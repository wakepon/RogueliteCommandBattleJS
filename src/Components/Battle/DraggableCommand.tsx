import { useDraggable } from '@dnd-kit/core'
import { BattleCommand, CommandSlot } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RelicInstance } from '../../Lib/Types/Relic'
import { isWeapon, isSpell, isPotion } from '../../Lib/Core/CommandValidator'
import { getDisplayMpCost } from '../../Lib/Core/MpCostCalculator'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange, getCommandBuffEntries } from '../../Lib/Utils/DamagePredictor'
import { KillCategory } from '../../Lib/Utils/KillPotential'
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
  /** 行動欄で先に詠唱予定の武器強化による武器Power加算（武器コマンドの予測に反映） */
  extraWeaponPowerBonus?: number
  /** 行動欄で先に詠唱予定の武器強化魔法の内訳（バフポップアップで呪文名つき表示） */
  pendingWeaponBuffs?: { name: string; value: number }[]
  /** 連携の紋章: このキャラが攻撃をセットしたと仮定した場合のSTR/INTボーナス（予測に反映） */
  comboBonus?: number
  /** 行動順スロット（追撃のナイフ等の先行味方攻撃数の算出用） */
  commandSlots?: CommandSlot[]
  /** このキャラの行動順スロットインデックス（追撃系の算出用） */
  commandSlotIndex?: number
  /** 撃破確定カテゴリ（左端アクセントバーの着色。solo=赤 / combo=黄） */
  killCategory?: KillCategory
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
export function DraggableCommand({ command, explorerId, commandIndex, disabled, isAvailable, explorer, relics = [], party, extraWeaponPowerBonus = 0, pendingWeaponBuffs = [], comboBonus = 0, commandSlots, commandSlotIndex, killCategory }: DraggableCommandProps) {
  const uniqueId = commandIndex !== undefined ? `cmd-${explorerId}-${command.id}-${commandIndex}` : `cmd-${explorerId}-${command.id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: uniqueId,
    // weaponIndex はコマンドスロット設定用（武器のみ）。commandIndex は weapons/spells 各配列内の生インデックス（デバッグ破棄用）
    data: { command, explorerId, weaponIndex: isWeapon(command) ? commandIndex : undefined, commandIndex },
    disabled: disabled || !isAvailable,
  })

  const style = getCommandStyle(command)
  const usesText = isWeapon(command) && command.currentUses !== null
    ? `${command.currentUses}/${command.maxUses}`
    : isSpell(command)
      ? `${getDisplayMpCost(command.mpCost)}MP`
      : ''

  // ダメージ予測（バフ/レリック/条件付き効果を含む）
  let damageText = ''
  let isBoosted = false
  let isWeakened = false
  let buffEntries: ReturnType<typeof getCommandBuffEntries> = []
  const isEnemyTarget = command.targetType === 'enemySingle' || command.targetType === 'enemyAll'
  if (isEnemyTarget && command.power > 0 && explorer) {
    const idx = party ? party.findIndex(e => e.id === explorer.id) : -1
    const explorerIndex = idx >= 0 ? idx : undefined
    const opts = { relics, includeConditionalRelics: true, party, explorerIndex, extraWeaponPowerBonus, comboBonus: comboBonus > 0 ? comboBonus : undefined, commandSlots, currentCommandIndex: commandSlotIndex }
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
    // 現在このコマンドのダメージに乗っているバフの一覧（2つ目のポップアップ用）
    buffEntries = getCommandBuffEntries(explorer, command, { relics, party, explorerIndex, pendingWeaponBuffs, comboBonus, commandSlots, currentCommandIndex: commandSlotIndex })
  }

  // 耐久値テキスト（武器のみ。無限使用武器は∞表示）
  const durabilityText = isWeapon(command)
    ? (command.currentUses !== null ? `${command.currentUses}/${command.maxUses}` : '∞')
    : undefined

  const tooltipContent = (
    <TooltipCard item={command} damageText={damageText || undefined} durabilityText={durabilityText} explorer={explorer} />
  )

  // 2つ目のポップアップ: 現在乗っているバフを列挙
  const buffContent = buffEntries.length > 0 ? (
    <div className="min-w-[110px] max-w-[220px]">
      <div className="text-[9px] text-gray-400 mb-1">発動中バフ</div>
      {buffEntries.map((entry, i) => (
        <div key={i} className="flex justify-between gap-3 text-[10px]">
          <span className="text-gray-200">{entry.label}</span>
          <span className="text-green-300">{entry.detail}</span>
        </div>
      ))}
    </div>
  ) : undefined

  const damageColor = isWeakened ? 'text-blue-400' : isBoosted ? 'text-yellow-400' : 'text-gray-400'

  // 撃破確定カテゴリの右端アクセントバー（利用可能・非ドラッグ・非無効時のみ）
  // solo=確定単騎キル=赤 / combo=他キャラと組めば確定キル=黄
  // border ではなく独立要素で描くことで、ホバー時の hover:border-gray-400 に色を奪われない
  // （コスト/MP表示の隣に置き、コストとバーの視線移動を最小化する）
  const killAccentColor = (!isDragging && isAvailable && !disabled)
    ? killCategory === 'solo'
      ? 'bg-red-500'
      : killCategory === 'combo'
        ? 'bg-yellow-400'
        : ''
    : ''

  return (
    <Tooltip content={tooltipContent} secondaryContent={buffContent} position="bottom" disabled={isDragging}>
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        relative flex items-center gap-1.5 px-2 py-1 rounded text-base border
        ${isDragging
          ? 'opacity-50 ring-2 ring-yellow-400 border-yellow-400'
          : !isAvailable || disabled
            ? 'border-gray-700 bg-gray-800/30 text-gray-500 cursor-not-allowed opacity-50'
            : 'border-gray-500 bg-gray-700/40 text-white cursor-grab hover:bg-gray-700 hover:border-gray-400 active:cursor-grabbing'
        }
        transition-colors select-none
      `}
    >
      {killAccentColor && (
        <span className={`absolute right-0 top-0 bottom-0 w-1 rounded-r pointer-events-none ${killAccentColor}`} />
      )}
      <span className={`w-6 h-6 rounded text-sm flex items-center justify-center flex-shrink-0 ${style.bgColor}`}>
        {style.label}
      </span>
      <span className="flex-1 truncate">{command.name}</span>
      {command.targetType === 'enemyAll' && (
        <span className="text-xs bg-red-700 text-white px-1 rounded">全</span>
      )}
      {command.targetType === 'allyAll' && (
        <span className="text-xs bg-green-700 text-white px-1 rounded">全</span>
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
