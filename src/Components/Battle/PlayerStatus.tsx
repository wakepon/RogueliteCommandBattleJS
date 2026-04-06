import { ExplorerState } from '../../Lib/Types/Explorer'
import { ResourceBar, BuffIcon } from '../Common'
import { ExpGauge } from './ExpGauge'

interface PlayerStatusProps {
  explorer: ExplorerState
  gold: number
  levelUpPopupCount: number
  onExpFillComplete?: () => void
  isTargeted?: boolean
  targetRate?: number  // 被ターゲット率（0〜1）
}

export function PlayerStatus({ explorer, gold, levelUpPopupCount, onExpFillComplete, isTargeted, targetRate }: PlayerStatusProps) {
  // 前衛/後衛のラベル
  const positionLabel = explorer.position === 'front' ? '前衛' : '後衛'
  const positionColor = explorer.position === 'front' ? 'text-orange-400' : 'text-cyan-400'

  return (
    <div className={isTargeted ? 'ring-2 ring-lime-400 rounded p-1 -m-1' : ''}>
      {/* 名前とレベル */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1">
          <span className="text-white font-bold text-sm">{explorer.name}</span>
          <span className={`text-[10px] ${positionColor}`}>{positionLabel}</span>
        </div>
        <span className="text-yellow-400 text-xs">Lv.{explorer.level}</span>
      </div>

      {/* 被ターゲット率 */}
      {targetRate !== undefined && (
        <div className="text-[10px] text-gray-400 mb-1">
          被弾: <span className={targetRate >= 0.5 ? 'text-red-400 font-bold' : 'text-gray-300'}>{Math.round(targetRate * 100)}%</span>
        </div>
      )}

      {/* HP */}
      <div className="mb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <div className="flex items-center gap-1">
            <span>HP</span>
            {(() => {
              const poisonDebuff = explorer.battleDebuffs.find(d => d.type === 'poison')
              const weaknessDebuff = explorer.battleDebuffs.find(d => d.type === 'weakness')
              return (
                <>
                  {poisonDebuff && poisonDebuff.type === 'poison' && (
                    <span className="bg-purple-600 text-white text-[10px] px-1 rounded font-bold">
                      毒{poisonDebuff.stacks}
                    </span>
                  )}
                  {weaknessDebuff && weaknessDebuff.type === 'weakness' && (
                    <span className="bg-yellow-700 text-white text-[10px] px-1 rounded font-bold">
                      弱体{weaknessDebuff.duration}T
                    </span>
                  )}
                </>
              )
            })()}
          </div>
          <span>{explorer.hp} / {explorer.maxHp}</span>
        </div>
        <ResourceBar
          current={explorer.hp}
          max={explorer.maxHp}
          color="red"
          showText={false}
          size="sm"
        />
      </div>

      {/* MP */}
      <div className="mb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>MP</span>
          <span>{explorer.mp} / {explorer.maxMp}</span>
        </div>
        <ResourceBar
          current={explorer.mp}
          max={explorer.maxMp}
          color="blue"
          showText={false}
          size="sm"
        />
      </div>

      {/* EXP */}
      <div className="mb-2">
        <ExpGauge
          exp={explorer.exp}
          level={explorer.level}
          levelUpPopupCount={levelUpPopupCount}
          onFillComplete={onExpFillComplete}
        />
      </div>

      {/* ゴールド（gold > 0の場合のみ表示） */}
      {gold > 0 && (
        <div className="text-yellow-400 text-xs">
          Gold: {gold}G
        </div>
      )}

      {/* バフ/デバフ表示 */}
      {(explorer.battleBuffs.length > 0 || explorer.battleDebuffs.length > 0) && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {explorer.battleBuffs.map((buff) => (
            <BuffIcon key={`buff-${buff.type}-${buff.value}`} buff={buff} />
          ))}
          {explorer.battleDebuffs.map((debuff, i) => (
            <BuffIcon key={`debuff-${debuff.type}-${i}`} debuff={debuff} />
          ))}
        </div>
      )}
    </div>
  )
}
