import { ItemCard } from '../Common/ItemCard'
import { Tooltip, TooltipCard } from '../Common'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RunState } from '../../Lib/Types/Run'
import { StoreState, ShopSlot } from '../../Lib/Types/Game'
import { WeaponData } from '../../Lib/Types/Weapon'
import { SpellData } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import {
  getSellPrice,
  getSellPriceItem,
  canBuyWeapon,
  canBuySpell,
  canBuyRelic,
  canBuyPotion,
  STORE_CATEGORY_LABELS,
} from '../../Lib/Core/StoreLogic'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'

interface StoreShopPanelProps {
  explorer: ExplorerState
  memberIndex: number
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
  memberIndex: _memberIndex,
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
  // 選択済みショップがなければ何も表示しない
  if (storeState.selectedShopIndex === null) return null
  const shop = storeState.shopOptions[storeState.selectedShopIndex]

  /** スロットの購入処理 */
  const handleBuySlot = (slotIndex: number, slot: ShopSlot) => {
    if (!slot.item || gold < slot.item.price) return
    switch (slot.category) {
      case 'weapon':
        if (!canBuyWeapon(explorer)) return
        buyWeapon(slotIndex, slot.item)
        break
      case 'spell':
        if (!canBuySpell(explorer)) return
        buySpell(slotIndex, slot.item)
        break
      case 'relic':
        if (!canBuyRelic(run.relics)) return
        buyRelic(slotIndex, slot.item)
        break
      case 'potion':
        if (!canBuyPotion(run.potions)) return
        buyPotion(slotIndex, slot.item)
        break
    }
  }

  /** 購入可能かチェック */
  const canBuySlot = (slot: ShopSlot): boolean => {
    if (!slot.item || gold < slot.item.price) return false
    switch (slot.category) {
      case 'weapon': return canBuyWeapon(explorer)
      case 'spell': return canBuySpell(explorer)
      case 'relic': return canBuyRelic(run.relics)
      case 'potion': return canBuyPotion(run.potions)
    }
  }

  const predOpts = { relics: run.relics }
  const topSlots = shop.slots.slice(0, 3)
  const bottomSlots = shop.slots.slice(3, 6)

  /** スロット1つをレンダリング */
  const renderSlot = (slot: ShopSlot, slotIndex: number) => (
    <div key={`slot-${slotIndex}`}>
      {slot.item ? (
        <ItemCard
          item={slot.item}
          showPrice
          compact
          onClick={() => handleBuySlot(slotIndex, slot)}
          disabled={!canBuySlot(slot)}
          explorer={explorer}
          relics={run.relics}
        />
      ) : (
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-1.5 h-12 flex items-center justify-center">
          <span className="text-gray-500 text-xs">売り切れ</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-3 h-full overflow-hidden">
      {/* 左側: ショップ */}
      <div className="overflow-y-auto">
        <div className="text-xs text-gray-400 mb-2">shop</div>

        {/* 上段カテゴリ */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">{STORE_CATEGORY_LABELS[shop.categories[0]]}</div>
          <div className="grid grid-cols-3 gap-1">
            {topSlots.map((slot, i) => renderSlot(slot, i))}
          </div>
        </div>

        {/* 下段カテゴリ */}
        <div>
          <div className="text-xs text-gray-500 mb-1">{STORE_CATEGORY_LABELS[shop.categories[1]]}</div>
          <div className="grid grid-cols-3 gap-1">
            {bottomSlots.map((slot, i) => renderSlot(slot, i + 3))}
          </div>
        </div>
      </div>

      {/* 右側: 所持品 */}
      <div className="overflow-y-auto">
        <div className="text-xs text-gray-400 mb-2">inventory</div>

        {/* 武器 */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">武器 ({explorer.weapons.filter(w => w.maxUses !== null).length}/{explorer.weaponSlotCount})</div>
          <div className="grid grid-cols-2 gap-1">
            {explorer.weapons.map((weapon, index) => {
              // 無限使用の無料武器は売却不可（パンチ、魔力弾、祈り等）
              const canSell = weapon.id !== 'punch' && weapon.maxUses !== null
              const price = getSellPrice(weapon)
              const range = predictWeaponDamage(explorer, weapon, predOpts)
              const dmgText = formatDamageRange(range)
              return (
                <Tooltip key={`owned-weapon-${index}`} content={<TooltipCard item={weapon} damageText={dmgText} />} position="bottom">
                  <div
                    className={`border rounded p-1.5 text-xs ${
                      canSell
                        ? 'border-gray-500 bg-gray-800 cursor-pointer hover:bg-gray-700'
                        : 'border-gray-700 bg-gray-900'
                    }`}
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
                </Tooltip>
              )
            })}
          </div>
        </div>

        {/* 魔法 */}
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">魔法 ({explorer.spells.length}/{explorer.magicSlotCount})</div>
          <div className="grid grid-cols-2 gap-1">
            {explorer.spells.length === 0 ? (
              <span className="text-gray-500 text-xs">なし</span>
            ) : (
              explorer.spells.map((spell, index) => {
                const price = getSellPriceItem(spell)
                const hasPower = spell.power > 0
                const range = hasPower ? predictSpellDamage(explorer, spell, predOpts) : null
                const dmgText = range ? formatDamageRange(range) : undefined
                return (
                  <Tooltip key={`owned-spell-${index}`} content={<TooltipCard item={spell} damageText={dmgText} />} position="bottom">
                    <div
                      className="border border-gray-500 bg-gray-800 rounded p-1.5 text-xs cursor-pointer hover:bg-gray-700"
                      onClick={() => sellSpell(index)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white">{spell.name}</span>
                        <span className="text-gray-400">MP: {spell.mpCost}</span>
                      </div>
                      <div className="text-green-400 text-xs">売却: {price}G</div>
                    </div>
                  </Tooltip>
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
                  <Tooltip key={`owned-relic-${index}`} content={<TooltipCard item={relic} />} position="bottom">
                    <div
                      className="border border-gray-500 bg-gray-800 rounded p-1.5 text-xs cursor-pointer hover:bg-gray-700"
                      onClick={() => sellRelic(index)}
                    >
                      <div className="text-white">{relic.name}</div>
                      <div className="text-green-400 text-xs">売却: {price}G</div>
                    </div>
                  </Tooltip>
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
                  <Tooltip key={`owned-potion-${index}`} content={<TooltipCard item={potion} />} position="bottom">
                    <div
                      className="border border-gray-500 bg-gray-800 rounded p-1.5 text-xs cursor-pointer hover:bg-gray-700"
                      onClick={() => sellPotion(index)}
                    >
                      <div className="text-white">{potion.name}</div>
                      <div className="text-green-400 text-xs">売却: {price}G</div>
                    </div>
                  </Tooltip>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
