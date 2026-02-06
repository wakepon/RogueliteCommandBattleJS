import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { EnemyInstance } from '../../Lib/Types/Enemy'
import { TargetType } from '../../Lib/Types/Command'

interface TargetSelectorProps {
  enemies: EnemyInstance[]
  selectedTargetId: string | null
  targetType: TargetType
  columns?: number
  onSelectTarget: (targetId: string) => void
  onConfirm: () => void
  onCancel: () => void
}

// 敵が選択可能かどうか
function isEnemySelectable(enemy: EnemyInstance): boolean {
  return enemy.currentHp > 0
}

export function TargetSelector({
  enemies,
  selectedTargetId,
  targetType,
  columns = 2,
  onSelectTarget,
  onConfirm,
  onCancel,
}: TargetSelectorProps) {
  // 選択可能な敵のリスト（メモ化）
  const selectableEnemies = useMemo(
    () => enemies.filter(isEnemySelectable),
    [enemies]
  )

  // カーソル位置（選択可能な敵のインデックス）
  const [cursorIndex, setCursorIndex] = useState(0)

  // 初期化フラグ
  const isInitialized = useRef(false)

  // マウント時に最初の敵を選択
  useEffect(() => {
    if (!isInitialized.current && selectableEnemies.length > 0) {
      if (targetType !== 'enemyAll') {
        onSelectTarget(selectableEnemies[0].instanceId)
      }
      isInitialized.current = true
    }
  }, [selectableEnemies, targetType, onSelectTarget])

  // カーソル位置のRef（循環依存を防ぐため）
  const prevCursorIndex = useRef(cursorIndex)

  // selectedTargetIdが変更されたらカーソル位置を同期
  // 注意: cursorIndexを依存配列から除外し、refで現在値を参照する
  useEffect(() => {
    if (selectedTargetId) {
      const idx = selectableEnemies.findIndex(e => e.instanceId === selectedTargetId)
      if (idx !== -1 && idx !== prevCursorIndex.current) {
        setCursorIndex(idx)
        prevCursorIndex.current = idx
      }
    }
  }, [selectedTargetId, selectableEnemies])

  // カーソル移動時にターゲットを選択
  useEffect(() => {
    // 初期化後のカーソル移動のみ処理
    if (isInitialized.current && prevCursorIndex.current !== cursorIndex) {
      if (targetType !== 'enemyAll' && selectableEnemies[cursorIndex]) {
        onSelectTarget(selectableEnemies[cursorIndex].instanceId)
      }
      prevCursorIndex.current = cursorIndex
    }
  }, [cursorIndex, selectableEnemies, targetType, onSelectTarget])

  // 確定処理
  const handleConfirm = useCallback(() => {
    if (targetType === 'enemyAll') {
      // 全体攻撃の場合、最初の生存敵のIDを渡す
      if (selectableEnemies.length > 0) {
        onSelectTarget(selectableEnemies[0].instanceId)
      }
    }
    onConfirm()
  }, [targetType, selectableEnemies, onSelectTarget, onConfirm])

  // キーボード操作
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault()
        if (targetType !== 'enemyAll' && selectableEnemies.length > 0) {
          setCursorIndex(prev =>
            prev > 0 ? prev - 1 : selectableEnemies.length - 1
          )
        }
        break

      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault()
        if (targetType !== 'enemyAll' && selectableEnemies.length > 0) {
          setCursorIndex(prev =>
            prev < selectableEnemies.length - 1 ? prev + 1 : 0
          )
        }
        break

      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault()
        // グリッドを想定して上に移動
        if (targetType !== 'enemyAll' && selectableEnemies.length > columns) {
          setCursorIndex(prev => {
            const newIdx = prev - columns
            return newIdx >= 0 ? newIdx : prev
          })
        }
        break

      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault()
        // グリッドを想定して下に移動
        if (targetType !== 'enemyAll' && selectableEnemies.length > columns) {
          setCursorIndex(prev => {
            const newIdx = prev + columns
            return newIdx < selectableEnemies.length ? newIdx : prev
          })
        }
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        handleConfirm()
        break

      case 'Escape':
      case 'Backspace':
        e.preventDefault()
        onCancel()
        break
    }
  }, [targetType, selectableEnemies, columns, onCancel, handleConfirm])

  // キーボードイベントのリスナー登録
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // このコンポーネントはUIを持たない（ロジックのみ）
  return null
}

// ターゲット選択状態を判定するヘルパー関数をエクスポート
export function getTargetSelectionState(
  enemy: EnemyInstance,
  selectedTargetId: string | null,
  targetType: TargetType
): { isSelected: boolean; isHighlighted: boolean } {
  const isSelectable = isEnemySelectable(enemy)

  if (!isSelectable) {
    return { isSelected: false, isHighlighted: false }
  }

  if (targetType === 'enemyAll') {
    return { isSelected: false, isHighlighted: true }
  }

  const isSelected = enemy.instanceId === selectedTargetId
  return { isSelected, isHighlighted: false }
}
