import { useState, useCallback, useRef, useMemo } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { ResourceBar, Tooltip, TooltipCard } from '../Common'
import { MapOverlay } from '../Store/MapOverlay'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../../Lib/Types/Weapon'
import { SpellData, SpellInstance } from '../../Lib/Types/Spell'
import { RelicData, RelicInstance } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { getSellPrice, getSellPriceItem, isWeaponData, isSpellData, STORE_CATEGORY_LABELS } from '../../Lib/Core/StoreLogic'
import { ShopSlot, ShopOption } from '../../Lib/Types/Game'
import { getRequiredKillsForNextLevel } from '../../Lib/Core/LevelUpCalculator'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'
import { calculateRelicAttackImpacts, MemberAttackImpact } from '../../Lib/Utils/RelicImpactCalculator'

// === 型定義 ===

type SoldItem = {
  name: string
  type: 'weapon' | 'spell' | 'relic' | 'potion'
  sellPrice: number
  memberIndex: number
  weapon?: ExplorerWeapon
  spell?: SpellInstance
  relicData?: RelicData
  potionData?: PotionData
}

type PurchaseRecord = {
  itemId: string
  type: 'weapon' | 'spell' | 'relic' | 'potion'
  shopSlotIndex: number
  item: WeaponData | SpellData | RelicData | PotionData
}

type ShopDragData =
  | { source: 'shop-weapon'; slotIndex: number; item: WeaponData | SpellData }
  | { source: 'shop-relic'; slotIndex: number; item: RelicData }
  | { source: 'shop-potion'; slotIndex: number; item: PotionData }
  | { source: 'inv-weapon'; memberIndex: number; weaponIndex: number; weapon: ExplorerWeapon }
  | { source: 'inv-spell'; memberIndex: number; spellIndex: number; spell: SpellInstance }
  | { source: 'inv-relic'; relicIndex: number }
  | { source: 'inv-potion'; potionIndex: number }
  | { source: 'sold-item'; soldIndex: number; soldItem: SoldItem }

/** ShopSlotからShopDragDataを生成する */
function slotToDragData(slotIndex: number, slot: ShopSlot): ShopDragData | null {
  if (!slot.item) return null
  switch (slot.category) {
    case 'weapon':
      return { source: 'shop-weapon', slotIndex, item: slot.item }
    case 'spell':
      return { source: 'shop-weapon', slotIndex, item: slot.item }
    case 'relic':
      return { source: 'shop-relic', slotIndex, item: slot.item }
    case 'potion':
      return { source: 'shop-potion', slotIndex, item: slot.item }
  }
}

/** ShopSlotのカテゴリからアイテムタイプカラーを取得 */
function getSlotType(slot: ShopSlot): 'weapon' | 'spell' | 'relic' | 'potion' {
  return slot.category
}

// === ダメージ予測ヘルパー ===

/** 武器/魔法の最大ダメージを出せるメンバーを見つけてダメージ予測を返す */
function getBestDamagePreview(
  item: WeaponData | SpellData,
  party: ExplorerState[],
  relics: RelicData[],
): { memberName: string; display: string } | null {
  if (item.power <= 0) return null
  let bestMax = -1
  let bestDisplay = ''
  let bestName = ''

  const opts = { relics }
  for (const member of party) {
    const range = isWeaponData(item)
      ? predictWeaponDamage(member, item, opts)
      : predictSpellDamage(member, item as SpellData, opts)
    if (range.max > bestMax) {
      bestMax = range.max
      bestDisplay = formatDamageRange(range)
      bestName = member.name
    }
  }
  return bestMax > 0 ? { memberName: bestName, display: bestDisplay } : null
}

/** 特定メンバーでのダメージ予測 */
function getMemberDamagePreview(
  item: WeaponData | SpellData,
  member: ExplorerState,
  relics: RelicData[],
): string | null {
  if (item.power <= 0) return null
  const opts = { relics }
  const range = isWeaponData(item)
    ? predictWeaponDamage(member, item, opts)
    : predictSpellDamage(member, item as SpellData, opts)
  return range.max > 0 ? formatDamageRange(range) : null
}

// === D&Dユーティリティ ===

function DraggableShopItem({ id, data, children, disabled }: { id: string; data: ShopDragData; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`${isDragging ? 'opacity-40' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} select-none`}>
      {children}
    </div>
  )
}

function DroppableSlot({ id, children, disabled, className }: { id: string; children: React.ReactNode; disabled?: boolean; className?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled })
  return (
    <div ref={setNodeRef} className={`${isOver && !disabled ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''} ${disabled ? 'opacity-30' : ''} ${className ?? ''}`}>
      {children}
    </div>
  )
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-gray-600 rounded p-1.5 h-full flex items-center justify-center">
      <span className="text-gray-600 text-[10px]">{label}</span>
    </div>
  )
}

// === 商品カード（ダメージ予測付き） ===

function ShopItemCard({ name, price, type, damageInfo, usesInfo, item, attackImpacts }: {
  name: string; price: number; type: 'weapon' | 'spell' | 'relic' | 'potion'
  damageInfo?: { memberName: string; display: string } | null
  usesInfo?: string | null
  item: WeaponData | SpellData | RelicData | PotionData
  attackImpacts?: MemberAttackImpact[]
}) {
  const typeColors = { weapon: 'border-orange-500 bg-orange-900/20', spell: 'border-purple-500 bg-purple-900/20', relic: 'border-yellow-500 bg-yellow-900/20', potion: 'border-teal-500 bg-teal-900/20' }
  const isAoe = 'targetType' in item && item.targetType === 'enemyAll'
  return (
    <Tooltip content={<TooltipCard item={item} damageText={damageInfo?.display} attackImpacts={attackImpacts} />} position="bottom">
      <div className={`border rounded p-1.5 text-xs ${typeColors[type]}`}>
        <div className="flex items-center gap-1">
          <span className="text-white font-bold truncate flex-1">{name}</span>
          {isAoe && <span className="text-[8px] bg-red-700 text-white px-0.5 rounded flex-shrink-0">全体</span>}
        </div>
        {damageInfo && (
          <div className="text-gray-400 text-[9px]">
            <span className="text-gray-500">({damageInfo.memberName})</span> {damageInfo.display}
          </div>
        )}
        {usesInfo && <div className="text-gray-500 text-[9px]">{usesInfo}</div>}
        <div className="text-yellow-400">{price}G</div>
      </div>
    </Tooltip>
  )
}

// === ショップ選択画面のプレビュー ===

// === ショップスロットのレンダラー ===

function ShopSlotRenderer({
  slot,
  slotIndex,
  dmgPreview,
  attackImpacts,
}: {
  slot: ShopSlot
  slotIndex: number
  dmgPreview: { memberName: string; display: string } | null
  attackImpacts?: MemberAttackImpact[]
}) {
  if (!slot.item) {
    return (
      <DroppableSlot id={`return-slot-${slotIndex}`}>
        <div className="border-2 border-dashed border-gray-700 rounded p-1.5 h-full flex items-center justify-center">
          <span className="text-gray-600 text-[10px]">売り切れ</span>
        </div>
      </DroppableSlot>
    )
  }

  const item = slot.item
  const dragData = slotToDragData(slotIndex, slot)
  if (!dragData) return null

  const type = getSlotType(slot)
  const usesInfo = getSlotUsesInfo(slot)

  return (
    <DraggableShopItem id={`shop-slot-${slotIndex}`} data={dragData}>
      <ShopItemCard
        name={item.name}
        price={item.price}
        type={type}
        damageInfo={dmgPreview}
        usesInfo={usesInfo}
        item={item}
        attackImpacts={attackImpacts}
      />
    </DraggableShopItem>
  )
}

/** スロットの使用回数/MP情報を取得 */
function getSlotUsesInfo(slot: ShopSlot): string | null {
  if (!slot.item) return null
  switch (slot.category) {
    case 'weapon':
      return slot.item.maxUses !== null ? `${slot.item.maxUses}回` : null
    case 'spell':
      return `${slot.item.mpCost}MP`
    default:
      return null
  }
}

// === キャラ欄 ===

function StoreCharacterPanel({
  member,
  memberIndex,
  dragData,
  movedKeys,
  newPurchaseKeys,
  relics,
}: {
  member: ExplorerState
  memberIndex: number
  dragData: ShopDragData | null
  movedKeys: Set<string>
  newPurchaseKeys: Set<string>
  relics: RelicData[]
}) {
  const purchasedWeapons = member.weapons.filter(w => w.maxUses !== null)
  const infiniteWeapons = member.weapons.filter(w => w.maxUses === null)
  const weaponEmptyCount = Math.max(0, member.weaponSlotCount - purchasedWeapons.length)
  const spellEmptyCount = Math.max(0, member.magicSlotCount - member.spells.length)

  const requiredKills = getRequiredKillsForNextLevel(member.level)
  const expProgress = requiredKills > 0 ? member.exp : 0

  const isDraggingWeapon = dragData && (
    (dragData.source === 'shop-weapon' && isWeaponData(dragData.item as WeaponData | SpellData))
    || dragData.source === 'inv-weapon'
    || (dragData.source === 'sold-item' && dragData.soldItem.type === 'weapon')
  )
  const isDraggingSpell = dragData && (
    (dragData.source === 'shop-weapon' && isSpellData(dragData.item as WeaponData | SpellData))
    || dragData.source === 'inv-spell'
    || (dragData.source === 'sold-item' && dragData.soldItem.type === 'spell')
  )
  const weaponDropDisabled = !!(isDraggingSpell)
  const spellDropDisabled = !!(isDraggingWeapon)

  const opts = { relics }

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded p-1.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-white font-bold text-xs">{member.name}</span>
        <span className="text-yellow-400 text-[10px]">Lv.{member.level}</span>
      </div>

      <div className="mb-0.5">
        <div className="flex justify-between text-[9px] text-gray-400"><span className="text-red-400">HP</span><span>{member.hp}/{member.maxHp}</span></div>
        <ResourceBar current={member.hp} max={member.maxHp} color="green" showText={false} size="sm" />
      </div>
      <div className="mb-0.5">
        <div className="flex justify-between text-[9px] text-gray-400"><span className="text-blue-400">MP</span><span>{member.mp}/{member.maxMp}</span></div>
        <ResourceBar current={member.mp} max={member.maxMp} color="blue" showText={false} size="sm" />
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-[9px] text-gray-400"><span className="text-yellow-400">EXP</span><span>{expProgress}/{requiredKills}</span></div>
        <ResourceBar current={expProgress} max={requiredKills} color="yellow" showText={false} size="sm" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {purchasedWeapons.map((w, i) => {
          const realIndex = member.weapons.indexOf(w)
          const sellPrice = getSellPrice(w)
          const isMoved = movedKeys.has(`weapon-${memberIndex}-${w.id}`)
          const isNew = newPurchaseKeys.has(`weapon-${memberIndex}-${w.id}`)
          const range = predictWeaponDamage(member, w, opts)
          const dmg = formatDamageRange(range)
          return (
            <Tooltip key={`w-${i}`} content={<TooltipCard item={w} damageText={dmg} />} position="bottom">
              <DraggableShopItem id={`inv-weapon-${memberIndex}-${realIndex}`}
                data={{ source: 'inv-weapon', memberIndex, weaponIndex: realIndex, weapon: w }}>
                <div className={`relative border rounded p-1.5 text-[10px] border-orange-500/50 bg-orange-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[7px] font-bold px-1 rounded">NEW</span>}
                  <div className="flex items-center gap-1">
                    <span className="text-white flex-1 truncate font-bold">{w.name}</span>
                    {w.targetType === 'enemyAll' && <span className="text-[8px] bg-red-700 text-white px-0.5 rounded flex-shrink-0">全体</span>}
                    {w.currentUses !== null && <span className="text-gray-400">{w.currentUses}/{w.maxUses}</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{dmg}</span>
                    <span className="text-green-400">売却 {sellPrice}G</span>
                  </div>
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: weaponEmptyCount }).map((_, i) => (
          <DroppableSlot key={`we-${i}`} id={`slot-weapon-${memberIndex}-${i}`} disabled={weaponDropDisabled}>
            <EmptySlot label="武器 空き" />
          </DroppableSlot>
        ))}
        {infiniteWeapons.map((w, i) => {
          const range = predictWeaponDamage(member, w, opts)
          const dmg = formatDamageRange(range)
          return (
            <Tooltip key={`iw-${i}`} content={<TooltipCard item={w} damageText={dmg} durabilityText="∞" />} position="bottom">
              <div className="border rounded p-1.5 text-[10px] border-gray-600/50 bg-gray-800/30 opacity-60">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate flex-1">{w.name}</span>
                  {w.targetType === 'enemyAll' && <span className="text-[8px] bg-red-700 text-white px-0.5 rounded flex-shrink-0">全体</span>}
                </div>
                <div className="text-gray-500">{dmg}</div>
              </div>
            </Tooltip>
          )
        })}

        {member.spells.map((s, i) => {
          const sellPrice = getSellPriceItem(s)
          const isMoved = movedKeys.has(`spell-${memberIndex}-${s.id}`)
          const isNew = newPurchaseKeys.has(`spell-${memberIndex}-${s.id}`)
          const range = predictSpellDamage(member, s, opts)
          const dmg = s.power > 0 ? formatDamageRange(range) : null
          return (
            <Tooltip key={`s-${i}`} content={<TooltipCard item={s} damageText={dmg || undefined} />} position="bottom">
              <DraggableShopItem id={`inv-spell-${memberIndex}-${i}`}
                data={{ source: 'inv-spell', memberIndex, spellIndex: i, spell: s }}>
                <div className={`relative border rounded p-1.5 text-[10px] border-purple-500/50 bg-purple-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[7px] font-bold px-1 rounded">NEW</span>}
                  <div className="flex items-center gap-1">
                    <span className="text-white flex-1 truncate font-bold">{s.name}</span>
                    {s.targetType === 'enemyAll' && <span className="text-[8px] bg-red-700 text-white px-0.5 rounded flex-shrink-0">全体</span>}
                    <span className="text-gray-400">{s.mpCost}MP</span>
                  </div>
                  <div className="flex justify-between">
                    {dmg && <span className="text-gray-400">{dmg}</span>}
                    <span className="text-green-400 ml-auto">売却 {sellPrice}G</span>
                  </div>
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: spellEmptyCount }).map((_, i) => (
          <DroppableSlot key={`se-${i}`} id={`slot-spell-${memberIndex}-${i}`} disabled={spellDropDisabled}>
            <EmptySlot label="魔法 空き" />
          </DroppableSlot>
        ))}
      </div>
    </div>
  )
}

// === 共有枠 ===

function StoreSharedPanel({
  potions,
  relics,
  movedKeys,
  newPurchaseKeys,
  party,
}: {
  potions: PotionData[]
  relics: RelicInstance[]
  movedKeys: Set<string>
  newPurchaseKeys: Set<string>
  party: ExplorerState[]
}) {
  const potionEmptyCount = Math.max(0, 2 - potions.length)
  const relicEmptyCount = Math.max(0, 5 - relics.length)

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded p-1.5">
      <div className="mb-1">
        <div className="text-[9px] text-gray-500 mb-0.5">ポーション</div>
        {potions.map((p, i) => {
          const sellPrice = getSellPriceItem(p as { price: number })
          const isMoved = movedKeys.has(`potion-${p.id}`)
          const isNew = newPurchaseKeys.has(`potion-${p.id}`)
          return (
            <Tooltip key={`p-${i}`} content={<TooltipCard item={p} />} position="bottom">
              <DraggableShopItem id={`inv-potion-${i}`}
                data={{ source: 'inv-potion', potionIndex: i }}>
                <div className={`relative border rounded p-1.5 text-[10px] border-teal-500/50 bg-teal-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[7px] font-bold px-1 rounded">NEW</span>}
                  <div className="text-white truncate font-bold">{p.name}</div>
                  <div className="text-green-400 text-[9px]">売却 {sellPrice}G</div>
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: potionEmptyCount }).map((_, i) => (
          <DroppableSlot key={`pe-${i}`} id={`slot-potion-${i}`}>
            <EmptySlot label="ポーション 空き" />
          </DroppableSlot>
        ))}
      </div>
      <div className="border-t border-gray-700 my-1" />
      <div className="flex-1">
        <div className="text-[9px] text-gray-500 mb-0.5">レリック</div>
        {relics.map((r, i) => {
          const sellPrice = getSellPriceItem(r as { price: number })
          const isMoved = movedKeys.has(`relic-${r.id}`)
          const isNew = newPurchaseKeys.has(`relic-${r.id}`)
          return (
            <Tooltip key={`r-${i}`} content={<TooltipCard item={r} attackImpacts={calculateRelicAttackImpacts(r, party, relics.filter((x: RelicInstance) => x.id !== r.id))} />} position="bottom">
              <DraggableShopItem id={`inv-relic-${i}`}
                data={{ source: 'inv-relic', relicIndex: i }}>
                <div className={`relative border rounded p-1.5 text-[10px] border-yellow-500/50 bg-yellow-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[7px] font-bold px-1 rounded">NEW</span>}
                  <div className="text-white truncate font-bold">{r.name}</div>
                  <div className="text-green-400 text-[9px]">売却 {sellPrice}G</div>
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: relicEmptyCount }).map((_, i) => (
          <DroppableSlot key={`re-${i}`} id={`slot-relic-${i}`}>
            <EmptySlot label="レリック 空き" />
          </DroppableSlot>
        ))}
      </div>
    </div>
  )
}

// === メイン ===

export function StoreScreen() {
  const {
    state,
    buyWeapon, buySpell, buyRelic, buyPotion,
    sellWeapon, sellSpell, sellRelic, sellPotion,
    undoBuyWeapon, undoBuySpell, undoBuyRelic, undoBuyPotion,
    undoSellWeapon, undoSellSpell, undoSellRelic, undoSellPotion,
    transferWeapon, transferSpell,
    rerollStore, closeStore, selectShop,
  } = useGame()

  const [showMap, setShowMap] = useState(false)
  const [dragData, setDragData] = useState<ShopDragData | null>(null)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  const [soldItems, setSoldItems] = useState<SoldItem[]>([])
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([])
  // 移動済みアイテムキー（点滅表示用）
  const [movedKeys, setMovedKeys] = useState<Set<string>>(new Set())
  // 新規購入アイテムキー（NEWバッジ表示用）
  const [newPurchaseKeys, setNewPurchaseKeys] = useState<Set<string>>(new Set())
  // ドラッグ中にホバーしているメンバーのインデックス
  const [hoverMemberIndex, setHoverMemberIndex] = useState<number | null>(null)
  const initialGoldRef = useRef<number | null>(null)

  const { run, storeState, mapState } = state
  if (!run || !storeState) return null

  const gold = run.gold

  if (initialGoldRef.current === null) {
    initialGoldRef.current = gold
  }
  const initialGold = initialGoldRef.current

  // 選択中のショップ
  const selectedShop: ShopOption | null = storeState.selectedShopIndex !== null
    ? storeState.shopOptions[storeState.selectedShopIndex]
    : null

  // 商品カード用のダメージ予測をメモ化（選択済みショップのスロットベース）
  const shopDamagePreviews = useMemo(() => {
    const previews: Map<number, { memberName: string; display: string } | null> = new Map()
    if (!selectedShop) return previews
    selectedShop.slots.forEach((slot, index) => {
      if (!slot.item) { previews.set(index, null); return }
      // 武器/魔法のみダメージ予測
      if (slot.category !== 'weapon' && slot.category !== 'spell') {
        previews.set(index, null)
        return
      }
      const item = slot.item as WeaponData | SpellData
      if (hoverMemberIndex !== null && run.party[hoverMemberIndex]) {
        const member = run.party[hoverMemberIndex]
        const dmg = getMemberDamagePreview(item, member, run.relics as RelicData[])
        previews.set(index, dmg ? { memberName: member.name, display: dmg } : null)
      } else {
        previews.set(index, getBestDamagePreview(item, run.party, run.relics as RelicData[]))
      }
    })
    return previews
  }, [selectedShop, run.party, run.relics, hoverMemberIndex])

  // 商品カード用のレリック攻撃力影響をメモ化（レリックスロット専用）
  const shopAttackImpacts = useMemo(() => {
    const impacts: Map<number, MemberAttackImpact[] | undefined> = new Map()
    if (!selectedShop) return impacts
    selectedShop.slots.forEach((slot, index) => {
      if (slot.category !== 'relic' || !slot.item) return
      impacts.set(index, calculateRelicAttackImpacts(slot.item as RelicData, run.party, run.relics))
    })
    return impacts
  }, [selectedShop, run.party, run.relics])

  const addMovedKey = useCallback((key: string) => {
    setMovedKeys(prev => new Set(prev).add(key))
  }, [])

  const removeMovedKey = useCallback((key: string) => {
    setMovedKeys(prev => { const s = new Set(prev); s.delete(key); return s })
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ShopDragData
    setDragData(data)
    if ('item' in data) setDraggingLabel((data.item as { name: string }).name)
    else if ('weapon' in data) setDraggingLabel((data as { weapon: ExplorerWeapon }).weapon.name)
    else if ('spell' in data) setDraggingLabel((data as { spell: SpellInstance }).spell.name)
    else if (data.source === 'inv-relic') setDraggingLabel(run.relics[data.relicIndex]?.name ?? '')
    else if (data.source === 'inv-potion') setDraggingLabel(run.potions[data.potionIndex]?.name ?? '')
    else if (data.source === 'sold-item') setDraggingLabel(data.soldItem.name)
  }, [run])

  // ドラッグ中のホバー検知（商品カードのダメージ予測メンバー切替用）
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined
    if (!overId) { setHoverMemberIndex(null); return }
    // slot-weapon-{memberIndex}-{slotIndex} パターンからメンバーを検出
    if (overId.startsWith('slot-weapon-') || overId.startsWith('slot-spell-')) {
      const memberIdx = parseInt(overId.split('-')[2])
      if (!isNaN(memberIdx)) { setHoverMemberIndex(memberIdx); return }
    }
    setHoverMemberIndex(null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragData(null)
    setDraggingLabel(null)
    setHoverMemberIndex(null)
    if (!event.over) return
    const dropId = event.over.id as string
    const data = event.active.data.current as ShopDragData

    // === 商品→空き枠 (購入) ===
    if (data.source === 'shop-weapon') {
      const item = data.item
      if (dropId.startsWith('slot-weapon-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        if (isWeaponData(item)) {
          buyWeapon(data.slotIndex, item, memberIndex)
          addMovedKey(`weapon-${memberIndex}-${item.id}`)
          setNewPurchaseKeys(prev => new Set(prev).add(`weapon-${memberIndex}-${item.id}`))
          setPurchaseRecords(prev => [...prev, { itemId: item.id, type: 'weapon', shopSlotIndex: data.slotIndex, item }])
        }
      } else if (dropId.startsWith('slot-spell-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        if (isSpellData(item)) {
          buySpell(data.slotIndex, item, memberIndex)
          addMovedKey(`spell-${memberIndex}-${item.id}`)
          setNewPurchaseKeys(prev => new Set(prev).add(`spell-${memberIndex}-${item.id}`))
          setPurchaseRecords(prev => [...prev, { itemId: item.id, type: 'spell', shopSlotIndex: data.slotIndex, item }])
        }
      }
    }
    if (data.source === 'shop-relic' && dropId.startsWith('slot-relic-')) {
      buyRelic(data.slotIndex, data.item)
      addMovedKey(`relic-${data.item.id}`)
      setNewPurchaseKeys(prev => new Set(prev).add(`relic-${data.item.id}`))
      setPurchaseRecords(prev => [...prev, { itemId: data.item.id, type: 'relic', shopSlotIndex: data.slotIndex, item: data.item }])
    }
    if (data.source === 'shop-potion' && dropId.startsWith('slot-potion-')) {
      buyPotion(data.slotIndex, data.item)
      addMovedKey(`potion-${data.item.id}`)
      setNewPurchaseKeys(prev => new Set(prev).add(`potion-${data.item.id}`))
      setPurchaseRecords(prev => [...prev, { itemId: data.item.id, type: 'potion', shopSlotIndex: data.slotIndex, item: data.item }])
    }

    // === 装備→売却枠 (売却) ===
    if (dropId === 'sell-zone') {
      if (data.source === 'inv-weapon') {
        const weapon = run.party[data.memberIndex]?.weapons[data.weaponIndex]
        if (weapon) {
          setSoldItems(prev => [...prev, { name: weapon.name, type: 'weapon', sellPrice: getSellPrice(weapon), memberIndex: data.memberIndex, weapon }])
          sellWeapon(data.weaponIndex, data.memberIndex)
        }
      }
      if (data.source === 'inv-spell') {
        const spell = run.party[data.memberIndex]?.spells[data.spellIndex]
        if (spell) {
          setSoldItems(prev => [...prev, { name: spell.name, type: 'spell', sellPrice: getSellPriceItem(spell), memberIndex: data.memberIndex, spell }])
          sellSpell(data.spellIndex, data.memberIndex)
        }
      }
      if (data.source === 'inv-relic') {
        const relic = run.relics[data.relicIndex]
        if (relic) {
          setSoldItems(prev => [...prev, { name: relic.name, type: 'relic', sellPrice: getSellPriceItem(relic), memberIndex: 0, relicData: relic as RelicData }])
          sellRelic(data.relicIndex)
        }
      }
      if (data.source === 'inv-potion') {
        const potion = run.potions[data.potionIndex]
        if (potion) {
          setSoldItems(prev => [...prev, { name: potion.name, type: 'potion', sellPrice: getSellPriceItem(potion), memberIndex: 0, potionData: potion as PotionData }])
          sellPotion(data.potionIndex)
        }
      }
    }

    // === 装備→商品枠 (購入取り消し) ===
    // 商品エリア内のどこにドロップしても、購入記録があれば元のスロットに返す
    const isShopReturnDrop = dropId === 'shop-return-zone' || dropId.startsWith('return-slot-')
    if (isShopReturnDrop) {
      if (data.source === 'inv-weapon') {
        const record = purchaseRecords.find(r => r.itemId === data.weapon.id && r.type === 'weapon')
        if (record) {
          undoBuyWeapon(record.shopSlotIndex, record.item as WeaponData, data.memberIndex, data.weaponIndex)
          removeMovedKey(`weapon-${data.memberIndex}-${data.weapon.id}`)
          setNewPurchaseKeys(prev => { const s = new Set(prev); s.delete(`weapon-${data.memberIndex}-${data.weapon.id}`); return s })
          setPurchaseRecords(prev => prev.filter(r => !(r.itemId === record.itemId && r.shopSlotIndex === record.shopSlotIndex && r.type === record.type)))
        }
      }
      if (data.source === 'inv-spell') {
        const record = purchaseRecords.find(r => r.itemId === data.spell.id && r.type === 'spell')
        if (record) {
          undoBuySpell(record.shopSlotIndex, record.item as SpellData, data.memberIndex, data.spellIndex)
          removeMovedKey(`spell-${data.memberIndex}-${data.spell.id}`)
          setNewPurchaseKeys(prev => { const s = new Set(prev); s.delete(`spell-${data.memberIndex}-${data.spell.id}`); return s })
          setPurchaseRecords(prev => prev.filter(r => !(r.itemId === record.itemId && r.shopSlotIndex === record.shopSlotIndex && r.type === record.type)))
        }
      }
      if (data.source === 'inv-relic') {
        const relic = run.relics[data.relicIndex]
        const record = relic && purchaseRecords.find(r => r.itemId === relic.id && r.type === 'relic')
        if (record) {
          undoBuyRelic(record.shopSlotIndex, record.item as RelicData, data.relicIndex)
          removeMovedKey(`relic-${relic.id}`)
          setNewPurchaseKeys(prev => { const s = new Set(prev); s.delete(`relic-${relic.id}`); return s })
          setPurchaseRecords(prev => prev.filter(r => !(r.itemId === record.itemId && r.shopSlotIndex === record.shopSlotIndex && r.type === record.type)))
        }
      }
      if (data.source === 'inv-potion') {
        const potion = run.potions[data.potionIndex]
        const record = potion && purchaseRecords.find(r => r.itemId === potion.id && r.type === 'potion')
        if (record) {
          undoBuyPotion(record.shopSlotIndex, record.item as PotionData, data.potionIndex)
          removeMovedKey(`potion-${potion.id}`)
          setNewPurchaseKeys(prev => { const s = new Set(prev); s.delete(`potion-${potion.id}`); return s })
          setPurchaseRecords(prev => prev.filter(r => !(r.itemId === record.itemId && r.shopSlotIndex === record.shopSlotIndex && r.type === record.type)))
        }
      }
    }

    // === メンバー間装備移動 ===
    if (data.source === 'inv-weapon' && dropId.startsWith('slot-weapon-')) {
      const toMemberIndex = parseInt(dropId.split('-')[2])
      if (toMemberIndex !== data.memberIndex) {
        transferWeapon(data.memberIndex, data.weaponIndex, toMemberIndex)
        addMovedKey(`weapon-${toMemberIndex}-${data.weapon.id}`)
        // NEWバッジをメンバー移動に追従
        setNewPurchaseKeys(prev => {
          const oldKey = `weapon-${data.memberIndex}-${data.weapon.id}`
          if (!prev.has(oldKey)) return prev
          const next = new Set(prev)
          next.delete(oldKey)
          next.add(`weapon-${toMemberIndex}-${data.weapon.id}`)
          return next
        })
      }
    }
    if (data.source === 'inv-spell' && dropId.startsWith('slot-spell-')) {
      const toMemberIndex = parseInt(dropId.split('-')[2])
      if (toMemberIndex !== data.memberIndex) {
        transferSpell(data.memberIndex, data.spellIndex, toMemberIndex)
        addMovedKey(`spell-${toMemberIndex}-${data.spell.id}`)
        setNewPurchaseKeys(prev => {
          const oldKey = `spell-${data.memberIndex}-${data.spell.id}`
          if (!prev.has(oldKey)) return prev
          const next = new Set(prev)
          next.delete(oldKey)
          next.add(`spell-${toMemberIndex}-${data.spell.id}`)
          return next
        })
      }
    }

    // === 売却枠→空き枠 (売却取り消し) ===
    if (data.source === 'sold-item') {
      const sold = data.soldItem
      if (sold.type === 'weapon' && sold.weapon && dropId.startsWith('slot-weapon-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        undoSellWeapon(sold.weapon, memberIndex, sold.sellPrice)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
      if (sold.type === 'spell' && sold.spell && dropId.startsWith('slot-spell-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        undoSellSpell(sold.spell, memberIndex, sold.sellPrice)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
      if (sold.type === 'relic' && sold.relicData && dropId.startsWith('slot-relic-')) {
        undoSellRelic(sold.relicData, sold.sellPrice)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
      if (sold.type === 'potion' && sold.potionData && dropId.startsWith('slot-potion-')) {
        undoSellPotion(sold.potionData, sold.sellPrice)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
    }
  }, [run, purchaseRecords, buyWeapon, buySpell, buyRelic, buyPotion, sellWeapon, sellSpell, sellRelic, sellPotion, undoBuyWeapon, undoBuySpell, undoBuyRelic, undoBuyPotion, undoSellWeapon, undoSellSpell, undoSellRelic, undoSellPotion, transferWeapon, transferSpell, addMovedKey, removeMovedKey])

  const handleDragCancel = useCallback(() => {
    setDragData(null)
    setDraggingLabel(null)
    setHoverMemberIndex(null)
  }, [])

  // ショップ選択画面
  if (storeState.selectedShopIndex === null) {
    return (
      <div className="min-h-screen bg-gray-800 p-2 flex flex-col gap-2">

        {/* ===== ショップ選択エリア（商品エリアの位置） ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-bold text-xs">ショップを選択</span>
            <span className="text-yellow-400 font-bold text-sm">{gold}G</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {storeState.shopOptions.map((option, optIdx) => (
              <button
                key={optIdx}
                className="bg-gray-800 border-2 border-gray-600 hover:border-yellow-400 rounded-lg p-3 flex flex-col items-center gap-1 transition-colors cursor-pointer min-h-[80px]"
                onClick={() => selectShop(optIdx)}
              >
                <div className="text-white font-bold text-sm">
                  {STORE_CATEGORY_LABELS[option.categories[0]]}
                  <span className="text-gray-500 mx-1">・</span>
                  {STORE_CATEGORY_LABELS[option.categories[1]]}
                </div>
                <div className="text-gray-500 text-[10px]">各{option.slots.length / 2}枠</div>
              </button>
            ))}
          </div>
        </div>

        {/* ===== キャラ欄4等分（3キャラ + 共有枠） ===== */}
        <div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0">
          {run.party.map((member, index) => (
            <StoreCharacterPanel
              key={member.id}
              member={member}
              memberIndex={index}
              dragData={null}
              movedKeys={movedKeys}
              newPurchaseKeys={newPurchaseKeys}
              relics={run.relics as RelicData[]}
            />
          ))}
          <StoreSharedPanel
            potions={run.potions}
            relics={run.relics}
            movedKeys={movedKeys}
            newPurchaseKeys={newPurchaseKeys}
            party={run.party}
          />
        </div>

        {/* ===== スキップボタン ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="flex gap-2 justify-center">
            {mapState && (
              <Button variant="secondary" onClick={() => setShowMap(true)}>マップ</Button>
            )}
            <Button variant="primary" onClick={closeStore} className="flex-1 max-w-md">
              ショップをスキップ
            </Button>
          </div>
        </div>

        {showMap && mapState && (
          <MapOverlay nodes={mapState.nodes} currentStage={mapState.currentStage} onClose={() => setShowMap(false)} />
        )}
      </div>
    )
  }

  // ショップ選択済み: 通常のショップ画面
  const shop = selectedShop!
  const topSlots = shop.slots.slice(0, 3)
  const bottomSlots = shop.slots.slice(3, 6)

  return (
    <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={pointerWithin}>
      <div className="min-h-screen bg-gray-800 p-2 flex flex-col gap-2">

        {/* ===== 商品エリア + 売却枠 ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative min-h-[200px] flex gap-2">
          {/* 商品エリア全体をドロップ可能に（購入取り消し用） */}
          <DroppableSlot id="shop-return-zone" className="flex-1">
            <div>
              {/* ヘッダー */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-xs">ショップ</span>
                  <Button variant="secondary" onClick={rerollStore} disabled={gold < storeState.rerollCost} className="text-[10px] px-2 py-0.5">
                    リロール ({storeState.rerollCost}G)
                  </Button>
                </div>
                <span className="font-bold text-sm">
                  {initialGold !== gold ? (
                    <>
                      <span className="text-gray-400">{initialGold}G</span>
                      <span className="text-gray-500 mx-1">→</span>
                      <span className={gold < 0 ? 'text-red-400' : 'text-yellow-400'}>{gold}G</span>
                    </>
                  ) : (
                    <span className="text-yellow-400">{gold}G</span>
                  )}
                </span>
              </div>

              {/* 上段: 最初のカテゴリ3枠 */}
              <div className="mb-2">
                <div className="text-[9px] text-gray-500 mb-1">{STORE_CATEGORY_LABELS[shop.categories[0]]}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {topSlots.map((slot, localIdx) => {
                    const slotIndex = localIdx
                    return (
                      <ShopSlotRenderer
                        key={`top-${localIdx}`}
                        slot={slot}
                        slotIndex={slotIndex}
                        dmgPreview={shopDamagePreviews.get(slotIndex) ?? null}
                        attackImpacts={shopAttackImpacts.get(slotIndex)}
                      />
                    )
                  })}
                </div>
              </div>

              {/* 下段: 2番目のカテゴリ3枠 */}
              <div>
                <div className="text-[9px] text-gray-500 mb-1">{STORE_CATEGORY_LABELS[shop.categories[1]]}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {bottomSlots.map((slot, localIdx) => {
                    const slotIndex = localIdx + 3
                    return (
                      <ShopSlotRenderer
                        key={`bottom-${localIdx}`}
                        slot={slot}
                        slotIndex={slotIndex}
                        dmgPreview={shopDamagePreviews.get(slotIndex) ?? null}
                        attackImpacts={shopAttackImpacts.get(slotIndex)}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </DroppableSlot>

          {/* 売却枠 */}
          <DroppableSlot id="sell-zone" className="w-32 flex-shrink-0">
            <div className="h-full border-2 border-dashed border-red-700/50 rounded flex flex-col bg-red-900/10 p-1.5">
              <div className="text-red-400 text-[9px] font-bold text-center mb-1">売却</div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {soldItems.map((item, i) => {
                  const typeColors: Record<string, string> = {
                    weapon: 'border-orange-500/50', spell: 'border-purple-500/50',
                    relic: 'border-yellow-500/50', potion: 'border-teal-500/50',
                  }
                  return (
                    <DraggableShopItem key={`sold-${i}`} id={`sold-item-${i}`}
                      data={{ source: 'sold-item', soldIndex: i, soldItem: item }}>
                      <div className={`text-[9px] border rounded px-1.5 py-0.5 ${typeColors[item.type]} bg-gray-800/50 cursor-grab active:cursor-grabbing animate-slow-blink`}>
                        <div className="text-gray-300 truncate">{item.name}</div>
                        <div className="text-green-400">+{item.sellPrice}G</div>
                      </div>
                    </DraggableShopItem>
                  )
                })}
              </div>
              {soldItems.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-red-400/50 text-[10px]">ここにドロップ</span>
                </div>
              )}
            </div>
          </DroppableSlot>
        </div>

        {/* ===== キャラ欄4等分（3キャラ + 共有枠） ===== */}
        <div className="grid grid-cols-4 gap-1.5 flex-1 min-h-0">
          {run.party.map((member, index) => (
            <StoreCharacterPanel
              key={member.id}
              member={member}
              memberIndex={index}
              dragData={dragData}
              movedKeys={movedKeys}
              newPurchaseKeys={newPurchaseKeys}
              relics={run.relics as RelicData[]}
            />
          ))}
          <StoreSharedPanel
            potions={run.potions}
            relics={run.relics}
            movedKeys={movedKeys}
            newPurchaseKeys={newPurchaseKeys}
            party={run.party}
          />
        </div>

        {/* ===== 確定ボタン ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="flex gap-2 justify-center">
            {mapState && (
              <Button variant="secondary" onClick={() => setShowMap(true)}>マップ</Button>
            )}
            <Button variant="primary" onClick={closeStore} disabled={gold < 0} className="flex-1 max-w-md">
              {gold < 0 ? `所持金不足 (${gold}G)` : '確定して出発'}
            </Button>
          </div>
        </div>

        {showMap && mapState && (
          <MapOverlay nodes={mapState.nodes} currentStage={mapState.currentStage} onClose={() => setShowMap(false)} />
        )}

        <DragOverlay>
          {draggingLabel && (
            <div className="bg-gray-800 border border-yellow-400 rounded px-3 py-1 text-sm text-white shadow-lg">
              {draggingLabel}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
