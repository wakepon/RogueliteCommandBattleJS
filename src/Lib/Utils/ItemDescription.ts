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
  includeConditionalRelics?: boolean
  party?: ExplorerState[]
  brokenWeaponCount?: number
  explorerIndex?: number
}

/** DamageContextからDamagePredictOptionsへ変換 */
function toPredictOptions(context: DamageContext): DamagePredictOptions {
  return {
    relics: context.relics,
    includeConditionalRelics: context.includeConditionalRelics,
    party: context.party,
    brokenWeaponCount: context.brokenWeaponCount,
    explorerIndex: context.explorerIndex,
  }
}

/** パッシブ効果の説明を生成 */
export function getPassiveEffectDescription(effect: PassiveEffectType): string {
  switch (effect.type) {
    // デメリット変換
    case 'hpCostPowerBoost':
      return `HP消費武器/魔法使用時Power+${effect.powerBonus}`
    case 'vulnerabilityPowerBoost':
      return `被ダメ増加中Power+${effect.powerBonus}`
    case 'mpSpendShield':
      return `MP${effect.mpThreshold}以上消費時シールド${effect.shieldValue}付与`
    // 条件付きバフ
    case 'knifeUseDurabilityRestore':
      return `ナイフ${effect.usesRequired}回使用で耐久+${effect.restoreAmount}`
    case 'killMpRecover':
      return `敵撃破時MP${effect.value}回復`
    case 'frontRowIntBonus':
      return `前衛時INT+${effect.value}`
    case 'backRowStrBonus':
      return `後衛時STR+${effect.value}`
    case 'shieldTaunt':
      return `シールド付与時被ターゲット率+${effect.value}%`
    case 'comboAttackBonus':
      return `同ターン${effect.requiredCount}人以上攻撃でPower+${effect.powerBonus}`
    case 'levelUpStatBoost':
      return `レベルアップ時STR+${effect.strBonus}/INT+${effect.intBonus}`
    case 'brokenWeaponStatBonus':
      return `壊れた武器1本につきSTR+${effect.strPerWeapon}`
    // リソース変換
    case 'damageTakenToMp':
      return `被弾時にMP${effect.value}回復`
    case 'battleStartHpReduction':
      return `戦闘開始時HP${Math.floor(effect.rate * 100)}%化、STR+${effect.strBonus}`
    case 'deathProtection':
      return '致死ダメージでHP1で耐える（1ランに1回消滅）'
    // シンプルバフ
    case 'regenPerTurn':
      return `毎ターンHP${effect.value}回復`
    case 'weaponDurabilitySave':
      return `武器使用時、${Math.floor(effect.chance * 100)}%の確率で耐久値を消費しない`
    case 'battleEndBonusExp':
      return `戦闘後に全員経験値+${effect.expValue}`
    case 'thornsStackBonus':
      return `棘スタック+${effect.value}`
    case 'potionEffectMultiplier':
      return `ポーション効果${effect.multiplier}倍`
    case 'potionSlotBonus':
      return `ポーション所持上限+${effect.value}`
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
      if (weapon.effect.type === 'selfHpConditional') {
        desc += ` | 失HP×${weapon.effect.coefficient}Power加算`
      }
      if (weapon.effect.type === 'targetHpConditional') {
        desc += ` | 敵失HP×${weapon.effect.coefficient}Power加算`
      }
      if (weapon.effect.type === 'shield') {
        desc += ` | シールド${weapon.effect.value}付与`
      }
      if (weapon.effect.type === 'hpPercentDamage') {
        desc += ` | 最大HP${Math.floor(weapon.effect.rate * 100)}%のダメージ`
      }
      if (weapon.effect.type === 'followUp') {
        desc += ` | 先行攻撃数×${weapon.effect.coefficient}Power加算`
      }
      if (weapon.effect.type === 'levelScale') {
        desc += ' | Lv分Power加算'
      }
      if (weapon.effect.type === 'combatStrGain') {
        desc += ` | 使用後STR+${weapon.effect.value}(戦闘中)`
      }
      if (weapon.effect.type === 'lifestealPercent') {
        desc += ` | ダメージの${Math.floor(weapon.effect.rate * 100)}%HP回復`
      }
      if (weapon.effect.type === 'manaSteal') {
        desc += ` | ダメージの${Math.floor(weapon.effect.rate * 100)}%MP回復`
      }
      if (weapon.effect.type === 'thornsShield') {
        desc += ` | シールド${weapon.effect.shieldValue}+棘${weapon.effect.thornStacks}スタック`
      }
      if (weapon.effect.type === 'aoe') {
        desc += ' | 全体攻撃'
      }
      if (weapon.effect.type === 'currentHpDamage') {
        desc += ' | 現在HP-1のダメージ（HPが1になる）'
      }
      if (weapon.effect.type === 'shieldBash') {
        desc += ' | 自身のシールド値をダメージに加算（シールド消費）'
      }
      if (weapon.effect.type === 'selfVulnerability') {
        desc += ` | 使用後${weapon.effect.duration}T被ダメ×${weapon.effect.multiplier}`
      }
      if (weapon.effect.type === 'killBonusExpToAll') {
        desc += ` | トドメ時に全員へ+${weapon.effect.expAmount}EXP`
      }
    }
    if ('hpCost' in weapon && weapon.hpCost) {
      desc += ` | HP${weapon.hpCost}消費`
    }
    if ('targetType' in weapon && weapon.targetType === 'enemyRandom') {
      const hitCount = 'hits' in weapon && weapon.hits ? weapon.hits : 3
      desc += ` | ランダムな敵に攻撃（${hitCount}回）`
    }
    return desc
  }

  // 魔法
  if ('commandCategory' in item && item.commandCategory === 'spell') {
    const spell = item as SpellData
    let desc: string
    if (spell.mpCostRate !== undefined && spell.mpCostRate > 0) {
      desc = spell.mpCostRate >= 1.0
        ? `MP: 全消費`
        : `MP: 最大${Math.floor(spell.mpCostRate * 100)}%消費`
    } else {
      desc = `MP: ${spell.mpCost}`
    }
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
      } else if (spell.effect.type === 'buff') {
        desc += spell.effect.stat === 'precision' ? ' | 攻撃時のダメージブレを0にする' : ` | STR +${spell.effect.value}`
      } else if (spell.effect.type === 'shield') {
        desc += ` | シールド${spell.effect.value}付与`
      } else if (spell.effect.type === 'repairWeapons') {
        desc += ` | 武器耐久+${spell.effect.value}回復`
      } else if (spell.effect.type === 'weaponPowerBuff') {
        desc += ` | 次の武器攻撃Power+${spell.effect.value}`
      } else if (spell.effect.type === 'killBonusExpToAll') {
        desc += ` | トドメ時に全員へ+${spell.effect.expAmount}EXP`
      } else if (spell.effect.type === 'targetRateUp') {
        desc += ` | 被ターゲット率UP(${spell.effect.value}%)`
      } else if (spell.effect.type === 'mpPercentShield') {
        desc += ` | 最大MP${Math.floor(spell.effect.rate * 100)}%のシールド付与`
      } else if (spell.effect.type === 'mpAllDamage') {
        desc += ' | 現在MP全量をダメージに変換'
      } else if (spell.effect.type === 'thorns') {
        desc += ` | 棘${spell.effect.value}スタック付与（被弾時反射、ターン終了リセット）`
      }
    }
    if (spell.hpCost) {
      desc += ` | HP${spell.hpCost}消費`
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
    if (potion.effect.type === 'taunt') {
      return '1ターン被弾率100%（挑発）'
    }
    if (potion.effect.type === 'statBoost') {
      return `1ターンSTR+${potion.effect.strValue} / INT+${potion.effect.intValue}`
    }
    if (potion.effect.type === 'damageReduction') {
      return `1ターン被ダメージ${Math.floor(potion.effect.rate * 100)}%カット`
    }
    if (potion.effect.type === 'aoeConvert') {
      return '次の1回の単体攻撃を全体攻撃化'
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
      } else if (weapon.effect.type === 'selfHpConditional') {
        parts.push(`失ったHP割合×${weapon.effect.coefficient}をPower加算`)
      } else if (weapon.effect.type === 'targetHpConditional') {
        parts.push(`敵が失ったHP割合×${weapon.effect.coefficient}をPower加算`)
      } else if (weapon.effect.type === 'shield') {
        parts.push(`シールド${weapon.effect.value}付与`)
      } else if (weapon.effect.type === 'hpPercentDamage') {
        parts.push(`最大HP${Math.floor(weapon.effect.rate * 100)}%のダメージ`)
      } else if (weapon.effect.type === 'followUp') {
        parts.push(`先行攻撃回数×${weapon.effect.coefficient}をPower加算`)
      } else if (weapon.effect.type === 'levelScale') {
        parts.push('Lv分Power加算')
      } else if (weapon.effect.type === 'combatStrGain') {
        parts.push(`使用後STR+${weapon.effect.value}(戦闘中)`)
      } else if (weapon.effect.type === 'lifestealPercent') {
        parts.push(`ダメージの${Math.floor(weapon.effect.rate * 100)}%HP回復`)
      } else if (weapon.effect.type === 'manaSteal') {
        parts.push(`ダメージの${Math.floor(weapon.effect.rate * 100)}%MP回復`)
      } else if (weapon.effect.type === 'thornsShield') {
        parts.push(`シールド${weapon.effect.shieldValue}+棘${weapon.effect.thornStacks}スタック`)
      } else if (weapon.effect.type === 'aoe') {
        parts.push('全体攻撃')
      } else if (weapon.effect.type === 'currentHpDamage') {
        parts.push('現在HP-1のダメージ（HPが1になる）')
      } else if (weapon.effect.type === 'shieldBash') {
        parts.push('シールド値をダメージに加算（シールド消費）')
      } else if (weapon.effect.type === 'selfVulnerability') {
        parts.push(`使用後${weapon.effect.duration}T被ダメ×${weapon.effect.multiplier}`)
      } else if (weapon.effect.type === 'killBonusExpToAll') {
        parts.push(`トドメ時に全員へ+${weapon.effect.expAmount}EXP`)
      }
    }
    if ('hpCost' in weapon && weapon.hpCost) {
      parts.push(`HP${weapon.hpCost}消費`)
    }
    if ('targetType' in weapon && weapon.targetType === 'enemyRandom') {
      const hitCount = 'hits' in weapon && weapon.hits ? weapon.hits : 3
      parts.push(`ランダムな敵に攻撃（${hitCount}回）`)
    }
    return parts.join(' / ')
  }

  // 魔法
  if ('commandCategory' in item && item.commandCategory === 'spell') {
    const spell = item as SpellData
    if (!spell.effect) {
      // 効果なしでもhpCostがあれば表示（反動魔法）
      if (spell.hpCost) return `HP${spell.hpCost}消費`
      return ''
    }
    switch (spell.effect.type) {
      case 'heal':
        return `HP+${spell.effect.value}回復`
      case 'buff':
        return spell.effect.stat === 'precision' ? '攻撃時のダメージブレを0にする' : `STR+${spell.effect.value}`
      case 'shield':
        return `シールド${spell.effect.value}付与`
      case 'repairWeapons':
        return `武器耐久+${spell.effect.value}回復`
      case 'weaponPowerBuff':
        return `次の武器攻撃Power+${spell.effect.value}`
      case 'killBonusExpToAll':
        return `トドメ時に全員へ+${spell.effect.expAmount}EXP`
      case 'targetRateUp':
        return `被ターゲット率UP(${spell.effect.value}%)`
      case 'mpPercentShield':
        return `最大MP${Math.floor(spell.effect.rate * 100)}%のシールド付与`
      case 'mpAllDamage':
        return '現在MP全量をダメージに変換'
      case 'thorns':
        return `棘${spell.effect.value}スタック付与（被弾時反射、ターン終了リセット）`
      case 'followUp':
        return `先行攻撃回数×${spell.effect.coefficient}をPower加算`
      case 'targetHpConditional':
        return `敵が失ったHP割合×${spell.effect.coefficient}をPower加算`
      case 'lowMpConditional':
        return `消費済みMP割合×${spell.effect.coefficient}をPower加算`
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
    if (potion.effect.type === 'taunt') return '1ターン被弾率100%（挑発）'
    if (potion.effect.type === 'statBoost') return `1ターンSTR+${potion.effect.strValue}/INT+${potion.effect.intValue}`
    if (potion.effect.type === 'damageReduction') return `1ターン被ダメ${Math.floor(potion.effect.rate * 100)}%カット`
    if (potion.effect.type === 'aoeConvert') return '次の単体攻撃を全体化'
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
      if (command.effect.type === 'selfHpConditional') {
        desc += ` 失HP×${command.effect.coefficient}P加算`
      }
      if (command.effect.type === 'targetHpConditional') {
        desc += ` 敵失HP×${command.effect.coefficient}P加算`
      }
      if (command.effect.type === 'selfVulnerability') {
        desc += ` ${command.effect.duration}T被ダメ×${command.effect.multiplier}`
      }
      if (command.effect.type === 'killBonusExpToAll') {
        desc += ` 全員+${command.effect.expAmount}EXP`
      }
    }
    if ('hpCost' in command && command.hpCost) {
      desc += ` HP${command.hpCost}消費`
    }
    if ('targetType' in command && command.targetType === 'enemyRandom') {
      const hitCount = 'hits' in command && command.hits ? command.hits : 3
      desc += ` ランダム(${hitCount}回)`
    }
    if ('targetType' in command && command.targetType === 'allyAll') {
      desc += ' 味方全体'
    }
    return desc
  }
  if (isSpell(command)) {
    let desc: string
    if (command.mpCostRate !== undefined && command.mpCostRate > 0) {
      desc = command.mpCostRate >= 1.0
        ? `「魔法」${command.name} - MP:全消費`
        : `「魔法」${command.name} - MP:最大${Math.floor(command.mpCostRate * 100)}%`
    } else {
      desc = `「魔法」${command.name} - MP:${command.mpCost}`
    }
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
      } else if (command.effect.type === 'buff') {
        desc += command.effect.stat === 'precision' ? ' 精密付与' : ` STR+${command.effect.value}`
      } else if (command.effect.type === 'shield') {
        desc += ` シールド${command.effect.value}`
      } else if (command.effect.type === 'repairWeapons') {
        desc += ` 耐久+${command.effect.value}`
      } else if (command.effect.type === 'weaponPowerBuff') {
        desc += ` 次武器P+${command.effect.value}`
      } else if (command.effect.type === 'killBonusExpToAll') {
        desc += ` 全員+${command.effect.expAmount}EXP`
      } else if (command.effect.type === 'targetRateUp') {
        desc += ` 被弾率+${command.effect.value}%`
      } else if (command.effect.type === 'mpPercentShield') {
        desc += ` 最大MP${Math.floor(command.effect.rate * 100)}%シールド`
      } else if (command.effect.type === 'mpAllDamage') {
        desc += ' 現在MP→ダメージ'
      } else if (command.effect.type === 'thorns') {
        desc += ` 棘${command.effect.value}スタック`
      }
    }
    if ('hpCost' in command && command.hpCost) {
      desc += ` HP${command.hpCost}消費`
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
    if (command.effect.type === 'taunt') {
      return `「ポーション」${command.name} - 1ターン被弾率100%`
    }
    if (command.effect.type === 'statBoost') {
      return `「ポーション」${command.name} - STR+${command.effect.strValue}/INT+${command.effect.intValue} (1ターン)`
    }
    if (command.effect.type === 'damageReduction') {
      return `「ポーション」${command.name} - 被ダメ${Math.floor(command.effect.rate * 100)}%カット (1ターン)`
    }
    if (command.effect.type === 'aoeConvert') {
      return `「ポーション」${command.name} - 次の単体攻撃を全体化`
    }
  }
  return command.name
}
