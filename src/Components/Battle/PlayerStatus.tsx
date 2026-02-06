import { ExplorerState } from '../../Lib/Types/Explorer'
import { ResourceBar, BuffIcon } from '../Common'

interface PlayerStatusProps {
  explorer: ExplorerState
  gold: number
}

export function PlayerStatus({ explorer, gold }: PlayerStatusProps) {
  return (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-bold">{explorer.name}</span>
        <span className="text-yellow-400">Lv.{explorer.level}</span>
      </div>

      {/* HP */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>HP</span>
          <span>{explorer.hp} / {explorer.maxHp}</span>
        </div>
        <ResourceBar
          current={explorer.hp}
          max={explorer.maxHp}
          color="red"
          showText={false}
          size="md"
        />
      </div>

      {/* MP */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>MP</span>
          <span>{explorer.mp} / {explorer.maxMp}</span>
        </div>
        <ResourceBar
          current={explorer.mp}
          max={explorer.maxMp}
          color="blue"
          showText={false}
          size="md"
        />
      </div>

      {/* ゴールド */}
      <div className="text-yellow-400 text-sm">
        Gold: {gold}G
      </div>

      {/* バフ/デバフ表示 */}
      {(explorer.battleBuffs.length > 0 || explorer.battleDebuffs.length > 0) && (
        <div className="flex gap-1 mt-2 flex-wrap">
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
