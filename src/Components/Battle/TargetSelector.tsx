import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { EnemyInstance } from '../../Lib/Types/Enemy'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { TargetType } from '../../Lib/Types/Command'

interface TargetSelectorProps {
  enemies: EnemyInstance[]
  selectedTargetId: string | null
  targetType: TargetType
  columns?: number
  party?: ExplorerState[]
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
  party,
  onSelectTarget,
  onConfirm,
  onCancel,
}: TargetSelectorProps) {
  // allySingle の場合は味方をターゲット候補にする
  const isAllyTarget = targetType === 'allySingle'

  // 選択可能な敵のリスト（メモ化）
  const selectableEnemies = useMemo(
    () => enemies.filter(isEnemySelectable),
    [enemies]
  )

  // ターゲットタイプに応じた選択候補リスト（味方 or 敵）
  const selectableTargets = useMemo(() => {
    if (isAllyTarget && party) {
      return party.filter(m => m.hp > 0).map(m => ({ id: m.id }))
    }
    return selectableEnemies.map(e => ({ id: e.instanceId }))
  }, [isAllyTarget, party, selectableEnemies])

  // カーソル位置（選択可能なターゲットのインデックス）
  const [cursorIndex, setCursorIndex] = useState(0)

  // 初期化フラグ
  const isInitialized = useRef(false)

  // マウント時に最初のターゲットを選択
  useEffect(() => {
    if (!isInitialized.current && selectableTargets.length > 0) {
      if (targetType !== 'enemyAll') {
        onSelectTarget(selectableTargets[0].id)
      }
      isInitialized.current = true
    }
  }, [selectableTargets, targetType, onSelectTarget])

  // カーソル位置のRef（循環依存を防ぐため）
  const prevCursorIndex = useRef(cursorIndex)

  // selectedTargetIdが変更されたらカーソル位置を同期
  useEffect(() => {
    if (selectedTargetId) {
      const idx = selectableTargets.findIndex(t => t.id === selectedTargetId)
      if (idx !== -1 && idx !== prevCursorIndex.current) {
        setCursorIndex(idx)
        prevCursorIndex.current = idx
      }
    }
  }, [selectedTargetId, selectableTargets])

  // カーソル移動時にターゲットを選択
  useEffect(() => {
    if (isInitialized.current && prevCursorIndex.current !== cursorIndex) {
      if (targetType !== 'enemyAll' && selectableTargets[cursorIndex]) {
        onSelectTarget(selectableTargets[cursorIndex].id)
      }
      prevCursorIndex.current = cursorIndex
    }
  }, [cursorIndex, selectableTargets, targetType, onSelectTarget])

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
        if (targetType !== 'enemyAll' && selectableTargets.length > 0) {
          setCursorIndex(prev =>
            prev > 0 ? prev - 1 : selectableTargets.length - 1
          )
        }
        break

      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault()
        if (targetType !== 'enemyAll' && selectableTargets.length > 0) {
          setCursorIndex(prev =>
            prev < selectableTargets.length - 1 ? prev + 1 : 0
          )
        }
        break

      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault()
        // グリッドを想定して上に移動
        if (targetType !== 'enemyAll' && selectableTargets.length > columns) {
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
        if (targetType !== 'enemyAll' && selectableTargets.length > columns) {
          setCursorIndex(prev => {
            const newIdx = prev + columns
            return newIdx < selectableTargets.length ? newIdx : prev
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
  }, [targetType, selectableTargets, columns, onCancel, handleConfirm])

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
