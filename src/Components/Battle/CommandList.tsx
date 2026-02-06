import { useState, useEffect, useCallback } from 'react'
import { ExplorerWeapon, WeaponInstance } from '../../Lib/Types/Weapon'
import { SpellInstance } from '../../Lib/Types/Spell'

interface CommandListProps {
  commands: (ExplorerWeapon | SpellInstance)[]
  availableCommands: (ExplorerWeapon | SpellInstance)[]
  selectedCommand: ExplorerWeapon | SpellInstance | null
  onSelectCommand: (command: ExplorerWeapon | SpellInstance) => void
  disabled: boolean
}

// コマンドが使用可能かどうかを判定
function isCommandAvailableCheck(
  command: ExplorerWeapon | SpellInstance,
  availableCommands: (ExplorerWeapon | SpellInstance)[]
): boolean {
  return availableCommands.some(c => c.id === command.id)
}

// 武器かどうかを判定
function isWeapon(command: ExplorerWeapon | SpellInstance): command is ExplorerWeapon {
  return command.commandCategory === 'weapon'
}

// 残り使用回数の表示
function getUsesDisplay(command: ExplorerWeapon | SpellInstance): string {
  if (isWeapon(command)) {
    if (command.maxUses === null) {
      return ''
    }
    const weapon = command as WeaponInstance
    return `[${weapon.currentUses}/${weapon.maxUses}]`
  }
  const spell = command as SpellInstance
  return `${spell.mpCost}MP`
}

export function CommandList({
  commands,
  availableCommands,
  selectedCommand,
  onSelectCommand,
  disabled,
}: CommandListProps) {
  // カーソル位置
  const [cursorIndex, setCursorIndex] = useState(0)

  // 使用可能なコマンドのインデックスリスト
  const availableIndices = commands
    .map((cmd, idx) => ({ cmd, idx }))
    .filter(({ cmd }) => isCommandAvailableCheck(cmd, availableCommands))
    .map(({ idx }) => idx)

  // カーソル位置が有効範囲外なら調整
  useEffect(() => {
    if (availableIndices.length > 0 && !availableIndices.includes(cursorIndex)) {
      setCursorIndex(availableIndices[0])
    }
  }, [availableIndices, cursorIndex])

  // コマンドが確定されたらカーソルをそこに合わせる
  useEffect(() => {
    if (selectedCommand) {
      const idx = commands.findIndex(c => c.id === selectedCommand.id)
      if (idx !== -1) {
        setCursorIndex(idx)
      }
    }
  }, [selectedCommand, commands])

  // キーボード操作
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled || availableIndices.length === 0) return

    const currentAvailableIdx = availableIndices.indexOf(cursorIndex)

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault()
        if (currentAvailableIdx > 0) {
          setCursorIndex(availableIndices[currentAvailableIdx - 1])
        } else {
          // 最初から最後へループ
          setCursorIndex(availableIndices[availableIndices.length - 1])
        }
        break

      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault()
        if (currentAvailableIdx < availableIndices.length - 1) {
          setCursorIndex(availableIndices[currentAvailableIdx + 1])
        } else {
          // 最後から最初へループ
          setCursorIndex(availableIndices[0])
        }
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        if (availableIndices.includes(cursorIndex)) {
          onSelectCommand(commands[cursorIndex])
        }
        break
    }
  }, [disabled, availableIndices, cursorIndex, commands, onSelectCommand])

  // キーボードイベントのリスナー登録
  useEffect(() => {
    // ターゲット選択中（selectedCommand != null）はCommandListのキー操作を無効化
    if (selectedCommand !== null) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, selectedCommand])

  return (
    <div>
      {/* コマンドリスト（縦並び） */}
      <div className="max-h-32 overflow-y-auto">
        {commands.map((command, index) => {
          const isAvailable = !disabled && isCommandAvailableCheck(command, availableCommands)
          const isCursor = index === cursorIndex
          const usesDisplay = getUsesDisplay(command)

          return (
            <div
              key={command.id}
              onClick={() => {
                if (isAvailable) {
                  setCursorIndex(index)
                  onSelectCommand(command)
                }
              }}
              className={`
                flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm
                ${isCursor ? 'bg-yellow-600 text-white' : 'text-gray-300'}
                ${!isAvailable ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-700'}
              `}
            >
              {/* カーソルインジケーター */}
              <span className={`w-4 ${isCursor ? 'text-white' : 'text-transparent'}`}>
                ▶
              </span>

              {/* コマンドカテゴリアイコン */}
              <span className={`
                w-4 h-4 rounded text-xs flex items-center justify-center
                ${isWeapon(command) ? 'bg-orange-600' : 'bg-purple-600'}
              `}>
                {isWeapon(command) ? '剣' : '魔'}
              </span>

              {/* コマンド名 */}
              <span className="flex-1">{command.name}</span>

              {/* 使用回数/MP */}
              {usesDisplay && (
                <span className="text-xs opacity-70">{usesDisplay}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 操作説明 */}
      <div className="text-xs text-gray-500 mt-1">
        ↑↓: 選択　Enter: 決定
      </div>
    </div>
  )
}
