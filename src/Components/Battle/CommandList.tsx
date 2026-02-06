import { ExplorerWeapon, WeaponInstance } from '../../Lib/Types/Weapon'
import { SpellInstance } from '../../Lib/Types/Spell'

interface CommandListProps {
  commands: (ExplorerWeapon | SpellInstance)[]  // 全てのコマンド（武器+魔法）
  availableCommands: (ExplorerWeapon | SpellInstance)[]  // 使用可能なコマンド
  selectedCommand: ExplorerWeapon | SpellInstance | null
  onSelectCommand: (command: ExplorerWeapon | SpellInstance) => void
  disabled: boolean  // プレイヤーターンでない場合はtrue
}

// コマンドが使用可能かどうかを判定
function isCommandAvailable(
  command: ExplorerWeapon | SpellInstance,
  availableCommands: (ExplorerWeapon | SpellInstance)[]
): boolean {
  return availableCommands.some(c => c.id === command.id)
}

// コマンドが選択中かどうかを判定
function isCommandSelected(
  command: ExplorerWeapon | SpellInstance,
  selectedCommand: ExplorerWeapon | SpellInstance | null
): boolean {
  return selectedCommand?.id === command.id
}

// 武器かどうかを判定
function isWeapon(command: ExplorerWeapon | SpellInstance): command is ExplorerWeapon {
  return command.commandCategory === 'weapon'
}

// 残り使用回数の表示
function getUsesDisplay(command: ExplorerWeapon | SpellInstance): string {
  if (isWeapon(command)) {
    // パンチ（maxUses === null）は無限
    if (command.maxUses === null) {
      return ''
    }
    // 武器インスタンス
    const weapon = command as WeaponInstance
    return `[${weapon.currentUses}/${weapon.maxUses}]`
  }
  // 魔法はMP消費を表示
  const spell = command as SpellInstance
  return `${spell.mpCost}MP`
}

// コマンドカテゴリに応じた色
function getCommandColor(command: ExplorerWeapon | SpellInstance, isAvailable: boolean): string {
  if (!isAvailable) {
    return 'bg-gray-600 text-gray-400'
  }

  if (isWeapon(command)) {
    return 'bg-orange-700 hover:bg-orange-600 text-white'
  }
  // 魔法
  return 'bg-purple-700 hover:bg-purple-600 text-white'
}

export function CommandList({
  commands,
  availableCommands,
  selectedCommand,
  onSelectCommand,
  disabled,
}: CommandListProps) {
  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <div className="text-xs text-gray-400 mb-2">Commands</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {commands.map((command) => {
          const isAvailable = !disabled && isCommandAvailable(command, availableCommands)
          const isSelected = isCommandSelected(command, selectedCommand)
          const colorClass = getCommandColor(command, isAvailable)
          const usesDisplay = getUsesDisplay(command)

          return (
            <button
              key={command.id}
              onClick={() => onSelectCommand(command)}
              disabled={!isAvailable}
              className={`
                p-3 rounded-lg font-bold text-sm transition-all
                ${colorClass}
                ${isSelected ? 'ring-2 ring-yellow-400' : ''}
                ${!isAvailable ? 'cursor-not-allowed opacity-50' : ''}
              `}
            >
              <div className="truncate">{command.name}</div>
              {usesDisplay && (
                <div className="text-xs mt-1 opacity-80">
                  {usesDisplay}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
