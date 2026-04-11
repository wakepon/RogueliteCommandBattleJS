import tuningData from '../Data/TuningData.json'
import { TuningConfig } from './TuningConfig'

/** DEV時のエディタからのオーバーライド値（凍結して保持） */
let _devOverrides: Readonly<Record<string, unknown>> = Object.freeze({})

/**
 * DEVオーバーライドを設定する（TuningReceiverから呼ばれる）
 */
export function setDevOverrides(overrides: Record<string, unknown>): void {
  _devOverrides = Object.freeze({ ...overrides })
}

/**
 * チューニング値を取得する
 *
 * - 本番ビルド: TuningData.jsonの値を返す
 * - DEV: エディタからのオーバーライドを優先し、なければTuningData.jsonの値を返す
 *
 * @param key - パラメータキー
 * @param defaultValue - JSONにもオーバーライドにも値がない場合のフォールバック
 */
export function getTuningValue<K extends keyof TuningConfig>(
  key: K,
  defaultValue: TuningConfig[K],
): TuningConfig[K] {
  // DEV時はエディタからのオーバーライドを優先
  if (import.meta.env.DEV) {
    const k = key as string
    if (k in _devOverrides) {
      return _devOverrides[k] as TuningConfig[K]
    }
  }

  // TuningData.jsonの値を返す
  const k = key as string
  if (k in tuningData) {
    return (tuningData as Record<string, unknown>)[k] as TuningConfig[K]
  }

  return defaultValue
}
