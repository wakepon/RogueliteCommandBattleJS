import { CommandSlot } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { EnemyInstance } from '../../Lib/Types/Enemy'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ActionOrderSlotsProps {
  commandSlots: CommandSlot[]
  party: ExplorerState[]
  enemies: EnemyInstance[]
  isCommandPhase: boolean
}

/** ターゲット名を解決 */
function resolveTargetName(
  targetId: string | null,
  party: ExplorerState[],
  enemies: EnemyInstance[]
): string {
  if (!targetId) return ''
  const enemy = enemies.find(e => e.instanceId === targetId)
  if (enemy) return enemy.name
  const member = party.find(m => m.id === targetId)
  if (member) return member.name
  return ''
}

/** ソート可能な行動順アイテム（縦にキャラ名・コマンド・ターゲットを表示） */
function SortableOrderItem({
  slot,
  index,
  member,
  targetName,
  isCommandPhase,
}: {
  slot: CommandSlot
  index: number
  member: ExplorerState
  targetName: string
  isCommandPhase: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `order-${slot.explorerId}`,
    disabled: !isCommandPhase || !slot.command,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const hasCommand = slot.command !== null

  return (
    <div className="flex items-center">
      {/* 矢印（先頭以外） */}
      {index > 0 && <span className="text-gray-600 text-xs mx-1">→</span>}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`flex flex-col items-center rounded px-3 py-1 text-center select-none min-w-[4.5rem]
          ${isDragging ? 'opacity-50 z-10' : ''}
          ${hasCommand
            ? 'bg-gray-700 text-white cursor-grab active:cursor-grabbing'
            : 'bg-gray-800 text-gray-500'
          }
        `}
      >
        {/* キャラ名 */}
        <span className="font-bold text-[11px]">{member.name}</span>
        {/* コマンド名 */}
        {hasCommand ? (
          <>
            <span className="text-green-300 text-[10px] truncate max-w-[5rem]">
              {slot.command!.name}
            </span>
            {targetName && (
              <span className="text-gray-400 text-[9px] truncate max-w-[5rem]">
                → {targetName}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-600 text-[10px]">未設定</span>
        )}
      </div>
    </div>
  )
}

/**
 * 行動順スロット（横並び）
 * - 各スロットにキャラ名・コマンド・ターゲットを縦表示
 * - D&Dで行動順を入れ替え可能
 */
export function ActionOrderSlots({ commandSlots, party, enemies, isCommandPhase }: ActionOrderSlotsProps) {
  return (
    <div>
      <span className="text-[9px] text-gray-500">行動順</span>
      <div className="flex items-center mt-0.5">
        {commandSlots.map((slot, index) => {
          const member = party.find(m => m.id === slot.explorerId)
          if (!member) return null
          const targetName = resolveTargetName(slot.targetId, party, enemies)
          return (
            <SortableOrderItem
              key={slot.explorerId}
              slot={slot}
              index={index}
              member={member}
              targetName={targetName}
              isCommandPhase={isCommandPhase}
            />
          )
        })}
      </div>
    </div>
  )
}
