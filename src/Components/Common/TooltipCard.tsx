import { ExplorerWeapon, WeaponData } from '../../Lib/Types/Weapon'
import { SpellData, SpellInstance } from '../../Lib/Types/Spell'
import { RelicData, RelicInstance } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { BattleCommand } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { getPassiveEffectDescription } from '../../Lib/Utils/ItemDescription'
import { MemberAttackImpact } from '../../Lib/Utils/RelicImpactCalculator'

type AnyItem = WeaponData | ExplorerWeapon | SpellData | SpellInstance | RelicData | RelicInstance | PotionData | BattleCommand

interface TooltipLine {
  label: string
  value: string
  color?: string
}

/** カード形式のTooltipコンテンツを生成 */
export function TooltipCard({ item, damageText, durabilityText, attackImpacts, explorer }: {
  item: AnyItem
  damageText?: string   // "5-9" 形式
  durabilityText?: string  // "3/5" 形式
  attackImpacts?: MemberAttackImpact[]  // レリック用: 各メンバーの最大攻撃力変化
  explorer?: ExplorerState  // 使用者（スケーリングシールドの付与値を実数で算出するため）
}) {
  const name = item.name
  const category = getCategory(item)
  const lines = buildLines(item, damageText, durabilityText, explorer)
  const isRelic = 'passiveEffect' in item
  const visibleImpacts = attackImpacts?.filter(i => i.status !== 'noWeapon') ?? []
  // 誰か1人でも攻撃力が変化するレリックのみ「最大攻撃力の変化」セクションを表示
  // (MP回復・利子上限など攻撃力に影響しないレリックではセクションごと非表示)
  const hasAnyAttackChange = visibleImpacts.some(i => i.status === 'changed')

  return (
    <div className="min-w-[120px] max-w-[220px]">
      {/* カテゴリ */}
      <div className="text-[9px] text-gray-400">{category}</div>
      {/* 名前 */}
      <div className="text-white font-bold text-xs mb-1">{name}</div>
      {/* 情報行 */}
      {lines.map((line, i) => (
        <div key={i} className="flex justify-between gap-3 text-[10px]">
          <span className="text-gray-400">{line.label}</span>
          <span className={line.color || 'text-gray-200'}>{line.value}</span>
        </div>
      ))}
      {/* レリック: 各メンバーの最大攻撃力変化 */}
      {isRelic && hasAnyAttackChange && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-600">
          <div className="text-[9px] text-gray-400 mb-0.5">最大攻撃力の変化</div>
          {visibleImpacts.map((imp, i) => (
            <div key={i} className="flex justify-between gap-3 text-[10px]">
              <span className="text-gray-300">{imp.memberName}</span>
              {imp.status === 'unchanged' ? (
                <span className="text-gray-500">変化なし</span>
              ) : (
                <span>
                  <span className="text-gray-200">{imp.before}→{imp.after}</span>
                  <span className="text-green-400 ml-1">(+{imp.after - imp.before})</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getCategory(item: AnyItem): string {
  if ('commandCategory' in item) {
    switch (item.commandCategory) {
      case 'weapon': return '武器'
      case 'spell': return '魔法'
      case 'potion': return 'ポーション'
    }
  }
  if ('passiveEffect' in item) return 'レリック'
  return ''
}

/**
 * スケーリングシールドの表示文字列を生成。
 * 使用者(explorer)が判明していれば付与値の実数を「シールド25(=5+STR×3)付与」の形で示し、
 * 不明な場合（ショップ等）は数式のみを表示する。
 */
function formatScalingShield(
  base: number,
  multiplier: number,
  statLabel: 'STR' | 'INT',
  statValue: number | undefined,
  suffix: string
): string {
  const formula = `${base}+${statLabel}×${multiplier}`
  if (statValue === undefined) return `シールド(${formula})${suffix}`
  const value = base + statValue * multiplier
  return `シールド${value}(=${formula})${suffix}`
}

function buildLines(item: AnyItem, damageText?: string, durabilityText?: string, explorer?: ExplorerState): TooltipLine[] {
  const lines: TooltipLine[] = []

  // 武器
  if ('commandCategory' in item && item.commandCategory === 'weapon') {
    const weapon = item as WeaponData | ExplorerWeapon
    // 無限使用武器（パンチ等）は依存ステ表示を省くための判定に使う
    const isSpellLike = weapon.maxUses === null
    if (damageText) {
      lines.push({ label: 'ダメージ', value: damageText, color: 'text-orange-300' })
    }
    if (isSpellLike) {
      lines.push({ label: '耐久値', value: '∞' })
    } else if (durabilityText) {
      lines.push({ label: '耐久値', value: durabilityText })
    } else if ('currentUses' in weapon && weapon.currentUses !== null) {
      lines.push({ label: '耐久値', value: `${weapon.currentUses}/${weapon.maxUses}` })
    } else if (weapon.maxUses !== null) {
      lines.push({ label: '使用回数', value: `${weapon.maxUses}` })
    } else {
      lines.push({ label: '耐久値', value: '∞' })
    }
    if ('effect' in weapon && weapon.effect) {
      if (weapon.effect.type === 'lifesteal') {
        lines.push({ label: '吸血', value: `${weapon.effect.value}HP`, color: 'text-green-300' })
      }
      if (weapon.effect.type === 'selfHpConditional') {
        lines.push({ label: '効果', value: `失HP×${weapon.effect.coefficient}P加算`, color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'targetHpConditional') {
        lines.push({ label: '効果', value: `敵失HP×${weapon.effect.coefficient}P加算`, color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'shield') {
        lines.push({ label: '効果', value: `シールド${weapon.effect.value}付与`, color: 'text-cyan-300' })
      }
      if (weapon.effect.type === 'hpPercentDamage') {
        lines.push({ label: '効果', value: `最大HP${Math.floor(weapon.effect.rate * 100)}%ダメージ`, color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'followUp') {
        lines.push({ label: '効果', value: `先行攻撃数×${weapon.effect.coefficient}P加算`, color: 'text-yellow-300' })
      }
      if (weapon.effect.type === 'levelScale') {
        lines.push({ label: '効果', value: 'Lv分Power加算', color: 'text-green-300' })
      }
      if (weapon.effect.type === 'combatStrGain') {
        lines.push({ label: '効果', value: `使用後STR+${weapon.effect.value}(戦闘中)`, color: 'text-green-300' })
      }
      if (weapon.effect.type === 'lifestealPercent') {
        lines.push({ label: '効果', value: `ダメージの${Math.floor(weapon.effect.rate * 100)}%HP回復`, color: 'text-green-300' })
      }
      if (weapon.effect.type === 'manaSteal') {
        lines.push({ label: '効果', value: `ダメージの${Math.floor(weapon.effect.rate * 100)}%MP回復`, color: 'text-blue-300' })
      }
      if (weapon.effect.type === 'scalingShield') {
        lines.push({ label: '効果', value: formatScalingShield(weapon.effect.base, weapon.effect.strMultiplier, 'STR', explorer?.str, '付与'), color: 'text-cyan-300' })
      }
      if (weapon.effect.type === 'thornsShield') {
        lines.push({ label: '効果', value: formatScalingShield(weapon.effect.shieldBase, weapon.effect.shieldStrMultiplier, 'STR', explorer?.str, `+棘${weapon.effect.thornStacks}`), color: 'text-cyan-300' })
      }
      if (weapon.effect.type === 'aoe') {
        lines.push({ label: '効果', value: '全体攻撃', color: 'text-red-300' })
      }
      if (weapon.effect.type === 'currentHpDamage') {
        lines.push({ label: '効果', value: '現在HP-1→ダメージ(HP1化)', color: 'text-red-300' })
      }
      if (weapon.effect.type === 'selfVulnerability') {
        lines.push({ label: 'デメリット', value: `${weapon.effect.duration}T被ダメ×${weapon.effect.multiplier}`, color: 'text-red-400' })
      }
      if (weapon.effect.type === 'killBonusExpToAll') {
        lines.push({ label: '効果', value: `トドメ時全員+${weapon.effect.expAmount}EXP`, color: 'text-green-300' })
      }
      if (weapon.effect.type === 'shieldBash') {
        lines.push({ label: '効果', value: 'シールド加算→消費', color: 'text-cyan-300' })
      }
      if (weapon.effect.type === 'revengeDamage') {
        lines.push({ label: '効果', value: `前ターン被ダメ×${weapon.effect.coefficient}P加算`, color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'revengeFlat') {
        lines.push({ label: '効果', value: `前ターン被ダメ時Power+${weapon.effect.powerBonus}`, color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'recoilSelfDamage') {
        lines.push({ label: 'デメリット', value: `与ダメの${Math.floor(weapon.effect.rate * 100)}%を反動ダメージ`, color: 'text-red-400' })
      }
      if (weapon.effect.type === 'hpThresholdBonus') {
        lines.push({
          label: '効果',
          value: weapon.effect.when === 'below'
            ? `HP${Math.floor(weapon.effect.thresholdRate * 100)}%以下でPower+${weapon.effect.powerBonus}`
            : `HP満タン時Power+${weapon.effect.powerBonus}`,
          color: 'text-orange-300',
        })
      }
      if (weapon.effect.type === 'allyFollowUpBonus') {
        lines.push({ label: '効果', value: `先行味方${weapon.effect.requiredCount}回攻撃でPower+${weapon.effect.powerBonus}`, color: 'text-yellow-300' })
      }
      if (weapon.effect.type === 'breakCountBonus') {
        lines.push({ label: '効果', value: 'ラン中の武器破壊回数分Power加算', color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'nextTurnStrGain') {
        lines.push({ label: '効果', value: `次のターンSTR+${weapon.effect.value}`, color: 'text-green-300' })
      }
    }
    if ('hpCost' in weapon && weapon.hpCost) {
      lines.push({ label: 'HP消費', value: `${weapon.hpCost}/回`, color: 'text-red-400' })
    }
    if (!isSpellLike && 'scaleStat' in weapon && weapon.scaleStat === 'int') {
      lines.push({ label: '依存ステ', value: 'INT', color: 'text-blue-300' })
    }
    if ('targetType' in weapon && weapon.targetType === 'enemyAll') {
      lines.push({ label: '対象', value: '全体攻撃', color: 'text-red-300' })
    }
    if ('targetType' in weapon && weapon.targetType === 'enemyRandom') {
      const hitCount = 'hits' in weapon && weapon.hits ? weapon.hits : 3
      lines.push({ label: '対象', value: `ランダムな敵に攻撃（${hitCount}回）`, color: 'text-red-300' })
    }
    if ('targetType' in weapon && weapon.targetType === 'allySingle') {
      lines.push({ label: '対象', value: '味方単体', color: 'text-green-300' })
    }
    if ('targetType' in weapon && weapon.targetType === 'allyAll') {
      lines.push({ label: '対象', value: '味方全体', color: 'text-green-300' })
    }
    return lines
  }

  // 魔法
  if ('commandCategory' in item && item.commandCategory === 'spell') {
    const spell = item as SpellData | SpellInstance
    if (damageText) {
      lines.push({ label: 'ダメージ', value: damageText, color: 'text-purple-300' })
    }
    // NoMP化: 武器と同じく耐久値(残り/最大)を表示。無制限は∞。
    if (durabilityText) {
      lines.push({ label: '耐久値', value: durabilityText })
    } else if ('currentUses' in spell && spell.currentUses !== null) {
      lines.push({ label: '耐久値', value: `${spell.currentUses}/${spell.maxUses}` })
    } else if (spell.maxUses !== null) {
      lines.push({ label: '使用回数', value: `${spell.maxUses}` })
    } else {
      lines.push({ label: '耐久値', value: '∞' })
    }
    if (spell.effect) {
      if (spell.effect.type === 'heal') {
        lines.push({
          label: '回復',
          value: spell.targetType === 'allyAll' ? `味方全体 HP +${spell.effect.value}` : `HP +${spell.effect.value}`,
          color: 'text-green-300',
        })
      }
      if (spell.effect.type === 'buff') {
        if (spell.effect.stat === 'precision') {
          lines.push({ label: '効果', value: 'ダメージブレを0にする', color: 'text-green-300' })
        } else {
          lines.push({ label: 'バフ', value: `STR +${spell.effect.value}`, color: 'text-green-300' })
        }
      }
      if (spell.effect.type === 'shield') {
        lines.push({ label: '効果', value: `シールド${spell.effect.value}付与`, color: 'text-cyan-300' })
      }
      if (spell.effect.type === 'repairWeapons') {
        lines.push({ label: '効果', value: `武器耐久+${spell.effect.value}回復`, color: 'text-green-300' })
      }
      if (spell.effect.type === 'weaponPowerBuff') {
        lines.push({ label: '効果', value: `次の武器攻撃P+${spell.effect.value}`, color: 'text-orange-300' })
      }
      if (spell.effect.type === 'killBonusExpToAll') {
        lines.push({ label: '効果', value: `トドメ時全員に+${spell.effect.expAmount}EXP`, color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'targetRateUp') {
        lines.push({ label: '効果', value: `被ターゲット率+${spell.effect.value}%`, color: 'text-red-300' })
      }
      if (spell.effect.type === 'mpPercentShield') {
        lines.push({ label: '効果', value: `最大MP${Math.floor(spell.effect.rate * 100)}%シールド`, color: 'text-cyan-300' })
      }
      if (spell.effect.type === 'scalingShieldInt') {
        lines.push({ label: '効果', value: formatScalingShield(spell.effect.base, spell.effect.intMultiplier, 'INT', explorer?.int, '付与'), color: 'text-cyan-300' })
      }
      if (spell.effect.type === 'mpAllDamage') {
        lines.push({ label: '効果', value: '現在MP全量→ダメージ', color: 'text-purple-300' })
      }
      if (spell.effect.type === 'followUp') {
        lines.push({ label: '効果', value: `先行攻撃数×${spell.effect.coefficient}P加算`, color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'allyFollowUpBonus') {
        lines.push({ label: '効果', value: `先行味方${spell.effect.requiredCount}回攻撃でPower+${spell.effect.powerBonus}`, color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'targetHpConditional') {
        lines.push({ label: '効果', value: `敵失HP×${spell.effect.coefficient}P加算`, color: 'text-orange-300' })
      }
      if (spell.effect.type === 'lowMpConditional') {
        lines.push({ label: '効果', value: `消費MP×${spell.effect.coefficient}P加算`, color: 'text-purple-300' })
      }
      if (spell.effect.type === 'thorns') {
        lines.push({ label: '効果', value: `棘${spell.effect.value}スタック付与`, color: 'text-green-300' })
      }
      if (spell.effect.type === 'revengeDamage') {
        lines.push({ label: '効果', value: `前ターン被ダメ×${spell.effect.coefficient}P加算`, color: 'text-orange-300' })
      }
      if (spell.effect.type === 'revengeFlat') {
        lines.push({ label: '効果', value: `前ターン被ダメ時Power+${spell.effect.powerBonus}`, color: 'text-orange-300' })
      }
      if (spell.effect.type === 'recoilSelfDamage') {
        lines.push({ label: 'デメリット', value: `与ダメの${Math.floor(spell.effect.rate * 100)}%を自傷`, color: 'text-red-400' })
      }
      if (spell.effect.type === 'recoilMpDrain') {
        lines.push({ label: 'デメリット', value: `与ダメの${Math.floor(spell.effect.rate * 100)}%MP減少`, color: 'text-red-400' })
      }
      if (spell.effect.type === 'repairLastWeapon') {
        lines.push({ label: '効果', value: `最後に使った武器の耐久+${spell.effect.value}回復`, color: 'text-green-300' })
      }
      if (spell.effect.type === 'healMp') {
        lines.push({ label: '効果', value: `MP +${spell.effect.value}回復`, color: 'text-blue-300' })
      }
      if (spell.effect.type === 'revive') {
        lines.push({ label: '効果', value: `戦闘不能の味方をHP${spell.effect.hp}で復活`, color: 'text-green-300' })
      }
    }
    if ('hpCost' in spell && (spell as SpellData).hpCost) {
      lines.push({ label: 'HP消費', value: `${(spell as SpellData).hpCost}/回`, color: 'text-red-400' })
    }
    if (spell.targetType === 'enemyAll') {
      lines.push({ label: '対象', value: '全体攻撃', color: 'text-red-300' })
    }
    if (spell.targetType === 'allySingle') {
      lines.push({ label: '対象', value: '味方単体', color: 'text-green-300' })
    }
    if (spell.targetType === 'allyAll') {
      lines.push({ label: '対象', value: '味方全体', color: 'text-green-300' })
    }
    return lines
  }

  // ポーション
  if ('commandCategory' in item && item.commandCategory === 'potion') {
    const potion = item as PotionData
    if (potion.effect.type === 'healHp') {
      lines.push({ label: '効果', value: potion.effect.full ? 'HP全回復' : `HP ${potion.effect.value}回復`, color: 'text-green-300' })
    }
    if (potion.effect.type === 'healMp') {
      lines.push({ label: '効果', value: potion.effect.full ? 'MP全回復' : `MP ${potion.effect.value}回復`, color: 'text-blue-300' })
    }
    if (potion.effect.type === 'repairWeapons') {
      lines.push({ label: '効果', value: `武器耐久値+${potion.effect.value}`, color: 'text-green-300' })
    }
    return lines
  }

  // レリック
  if ('passiveEffect' in item) {
    const relic = item as RelicData | RelicInstance
    lines.push({ label: '効果', value: getPassiveEffectDescription(relic.passiveEffect), color: 'text-yellow-300' })
    return lines
  }

  return lines
}
