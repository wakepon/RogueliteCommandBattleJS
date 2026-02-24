import { useEffect, useRef } from 'react'

// ダメージポップアップの表示時間（ミリ秒）
const POPUP_DURATION_MS = 1000

interface DamagePopupProps {
  damage: number
  targetIndex: number  // 敵リスト内のインデックス
  totalTargets: number  // 敵の総数
  onComplete: () => void  // アニメーション完了時のコールバック
  isPlayerDamage?: boolean  // プレイヤーへのダメージかどうか
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

export function DamagePopup({ damage, targetIndex, totalTargets, onComplete, isPlayerDamage = false }: DamagePopupProps) {
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

  // プレイヤーダメージは黄色、敵へのダメージは赤
  const textColorClass = isPlayerDamage ? 'text-yellow-500' : 'text-red-500'

  return (
    <div
      className="absolute pointer-events-none animate-damage-popup z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span className={`text-2xl font-bold drop-shadow-lg ${textColorClass}`}>
        -{damage}
      </span>
    </div>
  )
}
