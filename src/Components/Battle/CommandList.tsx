import { useState, useEffect, useCallback } from 'react'
import { PotionInstance } from '../../Lib/Types/Potion'
import { BattleCommand } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { RelicInstance } from '../../Lib/Types/Relic'
import { WeaponInstance } from '../../Lib/Types/Weapon'
import { isWeapon, isSpell, isPotion } from '../../Lib/Core/CommandValidator'
import { getCommandTooltip, DamageContext } from '../../Lib/Utils/ItemDescription'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'
import { getWeaponEnhancementSummary, getSpellEnhancementSummary } from '../../Lib/Core/EnhancementLogic'

interface CommandListProps {
  commands: BattleCommand[]
  availableCommands: BattleCommand[]
  selectedCommand: BattleCommand | null
  onSelectCommand: (command: BattleCommand) => void
  disabled: boolean
  potions?: PotionInstance[]
  explorer?: ExplorerState
  relics?: RelicInstance[]
  killStreakActive?: boolean
  party?: ExplorerState[]
}

// コマンドが使用可能かどうかを判定
function isCommandAvailableCheck(
  command: BattleCommand,
  availableCommands: BattleCommand[]
): boolean {
  return availableCommands.some(c => c.id === command.id)
}

// 残り使用回数の表示
function getUsesDisplay(command: BattleCommand, potions?: PotionInstance[]): string {
  if (isWeapon(command)) {
    if (command.maxUses === null) {
      return ''
    }
    return `[${command.currentUses}/${command.maxUses}]`
  }
  if (isSpell(command)) {
    return `${command.mpCost}MP`
  }
  if (isPotion(command) && potions) {
    const count = potions.filter(p => p.id === command.id).length
    return `×${count}`
  }
  return ''
}

// コマンドカテゴリに応じたアイコンの背景色とラベル
function getCommandIcon(command: BattleCommand): { bgColor: string; label: string } {
  switch (command.commandCategory) {
    case 'weapon':
      return { bgColor: 'bg-orange-600', label: '剣' }
    case 'spell':
      return { bgColor: 'bg-purple-600', label: '魔' }
    case 'potion':
      return { bgColor: 'bg-lime-600', label: '薬' }
  }
}

export function CommandList({
  commands,
  availableCommands,
  selectedCommand,
  onSelectCommand,
  disabled,
  potions,
  explorer,
  relics = [],
  killStreakActive = false,
  party,
}: CommandListProps) {
  const damageContext: DamageContext | undefined = explorer
    ? { explorer, relics, killStreakActive, includeConditionalRelics: true, party }
    : undefined
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
          const usesDisplay = getUsesDisplay(command, potions)
          const icon = getCommandIcon(command)

          // ダメージ予測値の計算
          let damageDisplay: string | null = null
          let isBoosted = false
          let isWeakened = false
          if (explorer) {
            const opts = { relics, killStreakActive, includeConditionalRelics: true, party }
            if (isWeapon(command)) {
              const range = predictWeaponDamage(explorer, command, opts)
              damageDisplay = formatDamageRange(range)
              isBoosted = range.isBoosted
              isWeakened = range.isWeakened ?? false
            } else if (isSpell(command) && command.power > 0) {
              const range = predictSpellDamage(explorer, command, opts)
              damageDisplay = formatDamageRange(range)
              isBoosted = range.isBoosted
              isWeakened = range.isWeakened ?? false
            }
          }

          let enhancementTitle = ''
          if (isWeapon(command) && 'enhancements' in command && (command as WeaponInstance).enhancements.length > 0) {
            const summaries = getWeaponEnhancementSummary((command as WeaponInstance).enhancements)
            if (summaries.length > 0) enhancementTitle = '\n強化: ' + summaries.map(s => s.text).join(', ')
          }
          if (isSpell(command) && command.enhancements.length > 0) {
            const summaries = getSpellEnhancementSummary(command.enhancements)
            if (summaries.length > 0) enhancementTitle = '\n強化: ' + summaries.map(s => s.text).join(', ')
          }

          return (
            <div
              key={command.id}
              onClick={() => {
                if (isAvailable) {
                  setCursorIndex(index)
                  onSelectCommand(command)
                }
              }}
              title={getCommandTooltip(command, damageContext) + enhancementTitle}
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
                ${icon.bgColor}
              `}>
                {icon.label}
              </span>

              {/* コマンド名 */}
              <span className="flex-1">
                {command.name}
                {command.targetType === 'enemyAll' && (
                  <span className="text-[10px] bg-red-700 text-white px-1 rounded ml-1">全体</span>
                )}
                {isWeapon(command) && 'enhancements' in command && (command as WeaponInstance).enhancements.length > 0 && (
                  <span className="text-[9px] bg-yellow-700/80 text-yellow-200 px-0.5 rounded ml-1">
                    強化({(command as WeaponInstance).enhancements.length})
                  </span>
                )}
                {isSpell(command) && command.enhancements.length > 0 && (
                  <span className="text-[9px] bg-yellow-700/80 text-yellow-200 px-0.5 rounded ml-1">
                    強化({command.enhancements.length})
                  </span>
                )}
              </span>

              {/* ダメージ予測値 */}
              {damageDisplay && (
                <span className={`text-xs ${isWeakened ? 'text-red-400' : isBoosted ? 'text-orange-400' : 'text-gray-400'}`}>
                  {damageDisplay}
                </span>
              )}

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
