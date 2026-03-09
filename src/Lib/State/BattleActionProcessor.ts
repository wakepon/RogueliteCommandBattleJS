import { GameState } from '../Types/Game'
import { RunState } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { BattleCommand, BattleState } from '../Types/Battle'
import { RelicInstance } from '../Types/Relic'
import { battleReducer, BattleAction } from './BattleReducer'
import { isSpell, isWeapon, isWeaponInstance, isPotion } from '../Core/CommandValidator'
import { calculateWeaponDamage, calculateSpellDamage } from '../Core/DamageCalculator'
import { addExpAndProcessLevelUp, LevelUpInfo } from '../Core/LevelUpCalculator'
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

  const isWeaponAttack = isWeapon(selectedCommand)

  const targetEnemy = state.battleState.enemies.find(e => e.instanceId === selectedTargetId)
  if (!targetEnemy) return state

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

  // スペルの効果を適用（ヒールなど）
  if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'heal') {
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + selectedCommand.effect.value, finalExplorer.maxHp),
    }
  }

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

  if (defeatedCount > 0) {
    const levelUpResult = addExpAndProcessLevelUp(finalExplorer, defeatedCount)
    finalExplorer = levelUpResult.updatedExplorer
    newLevelUps = levelUpResult.levelUps

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatePartyMember(state.run, finalExplorer),
      gold: updatedGold,
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

  if (defeatedCount > 0) {
    const levelUpResult = addExpAndProcessLevelUp(finalExplorer, defeatedCount)
    finalExplorer = levelUpResult.updatedExplorer
    newLevelUps = levelUpResult.levelUps

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatePartyMember(state.run, finalExplorer),
      gold: updatedGold,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
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
    return executePotionCommand(state, battleAction, relics)
  }

  return executeAttackCommand(state, battleAction, relics)
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
  if (state.battleState.relicState.shieldActive) {
    actualDamage = 0
    newBattleState = battleReducer(state.battleState, {
      type: 'UPDATE_RELIC_STATE',
      relicState: { shieldActive: false },
    })
  }

  newBattleState = battleReducer(newBattleState, {
    ...battleAction,
    damage: actualDamage,
  })

  const updatedExplorer = {
    ...battleAction.explorer,
    hp: Math.max(0, battleAction.explorer.hp - actualDamage),
  }

  let newRun = updatePartyMember(state.run, updatedExplorer)

  // 反撃の棘: 被攻撃時に敵にダメージ
  const thornsDmg = getThornsDamage(relics)
  if (thornsDmg > 0) {
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

  // 再生のコケ: ターン終了時にHP回復
  let finalExplorer = battleAction.updatedExplorer
  const regenAmount = getRegenPerTurn(state.run.relics)
  if (regenAmount > 0) {
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + regenAmount, finalExplorer.maxHp),
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: updatePartyMember(state.run, finalExplorer),
  }
}
