import { setDevOverrides } from './TuningStore'
import { TuningChannelMessage } from './TuningConfig'
import { validateChannelState } from './TuningSerializer'

/**
 * ゲームタブ側でBroadcastChannelを受信し、_devOverridesに反映する
 * ゲーム初期化時に1回呼び出す（DEV時のみ動作）
 */
export function initTuningReceiver(): void {
  if (!import.meta.env.DEV) return

  const channel = new BroadcastChannel('game-tuning')

  // エディタが既に開いている場合に同期をリクエスト
  channel.postMessage({ type: 'request-sync' } satisfies TuningChannelMessage)

  channel.onmessage = (e: MessageEvent<TuningChannelMessage>) => {
    const msg = e.data
    if (msg.type === 'full-sync' || msg.type === 'batch-update') {
      setDevOverrides(validateChannelState(msg.state))
    }
  }
}
