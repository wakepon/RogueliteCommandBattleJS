import { useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { ResourceBar } from '../Common'
import { MapOverlay } from '../Store/MapOverlay'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../../Lib/Types/Weapon'
import { SpellData, SpellInstance } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { getSellPrice, getSellPriceItem, isWeaponData, isSpellData } from '../../Lib/Core/StoreLogic'
import { getRequiredKillsForNextLevel } from '../../Lib/Core/LevelUpCalculator'

// === D&Dユーティリティ ===

type ShopDragData =
  | { source: 'shop-weapon'; slotIndex: number; item: WeaponData | SpellData }
  | { source: 'shop-relic'; slotIndex: number; item: RelicData }
  | { source: 'shop-potion'; slotIndex: number; item: PotionData }
  | { source: 'inv-weapon'; memberIndex: number; weaponIndex: number; weapon: ExplorerWeapon }
  | { source: 'inv-spell'; memberIndex: number; spellIndex: number; spell: SpellInstance }
  | { source: 'inv-relic'; relicIndex: number }
  | { source: 'inv-potion'; potionIndex: number }

/** ドラッグ可能な商品カード */
function DraggableShopItem({ id, data, children, disabled }: { id: string; data: ShopDragData; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`${isDragging ? 'opacity-40' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} select-none`}>
      {children}
    </div>
  )
}

/** ドロップ可能な枠 */
function DroppableSlot({ id, children, disabled, className }: { id: string; children: React.ReactNode; disabled?: boolean; className?: string }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled })
  return (
    <div ref={setNodeRef} className={`${isOver && !disabled ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''} ${disabled ? 'opacity-30' : ''} ${className ?? ''}`}>
      {children}
    </div>
  )
}

/** 商品カード */
function ShopItemCard({ name, price, type }: { name: string; price: number; type: 'weapon' | 'spell' | 'relic' | 'potion' }) {
  const typeColors = { weapon: 'border-orange-500 bg-orange-900/20', spell: 'border-purple-500 bg-purple-900/20', relic: 'border-yellow-500 bg-yellow-900/20', potion: 'border-teal-500 bg-teal-900/20' }
  return (
    <div className={`border rounded p-1.5 text-xs ${typeColors[type]}`}>
      <div className="text-white font-bold truncate">{name}</div>
      <div className="text-yellow-400">{price}G</div>
    </div>
  )
}

/** 空き枠表示 */
function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-gray-600 rounded p-1.5 h-full flex items-center justify-center">
      <span className="text-gray-600 text-[10px]">{label}</span>
    </div>
  )
}

/** ショップ用キャラ欄 */
function StoreCharacterPanel({
  member,
  memberIndex,
  dragData,
  newPurchaseIds,
}: {
  member: ExplorerState
  memberIndex: number
  dragData: ShopDragData | null
  newPurchaseIds: Set<string>
}) {
  const purchasedWeapons = member.weapons.filter(w => w.maxUses !== null)
  const infiniteWeapons = member.weapons.filter(w => w.maxUses === null)
  const weaponEmptyCount = Math.max(0, member.weaponSlotCount - purchasedWeapons.length)
  const spellEmptyCount = Math.max(0, member.magicSlotCount - member.spells.length)

  const requiredKills = getRequiredKillsForNextLevel(member.level)
  const expProgress = requiredKills > 0 ? member.exp : 0

  // ドラッグ中のアイテムに基づいてグレーアウト判定
  const isDraggingWeapon = dragData && ((dragData.source === 'shop-weapon' && isWeaponData(dragData.item as WeaponData | SpellData)) || dragData.source === 'inv-weapon')
  const isDraggingSpell = dragData && ((dragData.source === 'shop-weapon' && isSpellData(dragData.item as WeaponData | SpellData)) || dragData.source === 'inv-spell')
  const weaponDropDisabled = !!(isDraggingSpell)
  const spellDropDisabled = !!(isDraggingWeapon)

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded p-1.5">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-white font-bold text-xs">{member.name}</span>
        <span className="text-yellow-400 text-[10px]">Lv.{member.level}</span>
      </div>

      {/* HP/MP/EXP バー */}
      <div className="mb-0.5">
        <div className="flex justify-between text-[9px] text-gray-400"><span className="text-red-400">HP</span><span>{member.hp}/{member.maxHp}</span></div>
        <ResourceBar current={member.hp} max={member.maxHp} color="red" showText={false} size="sm" />
      </div>
      <div className="mb-0.5">
        <div className="flex justify-between text-[9px] text-gray-400"><span className="text-blue-400">MP</span><span>{member.mp}/{member.maxMp}</span></div>
        <ResourceBar current={member.mp} max={member.maxMp} color="blue" showText={false} size="sm" />
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-[9px] text-gray-400"><span className="text-yellow-400">EXP</span><span>{expProgress}/{requiredKills}</span></div>
        <ResourceBar current={expProgress} max={requiredKills} color="yellow" showText={false} size="sm" />
      </div>

      {/* 武器一覧 */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {/* 購入済み武器（売却可能） */}
        {purchasedWeapons.map((w, i) => {
          const realIndex = member.weapons.indexOf(w)
          const sellPrice = getSellPrice(w)
          const isNew = newPurchaseIds.has(`weapon-${memberIndex}-${w.id}`)
          return (
            <DraggableShopItem key={`w-${i}`} id={`inv-weapon-${memberIndex}-${realIndex}`}
              data={{ source: 'inv-weapon', memberIndex, weaponIndex: realIndex, weapon: w }}>
              <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${isNew ? 'ring-1 ring-yellow-400 bg-yellow-900/20' : 'hover:bg-gray-700'}`}>
                <span className="w-3 h-3 rounded text-[8px] flex items-center justify-center bg-orange-600 flex-shrink-0">剣</span>
                <span className="text-white flex-1 truncate">{w.name}</span>
                {w.currentUses !== null && <span className="text-gray-400">{w.currentUses}/{w.maxUses}</span>}
                <span className="text-green-400">{sellPrice}G</span>
              </div>
            </DraggableShopItem>
          )
        })}
        {/* 武器空き枠 */}
        {Array.from({ length: weaponEmptyCount }).map((_, i) => (
          <DroppableSlot key={`we-${i}`} id={`slot-weapon-${memberIndex}-${i}`} disabled={weaponDropDisabled}>
            <EmptySlot label="武器 空き" />
          </DroppableSlot>
        ))}
        {/* 無限使用武器（売却不可） */}
        {infiniteWeapons.map((w, i) => (
          <div key={`iw-${i}`} className="flex items-center gap-1 px-1 py-0.5 text-[10px] text-gray-500">
            <span className="w-3 h-3 rounded text-[8px] flex items-center justify-center bg-gray-600 flex-shrink-0">
              {w.targetType === 'allySingle' ? '祈' : '剣'}
            </span>
            <span className="flex-1 truncate">{w.name}</span>
          </div>
        ))}

        {/* 魔法一覧 */}
        {member.spells.map((s, i) => {
          const sellPrice = getSellPriceItem(s)
          const isNew = newPurchaseIds.has(`spell-${memberIndex}-${s.id}`)
          return (
            <DraggableShopItem key={`s-${i}`} id={`inv-spell-${memberIndex}-${i}`}
              data={{ source: 'inv-spell', memberIndex, spellIndex: i, spell: s }}>
              <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${isNew ? 'ring-1 ring-yellow-400 bg-yellow-900/20' : 'hover:bg-gray-700'}`}>
                <span className="w-3 h-3 rounded text-[8px] flex items-center justify-center bg-purple-600 flex-shrink-0">魔</span>
                <span className="text-white flex-1 truncate">{s.name}</span>
                <span className="text-gray-400">{s.mpCost}MP</span>
                <span className="text-green-400">{sellPrice}G</span>
              </div>
            </DraggableShopItem>
          )
        })}
        {/* 魔法空き枠 */}
        {Array.from({ length: spellEmptyCount }).map((_, i) => (
          <DroppableSlot key={`se-${i}`} id={`slot-spell-${memberIndex}-${i}`} disabled={spellDropDisabled}>
            <EmptySlot label="魔法 空き" />
          </DroppableSlot>
        ))}
      </div>
    </div>
  )
}

/** 共有枠（ポーション + レリック） */
function StoreSharedPanel({
  potions,
  relics,
  newPurchaseIds,
}: {
  potions: { id: string; name: string; price: number }[]
  relics: { id: string; name: string; price: number }[]
  newPurchaseIds: Set<string>
}) {
  const potionEmptyCount = Math.max(0, 2 - potions.length)
  const relicEmptyCount = Math.max(0, 5 - relics.length)

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded p-1.5">
      {/* ポーション */}
      <div className="mb-1">
        <div className="text-[9px] text-gray-500 mb-0.5">ポーション</div>
        {potions.map((p, i) => {
          const sellPrice = getSellPriceItem(p as { price: number })
          const isNew = newPurchaseIds.has(`potion-${p.id}`)
          return (
            <DraggableShopItem key={`p-${i}`} id={`inv-potion-${i}`}
              data={{ source: 'inv-potion', potionIndex: i }}>
              <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${isNew ? 'ring-1 ring-yellow-400 bg-yellow-900/20' : 'hover:bg-gray-700'}`}>
                <span className="w-3 h-3 rounded text-[8px] flex items-center justify-center bg-teal-600 flex-shrink-0">薬</span>
                <span className="text-white flex-1 truncate">{p.name}</span>
                <span className="text-green-400">{sellPrice}G</span>
              </div>
            </DraggableShopItem>
          )
        })}
        {Array.from({ length: potionEmptyCount }).map((_, i) => (
          <DroppableSlot key={`pe-${i}`} id={`slot-potion-${i}`}>
            <EmptySlot label="ポーション 空き" />
          </DroppableSlot>
        ))}
      </div>
      <div className="border-t border-gray-700 my-1" />
      {/* レリック */}
      <div className="flex-1">
        <div className="text-[9px] text-gray-500 mb-0.5">レリック</div>
        {relics.map((r, i) => {
          const sellPrice = getSellPriceItem(r as { price: number })
          const isNew = newPurchaseIds.has(`relic-${r.id}`)
          return (
            <DraggableShopItem key={`r-${i}`} id={`inv-relic-${i}`}
              data={{ source: 'inv-relic', relicIndex: i }}>
              <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] ${isNew ? 'ring-1 ring-yellow-400 bg-yellow-900/20' : 'hover:bg-gray-700'}`}>
                <span className="w-3 h-3 rounded text-[8px] flex items-center justify-center bg-yellow-600 flex-shrink-0">遺</span>
                <span className="text-white flex-1 truncate">{r.name}</span>
                <span className="text-green-400">{sellPrice}G</span>
              </div>
            </DraggableShopItem>
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
    rerollStore, closeStore,
  } = useGame()

  const [showMap, setShowMap] = useState(false)
  const [dragData, setDragData] = useState<ShopDragData | null>(null)
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null)
  // 今回のショップで購入した装備のIDセット（強調表示用）
  const [newPurchaseIds, setNewPurchaseIds] = useState<Set<string>>(new Set())

  const { run, storeState, mapState } = state
  if (!run || !storeState) return null

  const gold = run.gold

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ShopDragData
    setDragData(data)
    if ('item' in data) setDraggingLabel((data.item as { name: string }).name)
    else if ('weapon' in data) setDraggingLabel((data as { weapon: ExplorerWeapon }).weapon.name)
    else if ('spell' in data) setDraggingLabel((data as { spell: SpellInstance }).spell.name)
    else if (data.source === 'inv-relic') setDraggingLabel(run.relics[data.relicIndex]?.name ?? '')
    else if (data.source === 'inv-potion') setDraggingLabel(run.potions[data.potionIndex]?.name ?? '')
  }, [run])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragData(null)
    setDraggingLabel(null)
    if (!event.over) return
    const dropId = event.over.id as string
    const data = event.active.data.current as ShopDragData

    // === 商品→空き枠 (購入) ===
    if (data.source === 'shop-weapon') {
      const item = data.item
      // 武器枠にドロップ
      if (dropId.startsWith('slot-weapon-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        if (isWeaponData(item)) {
          buyWeapon(data.slotIndex, item, memberIndex)
          setNewPurchaseIds(prev => new Set(prev).add(`weapon-${memberIndex}-${item.id}`))
        }
      }
      // 魔法枠にドロップ
      if (dropId.startsWith('slot-spell-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        if (isSpellData(item)) {
          buySpell(data.slotIndex, item, memberIndex)
          setNewPurchaseIds(prev => new Set(prev).add(`spell-${memberIndex}-${item.id}`))
        }
      }
    }
    if (data.source === 'shop-relic' && dropId.startsWith('slot-relic-')) {
      buyRelic(data.slotIndex, data.item)
      setNewPurchaseIds(prev => new Set(prev).add(`relic-${data.item.id}`))
    }
    if (data.source === 'shop-potion' && dropId.startsWith('slot-potion-')) {
      buyPotion(data.slotIndex, data.item)
      setNewPurchaseIds(prev => new Set(prev).add(`potion-${data.item.id}`))
    }

    // === 装備→売却枠 (売却) ===
    if (dropId === 'sell-zone') {
      if (data.source === 'inv-weapon') sellWeapon(data.weaponIndex, data.memberIndex)
      if (data.source === 'inv-spell') sellSpell(data.spellIndex, data.memberIndex)
      if (data.source === 'inv-relic') sellRelic(data.relicIndex)
      if (data.source === 'inv-potion') sellPotion(data.potionIndex)
    }
  }, [buyWeapon, buySpell, buyRelic, buyPotion, sellWeapon, sellSpell, sellRelic, sellPotion])

  const handleDragCancel = useCallback(() => {
    setDragData(null)
    setDraggingLabel(null)
  }, [])

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={pointerWithin}>
      <div className="min-h-screen bg-gray-800 p-2 flex flex-col gap-2">

        {/* ===== 商品エリア + 売却枠 ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative min-h-[200px] flex gap-2">
          {/* 商品エリア */}
          <div className="flex-1">
            {/* ヘッダー: リロール + ストア名 + ゴールド */}
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xs">ショップ</span>
                <Button variant="secondary" onClick={rerollStore} disabled={gold < storeState.rerollCost} className="text-[10px] px-2 py-0.5">
                  リロール ({storeState.rerollCost}G)
                </Button>
              </div>
              <span className="text-yellow-400 font-bold text-sm">{gold}G</span>
            </div>

            {/* 上半分: 武器・魔法 4枠 */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {storeState.weaponSlots.map((item, index) => (
                <div key={`ws-${index}`}>
                  {item ? (
                    <DraggableShopItem id={`shop-weapon-${index}`}
                      data={{ source: 'shop-weapon', slotIndex: index, item }}>
                      <ShopItemCard name={item.name} price={item.price}
                        type={isWeaponData(item) ? 'weapon' : 'spell'} />
                    </DraggableShopItem>
                  ) : (
                    <div className="border-2 border-dashed border-gray-700 rounded p-1.5 h-full flex items-center justify-center">
                      <span className="text-gray-600 text-[10px]">売り切れ</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 下半分: レリック2枠 + ポーション2枠 */}
            <div className="grid grid-cols-2 gap-2">
              {/* レリック */}
              <div>
                <div className="text-[9px] text-gray-500 mb-1">レリック</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {storeState.relicSlots.map((item, index) => (
                    <div key={`rs-${index}`}>
                      {item ? (
                        <DraggableShopItem id={`shop-relic-${index}`}
                          data={{ source: 'shop-relic', slotIndex: index, item }}>
                          <ShopItemCard name={item.name} price={item.price} type="relic" />
                        </DraggableShopItem>
                      ) : (
                        <div className="border-2 border-dashed border-gray-700 rounded p-1.5 flex items-center justify-center">
                          <span className="text-gray-600 text-[10px]">売り切れ</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* ポーション */}
              <div>
                <div className="text-[9px] text-gray-500 mb-1">ポーション</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {storeState.potionSlots.map((item, index) => (
                    <div key={`ps-${index}`}>
                      {item ? (
                        <DraggableShopItem id={`shop-potion-${index}`}
                          data={{ source: 'shop-potion', slotIndex: index, item }}>
                          <ShopItemCard name={item.name} price={item.price} type="potion" />
                        </DraggableShopItem>
                      ) : (
                        <div className="border-2 border-dashed border-gray-700 rounded p-1.5 flex items-center justify-center">
                          <span className="text-gray-600 text-[10px]">売り切れ</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 売却枠 */}
          <DroppableSlot id="sell-zone" className="w-16 flex-shrink-0">
            <div className="h-full border-2 border-dashed border-red-700/50 rounded flex flex-col items-center justify-center gap-1 bg-red-900/10">
              <span className="text-red-400 text-lg">🗑</span>
              <span className="text-red-400 text-[9px] font-bold">売却</span>
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
              newPurchaseIds={newPurchaseIds}
            />
          ))}
          <StoreSharedPanel
            potions={run.potions}
            relics={run.relics}
            newPurchaseIds={newPurchaseIds}
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

        {/* マップオーバーレイ */}
        {showMap && mapState && (
          <MapOverlay nodes={mapState.nodes} currentStage={mapState.currentStage} onClose={() => setShowMap(false)} />
        )}

        {/* D&Dオーバーレイ */}
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
