import { ExplorerWeapon, WeaponData } from '../../Lib/Types/Weapon'
import { SpellData, SpellInstance } from '../../Lib/Types/Spell'
import { RelicData, RelicInstance } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { BattleCommand } from '../../Lib/Types/Battle'
import { getPassiveEffectDescription } from '../../Lib/Utils/ItemDescription'
import { MemberAttackImpact } from '../../Lib/Utils/RelicImpactCalculator'

type AnyItem = WeaponData | ExplorerWeapon | SpellData | SpellInstance | RelicData | RelicInstance | PotionData | BattleCommand

interface TooltipLine {
  label: string
  value: string
  color?: string
}

/** カード形式のTooltipコンテンツを生成 */
export function TooltipCard({ item, damageText, durabilityText, attackImpacts }: {
  item: AnyItem
  damageText?: string   // "5-9" 形式
  durabilityText?: string  // "3/5" 形式
  attackImpacts?: MemberAttackImpact[]  // レリック用: 各メンバーの最大攻撃力変化
}) {
  const name = item.name
  const category = getCategory(item)
  const lines = buildLines(item, damageText, durabilityText)
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

function buildLines(item: AnyItem, damageText?: string, durabilityText?: string): TooltipLine[] {
  const lines: TooltipLine[] = []

  // 武器
  if ('commandCategory' in item && item.commandCategory === 'weapon') {
    const weapon = item as WeaponData | ExplorerWeapon
    // 祈り/魔力弾等の魔法系武器（無限使用）は実質的に魔法と同等のため、耐久値/依存ステの代わりにMP消費を表示
    const isSpellLike = weapon.maxUses === null
    if (damageText) {
      lines.push({ label: 'ダメージ', value: damageText, color: 'text-orange-300' })
    }
    if (isSpellLike) {
      lines.push({ label: 'MP消費', value: '0', color: 'text-blue-300' })
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
      if (weapon.effect.type === 'targetRateUp') {
        lines.push({ label: '効果', value: `対象の被弾率+${weapon.effect.value}%`, color: 'text-red-300' })
      }
      if (weapon.effect.type === 'conditionalPower') {
        lines.push({ label: '条件', value: `HP${Math.floor(weapon.effect.hpThreshold * 100)}%以下でP+${weapon.effect.bonusPower}`, color: 'text-orange-300' })
      }
      if (weapon.effect.type === 'shield') {
        lines.push({ label: '効果', value: `シールド${weapon.effect.value}付与`, color: 'text-cyan-300' })
      }
      if (weapon.effect.type === 'killPreserveDurability') {
        lines.push({ label: '効果', value: 'トドメ時に耐久消費なし', color: 'text-yellow-300' })
      }
    }
    if ('hpCost' in weapon && weapon.hpCost) {
      lines.push({ label: 'HP消費', value: `${weapon.hpCost}/回`, color: 'text-red-400' })
    }
    if ('goldCost' in weapon && weapon.goldCost) {
      lines.push({ label: 'G消費', value: `${weapon.goldCost}G/回`, color: 'text-yellow-400' })
    }
    if (!isSpellLike && 'scaleStat' in weapon && weapon.scaleStat === 'int') {
      lines.push({ label: '依存ステ', value: 'INT', color: 'text-blue-300' })
    }
    if ('targetType' in weapon && weapon.targetType === 'enemyAll') {
      lines.push({ label: '対象', value: '全体攻撃', color: 'text-red-300' })
    }
    if ('targetType' in weapon && weapon.targetType === 'allySingle') {
      lines.push({ label: '対象', value: '味方単体', color: 'text-green-300' })
    }
    return lines
  }

  // 魔法
  if ('commandCategory' in item && item.commandCategory === 'spell') {
    const spell = item as SpellData | SpellInstance
    if (damageText) {
      lines.push({ label: 'ダメージ', value: damageText, color: 'text-purple-300' })
    }
    lines.push({ label: 'MP消費', value: `${spell.mpCost}`, color: 'text-blue-300' })
    if (spell.effect) {
      if (spell.effect.type === 'heal') {
        lines.push({ label: '回復', value: `HP +${spell.effect.value}`, color: 'text-green-300' })
      }
      if (spell.effect.type === 'steal') {
        lines.push({ label: '効果', value: 'ゴールドを盗む', color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'buff') {
        const statLabel = spell.effect.stat === 'precision' ? '精密' : 'STR'
        lines.push({ label: 'バフ', value: `${statLabel} +${spell.effect.value}`, color: 'text-green-300' })
      }
      if (spell.effect.type === 'shield') {
        lines.push({ label: '効果', value: `シールド${spell.effect.value}付与`, color: 'text-cyan-300' })
      }
      if (spell.effect.type === 'hpToMp') {
        lines.push({ label: '効果', value: `HP${spell.effect.hpCost}→MP${spell.effect.mpGain}`, color: 'text-purple-300' })
      }
      if (spell.effect.type === 'goldOnHit') {
        lines.push({ label: '効果', value: `ヒット時+${spell.effect.value}G`, color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'goldDamage') {
        lines.push({ label: '効果', value: `所持金${Math.floor(spell.effect.rate * 100)}%→×${spell.effect.multiplier}ダメ`, color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'repairWeapons') {
        lines.push({ label: '効果', value: `武器耐久+${spell.effect.value}回復`, color: 'text-green-300' })
      }
      if (spell.effect.type === 'weaponPowerBuff') {
        lines.push({ label: '効果', value: `次の武器攻撃P+${spell.effect.value}`, color: 'text-orange-300' })
      }
      if (spell.effect.type === 'guidanceBuff') {
        lines.push({ label: '効果', value: '導き付与(次トドメで+1EXP)', color: 'text-yellow-300' })
      }
      if (spell.effect.type === 'killBonusExpToAll') {
        lines.push({ label: '効果', value: 'トドメ時全員にボーナスEXP', color: 'text-yellow-300' })
      }
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
      lines.push({ label: '効果', value: `HP ${potion.effect.value}回復`, color: 'text-green-300' })
    }
    if (potion.effect.type === 'healMp') {
      lines.push({ label: '効果', value: `MP ${potion.effect.value}回復`, color: 'text-blue-300' })
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
