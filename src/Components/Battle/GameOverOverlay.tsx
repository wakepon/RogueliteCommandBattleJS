import { Button } from '../Common/Button'

interface GameOverOverlayProps {
  onReturnTitle: () => void
}

/**
 * バトル画面に被せて表示するゲームオーバーオーバーレイ
 * 敗北時に残存リソース（HP/MP/武器耐久など）を確認できるよう、
 * 半透明のバックドロップ越しにバトル画面が見える
 */
export function GameOverOverlay({ onReturnTitle }: GameOverOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="bg-red-900/95 border-2 border-red-500 rounded-lg shadow-2xl px-10 py-8 flex flex-col items-center gap-6">
        <h2 className="text-4xl font-bold text-white tracking-widest">GAME OVER</h2>
        <Button variant="secondary" size="lg" onClick={onReturnTitle}>
          タイトルへ戻る
        </Button>
      </div>
    </div>
  )
}
