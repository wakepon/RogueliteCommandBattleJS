import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { PotionInstance } from '../Types/Potion'
import { BattleCommand } from '../Types/Battle'

/**
 * 武器が WeaponInstance かどうかを判定する型ガード
 */
export function isWeaponInstance(weapon: ExplorerWeapon): weapon is WeaponInstance {
  return 'price' in weapon
}

/**
 * コマンドが武器かどうかを判定する型ガード
 */
export function isWeapon(command: BattleCommand): command is ExplorerWeapon {
  return command.commandCategory === 'weapon'
}

/**
 * コマンドが魔法かどうかを判定する型ガード
 */
export function isSpell(command: BattleCommand): command is SpellInstance {
  return command.commandCategory === 'spell'
}

/**
 * コマンドがポーションかどうかを判定する型ガード
 */
export function isPotion(command: BattleCommand): command is PotionInstance {
  return command.commandCategory === 'potion'
}

/**
 * 武器が使用可能かどうかを判定する
 *
 * 判定条件:
 * - currentUses が null の場合は無制限（常に使用可能）
 * - currentUses > 0 の場合は使用可能
 * - currentHpDamage の場合は HP > 1 をチェック（HP1だとダメージ0のため）
 *
 * @param weapon - 判定対象の武器
 * @param explorer - 探索者の状態（HP依存武器の判定に必要）
 * @returns 使用可能な場合 true
 */
function isWeaponAvailable(weapon: ExplorerWeapon, explorer?: ExplorerState): boolean {
  // currentUses が null の場合は無制限（パンチなど）
  if (weapon.currentUses === null) {
    return true
  }

  // 使用回数が残っていない
  if (weapon.currentUses <= 0) {
    return false
  }

  // WeaponInstance の場合の追加チェック
  if (isWeaponInstance(weapon)) {
    // 捨て身の一撃: HP1だとダメージ0なので使用不可
    if (weapon.effect?.type === 'currentHpDamage' && explorer && explorer.hp <= 1) {
      return false
    }
  }

  return true
}

/**
 * 魔法が使用可能かどうかを判定する
 *
 * 判定条件:
 * - mpCostRate がある場合: rate >= 1.0 なら mp > 0、それ以外は mp >= floor(maxMp × rate)
 * - mpCostRate がない場合: explorer.mp >= spell.mpCost
 *
 * @param spell - 判定対象の魔法
 * @param explorer - 探索者の状態
 * @returns 使用可能な場合 true
 */
function isSpellAvailable(spell: SpellInstance, explorer: ExplorerState): boolean {
  if (spell.mpCostRate !== undefined && spell.mpCostRate > 0) {
    // 全MP消費型（rate >= 1.0）: MP残量があれば使用可能
    if (spell.mpCostRate >= 1.0) {
      return explorer.mp > 0
    }
    // 割合消費型: 最大MP×rate 以上のMPが必要
    return explorer.mp >= Math.floor(explorer.maxMp * spell.mpCostRate)
  }
  return explorer.mp >= spell.mpCost
}

/**
 * 使用可能なコマンド一覧を取得する
 *
 * @param explorer - 探索者の状態
 * @returns 使用可能なコマンドの配列
 */
export function getAvailableCommands(
  explorer: ExplorerState,
  potions: PotionInstance[] = []
): BattleCommand[] {
  const availableWeapons = explorer.weapons.filter(weapon =>
    isWeaponAvailable(weapon, explorer)
  )

  const availableSpells = explorer.spells.filter(spell =>
    isSpellAvailable(spell, explorer)
  )

  // 同名ポーションは重複排除して1つだけ返す（個数はUI側で計算）
  const uniquePotions = potions.filter((potion, index, arr) =>
    arr.findIndex(p => p.id === potion.id) === index
  )

  return [...availableWeapons, ...availableSpells, ...uniquePotions]
}
