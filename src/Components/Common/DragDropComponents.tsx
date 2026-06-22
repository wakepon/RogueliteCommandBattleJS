import { useDraggable, useDroppable } from '@dnd-kit/core'

export function DraggableItem({ id, data, children, disabled }: {
  id: string
  data: Record<string, unknown>
  children: React.ReactNode
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`${isDragging ? 'opacity-40' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} select-none`}>
      {children}
    </div>
  )
}

export function DroppableSlot({ id, children, disabled, className, isValidTarget }: {
  id: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
  isValidTarget?: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled })
  const isOverActive = isOver && !disabled
  const isValid = !!isValidTarget && !disabled && !isOverActive
  const highlight = isOverActive
    ? 'ring-2 ring-yellow-400 bg-yellow-400/10'
    : isValid
      ? 'ring-2 ring-yellow-400/50 bg-yellow-400/5'
      : ''
  return (
    <div ref={setNodeRef} className={`${highlight} ${disabled ? 'opacity-30' : ''} ${className ?? ''} rounded`}>
      {children}
    </div>
  )
}

export function EmptySlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-gray-600 rounded p-1.5 h-full flex items-center justify-center">
      <span className="text-gray-600 text-[10px]">{label}</span>
    </div>
  )
}
