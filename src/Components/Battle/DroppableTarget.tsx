import { useDroppable } from '@dnd-kit/core'
import { ReactNode } from 'react'

interface DroppableTargetProps {
  id: string
  children: ReactNode
  disabled?: boolean
}

/**
 * ドロップ可能なターゲットゾーン
 * 敵や味方キャラの上にドロップするとコマンドがセットされる
 */
export function DroppableTarget({ id, children, disabled }: DroppableTargetProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-150 ${
        isOver ? 'ring-2 ring-yellow-400 bg-yellow-400/10 rounded' : ''
      }`}
    >
      {children}
    </div>
  )
}
