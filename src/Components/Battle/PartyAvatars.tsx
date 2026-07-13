import { ExplorerState, CharacterClass } from '../../Lib/Types/Explorer'
import { isFrontMember } from '../../Lib/Core'
import { DroppableTarget } from './DroppableTarget'
import { Tooltip } from '../Common'
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** クラス別のアイコン（絵文字） */
export const CLASS_ICONS: Record<CharacterClass, string> = {
  warrior: '⚔️',
  mage: '🔮',
  cleric: '✨',
}

/** 行動アニメーション種別 */
export type AvatarActingType = 'attack' | 'heal'

interface AvatarVisualProps {
  member: ExplorerState
  party: ExplorerState[]
  /** 選択中ハイライト */
  isSelected?: boolean
  /** ドロップターゲット候補ハイライト */
  isDropTarget?: boolean
  /** 行動アニメ種別 */
  actingType?: AvatarActingType | null
  /** 任意のスケール (e.g. 0.7) */
  scale?: number
}

/**
 * 丸アイコンの「見た目だけ」のコンポーネント。
 * SortableAvatar / DragOverlay 双方で再利用される。
 */
export function AvatarVisual({
  member,
  party,
  isSelected = false,
  isDropTarget = false,
  actingType = null,
  scale,
}: AvatarVisualProps) {
  const isDead = member.hp <= 0
  const icon = CLASS_ICONS[member.characterClass]
  const isFront = isFrontMember(party, member.id)
  const actingClass = actingType
    ? actingType === 'attack'
      ? 'animate-avatar-attack'
      : 'animate-avatar-heal'
    : ''

  const style: React.CSSProperties | undefined = scale
    ? { transform: `scale(${scale})` }
    : undefined

  return (
    <div
      style={style}
      className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl
        ${isDead ? 'bg-gray-800 border-gray-600 opacity-40' : 'bg-gray-700 border-gray-400'}
        ${isFront && !isDead ? 'ring-2 ring-orange-400/60' : ''}
        ${isSelected ? 'ring-2 ring-lime-400' : ''}
        ${isDropTarget ? 'ring-2 ring-yellow-300/70' : ''}
        ${actingClass}`}
    >
      <span className="leading-none select-none">{icon}</span>
      {isDead && (
        <span className="absolute -top-1 -right-1 text-[10px] text-red-400 font-bold">×</span>
      )}
    </div>
  )
}

interface PartyAvatarsProps {
  party: ExplorerState[]
  isCommandPhase: boolean
  draggingAllyTarget: boolean
  draggingPanel: boolean
  /** 蘇生など戦闘不能の味方を対象にするモード（有効対象が反転する） */
  reviveMode?: boolean
  /** 現在行動中のメンバーIDとアニメ種別 */
  acting: { explorerId: string; type: AvatarActingType } | null
  /** ターゲットとして選択中の味方ID（クリックフロー用ハイライト） */
  selectedTargetId: string | null
  isSelectingAlly: boolean
  onAllyClick?: (memberId: string) => void
}

interface SortableAvatarProps {
  member: ExplorerState
  party: ExplorerState[]
  index: number
  offset: { x: number; y: number }
  isCommandPhase: boolean
  draggingAllyTarget: boolean
  draggingPanel: boolean
  reviveMode: boolean
  acting: { explorerId: string; type: AvatarActingType } | null
  selectedTargetId: string | null
  isSelectingAlly: boolean
  onAllyClick?: (memberId: string) => void
}

/** 1つの丸アイコン（D&D並び替え対応） */
function SortableAvatar({
  member,
  party,
  offset,
  isCommandPhase,
  draggingAllyTarget,
  draggingPanel,
  reviveMode,
  acting,
  selectedTargetId,
  isSelectingAlly,
  onAllyClick,
}: SortableAvatarProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `avatar-${member.id}`,
    disabled: !isCommandPhase,
  })

  const isDead = member.hp <= 0
  const isValidAllyTarget = reviveMode ? isDead : !isDead
  const isActing = acting?.explorerId === member.id
  const isSelected = isSelectingAlly && selectedTargetId === member.id

  const sortStyle: React.CSSProperties = {
    left: offset.x,
    top: offset.y,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // ドラッグ中はドラッグオーバーレイで表示するので、元の位置は invisible にする
  const containerVisibilityClass = isDragging ? 'opacity-0' : ''

  return (
    <div
      ref={setNodeRef}
      className={`absolute z-[1] ${containerVisibilityClass}`}
      style={sortStyle}
    >
      <Tooltip
        content={
          <div>
            <div className="font-bold">
              {member.name}{' '}
              <span className={isFrontMember(party, member.id) ? 'text-orange-400' : 'text-cyan-400'}>
                {isFrontMember(party, member.id) ? '前衛' : '後衛'}
              </span>
            </div>
            <div className="text-gray-300">
              HP {member.hp}/{member.maxHp}
            </div>
            <div className="flex justify-between gap-3 text-gray-300">
              <span className="text-gray-400">STR</span><span>{member.str}</span>
            </div>
            <div className="flex justify-between gap-3 text-gray-300">
              <span className="text-gray-400">INT</span><span>{member.int}</span>
            </div>
          </div>
        }
        position="bottom"
        disabled={!!acting || isDragging}
      >
        <DroppableTarget
          id={`ally-avatar-${member.id}`}
          disabled={!isCommandPhase || draggingPanel || (!draggingAllyTarget && !onAllyClick)}
        >
          <button
            type="button"
            onClick={onAllyClick ? () => onAllyClick(member.id) : undefined}
            disabled={!onAllyClick || !isSelectingAlly}
            {...listeners}
            {...attributes}
            className={`block ${onAllyClick && isSelectingAlly && isValidAllyTarget ? 'cursor-pointer hover:brightness-125' : isCommandPhase ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            aria-label={member.name}
          >
            <AvatarVisual
              member={member}
              party={party}
              isSelected={isSelected}
              isDropTarget={draggingAllyTarget && isValidAllyTarget}
              actingType={isActing ? acting!.type : null}
            />
          </button>
        </DroppableTarget>
      </Tooltip>
    </div>
  )
}

/**
 * 敵エリア右側に表示する味方丸アイコン群
 * - party 配列順で 上→下 に右肩下がりで3つ並ぶ（左上=前衛、中央、右下=後衛）
 * - クラスアイコンを表示、ホバーでメンバー名+HP表示
 * - 味方対象コマンドのドロップターゲット (`ally-avatar-${id}`)
 * - D&Dで並び替え可（`avatar-${id}` IDで Sortable）
 */
export function PartyAvatars({
  party,
  isCommandPhase,
  draggingAllyTarget,
  draggingPanel,
  reviveMode = false,
  acting,
  selectedTargetId,
  isSelectingAlly,
  onAllyClick,
}: PartyAvatarsProps) {
  // 右肩下がり: index 0 が左上、index 2 が右下
  const offsets = [
    { x: 0, y: 0 },
    { x: 32, y: 36 },
    { x: 64, y: 72 },
  ]

  const avatarIds = party.map(m => `avatar-${m.id}`)

  return (
    <div className="relative w-[180px] h-[126px] shrink-0">
      <SortableContext items={avatarIds}>
        {party.map((member, index) => (
          <SortableAvatar
            key={member.id}
            member={member}
            party={party}
            index={index}
            offset={offsets[index] ?? { x: 0, y: 0 }}
            isCommandPhase={isCommandPhase}
            draggingAllyTarget={draggingAllyTarget}
            draggingPanel={draggingPanel}
            reviveMode={reviveMode}
            acting={acting}
            selectedTargetId={selectedTargetId}
            isSelectingAlly={isSelectingAlly}
            onAllyClick={onAllyClick}
          />
        ))}
      </SortableContext>
    </div>
  )
}
