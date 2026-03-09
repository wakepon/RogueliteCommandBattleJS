import { Rarity } from '../../Lib/Types/Item'
import { WeaponData } from '../../Lib/Types/Weapon'
import { SpellData } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { PassiveEffectType } from '../../Lib/Types/Passive'

type ItemType = WeaponData | SpellData | RelicData | PotionData

interface ItemCardProps {
  item: ItemType
  onClick?: () => void
  disabled?: boolean
  showPrice?: boolean
  showSellPrice?: boolean
  sellPrice?: number
}

/** レアリティに応じた色を返す */
function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return 'border-gray-400 bg-gray-800'
    case 'Uncommon':
      return 'border-green-400 bg-green-900/30'
    case 'Rare':
      return 'border-blue-400 bg-blue-900/30'
    case 'Unique':
      return 'border-purple-400 bg-purple-900/30'
  }
}

/** レアリティのテキスト色 */
function getRarityTextColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return 'text-gray-400'
    case 'Uncommon':
      return 'text-green-400'
    case 'Rare':
      return 'text-blue-400'
    case 'Unique':
      return 'text-purple-400'
  }
}

/** パッシブ効果の説明を生成 */
function getPassiveEffectDescription(effect: PassiveEffectType): string {
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
function getItemDescription(item: ItemType): string {
  // 武器
  if ('commandCategory' in item && item.commandCategory === 'weapon') {
    const weapon = item as WeaponData
    let desc = `威力: ${weapon.power}`
    if (weapon.maxUses !== null) {
      desc += ` | 使用回数: ${weapon.maxUses}`
    }
    if (weapon.effect) {
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
      desc += ` | 威力: ${spell.power}`
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
function getItemCategory(item: ItemType): string {
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

export function ItemCard({
  item,
  onClick,
  disabled = false,
  showPrice = false,
  showSellPrice = false,
  sellPrice = 0,
}: ItemCardProps) {
  const rarityColor = getRarityColor(item.rarity)
  const rarityTextColor = getRarityTextColor(item.rarity)
  const description = getItemDescription(item)
  const category = getItemCategory(item)

  const isClickable = onClick && !disabled

  return (
    <div
      className={`
        border-2 rounded-lg p-3 min-w-32
        ${rarityColor}
        ${isClickable ? 'cursor-pointer hover:brightness-110 active:brightness-90' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        transition-all
      `}
      onClick={isClickable ? onClick : undefined}
    >
      {/* カテゴリ */}
      <div className="text-xs text-gray-400 mb-1">{category}</div>

      {/* アイテム名 */}
      <div className={`font-bold ${rarityTextColor}`}>{item.name}</div>

      {/* 説明 */}
      <div className="text-xs text-gray-300 mt-1">{description}</div>

      {/* 価格 */}
      {showPrice && (
        <div className="text-sm text-yellow-400 mt-2 font-semibold">
          {item.price} G
        </div>
      )}

      {/* 売却価格 */}
      {showSellPrice && (
        <div className="text-sm text-green-400 mt-2">
          売却: {sellPrice} G
        </div>
      )}
    </div>
  )
}
