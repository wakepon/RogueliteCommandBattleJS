import { Buff, Debuff } from '../Types/Explorer'
import { getTuningValue } from '../Tuning/TuningStore'

/**
 * 力溜めバフのタイプ名
 */
const CHARGE_BUFF_TYPE = 'charge'

/**
 * 毒ダメージを計算し、スタックを1減少させる
 * @param debuffs - 現在のデバフ配列
 * @returns { damage: number, updatedDebuffs: Debuff[] }
 * - damage: 固定2ダメージ（毒がある場合）
 * - updatedDebuffs: スタックを-1した配列（0になったら削除）
 */
export function processPoisonDamage(debuffs: Debuff[]): {
  damage: number
  updatedDebuffs: Debuff[]
} {
  const poisonDebuff = debuffs.find(d => d.type === 'poison')

  if (!poisonDebuff) {
    return {
      damage: 0,
      updatedDebuffs: debuffs
    }
  }

  const damage = getTuningValue('poison_damage_per_tick', 2)
  const newStacks = poisonDebuff.stacks - 1

  // スタックが0以下になったら削除
  if (newStacks <= 0) {
    return {
      damage,
      updatedDebuffs: debuffs.filter(d => d.type !== 'poison')
    }
  }

  // スタックを減らした新しいデバフ配列を作成
  const updatedDebuffs = debuffs.map(d =>
    d.type === 'poison'
      ? { ...d, stacks: newStacks }
      : d
  )

  return {
    damage,
    updatedDebuffs
  }
}

/**
 * 力溜めバフの倍率を取得
 * @param buffs - 現在のバフ配列
 * @returns 力溜めがあれば2.0、なければ1.0
 */
export function getChargeMultiplier(buffs: Buff[]): number {
  const hasCharge = buffs.some(
    b => b.type === CHARGE_BUFF_TYPE && b.duration === 'nextAction'
  )
  return hasCharge ? getTuningValue('charge_multiplier', 2.0) : 1.0
}

/**
 * 攻撃後にnextActionバフ（精密など）を消費する
 * @param buffs - 現在のバフ配列
 * @returns nextActionバフを除いたバフ配列
 */
export function consumeNextActionBuffs(buffs: Buff[]): Buff[] {
  return buffs.filter(b => b.duration !== 'nextAction')
}

/**
 * weaknessデバフの持続ターンを減少させ、0以下で削除する
 * @param debuffs - 現在のデバフ配列
 * @returns 更新後のデバフ配列
 */
export function decrementWeaknessDuration(debuffs: Debuff[]): Debuff[] {
  return debuffs
    .map(d => {
      if (d.type === 'weakness') {
        return { ...d, duration: d.duration - 1 }
      }
      return d
    })
    .filter(d => {
      if (d.type === 'weakness' && d.duration <= 0) {
        return false
      }
      return true
    })
}

/**
 * シールドバフによるダメージ軽減処理
 * シールドの value 分だけダメージを吸収し、使用後はシールドを削除する
 * @param buffs - 現在のバフ配列
 * @param incomingDamage - 受けるダメージ量
 * @returns { reducedDamage, updatedBuffs }
 */
export function processShieldDamageReduction(
  buffs: Buff[],
  incomingDamage: number
): { reducedDamage: number; updatedBuffs: Buff[] } {
  const shieldBuff = buffs.find(b => b.type === 'shield')

  if (!shieldBuff || incomingDamage <= 0) {
    return { reducedDamage: incomingDamage, updatedBuffs: buffs }
  }

  const absorbed = Math.min(shieldBuff.value, incomingDamage)
  const reducedDamage = Math.max(0, incomingDamage - absorbed)

  // シールドを消費（1回使い切り）
  const updatedBuffs = buffs.filter(b => b.type !== 'shield')

  return { reducedDamage, updatedBuffs }
}

/**
 * ターン終了時のバフ持続ターン減少処理
 * - duration が number の場合は -1
 * - 0以下になったら削除
 * - 'battle' は戦闘終了まで維持
 * - 'nextAction' はこの関数では処理しない（攻撃後に別途処理）
 * @param buffs - 現在のバフ配列
 * @returns 更新後のバフ配列
 */
export function decrementBuffDurations(buffs: Buff[]): Buff[] {
  return buffs
    .map(buff => {
      // 'battle' と 'nextAction' はそのまま維持
      if (typeof buff.duration !== 'number') {
        return buff
      }

      // duration が number の場合は -1
      return {
        ...buff,
        duration: buff.duration - 1
      }
    })
    .filter(buff => {
      // 0以下になったものを削除
      if (typeof buff.duration === 'number' && buff.duration <= 0) {
        return false
      }
      return true
    })
}
