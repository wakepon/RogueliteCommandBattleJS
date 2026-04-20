import { useEffect, useRef } from 'react'
import { DamageContributor } from '../../Lib/Types/Battle'

// ダメージポップアップの表示時間（ミリ秒）
const POPUP_DURATION_MS = 2250

interface DamagePopupProps {
  damage: number
  targetIndex: number  // 敵リスト内のインデックス
  totalTargets: number  // 敵の総数
  onComplete: () => void  // アニメーション完了時のコールバック
  isPlayerDamage?: boolean  // プレイヤーへのダメージかどうか
  contributors?: DamageContributor[]
  label?: string  // テキストラベル（例: 武器名）
}

// 敵インデックスから表示位置を計算
function calculatePosition(targetIndex: number, totalTargets: number): { x: number; y: number } {
  // グリッドレイアウト（2列）を想定して位置を計算
  const cols = Math.min(totalTargets, 2)
  const row = Math.floor(targetIndex / cols)
  const col = targetIndex % cols

  // 各セルの中央に表示
  const cellWidth = 100 / cols
  const x = cellWidth * col + cellWidth / 2
  const y = 30 + row * 40  // 各行の中央付近

  return { x, y }
}

export function DamagePopup({ damage, targetIndex, totalTargets, onComplete, isPlayerDamage = false, contributors, label }: DamagePopupProps) {
  const { x, y } = calculatePosition(targetIndex, totalTargets)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // マウント時に1回だけタイマーをセット
  useEffect(() => {
    const timer = setTimeout(() => {
      onCompleteRef.current()
    }, POPUP_DURATION_MS)

    return () => clearTimeout(timer)
  }, [])

  // 回復（負のdamage）は緑、プレイヤーダメージは黄色、敵へのダメージは赤
  const isHealing = damage < 0
  const displayText = isHealing ? `+${Math.abs(damage)}` : `-${damage}`
  const textColorClass = isHealing
    ? 'text-green-400'
    : isPlayerDamage ? 'text-yellow-500' : 'text-red-500'

  const hasContributors = contributors && contributors.length > 0

  return (
    <div
      className="absolute pointer-events-none animate-damage-popup z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex flex-col items-center">
        {label && (
          <span className="text-[10px] text-gray-200 drop-shadow-md whitespace-nowrap mb-0.5">
            {label}
          </span>
        )}
        <span className={`text-2xl font-bold drop-shadow-lg ${textColorClass}`}>
          {displayText}
        </span>
        {hasContributors && (
          <div className="flex flex-col items-center mt-0.5">
            {contributors.map((c, i) => (
              <span key={i} className="text-[9px] text-gray-300 drop-shadow-md whitespace-nowrap leading-tight">
                {c.name} {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
