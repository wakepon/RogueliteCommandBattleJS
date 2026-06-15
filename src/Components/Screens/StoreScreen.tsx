import { useState, useCallback, useMemo } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { ResourceBar, Tooltip, TooltipCard } from '../Common'
import { MapOverlay } from '../Store/MapOverlay'
import { ExplorerState, CharacterClass } from '../../Lib/Types/Explorer'
import { ExplorerWeapon, WeaponData } from '../../Lib/Types/Weapon'
import { SpellData, SpellInstance } from '../../Lib/Types/Spell'
import { RelicData, RelicInstance } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { isWeaponData, isSpellData } from '../../Lib/Core/StoreLogic'
import { getPotionSlotBonus } from '../../Lib/Core/RelicProcessor'
import { getTuningValue } from '../../Lib/Tuning/TuningStore'
import { ShopSlot } from '../../Lib/Types/Game'
import { getRequiredKillsForNextLevel } from '../../Lib/Core/LevelUpCalculator'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'
import { calculateRelicAttackImpacts, MemberAttackImpact } from '../../Lib/Utils/RelicImpactCalculator'
import { getItemSpecialEffect } from '../../Lib/Utils/ItemDescription'
import { CLASS_ICONS } from '../Battle/PartyAvatars'
import { NextStagePreview } from '../Battle/NextStagePreview'
import { SegmentedBar } from '../Common'

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

/** 商品カードに表示するダメージ予測（最大2人分、ダメージ大→小の順） */
interface DualDamagePreview {
  primary: { memberName: string; characterClass: CharacterClass; display: string }
  secondary?: { memberName: string; characterClass: CharacterClass; display: string }
}

/**
 * 武器=戦士+僧侶、魔法=魔法使い+僧侶 のクラスフィルタでダメージ予測。
 * 該当クラスの中でダメージが大きい順にソートして返す（最大2人）。
 */
function getDualDamagePreview(
  item: WeaponData | SpellData,
  party: ExplorerState[],
  relics: RelicData[],
): DualDamagePreview | null {
  if (item.power <= 0) return null
  const isWeapon = isWeaponData(item)
  const targetClasses: CharacterClass[] = isWeapon ? ['warrior', 'cleric'] : ['mage', 'cleric']
  const opts = { relics }
  const candidates = party
    .filter(m => targetClasses.includes(m.characterClass))
    .map(member => {
      const range = isWeapon
        ? predictWeaponDamage(member, item, opts)
        : predictSpellDamage(member, item as SpellData, opts)
      return {
        memberName: member.name,
        characterClass: member.characterClass,
        display: formatDamageRange(range),
        max: range.max,
      }
    })
    .filter(p => p.max > 0)
    .sort((a, b) => b.max - a.max)

  if (candidates.length === 0) return null
  return {
    primary: candidates[0],
    secondary: candidates[1],
  }
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

function DroppableSlot({ id, children, disabled, className, isValidTarget }: {
  id: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
  /** ドラッグ中、このスロットが有効なドロップ先である場合に薄く強調表示 */
  isValidTarget?: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled })
  const isOverActive = isOver && !disabled
  const isValid = !!isValidTarget && !disabled && !isOverActive
  const highlight = isOverActive
    ? 'ring-2 ring-yellow-400 bg-yellow-400/10'
    : isValid
      ? 'ring-2 ring-yellow-400/50 bg-yellow-400/5'
      : ''
  return (
    <div ref={setNodeRef} className={`${highlight} ${disabled ? 'opacity-30' : ''} ${className ?? ''} rounded`}>
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

function ShopItemCard({ name, type, damageInfo, usesInfo, item, attackImpacts, specialEffect }: {
  name: string; type: 'weapon' | 'spell' | 'relic' | 'potion'
  damageInfo?: DualDamagePreview | null
  usesInfo?: string | null
  item: WeaponData | SpellData | RelicData | PotionData
  attackImpacts?: MemberAttackImpact[]
  specialEffect?: string
}) {
  const typeColors = { weapon: 'border-orange-500 bg-orange-900/20', spell: 'border-purple-500 bg-purple-900/20', relic: 'border-yellow-500 bg-yellow-900/20', potion: 'border-teal-500 bg-teal-900/20' }
  const isAoe = 'targetType' in item && item.targetType === 'enemyAll'
  return (
    <Tooltip content={<TooltipCard item={item} damageText={damageInfo?.primary.display} attackImpacts={attackImpacts} />} position="bottom">
      <div className={`border rounded p-2 text-xs min-h-[96px] flex gap-2 ${typeColors[type]}`}>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold truncate flex-1">{name}</span>
            {isAoe && <span className="text-[8px] bg-red-700 text-white px-0.5 rounded flex-shrink-0">全体</span>}
          </div>
          {damageInfo && (
            <div className="leading-tight">
              <div className="text-gray-200 text-base font-bold">
                <span className="mr-0.5">{CLASS_ICONS[damageInfo.primary.characterClass]}</span>
                {damageInfo.primary.display}
              </div>
              {damageInfo.secondary && (
                <div className="text-gray-400 text-[10px]">
                  <span className="mr-0.5">{CLASS_ICONS[damageInfo.secondary.characterClass]}</span>
                  {damageInfo.secondary.display}
                </div>
              )}
            </div>
          )}
          {specialEffect && (
            <div className="text-cyan-300 text-[10px] leading-tight break-words">
              {specialEffect}
            </div>
          )}
          {usesInfo && <div className="text-gray-500 text-[10px]">{usesInfo}</div>}
        </div>
      </div>
    </Tooltip>
  )
}

// === 報酬選択画面のプレビュー ===

// === 報酬スロットのレンダラー ===

function ShopSlotRenderer({
  slot,
  slotIndex,
  dmgPreview,
  attackImpacts,
  disabled,
}: {
  slot: ShopSlot
  slotIndex: number
  dmgPreview: DualDamagePreview | null
  attackImpacts?: MemberAttackImpact[]
  /** 他のアイテムが選択済みのためグレーアウト */
  disabled?: boolean
}) {
  if (!slot.item) {
    return (
      <DroppableSlot id={`return-slot-${slotIndex}`}>
        <div className="border-2 border-dashed border-gray-700 rounded p-1.5 h-full min-h-[96px] flex items-center justify-center">
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
  const specialEffect = getItemSpecialEffect(item)

  return (
    <DraggableShopItem id={`shop-slot-${slotIndex}`} data={dragData} disabled={disabled}>
      <div className={`transition-all duration-200 ${disabled ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
        <ShopItemCard
          name={item.name}
          type={type}
          damageInfo={dmgPreview}
          usesInfo={usesInfo}
          item={item}
          attackImpacts={attackImpacts}
          specialEffect={specialEffect}
        />
      </div>
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
  const purchasedSpells = member.spells.filter(s => !s.slotFree)
  const slotFreeSpells = member.spells.filter(s => s.slotFree)
  const spellEmptyCount = Math.max(0, member.magicSlotCount - purchasedSpells.length)

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
    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg border border-gray-500 p-1.5">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-2xl leading-none shrink-0">{CLASS_ICONS[member.characterClass]}</span>
          <span className="text-white font-bold text-2xl truncate">{member.name}</span>
        </div>
        <span className="text-yellow-400 text-xl font-bold shrink-0">Lv.{member.level}</span>
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
        <SegmentedBar current={expProgress} max={requiredKills} color="yellow" size="sm" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {purchasedWeapons.map((w, i) => {
          const realIndex = member.weapons.indexOf(w)
          const isMoved = movedKeys.has(`weapon-${memberIndex}-${w.id}`)
          const isNew = newPurchaseKeys.has(`weapon-${memberIndex}-${w.id}`)
          const range = predictWeaponDamage(member, w, opts)
          const dmg = formatDamageRange(range)
          return (
            <Tooltip key={`w-${i}`} content={<TooltipCard item={w} damageText={dmg} />} position="bottom">
              <DraggableShopItem id={`inv-weapon-${memberIndex}-${realIndex}`}
                data={{ source: 'inv-weapon', memberIndex, weaponIndex: realIndex, weapon: w }}>
                <div className={`relative border rounded p-1.5 text-base border-orange-500/50 bg-orange-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">NEW</span>}
                  <div className="flex items-center gap-1">
                    <span className="text-white flex-1 truncate font-bold">{w.name}</span>
                    {w.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                    {w.currentUses !== null && <span className="text-gray-400 text-sm">{w.currentUses}/{w.maxUses}</span>}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">{dmg}</span>
                  </div>
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: weaponEmptyCount }).map((_, i) => (
          <DroppableSlot key={`we-${i}`} id={`slot-weapon-${memberIndex}-${i}`} disabled={weaponDropDisabled} isValidTarget={!!isDraggingWeapon}>
            <EmptySlot label="武器 空き" />
          </DroppableSlot>
        ))}
        {infiniteWeapons.map((w, i) => {
          const range = predictWeaponDamage(member, w, opts)
          const dmg = formatDamageRange(range)
          return (
            <Tooltip key={`iw-${i}`} content={<TooltipCard item={w} damageText={dmg} durabilityText="∞" />} position="bottom">
              <div className="border rounded p-1.5 text-base border-gray-600/50 bg-gray-800/30 opacity-60">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate flex-1">{w.name}</span>
                  {w.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                </div>
                <div className="text-gray-500 text-sm">{dmg}</div>
              </div>
            </Tooltip>
          )
        })}

        {purchasedSpells.map((s, i) => {
          const realIndex = member.spells.indexOf(s)
          const isMoved = movedKeys.has(`spell-${memberIndex}-${s.id}`)
          const isNew = newPurchaseKeys.has(`spell-${memberIndex}-${s.id}`)
          const range = predictSpellDamage(member, s, opts)
          const dmg = s.power > 0 ? formatDamageRange(range) : null
          return (
            <Tooltip key={`s-${i}`} content={<TooltipCard item={s} damageText={dmg || undefined} />} position="bottom">
              <DraggableShopItem id={`inv-spell-${memberIndex}-${realIndex}`}
                data={{ source: 'inv-spell', memberIndex, spellIndex: realIndex, spell: s }}>
                <div className={`relative border rounded p-1.5 text-base border-purple-500/50 bg-purple-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">NEW</span>}
                  <div className="flex items-center gap-1">
                    <span className="text-white flex-1 truncate font-bold">{s.name}</span>
                    {s.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                    <span className="text-gray-400 text-sm">{s.mpCost}MP</span>
                  </div>
                  {dmg && (
                    <div className="text-sm">
                      <span className="text-gray-400">{dmg}</span>
                    </div>
                  )}
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: spellEmptyCount }).map((_, i) => (
          <DroppableSlot key={`se-${i}`} id={`slot-spell-${memberIndex}-${i}`} disabled={spellDropDisabled} isValidTarget={!!isDraggingSpell}>
            <EmptySlot label="魔法 空き" />
          </DroppableSlot>
        ))}
        {slotFreeSpells.map((s, i) => {
          const range = predictSpellDamage(member, s, opts)
          const dmg = s.power > 0 ? formatDamageRange(range) : null
          return (
            <Tooltip key={`sf-${i}`} content={<TooltipCard item={s} damageText={dmg || undefined} />} position="bottom">
              <div className="border rounded p-1.5 text-base border-gray-600/50 bg-gray-800/30 opacity-60">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate flex-1">{s.name}</span>
                  {s.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                </div>
                {dmg && <div className="text-gray-500 text-sm">{dmg}</div>}
              </div>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

// === 左サイドパネル: 報酬タイトル / 次の敵 / 次の次の敵 / レリック / ポーション ===

export function StoreLeftPanel({
  shopTitle,
  currentStage,
  seed,
  potions,
  relics,
  movedKeys,
  newPurchaseKeys,
  party,
  dragData,
}: {
  shopTitle: string
  currentStage: number
  seed: number
  potions: PotionData[]
  relics: RelicInstance[]
  movedKeys: Set<string>
  newPurchaseKeys: Set<string>
  party: ExplorerState[]
  dragData: ShopDragData | null
}) {
  const maxRelicCount = getTuningValue('max_relic_count', 5)
  const relicEmptyCount = Math.max(0, maxRelicCount - relics.length)
  const maxPotionCount = getTuningValue('max_potion_count', 2) + getPotionSlotBonus(relics)
  const potionEmptyCount = Math.max(0, maxPotionCount - potions.length)

  // レリック空きスロットへの有効ドロップ判定: shop-relic / sold-item(relic)
  const isDraggingRelic = !!(dragData && (
    dragData.source === 'shop-relic'
    || (dragData.source === 'sold-item' && dragData.soldItem.type === 'relic')
  ))
  // ポーション空きスロットへの有効ドロップ判定: shop-potion / sold-item(potion)
  const isDraggingPotion = !!(dragData && (
    dragData.source === 'shop-potion'
    || (dragData.source === 'sold-item' && dragData.soldItem.type === 'potion')
  ))

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto">
      {/* 上段: タイトル / 次の敵 / 次の次の敵 / レリック を最低 1/3 高さ確保 */}
      <div className="flex flex-col gap-2" style={{ minHeight: '33vh' }}>
        {/* 報酬タイトル */}
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-white leading-tight">{shopTitle}</div>
        </div>

        {/* 次の敵 */}
        <NextStagePreview seed={seed} currentStage={currentStage} label="次の敵" />

        {/* 次の次の敵 */}
        <NextStagePreview seed={seed} currentStage={currentStage} offset={2} label="次の次の敵" />

        {/* レリック（上段の余白を埋める。空きスロット含めスクロール可能） */}
        <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-2 flex-1 min-h-0 overflow-y-auto">
          <div className="text-base text-gray-400 font-bold mb-1">レリック</div>
          {relics.map((r, i) => {
            const isMoved = movedKeys.has(`relic-${r.id}`)
            const isNew = newPurchaseKeys.has(`relic-${r.id}`)
            return (
              <Tooltip key={`r-${i}`} content={<TooltipCard item={r} attackImpacts={calculateRelicAttackImpacts(r, party, relics.filter((x: RelicInstance) => x.id !== r.id))} />} position="bottom">
                <DraggableShopItem id={`inv-relic-${i}`}
                  data={{ source: 'inv-relic', relicIndex: i }}>
                  <div className={`relative border rounded p-1.5 mb-0.5 text-xl border-yellow-500/50 bg-yellow-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                    {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">NEW</span>}
                    <div className="text-white truncate font-bold">{r.name}</div>
                  </div>
                </DraggableShopItem>
              </Tooltip>
            )
          })}
          {Array.from({ length: relicEmptyCount }).map((_, i) => (
            <DroppableSlot key={`re-${i}`} id={`slot-relic-${i}`} isValidTarget={isDraggingRelic}>
              <div className="border-2 border-dashed border-gray-600 rounded p-1.5 mb-0.5 flex items-center justify-center">
                <span className="text-gray-600 text-sm">レリック 空き</span>
              </div>
            </DroppableSlot>
          ))}
        </div>
      </div>

      {/* 下段: ポーション（画面 1/3 地点から開始） */}
      <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-2">
        <div className="text-sm text-gray-400 font-bold mb-1">ポーション</div>
        {potions.map((p, i) => {
          const isMoved = movedKeys.has(`potion-${p.id}`)
          const isNew = newPurchaseKeys.has(`potion-${p.id}`)
          return (
            <Tooltip key={`p-${i}`} content={<TooltipCard item={p} />} position="bottom">
              <DraggableShopItem id={`inv-potion-${i}`}
                data={{ source: 'inv-potion', potionIndex: i }}>
                <div className={`relative border rounded p-1.5 mb-0.5 text-base border-teal-500/50 bg-teal-900/10 hover:brightness-110 ${isMoved ? 'animate-slow-blink' : ''}`}>
                  {isNew && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded">NEW</span>}
                  <div className="text-white truncate font-bold">{p.name}</div>
                </div>
              </DraggableShopItem>
            </Tooltip>
          )
        })}
        {Array.from({ length: potionEmptyCount }).map((_, i) => (
          <DroppableSlot key={`pe-${i}`} id={`slot-potion-${i}`} isValidTarget={isDraggingPotion}>
            <div className="border-2 border-dashed border-gray-600 rounded p-1.5 mb-0.5 flex items-center justify-center">
              <span className="text-gray-600 text-xs">ポーション 空き</span>
            </div>
          </DroppableSlot>
        ))}
      </div>

      {/* 余白（ポーションを上方に固定） */}
      <div className="flex-1" />
    </div>
  )
}

// === メイン ===

export function StoreScreen() {
  const {
    state,
    buyWeapon, buySpell, buyRelic, buyPotion,
    discardWeapon, discardSpell, discardRelic, discardPotion,
    undoBuyWeapon, undoBuySpell, undoBuyRelic, undoBuyPotion,
    undoDiscardWeapon, undoDiscardSpell, undoDiscardRelic, undoDiscardPotion,
    transferWeapon, transferSpell,
    rerollStore, closeStore,
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

  const { run, storeState, mapState } = state
  if (!run || !storeState) return null

  // 商品カード用のダメージ予測（武器=戦士+僧侶、魔法=魔法使い+僧侶 のデュアル予測）
  const shopDamagePreviews = useMemo(() => {
    const previews: Map<number, DualDamagePreview | null> = new Map()
    storeState.slots.forEach((slot, index) => {
      if (!slot.item) { previews.set(index, null); return }
      if (slot.category !== 'weapon' && slot.category !== 'spell') {
        previews.set(index, null)
        return
      }
      const item = slot.item as WeaponData | SpellData
      previews.set(index, getDualDamagePreview(item, run.party, run.relics as RelicData[]))
    })
    return previews
  }, [storeState.slots, run.party, run.relics])

  // 商品カード用のレリック攻撃力影響をメモ化（レリックスロット専用）
  const shopAttackImpacts = useMemo(() => {
    const impacts: Map<number, MemberAttackImpact[] | undefined> = new Map()
    storeState.slots.forEach((slot, index) => {
      if (slot.category !== 'relic' || !slot.item) return
      impacts.set(index, calculateRelicAttackImpacts(slot.item as RelicData, run.party, run.relics))
    })
    return impacts
  }, [storeState.slots, run.party, run.relics])

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragData(null)
    setDraggingLabel(null)
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

    // === 装備→削除枠 (削除) ===
    if (dropId === 'discard-zone') {
      if (data.source === 'inv-weapon') {
        const weapon = run.party[data.memberIndex]?.weapons[data.weaponIndex]
        if (weapon) {
          setSoldItems(prev => [...prev, { name: weapon.name, type: 'weapon', sellPrice: 0, memberIndex: data.memberIndex, weapon }])
          discardWeapon(data.weaponIndex, data.memberIndex)
        }
      }
      if (data.source === 'inv-spell') {
        const spell = run.party[data.memberIndex]?.spells[data.spellIndex]
        if (spell && spell.price > 0 && !spell.slotFree) {
          setSoldItems(prev => [...prev, { name: spell.name, type: 'spell', sellPrice: 0, memberIndex: data.memberIndex, spell }])
          discardSpell(data.spellIndex, data.memberIndex)
        }
      }
      if (data.source === 'inv-relic') {
        const relic = run.relics[data.relicIndex]
        if (relic) {
          setSoldItems(prev => [...prev, { name: relic.name, type: 'relic', sellPrice: 0, memberIndex: 0, relicData: relic as RelicData }])
          discardRelic(data.relicIndex)
        }
      }
      if (data.source === 'inv-potion') {
        const potion = run.potions[data.potionIndex]
        if (potion) {
          setSoldItems(prev => [...prev, { name: potion.name, type: 'potion', sellPrice: 0, memberIndex: 0, potionData: potion as PotionData }])
          discardPotion(data.potionIndex)
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

    // === 削除枠→空き枠 (削除取り消し) ===
    if (data.source === 'sold-item') {
      const sold = data.soldItem
      if (sold.type === 'weapon' && sold.weapon && dropId.startsWith('slot-weapon-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        undoDiscardWeapon(sold.weapon, memberIndex)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
      if (sold.type === 'spell' && sold.spell && dropId.startsWith('slot-spell-')) {
        const memberIndex = parseInt(dropId.split('-')[2])
        undoDiscardSpell(sold.spell, memberIndex)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
      if (sold.type === 'relic' && sold.relicData && dropId.startsWith('slot-relic-')) {
        undoDiscardRelic(sold.relicData)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
      if (sold.type === 'potion' && sold.potionData && dropId.startsWith('slot-potion-')) {
        undoDiscardPotion(sold.potionData)
        setSoldItems(prev => prev.filter((_, i) => i !== data.soldIndex))
      }
    }
  }, [run, purchaseRecords, buyWeapon, buySpell, buyRelic, buyPotion, discardWeapon, discardSpell, discardRelic, discardPotion, undoBuyWeapon, undoBuySpell, undoBuyRelic, undoBuyPotion, undoDiscardWeapon, undoDiscardSpell, undoDiscardRelic, undoDiscardPotion, transferWeapon, transferSpell, addMovedKey, removeMovedKey])

  const handleDragCancel = useCallback(() => {
    setDragData(null)
    setDraggingLabel(null)
  }, [])

  // 報酬2択制: アイテムを2つ選んだら他はグレーアウト
  const hasReachedMax = purchaseRecords.length >= storeState.maxSelections
  // 選択済みアイテムのスロットインデックス（購入取り消し時の判定用）
  const pickedSlotIndices = new Set(purchaseRecords.map(r => r.shopSlotIndex))

  // 装備中アイテム(インベントリ→報酬戻し / 削除枠)の有効ドロップ判定
  const isDraggingInv = !!(dragData && (
    dragData.source === 'inv-weapon' || dragData.source === 'inv-spell'
    || dragData.source === 'inv-relic' || dragData.source === 'inv-potion'
  ))

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={pointerWithin}>
      <div className="min-h-screen bg-gray-800 p-2 flex gap-2">

        {/* ===== 左サイドパネル ===== */}
        <div className="w-1/4 flex-shrink-0 flex flex-col">
          <StoreLeftPanel
            shopTitle="報酬"
            currentStage={run.currentStage}
            seed={run.seed}
            potions={run.potions}
            relics={run.relics}
            movedKeys={movedKeys}
            newPurchaseKeys={newPurchaseKeys}
            party={run.party}
            dragData={dragData}
          />
        </div>

        {/* ===== 右側メイン領域 ===== */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

        {/* ===== 報酬エリア + 削除枠 ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg relative min-h-[200px] flex gap-2">
          {/* 商品エリア全体をドロップ可能に（購入取り消し用） */}
          <DroppableSlot id="shop-return-zone" className="flex-1" isValidTarget={isDraggingInv}>
            <div>
              {/* ヘッダー: リロールボタン + 二つ選べ表示 */}
              <div className="flex items-center gap-2 mb-2">
                <Button variant="secondary" onClick={rerollStore} disabled={purchaseRecords.length > 0} className="text-[10px] px-2 py-0.5">
                  リロール
                </Button>
                <span className="text-yellow-300 font-bold text-sm">二つ選べ</span>
              </div>

              {/* 5枠グリッド */}
              <div className="grid grid-cols-5 gap-1.5">
                {storeState.slots.map((slot, slotIndex) => {
                  const isDisabled = hasReachedMax && !pickedSlotIndices.has(slotIndex)
                  return (
                    <ShopSlotRenderer
                      key={`slot-${slotIndex}`}
                      slot={slot}
                      slotIndex={slotIndex}
                      dmgPreview={shopDamagePreviews.get(slotIndex) ?? null}
                      attackImpacts={shopAttackImpacts.get(slotIndex)}
                      disabled={isDisabled}
                    />
                  )
                })}
              </div>
            </div>
          </DroppableSlot>

          {/* 削除枠 */}
          <DroppableSlot id="discard-zone" className="w-32 flex-shrink-0" isValidTarget={isDraggingInv}>
            <div className="h-full border-2 border-dashed border-red-700/50 rounded flex flex-col bg-red-900/10 p-1.5">
              <div className="text-red-400 text-[9px] font-bold text-center mb-1">削除</div>
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

        {/* ===== キャラ欄3等分（3キャラ。共有枠はサイドバーへ移動） ===== */}
        <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
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
        </div>

        {/* ===== 確定ボタン ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="flex gap-2 justify-center">
            {mapState && (
              <Button variant="secondary" onClick={() => setShowMap(true)}>マップ</Button>
            )}
            <Button variant="primary" onClick={closeStore} className="flex-1 max-w-md">
              確定して出発
            </Button>
          </div>
        </div>

        </div>{/* 右側メイン領域 終わり */}

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
