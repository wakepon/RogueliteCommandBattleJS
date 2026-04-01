import { GameState } from '../Types/Game'
import { RunState } from '../Types/Run'
import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { BattleCommand, BattleState } from '../Types/Battle'
import { SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { battleReducer, BattleAction, createPlayerDamagePopup } from './BattleReducer'
import { isSpell, isWeapon, isWeaponInstance, isPotion } from '../Core/CommandValidator'
import { calculateWeaponDamage, calculateSpellDamage } from '../Core/DamageCalculator'
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

  if (isWeaponAttack) {
    const result = calculateWeaponDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
      killStreakActive: state.battleState.relicState.killStreakActive,
    })
    calculatedDamage = result.damage
  } else if (isSpell(selectedCommand)) {
    const result = calculateSpellDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
    })
    calculatedDamage = result.damage
  } else {
    return state
  }

  // BattleReducerに事前計算済みダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamage,
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
  const calculatedDamages = aliveEnemies.map(enemy => {
    const result = calculateSpellDamage(battleAction.explorer, spell, enemy, {
      relics,
    })
    return { targetId: enemy.instanceId, damage: result.damage }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
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
  const calculatedDamages = aliveEnemies.map(enemy => {
    const result = calculateWeaponDamage(battleAction.explorer, weapon, enemy, {
      relics,
      killStreakActive: state.battleState!.relicState.killStreakActive,
    })
    return { targetId: enemy.instanceId, damage: result.damage }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
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
  let actualDamage = battleAction.damage

  // 壊れかけの鎧: shieldActive時にダメージ0化
  let newBattleState = state.battleState
  if (state.battleState.relicState.shieldActive && actualDamage > 0) {
    actualDamage = 0
    newBattleState = battleReducer(state.battleState, {
      type: 'UPDATE_RELIC_STATE',
      relicState: { shieldActive: false },
    })
  }

  // 力溜め付与: 敵にchargeバフを追加
  if (battleAction.applyCharge) {
    const updatedEnemies = newBattleState.enemies.map(enemy => {
      if (enemy.instanceId === battleAction.enemyId) {
        const newBuff = { type: 'charge' as const, value: 2.0, duration: 'nextAction' as const }
        return { ...enemy, battleBuffs: [...enemy.battleBuffs, newBuff] }
      }
      return enemy
    })
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_ENEMIES',
      enemies: updatedEnemies,
    })
  }

  // 力溜め消費: 敵のchargeバフを除去
  if (battleAction.consumeCharge) {
    const updatedEnemies = newBattleState.enemies.map(enemy => {
      if (enemy.instanceId === battleAction.enemyId) {
        return {
          ...enemy,
          battleBuffs: enemy.battleBuffs.filter(b => !(b.type === 'charge' && b.duration === 'nextAction')),
        }
      }
      return enemy
    })
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_ENEMIES',
      enemies: updatedEnemies,
    })
  }

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
    if (existingPoison) {
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

  let newRun = updatePartyMember(state.run, updatedExplorer)

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

  const newBattleState = battleReducer(state.battleState, battleAction)

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...state.run,
      party: battleAction.updatedParty,
    },
  }
}
