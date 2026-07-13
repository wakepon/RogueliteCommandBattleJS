type Props = {
  /** 使用のたびに増加するカウンタ。値が変わるたびに key で再マウントしフラッシュを再生する */
  flashKey: number
}

/**
 * 画面全体を一瞬フラッシュさせるオーバーレイ。
 * ポーション使用時などのフィードバック演出に使う。
 * flashKey === 0（未発動）の間は描画しない。
 */
export function ScreenFlashOverlay({ flashKey }: Props) {
  if (flashKey === 0) return null
  return (
    <div
      key={flashKey}
      className="animate-screen-flash pointer-events-none fixed inset-0 z-50 bg-white"
    />
  )
}
