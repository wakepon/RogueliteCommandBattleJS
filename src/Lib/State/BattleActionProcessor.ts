import { GameState } from '../Types/Game'
import { RunState } from '../Types/Run'
import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { BattleCommand, BattleState } from '../Types/Battle'
import { SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { battleReducer, BattleAction, createPlayerDamagePopup } from './BattleReducer'
import {
  applyDefenseReduction,
  applyChargeToEnemy,
  consumeChargeFromEnemy,
  applyChargeToAllAllies,
  applySelfDefenseBuff,
  applyHealSelf,
  applyHealAlly,
  applySummonEnemy,
} from './EnemyEffectProcessor'
import { isSpell, isWeapon, isWeaponInstance, isPotion } from '../Core/CommandValidator'
import { calculateWeaponDamage, calculateSpellDamage } from '../Core/DamageCalculator'
import { consumeNextActionBuffs } from '../Core/BuffProcessor'
import { distributeExpToParty, LevelUpInfo } from '../Core/LevelUpCalculator'
import {
  getWeaponDurabilitySaveChance,
  getWeaponAttackMpRecover,
  getThornsDamage,
  getRegenPerTurn,
  getPotionEffectMultiplier,
  hasRelicEffect,
} from '../Core/RelicProcessor'

/** RunStateのpartyを更新 */
function updatePartyMember(run: RunState, updatedExplorer: ExplorerState): RunState {
  return {
    ...run,
    party: run.party.map(e =>
      e.id === updatedExplorer.id ? updatedExplorer : e
    ),
  }
}

/** 敵討伐数をカウント（今回倒した敵の数） */
function countDefeatedEnemies(
  previousEnemies: BattleState['enemies'],
  currentEnemies: BattleState['enemies']
): number {
  return currentEnemies.filter((enemy, index) => {
    const previousEnemy = previousEnemies[index]
    return enemy.currentHp <= 0 && previousEnemy && previousEnemy.currentHp > 0
  }).length
}

/** 武器の使用回数を減らす（レリック効果考慮） */
function consumeWeaponUse(
  weapon: ExplorerWeapon,
  durabilitySaveChance: number
): ExplorerWeapon {
  if (weapon.currentUses === null) {
    return weapon
  }

  // 武器お手入れ用油: 確率で耐久を温存
  if (durabilitySaveChance > 0 && Math.random() < durabilitySaveChance) {
    return weapon
  }

  return {
    ...weapon,
    currentUses: weapon.currentUses - 1,
  } as WeaponInstance
}

/** ExplorerStateのMP/武器使用回数を消費 */
function consumeCommandCost(
  explorer: ExplorerState,
  command: BattleCommand,
  gold: number,
  durabilitySaveChance: number
): { updatedExplorer: ExplorerState; updatedGold: number } {
  if (isWeapon(command)) {
    const updatedWeapons = explorer.weapons.map(w => {
      if (w.id === command.id) {
        return consumeWeaponUse(w, durabilitySaveChance)
      }
      return w
    })

    let newGold = gold
    if (isWeaponInstance(command) && command.goldCost !== undefined) {
      newGold = gold - command.goldCost
    }

    return {
      updatedExplorer: { ...explorer, weapons: updatedWeapons },
      updatedGold: newGold,
    }
  }

  if (isSpell(command)) {
    return {
      updatedExplorer: { ...explorer, mp: explorer.mp - command.mpCost },
      updatedGold: gold,
    }
  }

  return { updatedExplorer: explorer, updatedGold: gold }
}

/** レベルアップポップアップをバトルステートに追加 */
function addLevelUpPopupsToBattle(
  battleState: BattleState,
  levelUps: LevelUpInfo[]
): BattleState {
  if (levelUps.length === 0) {
    return battleState
  }
  return battleReducer(battleState, {
    type: 'ADD_LEVEL_UP_POPUP',
    levelUpInfo: levelUps[0],
  })
}

/** ポーションコマンドを実行 */
function executePotionCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand || !isPotion(selectedCommand)) return state

  const newBattleState = battleReducer(state.battleState, battleAction)
  const potionMultiplier = getPotionEffectMultiplier(relics)

  let updatedExplorer = battleAction.explorer
  const { effect } = selectedCommand
  if (effect.type === 'healHp') {
    const healAmount = Math.floor(effect.value * potionMultiplier)
    updatedExplorer = {
      ...updatedExplorer,
      hp: Math.min(updatedExplorer.hp + healAmount, updatedExplorer.maxHp),
    }
  } else if (effect.type === 'healMp') {
    const healAmount = Math.floor(effect.value * potionMultiplier)
    updatedExplorer = {
      ...updatedExplorer,
      mp: Math.min(updatedExplorer.mp + healAmount, updatedExplorer.maxMp),
    }
  }

  const potionIndex = state.run.potions.findIndex(p => p.id === selectedCommand.id)
  const updatedPotions = state.run.potions.filter((_, i) => i !== potionIndex)

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatePartyMember(state.run, updatedExplorer),
      potions: updatedPotions,
    },
  }
}

/** 攻撃コマンド（武器/魔法）を実行 */
function executeAttackCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand, selectedTargetId } = state.battleState
  if (!selectedCommand || !selectedTargetId) return state

  // enemyAll武器: 全敵にダメージ
  if (isWeapon(selectedCommand) && isWeaponInstance(selectedCommand) && selectedCommand.targetType === 'enemyAll') {
    return executeEnemyAllAttack(state, battleAction, relics, selectedCommand)
  }

  // enemyAll魔法: 全敵にダメージ
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'enemyAll') {
    return executeSpellAllAttack(state, battleAction, relics, selectedCommand)
  }

  const isWeaponAttack = isWeapon(selectedCommand)

  const targetEnemy = state.battleState.enemies.find(e => e.instanceId === selectedTargetId)
  if (!targetEnemy) return state

  // 空振り: ターゲットが既に倒されている場合、リソース消費なしでスキップ
  if (targetEnemy.currentHp <= 0) {
    const newBattleState = battleReducer(state.battleState, battleAction)
    return { ...state, battleState: newBattleState }
  }

  // ダメージ計算
  let calculatedDamage = 0
  let contributors: import('../Core/DamageCalculator').DamageContributor[] = []

  if (isWeaponAttack) {
    const result = calculateWeaponDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
      killStreakActive: state.battleState.relicState.killStreakActive,
    })
    calculatedDamage = result.damage
    contributors = result.contributors
  } else if (isSpell(selectedCommand)) {
    const result = calculateSpellDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
    })
    calculatedDamage = result.damage
    contributors = result.contributors
  } else {
    return state
  }

  // 敵のdefenseバフによるダメージ軽減
  const reducedDamage = applyDefenseReduction(calculatedDamage, targetEnemy.battleBuffs)
  if (reducedDamage !== calculatedDamage) {
    const defenseBuff = targetEnemy.battleBuffs.find(b => b.type === 'defense')!
    const reduction = defenseBuff.value / 100
    contributors.push({ name: 'ガード', label: `×${(1.0 - reduction).toFixed(1)}` })
    calculatedDamage = reducedDamage
  }

  // BattleReducerに事前計算済みダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamage,
    contributors,
  })

  // コスト消費
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  const { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
    battleAction.explorer, selectedCommand, state.run.gold, durabilitySaveChance
  )

  const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // 武器の lifesteal 効果
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'lifesteal') {
    const lifestealValue = selectedCommand.effect.value
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + lifestealValue, finalExplorer.maxHp),
    }
  }

  // ストレス発散: パンチ以外の武器攻撃後にMP回復
  if (isWeaponAttack) {
    const mpRecover = getWeaponAttackMpRecover(relics)
    if (mpRecover && (!mpRecover.excludeWeaponId || selectedCommand.id !== mpRecover.excludeWeaponId)) {
      finalExplorer = {
        ...finalExplorer,
        mp: Math.min(finalExplorer.mp + mpRecover.value, finalExplorer.maxMp),
      }
    }
  }

  // 血染めの手袋: killStreakActive を1度に決定
  if (isWeaponAttack) {
    const killedWithWeapon = defeatedCount > 0 && hasRelicEffect(relics, 'killStreakBonus')
    const nextKillStreakActive = killedWithWeapon
    if (nextKillStreakActive !== state.battleState.relicState.killStreakActive) {
      newBattleState = battleReducer(newBattleState, {
        type: 'UPDATE_RELIC_STATE',
        relicState: { killStreakActive: nextKillStreakActive },
      })
    }
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    gold: updatedGold,
  }

  if (defeatedCount > 0) {
    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** enemyAll魔法攻撃を実行 */
function executeSpellAllAttack(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[],
  spell: SpellData
): GameState {
  if (!state.battleState || !state.run) return state

  // 生存中の全敵に対してダメージ計算
  const aliveEnemies = state.battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) {
    return state
  }
  let allContributors: import('../Core/DamageCalculator').DamageContributor[] = []
  const calculatedDamages = aliveEnemies.map((enemy, i) => {
    const result = calculateSpellDamage(battleAction.explorer, spell, enemy, {
      relics,
    })
    if (i === 0) allContributors = result.contributors
    // defenseバフによる軽減
    const finalDamage = applyDefenseReduction(result.damage, enemy.battleBuffs)
    return { targetId: enemy.instanceId, damage: finalDamage }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
    contributors: allContributors,
  })

  // MP消費
  const { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
    battleAction.explorer, spell, state.run.gold, 0
  )

  const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // スペルの効果を適用（ヒールなど）
  if (spell.effect?.type === 'heal') {
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + spell.effect.value, finalExplorer.maxHp),
    }
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    gold: updatedGold,
  }

  if (defeatedCount > 0) {
    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** enemyAll武器攻撃を実行 */
function executeEnemyAllAttack(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[],
  weapon: WeaponInstance
): GameState {
  if (!state.battleState || !state.run) return state

  // 生存中の全敵に対してダメージ計算
  const aliveEnemies = state.battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) {
    return state
  }
  let allContributors: import('../Core/DamageCalculator').DamageContributor[] = []
  const calculatedDamages = aliveEnemies.map((enemy, i) => {
    const result = calculateWeaponDamage(battleAction.explorer, weapon, enemy, {
      relics,
      killStreakActive: state.battleState!.relicState.killStreakActive,
    })
    if (i === 0) allContributors = result.contributors
    // defenseバフによる軽減
    const finalDamage = applyDefenseReduction(result.damage, enemy.battleBuffs)
    return { targetId: enemy.instanceId, damage: finalDamage }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
    contributors: allContributors,
  })

  // コスト消費
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  const { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
    battleAction.explorer, weapon, state.run.gold, durabilitySaveChance
  )

  const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // 武器の lifesteal 効果（全体攻撃時は合計ダメージに対して1回）
  if (weapon.effect?.type === 'lifesteal') {
    const lifestealValue = weapon.effect.value
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + lifestealValue, finalExplorer.maxHp),
    }
  }

  // ストレス発散: パンチ以外の武器攻撃後にMP回復
  const mpRecover = getWeaponAttackMpRecover(relics)
  if (mpRecover && (!mpRecover.excludeWeaponId || weapon.id !== mpRecover.excludeWeaponId)) {
    finalExplorer = {
      ...finalExplorer,
      mp: Math.min(finalExplorer.mp + mpRecover.value, finalExplorer.maxMp),
    }
  }

  // 血染めの手袋: killStreakActive を1度に決定
  const killedWithWeapon = defeatedCount > 0 && hasRelicEffect(relics, 'killStreakBonus')
  const nextKillStreakActive = killedWithWeapon
  if (nextKillStreakActive !== state.battleState.relicState.killStreakActive) {
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_RELIC_STATE',
      relicState: { killStreakActive: nextKillStreakActive },
    })
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    gold: updatedGold,
  }

  if (defeatedCount > 0) {
    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** 味方対象スペル（ヒールなど）を実行 */
function executeAllySpellCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  _relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand || !isSpell(selectedCommand)) return state

  const newBattleState = battleReducer(state.battleState, battleAction)

  // MP消費（consumeCommandCostを使用して他パスと一貫性を保つ）
  const { updatedExplorer: explorerAfterCost } = consumeCommandCost(
    battleAction.explorer, selectedCommand, state.run.gold, 0
  )

  let updatedExplorer = explorerAfterCost

  if (selectedCommand.effect?.type === 'heal') {
    updatedExplorer = {
      ...updatedExplorer,
      hp: Math.min(updatedExplorer.hp + selectedCommand.effect.value, updatedExplorer.maxHp),
    }
  }

  // バフ効果（精密など）
  if (selectedCommand.effect?.type === 'buff') {
    const newBuff: Buff = {
      type: selectedCommand.effect.stat,
      value: selectedCommand.effect.value,
      duration: selectedCommand.effect.duration,
    }
    updatedExplorer = {
      ...updatedExplorer,
      battleBuffs: [...updatedExplorer.battleBuffs, newBuff],
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: updatePartyMember(state.run, updatedExplorer),
  }
}

/** 味方対象武器（祈りなど）を実行 */
function executeAllyWeaponCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand, selectedTargetId } = state.battleState
  if (!selectedCommand || !isWeapon(selectedCommand) || !selectedTargetId) return state

  const newBattleState = battleReducer(state.battleState, battleAction)

  // 祈り: 対象キャラにtargetRateUpバフを付与
  if (isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'targetRateUp') {
    const targetMember = state.run.party.find(e => e.id === selectedTargetId)
    if (targetMember) {
      const newBuff: Buff = {
        type: 'targetRateUp',
        value: selectedCommand.effect.value,
        duration: 1,  // 次の敵フェーズ終了時にクリア
      }
      const updatedMember = {
        ...targetMember,
        battleBuffs: [...targetMember.battleBuffs, newBuff],
      }
      return {
        ...state,
        battleState: newBattleState,
        run: updatePartyMember(state.run, updatedMember),
      }
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: state.run,
  }
}

/** EXECUTE_COMMANDを処理 */
export function processExecuteCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand) return state

  const relics = state.run.relics

  if (isPotion(selectedCommand)) {
    return applyRegenAfterAction(executePotionCommand(state, battleAction, relics))
  }

  // 味方対象スペル（ヒール、精密など）
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'allySingle') {
    return applyRegenAfterAction(executeAllySpellCommand(state, battleAction, relics))
  }

  // 味方対象武器（祈りなど）— 攻撃ではなくサポート行動
  if (isWeapon(selectedCommand) && selectedCommand.targetType === 'allySingle') {
    return applyRegenAfterAction(executeAllyWeaponCommand(state, battleAction))
  }

  return applyRegenAfterAction(executeAttackCommand(state, battleAction, relics))
}

/** 行動後に再生のコケの回復を適用（行動したキャラに適用） */
function applyRegenAfterAction(result: GameState, explorerId?: string): GameState {
  if (!result.run || !result.battleState) return result

  const regenAmount = getRegenPerTurn(result.run.relics)
  if (regenAmount <= 0) return result

  // 行動キャラを特定（指定がなければcommandSlotsから取得）
  const targetId = explorerId
    ?? result.battleState.commandSlots[result.battleState.currentCommandIndex]?.explorerId
    ?? result.run.party[0].id
  const explorer = result.run.party.find(e => e.id === targetId) ?? result.run.party[0]

  const healedHp = Math.min(explorer.hp + regenAmount, explorer.maxHp)
  const actualHeal = healedHp - explorer.hp
  if (actualHeal <= 0) return result

  const updatedExplorer = { ...explorer, hp: healedHp }
  return {
    ...result,
    run: updatePartyMember(result.run, updatedExplorer),
    battleState: {
      ...result.battleState,
      playerDamagePopups: [
        ...result.battleState.playerDamagePopups,
        createPlayerDamagePopup(-actualHeal, targetId),
      ],
    },
  }
}

/** ENEMY_ACTIONを処理 */
export function processEnemyAction(
  state: GameState,
  battleAction: BattleAction & { type: 'ENEMY_ACTION' }
): GameState {
  if (!state.battleState || !state.run) return state

  const relics = state.run.relics
  const hits = battleAction.hits ?? 1
  let perHitDamage = battleAction.damage

  // 壊れかけの鎧: shieldActive時に1hit目のみダメージ0化
  let newBattleState = state.battleState
  let shieldAbsorbed = false
  if (state.battleState.relicState.shieldActive && perHitDamage > 0) {
    shieldAbsorbed = true
    newBattleState = battleReducer(state.battleState, {
      type: 'UPDATE_RELIC_STATE',
      relicState: { shieldActive: false },
    })
  }

  // 合計ダメージ: シールドは1hit目のみ防ぐ
  const actualDamage = shieldAbsorbed
    ? perHitDamage * (hits - 1)
    : perHitDamage * hits

  // 敵エフェクトの適用（EnemyEffectProcessorのピュア関数で状態変換し、UPDATE_ENEMIESで反映）
  let effectState = newBattleState

  // 力溜め付与: 敵にchargeバフを追加
  if (battleAction.applyCharge) {
    effectState = applyChargeToEnemy(effectState, battleAction.enemyId)
  }

  // 力溜め消費: 敵のchargeバフを除去
  if (battleAction.consumeCharge) {
    effectState = consumeChargeFromEnemy(effectState, battleAction.enemyId)
  }

  // chargeAllAllies: 行動敵以外の全生存敵にchargeバフ付与
  if (battleAction.chargeAllAllies) {
    effectState = applyChargeToAllAllies(effectState, battleAction.enemyId)
  }

  // applySelfDefense: 行動敵に防御バフ付与（既存バフ上書き）
  if (battleAction.applySelfDefense) {
    const { value, duration } = battleAction.applySelfDefense
    effectState = applySelfDefenseBuff(effectState, battleAction.enemyId, value, duration)
  }

  // healSelf: 行動敵の自己回復
  if (battleAction.healSelf && battleAction.healSelf > 0) {
    effectState = applyHealSelf(effectState, battleAction.enemyId, battleAction.healSelf)
  }

  // healAlly: 最もHP割合が低い生存敵（自身含む）を回復
  if (battleAction.healAlly) {
    effectState = applyHealAlly(effectState, battleAction.healAlly.amount)
  }

  // summonEnemyId: 戦闘中に敵を追加
  if (battleAction.summonEnemyId) {
    effectState = applySummonEnemy(effectState, battleAction.enemyId, battleAction.summonEnemyId)
  }

  // エフェクト適用結果をbattleReducer経由で反映
  if (effectState.enemies !== newBattleState.enemies) {
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_ENEMIES',
      enemies: effectState.enemies,
    })
  }

  // ダメージ処理: isAoeの場合は全生存メンバーにダメージ
  let newRun = state.run
  if (battleAction.isAoe && actualDamage > 0) {
    // 全体攻撃: BattleReducerにポップアップ用のダメージを通知
    newBattleState = battleReducer(newBattleState, {
      ...battleAction,
      damage: actualDamage,
    })

    // 全生存パーティーメンバーにダメージ適用
    const aliveMembers = newRun.party.filter(m => m.hp > 0)
    for (const member of aliveMembers) {
      const updatedMember = {
        ...member,
        hp: Math.max(0, member.hp - actualDamage),
      }
      newRun = updatePartyMember(newRun, updatedMember)
    }

    // 全メンバー分のポップアップを追加
    const aoePopups = aliveMembers.map(m => createPlayerDamagePopup(actualDamage, m.id))
    newBattleState = {
      ...newBattleState,
      playerDamagePopups: [...newBattleState.playerDamagePopups, ...aoePopups],
    }
  } else {
    // 単体攻撃
    newBattleState = battleReducer(newBattleState, {
      ...battleAction,
      damage: actualDamage,
    })

    let updatedExplorer = {
      ...battleAction.explorer,
      hp: Math.max(0, battleAction.explorer.hp - actualDamage),
    }

    // 毒付与: プレイヤーのbattleDebuffsにpoisonを加算
    if (battleAction.poisonStacks > 0) {
      const existingPoison = updatedExplorer.battleDebuffs.find(d => d.type === 'poison')
      if (existingPoison && existingPoison.type === 'poison') {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: updatedExplorer.battleDebuffs.map(d =>
            d.type === 'poison'
              ? { ...d, stacks: d.stacks + battleAction.poisonStacks }
              : d
          ),
        }
      } else {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: [
            ...updatedExplorer.battleDebuffs,
            { type: 'poison' as const, stacks: battleAction.poisonStacks },
          ],
        }
      }
    }

    // MPドレイン: プレイヤーのmpを減少（最低0）
    if (battleAction.mpDrain > 0) {
      updatedExplorer = {
        ...updatedExplorer,
        mp: Math.max(0, updatedExplorer.mp - battleAction.mpDrain),
      }
    }

    // applyWeakness: プレイヤーに弱体デバフ付与
    if (battleAction.applyWeakness) {
      const { value, duration } = battleAction.applyWeakness
      const existingWeakness = updatedExplorer.battleDebuffs.find(d => d.type === 'weakness')
      if (existingWeakness) {
        // 既存の弱体を上書き（duration更新）
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: updatedExplorer.battleDebuffs.map(d =>
            d.type === 'weakness'
              ? { ...d, value, duration }
              : d
          ),
        }
      } else {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: [
            ...updatedExplorer.battleDebuffs,
            { type: 'weakness' as const, value, duration },
          ],
        }
      }
    }

    newRun = updatePartyMember(newRun, updatedExplorer)
  }

  // 反撃の棘: 被攻撃時に敵にダメージ（ダメージが発生した場合のみ）
  const thornsDmg = getThornsDamage(relics)
  if (thornsDmg > 0 && actualDamage > 0) {
    const attackingEnemy = newBattleState.enemies.find(
      e => e.instanceId === battleAction.enemyId
    )
    if (attackingEnemy && attackingEnemy.currentHp > 0) {
      const updatedEnemies = newBattleState.enemies.map(enemy => {
        if (enemy.instanceId === battleAction.enemyId) {
          return { ...enemy, currentHp: Math.max(0, enemy.currentHp - thornsDmg) }
        }
        return enemy
      })
      newBattleState = battleReducer(newBattleState, {
        type: 'UPDATE_ENEMIES',
        enemies: updatedEnemies,
      })
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: newRun,
  }
}

/** PROCESS_TURN_ENDを処理 */
export function processTurnEndAction(
  state: GameState,
  battleAction: BattleAction & { type: 'PROCESS_TURN_END' }
): GameState {
  if (!state.battleState || !state.run) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // 敵のバフ持続ターン減少（defenseバフ等）
  const updatedEnemies = newBattleState.enemies.map(enemy => {
    if (enemy.currentHp <= 0) return enemy
    const updatedBuffs = enemy.battleBuffs
      .map(b => {
        if (typeof b.duration === 'number') {
          return { ...b, duration: b.duration - 1 }
        }
        return b
      })
      .filter(b => {
        if (typeof b.duration === 'number' && b.duration <= 0) return false
        return true
      })
    return { ...enemy, battleBuffs: updatedBuffs }
  })
  newBattleState = battleReducer(newBattleState, {
    type: 'UPDATE_ENEMIES',
    enemies: updatedEnemies,
  })

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...state.run,
      party: battleAction.updatedParty,
    },
  }
}
