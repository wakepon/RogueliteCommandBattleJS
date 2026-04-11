import { TUNING_SCHEMA, TuningFieldMeta } from './TuningSchema'

/**
 * スキーマに基づいてデータをバリデーション・クランプする
 * 不明キーは除去し、型が合わない場合はデフォルト値にフォールバック
 */
export function validateTuningData(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const field of TUNING_SCHEMA) {
    const value = raw[field.key]
    result[field.key] = validateField(field, value)
  }

  return result
}

/** BroadcastChannel受信データのバリデーション */
export function validateChannelState(raw: Record<string, unknown>): Record<string, unknown> {
  return validateTuningData(raw)
}

function validateField(field: TuningFieldMeta, value: unknown): unknown {
  const { control, defaultValue } = field

  switch (control.type) {
    case 'number':
    case 'slider': {
      if (typeof value !== 'number' || !isFinite(value)) {
        return defaultValue
      }
      // 範囲クランプ
      return Math.min(Math.max(value, control.min), control.max)
    }
    case 'toggle': {
      if (typeof value !== 'boolean') {
        return defaultValue
      }
      return value
    }
    default:
      return defaultValue
  }
}
