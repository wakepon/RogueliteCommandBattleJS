import { useState } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { ResourceBar, SegmentedBar, Tooltip, TooltipCard } from '../Common'
import { DraggableItem, DroppableSlot } from '../Common/DragDropComponents'
import { CLASS_ICONS } from '../Battle/PartyAvatars'
import { NextStagePreview } from '../Battle/NextStagePreview'
import { PotionData } from '../../Lib/Types/Potion'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { WeaponInstance } from '../../Lib/Types/Weapon'
import { RelicData, RelicInstance } from '../../Lib/Types/Relic'
import { canUseImmediately, canStorePotion, canUseOnMember, getPotionEffectDescription } from '../../Lib/Core/PotionShopLogic'
import { canBuyPotion } from '../../Lib/Core/StoreLogic'
import { getPotionSlotBonus } from '../../Lib/Core/RelicProcessor'
import { getTuningValue } from '../../Lib/Tuning/TuningStore'
import { getRequiredKillsForNextLevel } from '../../Lib/Core/LevelUpCalculator'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'

type PotionShopDragData = {
  source: 'potion-shop'
  shopSlotIndex: number
  potion: PotionData
}

function isPotionShopDrag(data: Record<string, unknown>): data is PotionShopDragData {
  return data.source === 'potion-shop'
}

// === ショップ商品カード（ShopItemCard準拠） ===

function ShopPotionCard({ potion, stock, price, canAfford }: {
  potion: PotionData
  stock: number
  price: number
  canAfford: boolean
}) {
  const disabled = stock <= 0 || !canAfford
  const effectDesc = getPotionEffectDescription(potion.effect)
  const isSeed = potion.effect.type.startsWith('boost')
  const isBuff = ['taunt', 'statBoost', 'damageReduction', 'aoeConvert'].includes(potion.effect.type)

  return (
    <div className={`border rounded p-2 text-xs min-h-[96px] flex flex-col gap-0.5 transition-all duration-200 ${
      disabled
        ? 'border-gray-600 bg-gray-800/50 opacity-30 grayscale'
        : 'border-teal-500 bg-teal-900/20'
    }`}>
      <div className="flex items-center gap-1">
        <span className={`font-bold truncate flex-1 ${disabled ? 'text-gray-500' : 'text-white'}`}>
          {potion.name}
        </span>
        <span className={`font-bold text-sm flex-shrink-0 ${canAfford ? 'text-yellow-300' : 'text-red-400'}`}>
          {price}G
        </span>
      </div>
      <div className={`text-[10px] ${disabled ? 'text-gray-600' : 'text-teal-300'}`}>
        {effectDesc}
      </div>
      <div className="flex items-center gap-1 mt-auto">
        <span className={`text-[10px] ${stock <= 0 ? 'text-red-400' : 'text-gray-400'}`}>
          残り {stock}
        </span>
        {isSeed && (
          <span className="text-[8px] bg-green-800/50 text-green-300 px-1 rounded">永続</span>
        )}
        {isBuff && (
          <span className="text-[8px] bg-purple-800/50 text-purple-300 px-1 rounded">戦闘用</span>
        )}
      </div>
    </div>
  )
}

// === キャラ欄（StoreCharacterPanel準拠、武器・魔法はグレーアウト） ===

function PotionShopCharacterPanel({
  member,
  isValidTarget,
  relics,
}: {
  member: ExplorerState
  isValidTarget: boolean
  relics: RelicData[]
}) {
  const requiredKills = getRequiredKillsForNextLevel(member.level)
  const expProgress = requiredKills > 0 ? member.exp : 0

  const purchasedWeapons = member.weapons.filter(w => w.maxUses !== null)
  const infiniteWeapons = member.weapons.filter(w => w.maxUses === null)
  const purchasedSpells = member.spells.filter(s => !s.slotFree)
  const slotFreeSpells = member.spells.filter(s => s.slotFree)

  const opts = { relics }

  return (
    <div className={`h-full flex flex-col bg-gray-800/50 rounded-lg border p-1.5 transition-colors ${
      isValidTarget ? 'border-teal-400' : 'border-gray-500'
    }`}>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-2xl leading-none shrink-0">{CLASS_ICONS[member.characterClass]}</span>
          <span className="text-white font-bold text-2xl truncate">{member.name}</span>
        </div>
        <span className="text-yellow-400 text-xl font-bold shrink-0">Lv.{member.level}</span>
      </div>

      {/* HP/MP/EXP バー */}
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

      {/* STR/INT */}
      <div className="flex gap-2 mb-1 text-[9px] text-gray-400">
        <span>STR <span className="text-orange-300">{member.str}</span></span>
        <span>INT <span className="text-purple-300">{member.int}</span></span>
      </div>

      {/* 武器・魔法（グレーアウト、ドラッグ不可） */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {purchasedWeapons.map((w, i) => {
          const range = predictWeaponDamage(member, w, opts)
          const dmg = formatDamageRange(range)
          return (
            <Tooltip key={`w-${i}`} content={<TooltipCard item={w} damageText={dmg} />} position="bottom">
              <div className="border rounded p-1.5 text-base border-gray-600/50 bg-gray-800/30 opacity-60">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate flex-1">{w.name}</span>
                  {w.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                  {(w as WeaponInstance).currentUses !== null && (
                    <span className="text-gray-500 text-sm">{(w as WeaponInstance).currentUses}/{w.maxUses}</span>
                  )}
                </div>
                <div className="text-gray-500 text-sm">{dmg}</div>
              </div>
            </Tooltip>
          )
        })}
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
          const range = predictSpellDamage(member, s, opts)
          const dmg = s.power > 0 ? formatDamageRange(range) : null
          return (
            <Tooltip key={`s-${i}`} content={<TooltipCard item={s} damageText={dmg || undefined} />} position="bottom">
              <div className="border rounded p-1.5 text-base border-gray-600/50 bg-gray-800/30 opacity-60">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate flex-1">{s.name}</span>
                  {s.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                  <span className="text-gray-500 text-sm">{s.mpCost}MP</span>
                </div>
                {dmg && <div className="text-gray-500 text-sm">{dmg}</div>}
              </div>
            </Tooltip>
          )
        })}
        {slotFreeSpells.map((s, i) => {
          const range = predictSpellDamage(member, s, opts)
          const dmg = s.power > 0 ? formatDamageRange(range) : null
          return (
            <Tooltip key={`sf-${i}`} content={<TooltipCard item={s} damageText={dmg || undefined} />} position="bottom">
              <div className="border rounded p-1.5 text-base border-gray-600/50 bg-gray-800/30 opacity-60">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 truncate flex-1">{s.name}</span>
                  {s.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                  <span className="text-gray-500 text-sm">{s.mpCost}MP</span>
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

// === 左サイドパネル ===

function PotionShopLeftPanel({
  gold,
  currentStage,
  seed,
  potions,
  relics,
  maxPotionSlots,
  isDraggingStorePotion,
}: {
  gold: number
  currentStage: number
  seed: number
  potions: PotionData[]
  relics: RelicInstance[]
  maxPotionSlots: number
  isDraggingStorePotion: boolean
}) {
  const potionEmptyCount = Math.max(0, maxPotionSlots - potions.length)

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto">
      <div className="flex flex-col gap-2" style={{ minHeight: '33vh' }}>
        {/* タイトル + 所持G */}
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-white leading-tight">ポーションショップ</div>
          <div className="text-lg font-bold text-yellow-300 mt-1">所持G: {gold}</div>
        </div>

        {/* 次の敵 */}
        <NextStagePreview seed={seed} currentStage={currentStage} label="次の敵" />

        {/* 次の次の敵 */}
        <NextStagePreview seed={seed} currentStage={currentStage} offset={2} label="次の次の敵" />

        {/* レリック */}
        <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-2 flex-1 min-h-0 overflow-y-auto">
          <div className="text-base text-gray-400 font-bold mb-1">レリック</div>
          {relics.map((r, i) => (
            <div key={`r-${i}`} className="border rounded p-1.5 mb-0.5 text-xl border-yellow-500/30 bg-yellow-900/5 opacity-60">
              <div className="text-gray-400 truncate font-bold">{r.name}</div>
            </div>
          ))}
          {relics.length === 0 && (
            <div className="text-gray-600 text-sm">なし</div>
          )}
        </div>
      </div>

      {/* ポーション枠 */}
      <div className="bg-gray-800/70 border border-gray-600 rounded-lg p-2">
        <div className="text-sm text-gray-400 font-bold mb-1">ポーション（{potions.length}/{maxPotionSlots}）</div>
        {potions.map((p, i) => (
          <div key={`p-${i}`} className="border rounded p-1.5 mb-0.5 text-base border-teal-500/30 bg-teal-900/5 opacity-60">
            <div className="text-gray-400 truncate font-bold">{p.name}</div>
          </div>
        ))}
        {Array.from({ length: potionEmptyCount }).map((_, i) => (
          <DroppableSlot key={`pe-${i}`} id={`potion-store-slot-${i}`} isValidTarget={isDraggingStorePotion}>
            <div className="border-2 border-dashed border-gray-600 rounded p-1.5 mb-0.5 flex items-center justify-center">
              <span className="text-gray-600 text-xs">ポーション 空き</span>
            </div>
          </DroppableSlot>
        ))}
      </div>

      <div className="flex-1" />
    </div>
  )
}

// === メイン ===

export function RecoveryScreen() {
  const { state, buyAndUsePotion, buyAndStorePotion, closePotionShop } = useGame()
  const { run, potionShopState } = state

  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [draggingData, setDraggingData] = useState<PotionShopDragData | null>(null)

  if (!run || !potionShopState) return null

  const gold = run.gold
  const maxPotionSlots = getTuningValue('max_potion_count', 2) + getPotionSlotBonus(run.relics)
  const hasPotionSlotSpace = canBuyPotion(run.potions, run.relics)

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (data && isPotionShopDrag(data as Record<string, unknown>)) {
      const d = data as PotionShopDragData
      setDragLabel(d.potion.name)
      setDraggingData(d)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDragLabel(null)
    setDraggingData(null)

    const { active, over } = event
    if (!over || !active.data.current) return

    const raw = active.data.current as Record<string, unknown>
    if (!isPotionShopDrag(raw)) return
    const data = raw

    const overId = over.id as string

    if (overId.startsWith('member-drop-')) {
      const targetId = overId.replace('member-drop-', '')
      buyAndUsePotion(data.shopSlotIndex, targetId)
    } else if (overId.startsWith('potion-store-slot-')) {
      buyAndStorePotion(data.shopSlotIndex)
    }
  }

  const isDraggingUseOnMember = draggingData ? canUseImmediately(draggingData.potion.effect) : false
  const isDraggingStorePotion = draggingData ? canStorePotion(draggingData.potion.effect) && hasPotionSlotSpace : false

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-800 p-2 flex gap-2">

        {/* ===== 左サイドパネル ===== */}
        <div className="w-1/4 flex-shrink-0 flex flex-col">
          <PotionShopLeftPanel
            gold={gold}
            currentStage={run.currentStage}
            seed={run.seed}
            potions={run.potions}
            relics={run.relics}
            maxPotionSlots={maxPotionSlots}
            isDraggingStorePotion={isDraggingStorePotion}
          />
        </div>

        {/* ===== 右側メイン領域 ===== */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">

          {/* ===== ショップエリア ===== */}
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg min-h-[200px]">
            <div className="text-sm text-gray-400 font-bold mb-2">商品（ドラッグして使用・保存）</div>
            <div className="grid grid-cols-5 gap-1.5">
              {potionShopState.shopSlots.map((slot, i) => {
                const canAfford = gold >= slot.potion.price
                const disabled = slot.stock <= 0 || !canAfford
                return (
                  <DraggableItem
                    key={`shop-${i}`}
                    id={`shop-potion-${i}`}
                    data={{ source: 'potion-shop', shopSlotIndex: i, potion: slot.potion } as unknown as Record<string, unknown>}
                    disabled={disabled}
                  >
                    <ShopPotionCard
                      potion={slot.potion}
                      stock={slot.stock}
                      price={slot.potion.price}
                      canAfford={canAfford}
                    />
                  </DraggableItem>
                )
              })}
            </div>
          </div>

          {/* ===== キャラ欄3等分 ===== */}
          <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
            {run.party.map(member => {
              const isValid = isDraggingUseOnMember && draggingData
                ? canUseOnMember(draggingData.potion.effect, member)
                : false
              return (
                <DroppableSlot
                  key={member.id}
                  id={`member-drop-${member.id}`}
                  disabled={!isDraggingUseOnMember}
                  isValidTarget={isValid}
                >
                  <PotionShopCharacterPanel
                    member={member}
                    isValidTarget={isValid}
                    relics={run.relics as RelicData[]}
                  />
                </DroppableSlot>
              )
            })}
          </div>

          {/* ===== 確定ボタン ===== */}
          <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
            <div className="flex justify-center">
              <Button variant="primary" onClick={closePotionShop} className="flex-1 max-w-md">
                進む
              </Button>
            </div>
          </div>

        </div>{/* 右側メイン領域 終わり */}

        {/* ドラッグオーバーレイ */}
        <DragOverlay>
          {dragLabel && (
            <div className="bg-teal-800 border border-teal-400 rounded px-3 py-1 text-sm text-white font-bold shadow-lg">
              {dragLabel}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
