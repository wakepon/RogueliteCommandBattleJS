import { ItemCard } from '../Common/ItemCard'
import { getItemTooltip, DamageContext } from '../../Lib/Utils/ItemDescription'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RunState } from '../../Lib/Types/Run'
import { StoreState } from '../../Lib/Types/Game'
import { WeaponData } from '../../Lib/Types/Weapon'
import { SpellData } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import {
  isWeaponData,
  isSpellData,
  isRelicData,
  isPotionData,
  getSellPrice,
  getSellPriceItem,
  canBuyWeapon,
  canBuySpell,
  canBuyRelic,
  canBuyPotion,
} from '../../Lib/Core/StoreLogic'

interface StoreShopPanelProps {
  explorer: ExplorerState
  run: RunState
  storeState: StoreState
  gold: number
  buyWeapon: (slotIndex: number, item: WeaponData) => void
  buySpell: (slotIndex: number, item: SpellData) => void
  buyRelic: (slotIndex: number, item: RelicData) => void
  buyPotion: (slotIndex: number, item: PotionData) => void
  sellWeapon: (weaponIndex: number) => void
  sellSpell: (spellIndex: number) => void
  sellRelic: (relicIndex: number) => void
  sellPotion: (potionIndex: number) => void
}

export function StoreShopPanel({
  explorer,
  run,
  storeState,
  gold,
  buyWeapon,
  buySpell,
  buyRelic,
  buyPotion,
  sellWeapon,
  sellSpell,
  sellRelic,
  sellPotion,
}: StoreShopPanelProps) {
  /** 武器/魔法の購入処理 */
  const handleBuyWeaponSlot = (slotIndex: number, item: WeaponData | SpellData) => {
    if (gold < item.price) return
    if (isWeaponData(item)) {
      if (!canBuyWeapon(explorer)) return
      buyWeapon(slotIndex, item)
    } else if (isSpellData(item)) {
      if (!canBuySpell(explorer)) return
      buySpell(slotIndex, item)
    }
  }

  /** レリック/ポーションの購入処理 */
  const handleBuyRelicSlot = (slotIndex: number, item: RelicData | PotionData) => {
    if (gold < item.price) return
    if (isRelicData(item)) {
      if (!canBuyRelic(run.relics)) return
      buyRelic(slotIndex, item)
    } else if (isPotionData(item)) {
      if (!canBuyPotion(run.potions)) return
      buyPotion(slotIndex, item)
    }
  }

  /** 購入可能かチェック */
  const canBuyWeaponSlot = (item: WeaponData | SpellData): boolean => {
    if (gold < item.price) return false
    if (isWeaponData(item)) return canBuyWeapon(explorer)
    if (isSpellData(item)) return canBuySpell(explorer)
    return false
  }

  /** 購入可能かチェック（レリック/ポーション） */
  const canBuyRelicSlot = (item: RelicData | PotionData): boolean => {
    if (gold < item.price) return false
    if (isRelicData(item)) return canBuyRelic(run.relics)
    if (isPotionData(item)) return canBuyPotion(run.potions)
    return false
  }

  const damageContext: DamageContext = { explorer, relics: run.relics }

  return (
    <div className="grid grid-cols-2 gap-3 h-full overflow-hidden">
      {/* 左側: ショップ */}
      <div className="overflow-y-auto">
        <div className="text-xs text-gray-400 mb-2">shop</div>

        {/* 武器/魔法スロット */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">武器・魔法</div>
          <div className="grid grid-cols-3 gap-1">
            {storeState.weaponSlots.map((item, index) => (
              <div key={`weapon-slot-${index}`}>
                {item ? (
                  <ItemCard
                    item={item}
                    showPrice
                    compact
                    onClick={() => handleBuyWeaponSlot(index, item)}
                    disabled={!canBuyWeaponSlot(item)}
                    explorer={explorer}
                    relics={run.relics}
                  />
                ) : (
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-1.5 h-12 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">売り切れ</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* レリック/ポーションスロット */}
        <div>
          <div className="text-xs text-gray-500 mb-1">レリック・ポーション</div>
          <div className="grid grid-cols-3 gap-1">
            {storeState.relicSlots.map((item, index) => (
              <div key={`relic-slot-${index}`}>
                {item ? (
                  <ItemCard
                    item={item}
                    showPrice
                    compact
                    onClick={() => handleBuyRelicSlot(index, item)}
                    disabled={!canBuyRelicSlot(item)}
                    explorer={explorer}
                    relics={run.relics}
                  />
                ) : (
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-1.5 h-12 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">売り切れ</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右側: 所持品 */}
      <div className="overflow-y-auto">
        <div className="text-xs text-gray-400 mb-2">inventory</div>

        {/* 武器 */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">武器 ({explorer.weapons.length}/4)</div>
          <div className="grid grid-cols-2 gap-1">
            {explorer.weapons.map((weapon, index) => {
              const canSell = weapon.id !== 'punch'
              const price = getSellPrice(weapon)
              return (
                <div
                  key={`owned-weapon-${index}`}
                  className={`border rounded p-1.5 text-xs ${
                    canSell
                      ? 'border-gray-500 bg-gray-800 cursor-pointer hover:bg-gray-700'
                      : 'border-gray-700 bg-gray-900'
                  }`}
                  title={getItemTooltip(weapon, damageContext)}
                  onClick={canSell ? () => sellWeapon(index) : undefined}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-white">{weapon.name}</span>
                    {weapon.currentUses !== null && (
                      <span className="text-gray-400">{weapon.currentUses}/{weapon.maxUses}</span>
                    )}
                  </div>
                  {canSell && (
                    <div className="text-green-400 text-xs">売却: {price}G</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 魔法 */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">魔法 ({explorer.spells.length}/2)</div>
          <div className="grid grid-cols-2 gap-1">
            {explorer.spells.length === 0 ? (
              <span className="text-gray-500 text-xs">なし</span>
            ) : (
              explorer.spells.map((spell, index) => {
                const price = getSellPriceItem(spell)
                return (
                  <div
                    key={`owned-spell-${index}`}
                    className="border border-gray-500 bg-gray-800 rounded p-1.5 text-xs cursor-pointer hover:bg-gray-700"
                    title={getItemTooltip(spell, damageContext)}
                    onClick={() => sellSpell(index)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white">{spell.name}</span>
                      <span className="text-gray-400">MP: {spell.mpCost}</span>
                    </div>
                    <div className="text-green-400 text-xs">売却: {price}G</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* レリック */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">レリック ({run.relics.length}/5)</div>
          <div className="grid grid-cols-2 gap-1">
            {run.relics.length === 0 ? (
              <span className="text-gray-500 text-xs">なし</span>
            ) : (
              run.relics.map((relic, index) => {
                const price = getSellPriceItem(relic)
                return (
                  <div
                    key={`owned-relic-${index}`}
                    className="border border-gray-500 bg-gray-800 rounded p-1.5 text-xs cursor-pointer hover:bg-gray-700"
                    title={getItemTooltip(relic)}
                    onClick={() => sellRelic(index)}
                  >
                    <div className="text-white">{relic.name}</div>
                    <div className="text-green-400 text-xs">売却: {price}G</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ポーション */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">ポーション ({run.potions.length}/2)</div>
          <div className="grid grid-cols-2 gap-1">
            {run.potions.length === 0 ? (
              <span className="text-gray-500 text-xs">なし</span>
            ) : (
              run.potions.map((potion, index) => {
                const price = getSellPriceItem(potion)
                return (
                  <div
                    key={`owned-potion-${index}`}
                    className="border border-gray-500 bg-gray-800 rounded p-1.5 text-xs cursor-pointer hover:bg-gray-700"
                    title={getItemTooltip(potion)}
                    onClick={() => sellPotion(index)}
                  >
                    <div className="text-white">{potion.name}</div>
                    <div className="text-green-400 text-xs">売却: {price}G</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
