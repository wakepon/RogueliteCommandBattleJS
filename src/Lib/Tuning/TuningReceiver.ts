import { setDevOverrides } from './TuningStore'
import { TuningChannelMessage, TUNING_SCHEMA_VERSION } from './TuningConfig'
import { validateChannelState } from './TuningSerializer'

/**
 * ゲームタブ側でBroadcastChannelを受信し、_devOverridesに反映する
 * ゲーム初期化時に1回呼び出す（DEV時のみ動作）
 * @returns cleanup関数（useEffectで使用）
 */
export function initTuningReceiver(): (() => void) | undefined {
  if (!import.meta.env.DEV) return undefined

  const channel = new BroadcastChannel('game-tuning')

  // エディタが既に開いている場合に同期をリクエスト
  channel.postMessage({ type: 'request-sync' } satisfies TuningChannelMessage)

  channel.onmessage = (e: MessageEvent<TuningChannelMessage>) => {
    const msg = e.data
    if (msg.type === 'full-sync' || msg.type === 'batch-update') {
      // バージョン不一致は無視
      if (msg.version !== TUNING_SCHEMA_VERSION) return
      setDevOverrides(validateChannelState(msg.state))
    }
  }

  return () => channel.close()
}
