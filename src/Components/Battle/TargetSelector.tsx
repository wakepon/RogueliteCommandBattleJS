import { EnemyInstance } from '../../Lib/Types/Enemy'
import { TargetType } from '../../Lib/Types/Command'
import { Button } from '../Common/Button'

interface TargetSelectorProps {
  enemies: EnemyInstance[]
  selectedTargetId: string | null
  targetType: TargetType
  onSelectTarget: (targetId: string) => void
  onConfirm: () => void
  onCancel: () => void
}

// 敵が選択可能かどうか
function isEnemySelectable(enemy: EnemyInstance): boolean {
  return enemy.currentHp > 0
}

// enemyAllの場合、全敵が選択対象
function isEnemyHighlighted(
  enemy: EnemyInstance,
  selectedTargetId: string | null,
  targetType: TargetType
): boolean {
  if (!isEnemySelectable(enemy)) {
    return false
  }

  if (targetType === 'enemyAll') {
    return true
  }

  return enemy.instanceId === selectedTargetId
}

export function TargetSelector({
  enemies,
  selectedTargetId,
  targetType,
  onSelectTarget,
  onConfirm,
  onCancel,
}: TargetSelectorProps) {
  // enemyAllの場合は確定ボタンを即座に有効化
  const canConfirm = targetType === 'enemyAll' || selectedTargetId !== null

  // enemyAllの場合、自動的に最初の生存敵を選択（ターゲットIDは必要ないが形式上）
  const handleConfirm = () => {
    if (targetType === 'enemyAll' && selectedTargetId === null) {
      // 最初の生存敵のIDを渡す（全体攻撃なのでどれでもOK）
      const firstAlive = enemies.find(e => e.currentHp > 0)
      if (firstAlive) {
        onSelectTarget(firstAlive.instanceId)
      }
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-4 rounded-lg max-w-lg w-full mx-4">
        <div className="text-white text-center mb-4 font-bold">
          {targetType === 'enemyAll' ? '全体攻撃' : 'ターゲットを選択'}
        </div>

        {/* 敵リスト */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {enemies.map((enemy) => {
            const selectable = isEnemySelectable(enemy)
            const highlighted = isEnemyHighlighted(enemy, selectedTargetId, targetType)

            return (
              <button
                key={enemy.instanceId}
                onClick={() => selectable && onSelectTarget(enemy.instanceId)}
                disabled={!selectable}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  ${highlighted
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : selectable
                      ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      : 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                <div className="text-white font-bold mb-1">{enemy.name}</div>
                <div className="text-sm text-gray-400">
                  HP: {enemy.currentHp} / {enemy.hp}
                </div>
                {enemy.currentHp <= 0 && (
                  <div className="text-red-400 text-xs mt-1">DEFEATED</div>
                )}
              </button>
            )
          })}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            確定
          </Button>
        </div>
      </div>
    </div>
  )
}
