import { useState, useCallback } from 'react'

/**
 * 画面フラッシュ演出の状態を管理するフック。
 * triggerFlash() を呼ぶたびに flashKey が増加し、ScreenFlashOverlay が再生される。
 */
export function useScreenFlash() {
  const [flashKey, setFlashKey] = useState(0)
  const triggerFlash = useCallback(() => setFlashKey(k => k + 1), [])
  return { flashKey, triggerFlash }
}
