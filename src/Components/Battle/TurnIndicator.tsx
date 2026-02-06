import { ActorId } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { EnemyInstance } from '../../Lib/Types/Enemy'
import { TargetType } from '../../Lib/Types/Command'

interface TurnIndicatorProps {
  actionQueue: ActorId[]
  currentActorIndex: number
  party: ExplorerState[]
  enemies: EnemyInstance[]
  hoveredTargetId?: string | null
  targetType?: TargetType
}

// アクターの名前を取得
function getActorName(
  actorId: ActorId,
  party: ExplorerState[],
  enemies: EnemyInstance[]
): string {
  if (actorId.type === 'explorer') {
    const explorer = party.find(e => e.id === actorId.id)
    return explorer?.name ?? 'Unknown'
  } else {
    const enemy = enemies.find(e => e.instanceId === actorId.instanceId)
    return enemy?.name ?? 'Unknown'
  }
}

// アクターが味方かどうか
function isAlly(actorId: ActorId): boolean {
  return actorId.type === 'explorer'
}

// アクターが死亡しているかどうか
function isActorDead(
  actorId: ActorId,
  party: ExplorerState[],
  enemies: EnemyInstance[]
): boolean {
  if (actorId.type === 'explorer') {
    const explorer = party.find(e => e.id === actorId.id)
    return (explorer?.hp ?? 0) <= 0
  } else {
    const enemy = enemies.find(e => e.instanceId === actorId.instanceId)
    return (enemy?.currentHp ?? 0) <= 0
  }
}

export function TurnIndicator({
  actionQueue,
  currentActorIndex,
  party,
  enemies,
  hoveredTargetId,
  targetType,
}: TurnIndicatorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
        {actionQueue.map((actorId, index) => {
          const name = getActorName(actorId, party, enemies)
          const ally = isAlly(actorId)
          const isCurrent = index === currentActorIndex
          const isDead = isActorDead(actorId, party, enemies)

          // ターゲット選択時のハイライト判定（敵のみ、死亡していない場合）
          const isHoveredTarget = actorId.type === 'enemy' && !isDead && (
            targetType === 'enemyAll' ||
            actorId.instanceId === hoveredTargetId
          )

          return (
            <div
              key={`${actorId.type}-${actorId.type === 'explorer' ? actorId.id : actorId.instanceId}-${index}`}
              className={`
                flex-shrink-0 px-3 py-1 rounded text-sm font-medium
                ${isCurrent ? 'ring-2 ring-yellow-400' : ''}
                ${isHoveredTarget && !isCurrent ? 'ring-2 ring-yellow-400 bg-yellow-400/20' : ''}
                ${isDead ? 'opacity-50 line-through' : ''}
                ${ally ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}
              `}
            >
              {isCurrent && <span className="mr-1">{'>'}</span>}
              {name}
            </div>
          )
        })}
    </div>
  )
}
