import { Rarity } from '../../Lib/Types/Item'
import { WeaponData } from '../../Lib/Types/Weapon'
import { SpellData } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { getItemDescription, getItemCategory } from '../../Lib/Utils/ItemDescription'

type ItemType = WeaponData | SpellData | RelicData | PotionData

interface ItemCardProps {
  item: ItemType
  onClick?: () => void
  disabled?: boolean
  showPrice?: boolean
  showSellPrice?: boolean
  sellPrice?: number
  compact?: boolean
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

export function ItemCard({
  item,
  onClick,
  disabled = false,
  showPrice = false,
  showSellPrice = false,
  sellPrice = 0,
  compact = false,
}: ItemCardProps) {
  const rarityColor = getRarityColor(item.rarity)
  const rarityTextColor = getRarityTextColor(item.rarity)
  const description = getItemDescription(item)
  const category = getItemCategory(item)

  const isClickable = onClick && !disabled

  return (
    <div
      className={`
        border-2 rounded-lg
        ${compact ? 'p-1.5' : 'p-3 min-w-32'}
        ${rarityColor}
        ${isClickable ? 'cursor-pointer hover:brightness-110 active:brightness-90' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        transition-all
      `}
      onClick={isClickable ? onClick : undefined}
    >
      {/* カテゴリ */}
      <div className={`text-gray-400 ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>{category}</div>

      {/* アイテム名 */}
      <div className={`font-bold ${rarityTextColor} ${compact ? 'text-xs' : ''}`}>{item.name}</div>

      {/* 説明 */}
      <div className={`text-gray-300 ${compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'}`}>{description}</div>

      {/* 価格 */}
      {showPrice && (
        <div className={`text-yellow-400 font-semibold ${compact ? 'text-xs mt-0.5' : 'text-sm mt-2'}`}>
          {item.price} G
        </div>
      )}

      {/* 売却価格 */}
      {showSellPrice && (
        <div className={`text-green-400 ${compact ? 'text-xs mt-0.5' : 'text-sm mt-2'}`}>
          売却: {sellPrice} G
        </div>
      )}
    </div>
  )
}
