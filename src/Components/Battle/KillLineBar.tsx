import { DamageRange } from '../../Lib/Utils/DamagePredictor'

interface KillLineBarProps {
  currentHp: number
  maxHp: number
  damagePreview: DamageRange | null  // nullの場合はプレビューなし
}

/**
 * キルラインバー
 *
 * 敵のHPバーに「確定ダメージ」「ブレ幅」を重ねて表示:
 * ■ = 最低ダメージで確実に削れる範囲（確定ダメ）
 * □ = 最大ダメージなら削れる範囲（運次第）
 * ░ = 残りHP
 *
 * 常に現在HPを100%幅として割合表示
 */
export function KillLineBar({ currentHp, maxHp, damagePreview }: KillLineBarProps) {
  if (currentHp <= 0) {
    return (
      <div className="h-3 bg-gray-700 rounded-sm overflow-hidden">
        <div className="h-full bg-gray-600 w-full" />
      </div>
    )
  }

  // HPの割合
  const hpRatio = currentHp / maxHp

  if (!damagePreview || (damagePreview.min === 0 && damagePreview.max === 0)) {
    // プレビューなし: 通常のHPバー
    return (
      <div className="h-3 bg-gray-700 rounded-sm overflow-hidden">
        <div
          className="h-full bg-red-500 transition-all duration-200"
          style={{ width: `${hpRatio * 100}%` }}
        />
      </div>
    )
  }

  // ダメージプレビューあり: 現在HPを100%として割合計算
  const minDamageRatio = Math.min(damagePreview.min / currentHp, 1)
  const maxDamageRatio = Math.min(damagePreview.max / currentHp, 1)
  const varianceRatio = maxDamageRatio - minDamageRatio
  const remainingRatio = 1 - maxDamageRatio

  // 確殺判定
  const isGuaranteedKill = damagePreview.min >= currentHp
  const isPossibleKill = damagePreview.max >= currentHp

  return (
    <div className="relative">
      <div className="h-3 bg-gray-700 rounded-sm overflow-hidden flex">
        {/* 確定ダメージ（最低ダメージ範囲） */}
        {minDamageRatio > 0 && (
          <div
            className={`h-full ${isGuaranteedKill ? 'bg-yellow-400' : 'bg-orange-500'} transition-all duration-200`}
            style={{ width: `${minDamageRatio * 100}%` }}
          />
        )}
        {/* ブレ幅（運次第の範囲） */}
        {varianceRatio > 0 && (
          <div
            className="h-full bg-orange-300/50 transition-all duration-200"
            style={{ width: `${varianceRatio * 100}%` }}
          />
        )}
        {/* 残りHP */}
        {remainingRatio > 0 && (
          <div
            className="h-full bg-red-500 transition-all duration-200"
            style={{ width: `${remainingRatio * 100}%` }}
          />
        )}
      </div>
      {/* 確殺/可能表示 */}
      {isGuaranteedKill && (
        <div className="absolute -top-0.5 right-0 text-[8px] text-yellow-300 font-bold">KILL</div>
      )}
      {!isGuaranteedKill && isPossibleKill && (
        <div className="absolute -top-0.5 right-0 text-[8px] text-orange-300 font-bold">KILL?</div>
      )}
    </div>
  )
}
