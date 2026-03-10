import { Buff, Debuff } from '../Types/Explorer'

/**
 * 毒の1ティックあたりの固定ダメージ
 */
const POISON_DAMAGE_PER_TICK = 2

/**
 * 力溜めバフのタイプ名
 */
const CHARGE_BUFF_TYPE = 'charge'

/**
 * 力溜めバフの倍率
 */
const CHARGE_MULTIPLIER = 2.0

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

  const damage = POISON_DAMAGE_PER_TICK
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
  return hasCharge ? CHARGE_MULTIPLIER : 1.0
}

/**
 * 攻撃後に力溜めバフを消費する（削除する）
 * @param buffs - 現在のバフ配列
 * @returns 力溜めを除いたバフ配列
 */
export function consumeChargeBuff(buffs: Buff[]): Buff[] {
  return buffs.filter(
    b => !(b.type === CHARGE_BUFF_TYPE && b.duration === 'nextAction')
  )
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
