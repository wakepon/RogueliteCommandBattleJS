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
 * - goldCost がある場合は gold >= goldCost をチェック
 *
 * @param weapon - 判定対象の武器
 * @param gold - 所持ゴールド
 * @returns 使用可能な場合 true
 */
function isWeaponAvailable(weapon: ExplorerWeapon, gold: number): boolean {
  // currentUses が null の場合は無制限（パンチなど）
  if (weapon.currentUses === null) {
    return true
  }

  // 使用回数が残っていない
  if (weapon.currentUses <= 0) {
    return false
  }

  // WeaponInstance の場合、goldCost をチェック
  if (isWeaponInstance(weapon)) {
    if (weapon.goldCost !== undefined && gold < weapon.goldCost) {
      return false
    }
  }

  return true
}

/**
 * 魔法が使用可能かどうかを判定する
 *
 * 判定条件:
 * - explorer.mp >= spell.mpCost
 *
 * @param spell - 判定対象の魔法
 * @param explorer - 探索者の状態
 * @returns 使用可能な場合 true
 */
function isSpellAvailable(spell: SpellInstance, explorer: ExplorerState): boolean {
  return explorer.mp >= spell.mpCost
}

/**
 * コマンド（武器または魔法）が使用可能かどうかを判定する
 *
 * @param command - 判定対象のコマンド（武器または魔法）
 * @param explorer - 探索者の状態
 * @param gold - 所持ゴールド（RunState から渡す）
 * @returns 使用可能な場合 true
 */
export function isCommandAvailable(
  command: BattleCommand,
  explorer: ExplorerState,
  gold: number
): boolean {
  if (isWeapon(command)) {
    return isWeaponAvailable(command, gold)
  }

  if (isSpell(command)) {
    return isSpellAvailable(command, explorer)
  }

  if (isPotion(command)) {
    // ポーションは所持していれば常に使用可能
    return true
  }

  // ここには到達しないはず
  return false
}

/**
 * 使用可能なコマンド一覧を取得する
 *
 * @param explorer - 探索者の状態
 * @param gold - 所持ゴールド（RunState から渡す）
 * @returns 使用可能なコマンドの配列
 */
export function getAvailableCommands(
  explorer: ExplorerState,
  gold: number,
  potions: PotionInstance[] = []
): BattleCommand[] {
  const availableWeapons = explorer.weapons.filter(weapon =>
    isWeaponAvailable(weapon, gold)
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
