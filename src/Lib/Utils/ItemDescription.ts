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
  party?: ExplorerState[]  // 番狂わせの一撃用: パーティ全体のレベル比較
}

/** DamageContextからDamagePredictOptionsへ変換 */
function toPredictOptions(context: DamageContext): DamagePredictOptions {
  return {
    relics: context.relics,
    killStreakActive: context.killStreakActive,
    includeConditionalRelics: context.includeConditionalRelics,
    party: context.party,
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
    case 'battleStartHpReduction':
      return `戦闘開始時HP${Math.floor(effect.rate * 100)}%化、STR+${effect.strBonus}`
    case 'damageTakenToMp':
      return `被ダメの${Math.floor(effect.rate * 100)}%をMP回復`
    case 'goldPerKill':
      return `敵撃破時+${effect.value}G`
    case 'weaponBreakDamageMultiplier':
      return `武器破壊ごとにダメージ+${Math.floor(effect.increment * 100)}%蓄積`
    case 'weaponBreakNextAttackBonus':
      return `武器破壊後、次の武器攻撃Power+${effect.value}`
    case 'levelUpDamageBoost':
      return `戦闘中レベルアップ時、そのキャラの次の行動ダメージ×${effect.multiplier}`
    case 'battleEndBonusExp':
      return `戦闘後に全員経験値+${effect.expValue}、獲得G-${effect.goldPenalty}`
    case 'lowestLevelDamageMultiplier':
      return `パーティで最もレベルが低いキャラのダメージ×${effect.multiplier}`
    case 'highHpTargetRateBonus':
      return `最もHPが多いキャラの被弾率+${effect.value}%`
    case 'deathProtection':
      return '致死ダメージでHP1で耐える（1ランに1回消滅）'
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
      if (weapon.effect.type === 'conditionalPower') {
        desc += ` | HP${Math.floor(weapon.effect.hpThreshold * 100)}%以下でPower+${weapon.effect.bonusPower}`
      }
      if (weapon.effect.type === 'shield') {
        desc += ` | シールド${weapon.effect.value}付与`
      }
      if (weapon.effect.type === 'killPreserveDurability') {
        desc += ' | トドメ時に耐久消費なし'
      }
    }
    if ('hpCost' in weapon && weapon.hpCost) {
      desc += ` | HP${weapon.hpCost}消費`
    }
    if ('goldCost' in weapon && weapon.goldCost) {
      desc += ` | ${weapon.goldCost}G消費/回`
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
      } else if (spell.effect.type === 'shield') {
        desc += ` | シールド${spell.effect.value}付与`
      } else if (spell.effect.type === 'hpToMp') {
        desc += ` | HP${spell.effect.hpCost}消費→MP${spell.effect.mpGain}回復`
      } else if (spell.effect.type === 'goldOnHit') {
        desc += ` | ヒット時+${spell.effect.value}G`
      } else if (spell.effect.type === 'goldDamage') {
        desc += ` | 所持金${Math.floor(spell.effect.rate * 100)}%消費→×${spell.effect.multiplier}ダメ`
      } else if (spell.effect.type === 'repairWeapons') {
        desc += ` | 武器耐久+${spell.effect.value}回復`
      } else if (spell.effect.type === 'weaponPowerBuff') {
        desc += ` | 次の武器攻撃Power+${spell.effect.value}`
      } else if (spell.effect.type === 'guidanceBuff') {
        desc += ' | 導き付与(次トドメで+1EXP)'
      } else if (spell.effect.type === 'killBonusExpToAll') {
        desc += ' | トドメ時に全員へボーナスEXP'
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
    if (potion.effect.type === 'repairWeapons') {
      return `全武器の耐久 +${potion.effect.value} 回復`
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

/**
 * 特殊効果のみを抽出した短い説明文を生成（商品カードでの一行表示用）
 * - ダメージ予測やMP/使用回数は呼び出し側で別表示するため含めない
 * - 効果がない場合は空文字を返す
 */
export function getItemSpecialEffect(item: ItemType): string {
  // 武器
  if ('commandCategory' in item && item.commandCategory === 'weapon') {
    const weapon = item as WeaponData | ExplorerWeapon
    const parts: string[] = []
    if ('effect' in weapon && weapon.effect) {
      if (weapon.effect.type === 'lifesteal') {
        parts.push(`ダメージを与えたときHP+${weapon.effect.value}回復`)
      } else if (weapon.effect.type === 'conditionalPower') {
        parts.push(`HP${Math.floor(weapon.effect.hpThreshold * 100)}%以下でPower+${weapon.effect.bonusPower}`)
      } else if (weapon.effect.type === 'shield') {
        parts.push(`シールド${weapon.effect.value}付与`)
      } else if (weapon.effect.type === 'killPreserveDurability') {
        parts.push('トドメ時に耐久消費なし')
      } else if (weapon.effect.type === 'targetRateUp') {
        parts.push(`対象の被弾率+${weapon.effect.value}%`)
      }
    }
    if ('hpCost' in weapon && weapon.hpCost) {
      parts.push(`HP${weapon.hpCost}消費`)
    }
    if ('goldCost' in weapon && weapon.goldCost) {
      parts.push(`${weapon.goldCost}G消費/回`)
    }
    return parts.join(' / ')
  }

  // 魔法
  if ('commandCategory' in item && item.commandCategory === 'spell') {
    const spell = item as SpellData
    if (!spell.effect) return ''
    switch (spell.effect.type) {
      case 'heal':
        return `HP+${spell.effect.value}回復`
      case 'steal':
        return 'ゴールドを盗む'
      case 'buff':
        return `STR+${spell.effect.value}`
      case 'shield':
        return `シールド${spell.effect.value}付与`
      case 'hpToMp':
        return `HP${spell.effect.hpCost}消費→MP${spell.effect.mpGain}回復`
      case 'goldOnHit':
        return `ヒット時+${spell.effect.value}G獲得`
      case 'goldDamage':
        return `所持金${Math.floor(spell.effect.rate * 100)}%消費→×${spell.effect.multiplier}ダメ`
      case 'repairWeapons':
        return `武器耐久+${spell.effect.value}回復`
      case 'weaponPowerBuff':
        return `次の武器攻撃Power+${spell.effect.value}`
      case 'guidanceBuff':
        return '導き付与（次トドメで+1EXP）'
      case 'killBonusExpToAll':
        return 'トドメ時に全員へボーナスEXP'
      default:
        return ''
    }
  }

  // ポーション
  if ('commandCategory' in item && item.commandCategory === 'potion') {
    const potion = item as PotionData
    if (potion.effect.type === 'healHp') return `HP+${potion.effect.value}回復`
    if (potion.effect.type === 'healMp') return `MP+${potion.effect.value}回復`
    if (potion.effect.type === 'repairWeapons') return `全武器耐久+${potion.effect.value}回復`
    return ''
  }

  // レリック
  if ('passiveEffect' in item) {
    return getPassiveEffectDescription((item as RelicData).passiveEffect)
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
      if (command.effect.type === 'conditionalPower') {
        desc += ` HP${Math.floor(command.effect.hpThreshold * 100)}%以下P+${command.effect.bonusPower}`
      }
    }
    if ('hpCost' in command && command.hpCost) {
      desc += ` HP${command.hpCost}消費`
    }
    if ('goldCost' in command && command.goldCost) {
      desc += ` ${command.goldCost}G/回`
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
      } else if (command.effect.type === 'shield') {
        desc += ` シールド${command.effect.value}`
      } else if (command.effect.type === 'hpToMp') {
        desc += ` HP${command.effect.hpCost}→MP${command.effect.mpGain}`
      } else if (command.effect.type === 'goldOnHit') {
        desc += ` +${command.effect.value}G`
      } else if (command.effect.type === 'goldDamage') {
        desc += ` 金${Math.floor(command.effect.rate * 100)}%→×${command.effect.multiplier}ダメ`
      } else if (command.effect.type === 'repairWeapons') {
        desc += ` 耐久+${command.effect.value}`
      } else if (command.effect.type === 'weaponPowerBuff') {
        desc += ` 次武器P+${command.effect.value}`
      } else if (command.effect.type === 'guidanceBuff') {
        desc += ' 導き付与'
      } else if (command.effect.type === 'killBonusExpToAll') {
        desc += ' 全員EXP+'
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
    if (command.effect.type === 'repairWeapons') {
      return `「ポーション」${command.name} - 全武器の耐久 +${command.effect.value} 回復`
    }
  }
  return command.name
}
