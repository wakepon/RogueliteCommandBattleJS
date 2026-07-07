import { DebugItemGrant } from './DebugItemGrant'
import { DebugEnemyEditor } from './DebugEnemyEditor'

/**
 * デバッグウィンドウ（DEV時のみ）。
 * アイテム即時入手 / レリック破棄 / 敵の入れ替え・追加 / 敵全滅を提供する。
 */
export function DebugWindow({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-lg shadow-2xl w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
          <h2 className="text-yellow-400 font-bold text-lg">🐞 デバッグウィンドウ</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl font-bold px-2"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* 本文 */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* 敵編集 */}
          <section>
            <h3 className="text-white font-bold text-sm border-b border-gray-700 pb-1 mb-2">敵の編集</h3>
            <DebugEnemyEditor onKillAll={onClose} />
          </section>

          {/* アイテム入手 */}
          <section>
            <h3 className="text-white font-bold text-sm border-b border-gray-700 pb-1 mb-2">アイテム入手（クリックで空き枠に追加）</h3>
            <DebugItemGrant />
          </section>

          {/* 破棄の説明 */}
          <p className="text-[10px] text-gray-500">
            ※武器・魔法の破棄: ウィンドウを閉じて、所持コマンドを左下のデバッグボタンへドラッグ＆ドロップ
          </p>
        </div>
      </div>
    </div>
  )
}
