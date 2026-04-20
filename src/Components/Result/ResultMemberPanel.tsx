import { MemberBattleDiff } from '../../Lib/Types/Game'
import { ResourceBar } from '../Common'
import { DiffLabel } from './DiffLabel'

interface ResultMemberPanelProps {
  diff: MemberBattleDiff
}

/**
 * リザルト画面のメンバーパネル
 * HP / MP / レベル / 経験値 / 武器耐久 を現在値＋変化量で表示
 */
export function ResultMemberPanel({ diff }: ResultMemberPanelProps) {
  const leveledUp = diff.levelDiff > 0
  const prevLevel = diff.level - diff.levelDiff
  // 武器耐久を表示する対象（無制限武器 maxUses=null は除外）
  const durableWeapons = diff.weapons.filter(w => w.maxUses !== null)

  return (
    <div className="bg-black/30 rounded-lg p-4 text-white">
      {/* 名前とレベル */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-bold">{diff.name}</span>
        <span className="text-yellow-400 text-sm">
          {leveledUp ? `Lv.${prevLevel} → Lv.${diff.level}` : `Lv.${diff.level}`}
        </span>
      </div>

      {/* HP */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-xs text-gray-400 mb-0.5">
          <span>HP</span>
          <span className="flex items-center gap-1">
            <span>
              {diff.hp} / {diff.maxHp}
            </span>
            <DiffLabel value={diff.hpDiff} />
            {diff.maxHpDiff !== 0 && (
              <DiffLabel value={diff.maxHpDiff} prefix="(max " suffix=")" />
            )}
          </span>
        </div>
        <ResourceBar
          current={diff.hp}
          max={diff.maxHp}
          color="green"
          showText={false}
          size="sm"
        />
      </div>

      {/* MP */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-xs text-gray-400 mb-0.5">
          <span>MP</span>
          <span className="flex items-center gap-1">
            <span>
              {diff.mp} / {diff.maxMp}
            </span>
            <DiffLabel value={diff.mpDiff} />
            {diff.maxMpDiff !== 0 && (
              <DiffLabel value={diff.maxMpDiff} prefix="(max " suffix=")" />
            )}
          </span>
        </div>
        <ResourceBar
          current={diff.mp}
          max={diff.maxMp}
          color="blue"
          showText={false}
          size="sm"
        />
      </div>

      {/* EXP（現在値のみ、差分は表示しない） */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>EXP</span>
          <span>
            {diff.exp} / {diff.expRequired}
          </span>
        </div>
        <ResourceBar
          current={diff.exp}
          max={diff.expRequired}
          color="yellow"
          showText={false}
          size="sm"
        />
      </div>

      {/* 武器耐久値リスト */}
      {durableWeapons.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700 space-y-0.5">
          {durableWeapons.map((w, i) => (
            <div
              key={`${w.weaponId}-${i}`}
              className="flex justify-between items-center text-xs"
            >
              <span className="text-gray-300">{w.weaponName}</span>
              <span className="flex items-center gap-1">
                <span className={w.broken ? 'text-red-400 font-bold' : 'text-white'}>
                  {w.currentUses}
                </span>
                <span className="text-gray-500">/ {w.maxUses}</span>
                <DiffLabel value={w.usesDiff} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
