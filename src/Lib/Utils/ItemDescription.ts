import { WeaponData, ExplorerWeapon } from '../Types/Weapon'
import { SpellData } from '../Types/Spell'
import { RelicData, RelicInstance } from '../Types/Relic'
import { PotionData } from '../Types/Potion'
import { PassiveEffectType } from '../Types/Passive'
import { BattleCommand } from '../Types/Battle'
import { ExplorerState } from '../Types/Explorer'
import { isWeapon, isSpell, isPotion } from '../Core/CommandValidator'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange, type DamagePredictOptions } from './DamagePredictor'

type ItemType = WeaponData | SpellData | RelicData | PotionData | ExplorerWeapon

/** ダメージ予測表示用コンテキスト */
export interface DamageContext {
  explorer: ExplorerState
  relics: RelicInstance[]
  killStreakActive?: boolean
  includeConditionalRelics?: boolean
}

/** DamageContextからDamagePredictOptionsへ変換 */
function toPredictOptions(context: DamageContext): DamagePredictOptions {
  return {
    relics: context.relics,
    killStreakActive: context.killStreakActive,
    includeConditionalRelics: context.includeConditionalRelics,
  }
}

/** パッシブ効果の説明を生成 */
export function getPassiveEffectDescription(effect: PassiveEffectType): string {
  switch (effect.type) {
    case 'statBonus': {
      const statName = effect.stat === 'str' ? 'STR' : effect.stat === 'int' ? 'INT' : 'AGI'
      return `${statName} +${effect.value}`
    }
    case 'weaponDamageBonus':
      return `武器ダメージ +${effect.value}`
    case 'interestCap':
      return `利子上限 ${effect.value}G`
    case 'lowHpDamageMultiplier':
      return `HP${Math.floor(effect.hpThreshold * 100)}%以下でダメージx${effect.multiplier}`
    case 'firstHitShield':
      return '最初の一撃を無効化（バトルごとに1回）'
    case 'weaponDurabilitySave':
      return `武器使用時、${Math.floor(effect.chance * 100)}%の確率で耐久値を消費しない`
    case 'weaponAttackMpRecover':
      return `武器攻撃時MP${effect.value}回復（パンチ除く）`
    case 'killStreakBonus':
      return `武器で敵を倒すと次の武器攻撃${effect.multiplier}倍`
    case 'lastStrikeDamageMultiplier':
      return `武器が壊れる直前の一振りはダメージ${effect.multiplier}倍`
    case 'lowMpDamageBonus':
      return `MP半分以下で魔法ダメージ+${Math.floor((effect.multiplier - 1) * 100)}%`
    case 'thornsDamage':
      return `被弾時に敵に${effect.value}ダメージ`
    case 'regenPerTurn':
      return `毎ターンHP${effect.value}回復`
    case 'potionEffectMultiplier':
      return `ポーション効果${effect.multiplier}倍`
  }
}

/** アイテムの説明を生成 */
export function getItemDescription(item: ItemType, context?: DamageContext): string {
  // 武器
  if ('commandCategory' in item && item.commandCategory === 'weapon') {
    const weapon = item as WeaponData | ExplorerWeapon
    let desc: string
    if (context) {
      const range = predictWeaponDamage(context.explorer, weapon, toPredictOptions(context))
      desc = `ダメージ: ${formatDamageRange(range)}`
    } else {
      desc = `威力: ${weapon.power}`
    }
    if (weapon.maxUses !== null) {
      desc += ` | 使用回数: ${weapon.maxUses}`
    }
    if ('effect' in weapon && weapon.effect) {
      if (weapon.effect.type === 'lifesteal') {
        desc += ` | 吸血: ${weapon.effect.value}`
      }
    }
    return desc
  }

  // 魔法
  if ('commandCategory' in item && item.commandCategory === 'spell') {
    const spell = item as SpellData
    let desc = `MP: ${spell.mpCost}`
    if (spell.power > 0) {
      if (context) {
        const range = predictSpellDamage(context.explorer, spell, toPredictOptions(context))
        desc += ` | ダメージ: ${formatDamageRange(range)}`
      } else {
        desc += ` | 威力: ${spell.power}`
      }
    }
    if (spell.effect) {
      if (spell.effect.type === 'heal') {
        desc += ` | 回復: ${spell.effect.value}`
      } else if (spell.effect.type === 'steal') {
        desc += ' | ゴールドを盗む'
      } else if (spell.effect.type === 'buff') {
        desc += ` | STR +${spell.effect.value}`
      }
    }
    return desc
  }

  // ポーション
  if ('commandCategory' in item && item.commandCategory === 'potion') {
    const potion = item as PotionData
    if (potion.effect.type === 'healHp') {
      return `HP +${potion.effect.value} 回復`
    }
    if (potion.effect.type === 'healMp') {
      return `MP +${potion.effect.value} 回復`
    }
    return ''
  }

  // レリック
  if ('passiveEffect' in item) {
    const relic = item as RelicData
    return getPassiveEffectDescription(relic.passiveEffect)
  }

  return ''
}

/** アイテムのカテゴリ表示 */
export function getItemCategory(item: ItemType): string {
  if ('commandCategory' in item) {
    switch (item.commandCategory) {
      case 'weapon':
        return '武器'
      case 'spell':
        return '魔法'
      case 'potion':
        return 'ポーション'
    }
  }
  if ('passiveEffect' in item) {
    return 'レリック'
  }
  return ''
}

/** アイテムのツールチップ文字列を生成 */
export function getItemTooltip(item: ItemType, context?: DamageContext): string {
  const category = getItemCategory(item)
  const description = getItemDescription(item, context)
  return `「${category}」${item.name} - ${description}`
}

/** BattleCommand用のツールチップ文字列を生成 */
export function getCommandTooltip(command: BattleCommand, context?: DamageContext): string {
  if (isWeapon(command)) {
    let desc: string
    if (context) {
      const range = predictWeaponDamage(context.explorer, command, toPredictOptions(context))
      desc = `「武器」${command.name} - ダメージ:${formatDamageRange(range)}`
    } else {
      desc = `「武器」${command.name} - 威力:${command.power}`
    }
    if (command.currentUses !== null) {
      desc += ` 使用:${command.currentUses}/${command.maxUses}`
    }
    if ('effect' in command && command.effect) {
      if (command.effect.type === 'lifesteal') {
        desc += ` 吸血:${command.effect.value}`
      }
    }
    return desc
  }
  if (isSpell(command)) {
    let desc = `「魔法」${command.name} - MP:${command.mpCost}`
    if (command.power > 0) {
      if (context) {
        const range = predictSpellDamage(context.explorer, command, toPredictOptions(context))
        desc += ` ダメージ:${formatDamageRange(range)}`
      } else {
        desc += ` 威力:${command.power}`
      }
    }
    if (command.effect) {
      if (command.effect.type === 'heal') {
        desc += ` 回復:${command.effect.value}`
      } else if (command.effect.type === 'steal') {
        desc += ' ゴールドを盗む'
      } else if (command.effect.type === 'buff') {
        desc += ` STR+${command.effect.value}`
      }
    }
    return desc
  }
  if (isPotion(command)) {
    if (command.effect.type === 'healHp') {
      return `「ポーション」${command.name} - HP +${command.effect.value} 回復`
    }
    if (command.effect.type === 'healMp') {
      return `「ポーション」${command.name} - MP +${command.effect.value} 回復`
    }
  }
  return command.name
}
