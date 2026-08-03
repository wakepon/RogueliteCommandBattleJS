import { MemberBattleDiff, MemberAnimationPhase } from '../../Lib/Types/Game'
import { ResourceBar, SegmentedBar, Tooltip, CharacterStatTooltip } from '../Common'
import { DiffLabel } from './DiffLabel'

interface ResultMemberPanelProps {
  diff: MemberBattleDiff
  /** アニメーションフェーズ。'pending' は未表示扱いで何も描画しない */
  phase: MemberAnimationPhase
}

const RESOURCE_TRANSITION_MS = 800

/**
 * リザルト画面のメンバーパネル
 * phase に応じて戦闘前値→戦闘後値へ伸縮、レベルアップ振動などのアニメを実行
 */
export function ResultMemberPanel({ diff, phase }: ResultMemberPanelProps) {
  if (phase === 'pending') return null

  const leveledUp = diff.levelDiff > 0

  // resourcesAnimate に達するまでは before 値を表示。それ以降は after 値（伸縮で見せる）
  const showAfterResources = phase !== 'enter'

  // レベル表示は levelUpdated 以降で新値、それより前は before 値
  const showNewLevel = phase === 'levelUpdated' || phase === 'maxStatsRevealed' || phase === 'done'
  const displayLevel = showNewLevel ? diff.level : diff.levelBefore

  // maxHP/maxMP の差分ラベルは maxStatsRevealed 以降のみ表示
  const showMaxDiff = phase === 'maxStatsRevealed' || phase === 'done'

  // HP の現在値・最大値（before/after）
  const hpCurrent = showAfterResources ? diff.hp : diff.hpBefore
  // maxHp は maxStatsRevealed 以降で新最大値、その前は旧最大値（バー伸縮はそれに合わせる）
  const hpMax = showMaxDiff ? diff.maxHp : diff.maxHpBefore

  // EXP: レベルアップ前は before の expRequired を分母に、レベル更新後は新 expRequired を分母に
  let expCurrent: number
  let expMax: number
  if (!showAfterResources) {
    // enter: 戦闘前
    expCurrent = diff.expBefore
    expMax = diff.expRequiredBefore
  } else if (!showNewLevel) {
    // resourcesAnimate / shaking: レベル前枠でバー満タンへ（レベルアップ時）or 普通の after 値（非レベルアップ）
    if (leveledUp) {
      expCurrent = diff.expRequiredBefore
      expMax = diff.expRequiredBefore
    } else {
      expCurrent = diff.exp
      expMax = diff.expRequired
    }
  } else {
    // levelUpdated 以降: 新レベルでの実値
    expCurrent = diff.exp
    expMax = diff.expRequired
  }

  // 武器耐久値: showAfterResources で after に切り替え
  const durableWeapons = diff.weapons.filter(w => w.maxUses !== null)

  // レベルアップ演出: shaking フェーズで縦方向ニョキニョキ
  const stretchClass = phase === 'shaking' ? 'animate-levelup-stretch' : ''
  // 大カードの出現アニメ: enter フェーズのみ
  const enterAnimClass = phase === 'enter' ? 'animate-card-fade' : ''

  return (
    <div className={`bg-black/30 rounded-lg p-4 text-white ${enterAnimClass} ${stretchClass}`}>
      {/* 名前とレベル */}
      <div className="flex justify-between items-center mb-2">
        <Tooltip content={<CharacterStatTooltip name={diff.name} str={diff.str} int={diff.int} />} position="bottom">
          <span className="text-white font-bold">{diff.name}</span>
        </Tooltip>
        <span className="text-yellow-400 text-sm">
          {leveledUp && showNewLevel
            ? `Lv.${diff.levelBefore} → Lv.${diff.level}`
            : `Lv.${displayLevel}`}
        </span>
      </div>

      {/* HP */}
      <div className="mb-2">
        <div className="flex justify-between items-center text-xs text-gray-400 mb-0.5">
          <span>HP</span>
          <span className="flex items-center gap-1">
            <span>
              {hpCurrent} / {hpMax}
            </span>
            {showAfterResources && <DiffLabel value={diff.hpDiff} />}
            {showMaxDiff && diff.maxHpDiff !== 0 && (
              <DiffLabel value={diff.maxHpDiff} prefix="(max " suffix=")" />
            )}
          </span>
        </div>
        <ResourceBar
          current={hpCurrent}
          max={hpMax}
          color="green"
          showText={false}
          size="sm"
          transitionMs={RESOURCE_TRANSITION_MS}
        />
      </div>


      {/* EXP（必要敵数で区画分割表示。レベルアップ時は最大→0 へ瞬時にワープ） */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
          <span>EXP</span>
          <span>
            {expCurrent} / {expMax}
          </span>
        </div>
        <SegmentedBar
          current={expCurrent}
          max={expMax}
          color="yellow"
          size="sm"
          animateExpansion
        />
      </div>

      {/* 武器耐久値リスト */}
      {durableWeapons.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700 space-y-0.5">
          {durableWeapons.map((w, i) => {
            const displayUses = showAfterResources ? w.currentUses : w.usesBefore
            return (
              <div
                key={`${w.weaponId}-${i}`}
                className="flex justify-between items-center text-xs"
              >
                <span className="text-gray-300">{w.weaponName}</span>
                <span className="flex items-center gap-1">
                  <span className={w.broken && showAfterResources ? 'text-red-400 font-bold' : 'text-white'}>
                    {displayUses}
                  </span>
                  <span className="text-gray-500">/ {w.maxUses}</span>
                  {showAfterResources && <DiffLabel value={w.usesDiff} />}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
