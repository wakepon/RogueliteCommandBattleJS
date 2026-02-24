import { EnemyInstance } from '../../Lib/Types/Enemy'
import { ResourceBar, BuffIcon } from '../Common'

interface EnemyDisplayProps {
  enemy: EnemyInstance
  isCurrentActor: boolean
  isTargetSelected?: boolean
  isTargetHighlighted?: boolean
  onSelect?: () => void
}

// 敵タイプに応じた色を返す
function getEnemyTypeColor(type: EnemyInstance['type']): string {
  switch (type) {
    case 'normal':
      return 'border-green-500'
    case 'elite':
      return 'border-purple-500'
    case 'boss':
      return 'border-red-500'
    default:
      return 'border-gray-500'
  }
}

// 敵タイプに応じた背景色を返す
function getEnemyTypeBgColor(type: EnemyInstance['type']): string {
  switch (type) {
    case 'normal':
      return 'bg-green-900/30'
    case 'elite':
      return 'bg-purple-900/30'
    case 'boss':
      return 'bg-red-900/30'
    default:
      return 'bg-gray-900/30'
  }
}

export function EnemyDisplay({
  enemy,
  isCurrentActor,
  isTargetSelected = false,
  isTargetHighlighted = false,
  onSelect,
}: EnemyDisplayProps) {
  const borderColor = getEnemyTypeColor(enemy.type)
  const bgColor = getEnemyTypeBgColor(enemy.type)
  const isDead = enemy.currentHp <= 0

  // ターゲット選択時のスタイル
  const targetStyle = isTargetSelected || isTargetHighlighted
    ? 'border-yellow-400 bg-yellow-400/20'
    : `${borderColor} ${bgColor}`

  return (
    <div
      onClick={onSelect}
      className={`
        relative p-4 rounded-lg border-2 w-32 md:w-40
        ${targetStyle}
        ${isCurrentActor ? 'ring-2 ring-yellow-400' : ''}
        ${isDead ? 'opacity-50' : ''}
        ${onSelect && !isDead ? 'cursor-pointer hover:border-yellow-300' : ''}
        transition-all duration-200
      `}
    >
      {/* 選択カーソルインジケーター */}
      {isTargetSelected && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-yellow-400 text-xl font-bold">
          ▲
        </div>
      )}
      {/* 敵タイプバッジ */}
      {enemy.type !== 'normal' && (
        <div className={`
          absolute -top-2 -right-2 px-2 py-0.5 rounded text-xs font-bold text-white
          ${enemy.type === 'elite' ? 'bg-purple-500' : 'bg-red-500'}
        `}>
          {enemy.type === 'elite' ? 'ELITE' : 'BOSS'}
        </div>
      )}

      {/* 敵名 */}
      <div className="text-white font-bold mb-2 text-center">
        {enemy.name}
      </div>

      {/* HP バー */}
      <div className="mb-2">
        <ResourceBar
          current={enemy.currentHp}
          max={enemy.hp}
          color="red"
          showText={true}
          size="sm"
        />
      </div>

      {/* 攻撃力表示 */}
      <div className="text-xs text-gray-400 text-center">
        ATK: {enemy.attack}
      </div>

      {/* バフ/デバフ表示 */}
      {(enemy.battleBuffs.length > 0 || enemy.battleDebuffs.length > 0) && (
        <div className="flex gap-1 mt-2 justify-center flex-wrap">
          {enemy.battleBuffs.map((buff) => (
            <BuffIcon key={`buff-${buff.type}-${buff.value}`} buff={buff} />
          ))}
          {enemy.battleDebuffs.map((debuff) => (
            <BuffIcon key={`debuff-${debuff.type}-${debuff.stacks}`} debuff={debuff} />
          ))}
        </div>
      )}

      {/* 死亡表示 */}
      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <span className="text-gray-400 font-bold">DEFEATED</span>
        </div>
      )}
    </div>
  )
}
