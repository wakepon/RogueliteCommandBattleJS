import { ExplorerState } from '../../Lib/Types/Explorer'
import { ResourceBar, BuffIcon } from '../Common'
import { ExpGauge } from './ExpGauge'

interface PlayerStatusProps {
  explorer: ExplorerState
  gold: number
  levelUpPopupCount: number
  onExpFillComplete?: () => void
  isTargeted?: boolean
}

export function PlayerStatus({ explorer, gold, levelUpPopupCount, onExpFillComplete, isTargeted }: PlayerStatusProps) {
  return (
    <div className={isTargeted ? 'ring-2 ring-lime-400 rounded p-1 -m-1' : ''}>
      {/* 名前とレベル */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-bold text-sm">{explorer.name}</span>
        <span className="text-yellow-400 text-sm">Lv.{explorer.level}</span>
      </div>

      {/* HP */}
      <div className="mb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>HP</span>
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

      {/* ゴールド */}
      <div className="text-yellow-400 text-xs">
        Gold: {gold}G
      </div>

      {/* バフ/デバフ表示 */}
      {(explorer.battleBuffs.length > 0 || explorer.battleDebuffs.length > 0) && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {explorer.battleBuffs.map((buff) => (
            <BuffIcon key={`buff-${buff.type}-${buff.value}`} buff={buff} />
          ))}
          {explorer.battleDebuffs.map((debuff) => (
            <BuffIcon key={`debuff-${debuff.type}-${debuff.stacks}`} debuff={debuff} />
          ))}
        </div>
      )}
    </div>
  )
}
