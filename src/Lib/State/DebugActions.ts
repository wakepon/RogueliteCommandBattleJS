import { ExplorerState } from '../Types/Explorer'
import { WeaponData, WeaponInstance } from '../Types/Weapon'
import { SpellData } from '../Types/Spell'
import { EnemyInstance } from '../Types/Enemy'
import { EnemyIntent } from '../Types/Battle'
import { canBuyWeapon, canBuySpell } from '../Core/StoreLogic'
import { createEnemyInstance, generateEnemyIntents } from './BattleStateFactory'

/**
 * デバッグ機能用のPure関数群。
 * DEV時のみ使用され、GameReducerのDEBUG_*アクションから呼ばれる。
 */

/** 武器枠に空きのある最初のメンバーに武器を追加。空きがなければnull */
export function grantWeaponToParty(
  party: ExplorerState[],
  item: WeaponData
): ExplorerState[] | null {
  const memberIndex = party.findIndex(canBuyWeapon)
  if (memberIndex < 0) return null

  const weaponInstance: WeaponInstance = {
    ...item,
    currentUses: item.maxUses === null ? null : item.maxUses,
    enhancements: [],
  }

  return party.map((m, i) =>
    i === memberIndex ? { ...m, weapons: [...m.weapons, weaponInstance] } : m
  )
}

/** 魔法枠に空きのある最初のメンバーに魔法を追加。空きがなければnull */
export function grantSpellToParty(
  party: ExplorerState[],
  item: SpellData
): ExplorerState[] | null {
  const memberIndex = party.findIndex(canBuySpell)
  if (memberIndex < 0) return null

  return party.map((m, i) =>
    i === memberIndex ? { ...m, spells: [...m.spells, { ...item, enhancements: [] }] } : m
  )
}

/** 敵マスターからフロア倍率適用済みのEnemyInstanceを生成（applySummonEnemyと同一ロジック） */
export function buildDebugEnemy(enemyId: string, hpMultiplier: number): EnemyInstance {
  const baseEnemy = createEnemyInstance(enemyId)
  if (hpMultiplier === 1.0) return baseEnemy
  return {
    ...baseEnemy,
    hp: Math.floor(baseEnemy.hp * hpMultiplier),
    currentHp: Math.floor(baseEnemy.currentHp * hpMultiplier),
  }
}

/** 指定インデックスの敵を差し替え */
export function replaceEnemyAt(
  enemies: EnemyInstance[],
  index: number,
  newEnemy: EnemyInstance
): EnemyInstance[] {
  return enemies.map((e, i) => (i === index ? newEnemy : e))
}

/**
 * 敵リスト変更後の行動予告を再構築する。
 * 既存の敵の予告は保持し、新規追加された敵のみ新しく生成する
 * （全再生成すると他の敵の予告内容が変わってしまうため）。
 */
export function rebuildEnemyIntents(
  existingIntents: EnemyIntent[],
  enemies: EnemyInstance[],
  party: ExplorerState[],
  damageMultiplier: number
): EnemyIntent[] {
  return enemies
    .filter(e => e.currentHp > 0 && !e.justSummoned)
    .map(enemy => {
      const existing = existingIntents.find(i => i.enemyInstanceId === enemy.instanceId)
      if (existing) return existing
      return generateEnemyIntents([enemy], party, damageMultiplier)[0]
    })
    .filter((intent): intent is EnemyIntent => intent !== undefined)
}
