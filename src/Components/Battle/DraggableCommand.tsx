import { useDraggable } from '@dnd-kit/core'
import { BattleCommand } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RelicInstance } from '../../Lib/Types/Relic'
import { isWeapon, isSpell, isPotion } from '../../Lib/Core/CommandValidator'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'
import { Tooltip, TooltipCard } from '../Common'

interface DraggableCommandProps {
  command: BattleCommand
  explorerId: string
  commandIndex?: number  // 同ID武器区別用: weapons/spells配列内のインデックス
  disabled?: boolean
  isAvailable: boolean
  explorer?: ExplorerState
  relics?: RelicInstance[]
  party?: ExplorerState[]
}

/** コマンドカテゴリに応じたアイコン */
function getCommandStyle(command: BattleCommand): { bgColor: string; label: string } {
  if (isWeapon(command)) {
    if (command.targetType === 'allySingle' || command.targetType === 'allyAll') return { bgColor: 'bg-green-600', label: '護' }
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
export function DraggableCommand({ command, explorerId, commandIndex, disabled, isAvailable, explorer, relics = [], party }: DraggableCommandProps) {
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

  // ダメージ予測（バフ/レリック/条件付き効果を含む）
  let damageText = ''
  let isBoosted = false
  let isWeakened = false
  const isEnemyTarget = command.targetType === 'enemySingle' || command.targetType === 'enemyAll'
  if (isEnemyTarget && command.power > 0 && explorer) {
    const idx = party ? party.findIndex(e => e.id === explorer.id) : -1
    const explorerIndex = idx >= 0 ? idx : undefined
    const opts = { relics, includeConditionalRelics: true, party, explorerIndex }
    if (isWeapon(command)) {
      const range = predictWeaponDamage(explorer, command, opts)
      damageText = formatDamageRange(range)
      isBoosted = range.isBoosted
      isWeakened = range.isWeakened ?? false
    } else if (isSpell(command)) {
      const range = predictSpellDamage(explorer, command, opts)
      damageText = formatDamageRange(range)
      isBoosted = range.isBoosted
      isWeakened = range.isWeakened ?? false
    }
  }

  // 耐久値テキスト（武器のみ。無限使用武器は∞表示）
  const durabilityText = isWeapon(command)
    ? (command.currentUses !== null ? `${command.currentUses}/${command.maxUses}` : '∞')
    : undefined

  const tooltipContent = (
    <TooltipCard item={command} damageText={damageText || undefined} durabilityText={durabilityText} />
  )

  const damageColor = isWeakened ? 'text-blue-400' : isBoosted ? 'text-yellow-400' : 'text-gray-400'

  return (
    <Tooltip content={tooltipContent} position="bottom" disabled={isDragging}>
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded text-base border
        ${isDragging
          ? 'opacity-50 ring-2 ring-yellow-400 border-yellow-400'
          : !isAvailable || disabled
            ? 'border-gray-700 bg-gray-800/30 text-gray-500 cursor-not-allowed opacity-50'
            : 'border-gray-500 bg-gray-700/40 text-white cursor-grab hover:bg-gray-700 hover:border-gray-400 active:cursor-grabbing'
        }
        transition-colors select-none
      `}
    >
      <span className={`w-6 h-6 rounded text-sm flex items-center justify-center flex-shrink-0 ${style.bgColor}`}>
        {style.label}
      </span>
      <span className="flex-1 truncate">{command.name}</span>
      {command.targetType === 'enemyAll' && (
        <span className="text-xs bg-red-700 text-white px-1 rounded">全</span>
      )}
      {damageText && (
        <span className={`text-base ${damageColor} flex-shrink-0`}>{damageText}</span>
      )}
      {usesText && (
        <span className="text-base text-gray-400 flex-shrink-0">{usesText}</span>
      )}
    </div>
    </Tooltip>
  )
}
