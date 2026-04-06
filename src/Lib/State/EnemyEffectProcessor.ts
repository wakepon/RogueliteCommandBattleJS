import { BattleState } from '../Types/Battle'
import { Buff } from '../Types/Explorer'
import { createEnemyInstance } from './BattleStateFactory'

/** defenseバフによるダメージ軽減を適用 */
export function applyDefenseReduction(damage: number, buffs: Buff[]): number {
  const defenseBuff = buffs.find(b => b.type === 'defense')
  if (!defenseBuff) return damage
  return Math.floor(damage * (1.0 - defenseBuff.value / 100))
}

/** 敵にchargeバフを付与 */
export function applyChargeToEnemy(battleState: BattleState, enemyId: string): BattleState {
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId === enemyId) {
      const newBuff = { type: 'charge' as const, value: 2.0, duration: 'nextAction' as const }
      return { ...enemy, battleBuffs: [...enemy.battleBuffs, newBuff] }
    }
    return enemy
  })
  return { ...battleState, enemies: updatedEnemies }
}

/** 敵のchargeバフを消費（除去） */
export function consumeChargeFromEnemy(battleState: BattleState, enemyId: string): BattleState {
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId === enemyId) {
      return {
        ...enemy,
        battleBuffs: enemy.battleBuffs.filter(b => !(b.type === 'charge' && b.duration === 'nextAction')),
      }
    }
    return enemy
  })
  return { ...battleState, enemies: updatedEnemies }
}

/** 行動敵以外の全生存敵にchargeバフを付与 */
export function applyChargeToAllAllies(battleState: BattleState, actingEnemyId: string): BattleState {
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId !== actingEnemyId && enemy.currentHp > 0) {
      const alreadyCharged = enemy.battleBuffs.some(b => b.type === 'charge' && b.duration === 'nextAction')
      if (!alreadyCharged) {
        const newBuff = { type: 'charge' as const, value: 2.0, duration: 'nextAction' as const }
        return { ...enemy, battleBuffs: [...enemy.battleBuffs, newBuff] }
      }
    }
    return enemy
  })
  return { ...battleState, enemies: updatedEnemies }
}

/** 行動敵に防御バフを付与（既存のdefenseバフは上書き） */
export function applySelfDefenseBuff(
  battleState: BattleState,
  enemyId: string,
  value: number,
  duration: number
): BattleState {
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId === enemyId) {
      const filteredBuffs = enemy.battleBuffs.filter(b => b.type !== 'defense')
      const newBuff = { type: 'defense' as const, value, duration }
      return { ...enemy, battleBuffs: [...filteredBuffs, newBuff] }
    }
    return enemy
  })
  return { ...battleState, enemies: updatedEnemies }
}

/** 行動敵の自己回復 */
export function applyHealSelf(battleState: BattleState, enemyId: string, amount: number): BattleState {
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId === enemyId) {
      return { ...enemy, currentHp: Math.min(enemy.hp, enemy.currentHp + amount) }
    }
    return enemy
  })
  return { ...battleState, enemies: updatedEnemies }
}

/** 最もHP割合が低い生存敵（自身含む）を回復 */
export function applyHealAlly(battleState: BattleState, amount: number): BattleState {
  const aliveEnemies = battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) return battleState

  const mostInjured = aliveEnemies.reduce((a, b) =>
    (a.currentHp / a.hp) < (b.currentHp / b.hp) ? a : b
  )
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId === mostInjured.instanceId) {
      return { ...enemy, currentHp: Math.min(enemy.hp, enemy.currentHp + amount) }
    }
    return enemy
  })
  return { ...battleState, enemies: updatedEnemies }
}

/** 戦闘中に敵を追加（召喚） */
export function applySummonEnemy(
  battleState: BattleState,
  actingEnemyId: string,
  summonEnemyId: string
): BattleState {
  const newEnemy = createEnemyInstance(summonEnemyId)
  const updatedEnemies = battleState.enemies.map(enemy => {
    if (enemy.instanceId === actingEnemyId) {
      return { ...enemy, hasSummoned: true }
    }
    return enemy
  })
  return { ...battleState, enemies: [...updatedEnemies, newEnemy] }
}
