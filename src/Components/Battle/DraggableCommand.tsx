import { useDraggable } from '@dnd-kit/core'
import { BattleCommand } from '../../Lib/Types/Battle'
import { isWeapon, isSpell, isPotion } from '../../Lib/Core/CommandValidator'
import { Tooltip, TooltipCard } from '../Common'

interface DraggableCommandProps {
  command: BattleCommand
  explorerId: string
  commandIndex?: number  // 同ID武器区別用: weapons/spells配列内のインデックス
  disabled?: boolean
  isAvailable: boolean
  attackerStr?: number  // ダメージ予測用: キャラのSTR
  attackerInt?: number  // ダメージ予測用: キャラのINT
}

/** コマンドカテゴリに応じたアイコン */
function getCommandStyle(command: BattleCommand): { bgColor: string; label: string } {
  if (isWeapon(command)) {
    // 祈り/守護の盾（味方対象武器）
    if (command.targetType === 'allySingle') return { bgColor: 'bg-green-600', label: '祈' }
    return { bgColor: 'bg-orange-600', label: '剣' }
  }
  if (isSpell(command)) {
    if (command.targetType === 'allySingle') return { bgColor: 'bg-green-600', label: '回' }
    if (command.targetType === 'allyAll') return { bgColor: 'bg-green-600', label: '癒' }
    return { bgColor: 'bg-purple-600', label: '魔' }
  }
  if (isPotion(command)) return { bgColor: 'bg-teal-600', label: '薬' }
  return { bgColor: 'bg-gray-600', label: '?' }
}

/**
 * ドラッグ可能なコマンドアイテム
 * 武器/魔法を敵や味方にドラッグ&ドロップしてコマンドをセット
 */
export function DraggableCommand({ command, explorerId, commandIndex, disabled, isAvailable, attackerStr = 0, attackerInt = 0 }: DraggableCommandProps) {
  const uniqueId = commandIndex !== undefined ? `cmd-${explorerId}-${command.id}-${commandIndex}` : `cmd-${explorerId}-${command.id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: uniqueId,
    data: { command, explorerId, weaponIndex: commandIndex },
    disabled: disabled || !isAvailable,
  })

  const style = getCommandStyle(command)
  const usesText = isWeapon(command) && command.currentUses !== null
    ? `${command.currentUses}/${command.maxUses}`
    : isSpell(command)
      ? `${command.mpCost}MP`
      : ''

  // 素のダメージ予測（バフ/レリックなし、ブレ幅込み）
  let damageText = ''
  const isEnemyTarget = command.targetType === 'enemySingle' || command.targetType === 'enemyAll'
  if (isEnemyTarget && command.power > 0) {
    let stat = attackerStr
    if (isWeapon(command) && 'scaleStat' in command && command.scaleStat === 'int') {
      stat = attackerInt
    } else if (isSpell(command)) {
      stat = attackerInt
    }
    const base = stat * command.power
    const min = Math.max(0, base - command.variance)
    const max = Math.max(0, base + command.variance)
    damageText = min === max ? `${min}` : `${min}-${max}`
  }

  // 耐久値テキスト（武器のみ。無限使用武器は∞表示）
  const durabilityText = isWeapon(command)
    ? (command.currentUses !== null ? `${command.currentUses}/${command.maxUses}` : '∞')
    : undefined

  const tooltipContent = (
    <TooltipCard item={command} damageText={damageText || undefined} durabilityText={durabilityText} />
  )

  return (
    <Tooltip content={tooltipContent} position="bottom" disabled={isDragging}>
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded text-xs
        ${isDragging ? 'opacity-50 ring-2 ring-yellow-400' : ''}
        ${!isAvailable || disabled
          ? 'text-gray-500 cursor-not-allowed opacity-50'
          : 'text-white cursor-grab hover:bg-gray-700 active:cursor-grabbing'
        }
        transition-colors select-none
      `}
    >
      <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center flex-shrink-0 ${style.bgColor}`}>
        {style.label}
      </span>
      <span className="flex-1 truncate">{command.name}</span>
      {command.targetType === 'enemyAll' && (
        <span className="text-[9px] bg-red-700 text-white px-0.5 rounded">全</span>
      )}
      {damageText && (
        <span className="text-[10px] text-gray-400 flex-shrink-0">{damageText}</span>
      )}
      {usesText && (
        <span className="text-[10px] text-gray-400 flex-shrink-0">{usesText}</span>
      )}
    </div>
    </Tooltip>
  )
}
