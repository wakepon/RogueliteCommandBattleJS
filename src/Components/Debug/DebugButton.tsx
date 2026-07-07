import { useDroppable } from '@dnd-kit/core'

/**
 * デバッグ起動ボタン（DEV時のみ表示）。
 * クリックでデバッグウィンドウを開く。
 * 所持アイテム（武器/魔法）をここへドラッグ＆ドロップすると即時破棄のドロップ先にもなる。
 */
export function DebugButton({ onClick, isDraggingItem }: {
  onClick: () => void
  /** アイテムドラッグ中フラグ（破棄ドロップ先であることを強調表示） */
  isDraggingItem: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id: 'debug-discard' })

  const baseStyle = isOver
    ? 'border-red-500 bg-red-900/60 text-red-300'
    : isDraggingItem
      ? 'border-red-400/60 bg-red-900/30 text-red-300'
      : 'border-yellow-600/60 bg-gray-800/70 text-yellow-400 hover:bg-gray-700'

  return (
    <div ref={setNodeRef}>
      <button
        onClick={onClick}
        className={`w-full border rounded-lg p-2 text-sm font-bold transition-colors ${baseStyle}`}
      >
        {isDraggingItem ? '🗑 ここにドロップで破棄' : '🐞 デバッグ'}
      </button>
    </div>
  )
}
