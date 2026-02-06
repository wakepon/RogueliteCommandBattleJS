import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { ItemCard } from '../Common/ItemCard'
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
import { WeaponData } from '../../Lib/Types/Weapon'
import { SpellData } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'

export function StoreScreen() {
  const {
    state,
    buyWeapon,
    buySpell,
    buyRelic,
    buyPotion,
    sellWeapon,
    sellSpell,
    sellRelic,
    sellPotion,
    rerollStore,
    closeStore,
  } = useGame()

  const { run, storeState } = state

  if (!run || !storeState) {
    return null
  }

  const explorer = run.party[0]
  const gold = run.gold

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

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">ストア</h1>
        <div className="text-xl text-yellow-400 font-bold">
          {gold} G
        </div>
      </div>

      {/* 武器/魔法セクション */}
      <div className="mb-6">
        <h2 className="text-lg text-white mb-3">武器・魔法</h2>
        <div className="flex flex-wrap gap-3">
          {storeState.weaponSlots.map((item, index) => (
            <div key={`weapon-slot-${index}`}>
              {item ? (
                <ItemCard
                  item={item}
                  showPrice
                  onClick={() => handleBuyWeaponSlot(index, item)}
                  disabled={!canBuyWeaponSlot(item)}
                />
              ) : (
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-3 min-w-32 h-24 flex items-center justify-center">
                  <span className="text-gray-500">売り切れ</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* レリック/ポーションセクション */}
      <div className="mb-6">
        <h2 className="text-lg text-white mb-3">レリック・ポーション</h2>
        <div className="flex flex-wrap gap-3">
          {storeState.relicSlots.map((item, index) => (
            <div key={`relic-slot-${index}`}>
              {item ? (
                <ItemCard
                  item={item}
                  showPrice
                  onClick={() => handleBuyRelicSlot(index, item)}
                  disabled={!canBuyRelicSlot(item)}
                />
              ) : (
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-3 min-w-32 h-24 flex items-center justify-center">
                  <span className="text-gray-500">売り切れ</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* リロールボタン */}
      <div className="mb-6">
        <Button
          variant="secondary"
          onClick={rerollStore}
          disabled={gold < storeState.rerollCost}
        >
          リロール ({storeState.rerollCost} G)
        </Button>
      </div>

      {/* 所持品セクション */}
      <div className="mb-6 border-t border-gray-700 pt-4">
        <h2 className="text-lg text-white mb-3">所持品</h2>

        {/* 武器 */}
        <div className="mb-4">
          <h3 className="text-sm text-gray-400 mb-2">武器 ({explorer.weapons.length}/4)</h3>
          <div className="flex flex-wrap gap-2">
            {explorer.weapons.map((weapon, index) => {
              const canSell = weapon.id !== 'punch'
              const price = getSellPrice(weapon)
              return (
                <div
                  key={`owned-weapon-${index}`}
                  className={`
                    border rounded-lg p-2 text-sm
                    ${canSell ? 'border-gray-500 bg-gray-800 cursor-pointer hover:bg-gray-700' : 'border-gray-700 bg-gray-900'}
                  `}
                  onClick={canSell ? () => sellWeapon(index) : undefined}
                >
                  <div className="text-white">{weapon.name}</div>
                  {weapon.currentUses !== null && (
                    <div className="text-xs text-gray-400">
                      使用: {weapon.currentUses}/{weapon.maxUses}
                    </div>
                  )}
                  {canSell && (
                    <div className="text-xs text-green-400">売却: {price}G</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 魔法 */}
        <div className="mb-4">
          <h3 className="text-sm text-gray-400 mb-2">魔法 ({explorer.spells.length}/2)</h3>
          <div className="flex flex-wrap gap-2">
            {explorer.spells.length === 0 ? (
              <span className="text-gray-500 text-sm">なし</span>
            ) : (
              explorer.spells.map((spell, index) => {
                const price = getSellPriceItem(spell)
                return (
                  <div
                    key={`owned-spell-${index}`}
                    className="border border-gray-500 bg-gray-800 rounded-lg p-2 text-sm cursor-pointer hover:bg-gray-700"
                    onClick={() => sellSpell(index)}
                  >
                    <div className="text-white">{spell.name}</div>
                    <div className="text-xs text-gray-400">MP: {spell.mpCost}</div>
                    <div className="text-xs text-green-400">売却: {price}G</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* レリック */}
        <div className="mb-4">
          <h3 className="text-sm text-gray-400 mb-2">レリック ({run.relics.length}/5)</h3>
          <div className="flex flex-wrap gap-2">
            {run.relics.length === 0 ? (
              <span className="text-gray-500 text-sm">なし</span>
            ) : (
              run.relics.map((relic, index) => {
                const price = getSellPriceItem(relic)
                return (
                  <div
                    key={`owned-relic-${index}`}
                    className="border border-gray-500 bg-gray-800 rounded-lg p-2 text-sm cursor-pointer hover:bg-gray-700"
                    onClick={() => sellRelic(index)}
                  >
                    <div className="text-white">{relic.name}</div>
                    <div className="text-xs text-green-400">売却: {price}G</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ポーション */}
        <div className="mb-4">
          <h3 className="text-sm text-gray-400 mb-2">ポーション ({run.potions.length}/2)</h3>
          <div className="flex flex-wrap gap-2">
            {run.potions.length === 0 ? (
              <span className="text-gray-500 text-sm">なし</span>
            ) : (
              run.potions.map((potion, index) => {
                const price = getSellPriceItem(potion)
                return (
                  <div
                    key={`owned-potion-${index}`}
                    className="border border-gray-500 bg-gray-800 rounded-lg p-2 text-sm cursor-pointer hover:bg-gray-700"
                    onClick={() => sellPotion(index)}
                  >
                    <div className="text-white">{potion.name}</div>
                    <div className="text-xs text-green-400">売却: {price}G</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 次へボタン */}
      <div className="flex justify-center">
        <Button variant="primary" size="lg" onClick={closeStore}>
          次の戦闘へ
        </Button>
      </div>
    </div>
  )
}
