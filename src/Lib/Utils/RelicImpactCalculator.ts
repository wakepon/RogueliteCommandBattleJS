import { Buff, ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon } from '../Types/Weapon'
import { RelicData, RelicInstance } from '../Types/Relic'
import { predictWeaponDamage, predictSpellDamage, DamagePredictOptions } from './DamagePredictor'

/** メンバー1人分のレリック影響 */
export interface MemberAttackImpact {
  memberName: string
  status: 'changed' | 'unchanged' | 'noWeapon'
  before: number
  after: number
}

/**
 * 条件付きレリック効果が全て発動した「仮想状態」を作る
 * - 怒りの炎（HP<=閾値で倍率）→ HP を閾値以下に下げる
 * - 集中の水晶（MP<=閾値で倍率）→ MP を閾値以下に下げる
 * - 血の契約（開始時HP削減+STR+3）→ STRバフを battleBuffs に追加
 * - 努力の証（武器破壊蓄積）→ weaponBreakMultiplier を 1 回分セット
 * - 鍛冶師の金槌（武器破壊後の次武器+Power）→ weaponPowerBonus バフを追加
 *
 * 現在条件を満たしていなくても「発動した時の最大攻撃力」を見せるのが目的
 */
function simulateMaxConditions(
  member: ExplorerState,
  relics: RelicInstance[]
): { simulated: ExplorerState; opts: DamagePredictOptions } {
  let simulatedHp = member.hp
  let simulatedMp = member.mp
  const extraBuffs: Buff[] = [...member.battleBuffs]
  let weaponBreakMultiplier = 0

  for (const relic of relics) {
    const effect = relic.passiveEffect
    if (effect.type === 'lowHpDamageMultiplier') {
      simulatedHp = Math.min(simulatedHp, Math.floor(member.maxHp * effect.hpThreshold))
    }
    if (effect.type === 'lowMpDamageBonus') {
      simulatedMp = Math.min(simulatedMp, Math.floor(member.maxMp * effect.mpThreshold))
    }
    if (effect.type === 'battleStartHpReduction') {
      const already = extraBuffs.some(
        b => b.type === 'str' && b.value === effect.strBonus && b.duration === 'battle'
      )
      if (!already) {
        extraBuffs.push({ type: 'str', value: effect.strBonus, duration: 'battle' })
      }
    }
    if (effect.type === 'weaponBreakDamageMultiplier') {
      weaponBreakMultiplier += effect.increment
    }
    if (effect.type === 'weaponBreakNextAttackBonus') {
      extraBuffs.push({ type: 'weaponPowerBonus', value: effect.value, duration: 'nextAction' })
    }
  }

  const simulated: ExplorerState = {
    ...member,
    hp: simulatedHp,
    mp: simulatedMp,
    battleBuffs: extraBuffs,
  }
  const opts: DamagePredictOptions = {
    relics,
    includeConditionalRelics: true,
    killStreakActive: true, // 血染めの手袋: キル直後前提
    weaponBreakMultiplier,
  }
  return { simulated, opts }
}

/**
 * そのメンバーが出せる「最大ダメージ」を、指定レリック集合で評価する
 * - 武器と魔法のうち power > 0 のものを全て試し、max ダメージの最大値を返す
 * - 条件付きレリック倍率は全て発動した仮想状態で計算（simulateMaxConditions）
 * - 各武器は「研ぎ師の名刺」発動条件 (currentUses=1) を満たした状態でも評価
 * - 攻撃手段（power>0 の武器・魔法）がなければ 0
 */
function maxAttackDamage(member: ExplorerState, relics: RelicInstance[]): number {
  const { simulated, opts } = simulateMaxConditions(member, relics)
  let best = 0
  for (const w of simulated.weapons) {
    if (w.power <= 0) continue
    // 研ぎ師の名刺: currentUses=1 の瞬間に倍率発動 → 仮想的に満たす
    const simulatedWeapon: ExplorerWeapon =
      'currentUses' in w && w.currentUses !== null
        ? ({ ...w, currentUses: 1 } as ExplorerWeapon)
        : w
    const range = predictWeaponDamage(simulated, simulatedWeapon, opts)
    if (range.max > best) best = range.max
  }
  for (const s of simulated.spells) {
    if (s.power <= 0) continue
    const range = predictSpellDamage(simulated, s, opts)
    if (range.max > best) best = range.max
  }
  return best
}

/** 攻撃手段（power>0 の武器か魔法）を持っているか */
function hasAnyAttackOption(member: ExplorerState): boolean {
  return (
    member.weapons.some(w => w.power > 0) ||
    member.spells.some(s => s.power > 0)
  )
}

/**
 * 指定レリックが「otherRelics に加わった時」の、各メンバー最大攻撃力の変化を計算する
 * - 呼び出し側の使い分け:
 *   - 購入候補のレリック: otherRelics = 現在装備している全レリック
 *   - 装備済みレリック: otherRelics = 現在装備している全レリックから該当レリックを除いたもの
 */
export function calculateRelicAttackImpacts(
  relic: RelicData,
  party: ExplorerState[],
  otherRelics: RelicInstance[]
): MemberAttackImpact[] {
  const withRelic: RelicInstance[] = [...otherRelics, relic]
  return party.map(member => {
    if (!hasAnyAttackOption(member)) {
      return { memberName: member.name, status: 'noWeapon', before: 0, after: 0 }
    }
    const before = maxAttackDamage(member, otherRelics)
    const after = maxAttackDamage(member, withRelic)
    const status: MemberAttackImpact['status'] = before === after ? 'unchanged' : 'changed'
    return { memberName: member.name, status, before, after }
  })
}
