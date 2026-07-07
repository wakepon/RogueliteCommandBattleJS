import { ExplorerState } from '../Types/Explorer'
import { CommandSlot, BattleCommand } from '../Types/Battle'
import { EnemyInstance } from '../Types/Enemy'
import { isWeapon, isSpell, getAvailableCommands } from '../Core/CommandValidator'
import { calculateDetailedDamagePreview, countPrecedingAllyAttacks, DamagePredictOptions } from './DamagePredictor'

/**
 * コマンド立案支援用の撃破確定カテゴリ。
 * - solo: そのコマンド単体で基準の敵を確定撃破できる
 * - combo: 単体では無理だが、他キャラの最大火力（非solo）と組めば確定撃破できる
 * - none: 攻撃技だが上記いずれの確定撃破組にも絡めない
 * - nonAttack: 攻撃技ではない（回復・防御・バフ等）
 *
 * ここでの「確定」は乱数のブレを考慮しても必ず倒せるライン（totalMin >= 敵HP）を指す。
 */
export type KillCategory = 'solo' | 'combo' | 'none' | 'nonAttack'

/** 分類マップのキー（同ID武器が複数あっても同カテゴリになるので index は不要） */
export function killPotentialKey(explorerId: string, commandId: string): string {
  return `${explorerId}::${commandId}`
}

/**
 * 着色の基準となる敵を返す。
 * - ホバー中の生存敵があればその敵
 * - なければ生存中で最も残HPが少ない敵
 */
export function getReferenceEnemy(
  enemies: EnemyInstance[],
  hoverEnemyId: string | null
): EnemyInstance | null {
  const alive = enemies.filter(e => e.currentHp > 0)
  if (alive.length === 0) return null
  if (hoverEnemyId) {
    const hovered = alive.find(e => e.instanceId === hoverEnemyId)
    if (hovered) return hovered
  }
  // 厳密比較なので同HPの敵が複数いる場合は配列先頭（=描画順の先頭）を優先する
  return alive.reduce((min, e) => (e.currentHp < min.currentHp ? e : min), alive[0])
}

/** 攻撃技かどうか（敵対象 かつ power > 0 の武器/魔法） */
function isAttackCommand(command: BattleCommand): boolean {
  if (isWeapon(command) || isSpell(command)) {
    const t = command.targetType
    if (t !== 'enemySingle' && t !== 'enemyAll' && t !== 'enemyRandom') return false
    return command.power > 0
  }
  return false
}

/** そのスロットが基準の敵にダメージを与えるか（rawMin 算出時に分離無効化する対象） */
function slotDamagesEnemy(slot: CommandSlot, enemyId: string): boolean {
  const cmd = slot.command
  if (!cmd) return false
  if (!(isWeapon(cmd) || isSpell(cmd))) return false
  const t = cmd.targetType
  if (t === 'enemyAll' || t === 'enemyRandom') return true
  if (t === 'enemySingle') return slot.targetId === enemyId
  return false
}

/**
 * シールド軽減の近似。敵がシールド持ちのとき、対象 min 群のうち最大の1つだけ 50% 減算して合計する。
 * ゲームは行動順の最初の1発に 50%軽減を適用するが、ここでは「最大の1発」に適用＝保守的
 * （false positive を避ける）近似とする。
 * solo 判定では `[rawMin]`（1発）、combo 判定では `[rawMin, ...partnerMins]`（合算後の最大1発）に適用する。
 * combo では実ゲームの「最初の1発のみ軽減」とのズレが solo より大きくなるが、過剰軽減方向なので実害はない。
 */
function applyShield(mins: number[], shielded: boolean): number {
  if (mins.length === 0) return 0
  const total = mins.reduce((s, m) => s + m, 0)
  if (!shielded) return total
  const maxMin = Math.max(...mins)
  return total - Math.floor(maxMin * 0.5)
}

/**
 * コマンド C（所有者 owner）の「バフ反映済み単体 min ダメージ」を求める。
 *
 * 確定済み commandSlots を土台に、owner のスロットへ C を差し替え、基準の敵に
 * ダメージを与える他スロットを無効化して C 単体のダメージへ分離する。それ以外
 * （味方対象の武器強化・精密などのバフ供給スロット、別の敵狙いの攻撃）は残すため、
 * 行動順に応じた精密/武器強化/連携が C に正しく効く。シールドは呼び出し側で別途適用するため false。
 */
function computeRawMin(
  command: BattleCommand,
  owner: ExplorerState,
  party: ExplorerState[],
  baseSlots: CommandSlot[],
  ref: EnemyInstance,
  aliveEnemyCount: number,
  options: DamagePredictOptions
): number {
  const hasOwnerSlot = baseSlots.some(s => s.explorerId === owner.id)
  const slots: CommandSlot[] = baseSlots.map(slot => {
    if (slot.explorerId === owner.id) {
      return { explorerId: owner.id, command, targetId: ref.instanceId }
    }
    if (slotDamagesEnemy(slot, ref.instanceId)) {
      return { explorerId: slot.explorerId, command: null, targetId: null }
    }
    return slot
  })
  // owner のスロットが土台に無い場合の保険（通常は1キャラ1スロットで存在する）
  if (!hasOwnerSlot) {
    slots.push({ explorerId: owner.id, command, targetId: ref.instanceId })
  }

  // 追撃系(追撃のナイフ等): 上で基準敵を攻撃する先行スロットを無効化してしまうため、
  // 実際にセット済みの先行味方攻撃数を元スロット(baseSlots)から算出して明示的に渡す。
  // これにより「先行2人がコマンドをセット済みなら +power を反映して着色」という挙動になる。
  const followUpCountOverride = countPrecedingAllyAttacks(baseSlots, owner.id)

  const preview = calculateDetailedDamagePreview(
    slots,
    ref.instanceId,
    party,
    { ...options, followUpCountOverride },
    undefined,
    aliveEnemyCount,
    false, // シールドは applyShield で別途適用
    ref.currentHp,
    ref.hp
  )
  return preview.totalMin
}

interface CommandEntry {
  command: BattleCommand
  rawMin: number
  isAttack: boolean
  soloKill: boolean
}

/**
 * 各キャラの各コマンドを撃破確定カテゴリに分類する。
 *
 * 判定は既存の calculateDetailedDamagePreview を用いるため、精密・武器強化・レリック・
 * 戦闘開始バフ・連携の紋章がすべて反映される（土台に渡す baseSlots が確定済み/ホバー仮反映を含む）。
 *
 * @param party パーティ
 * @param enemies 敵リスト
 * @param baseSlots 判定の土台となるコマンドスロット（確定済み。ドラッグ中ホバーの仮反映を含んでよい）
 * @param hoverEnemyId 着色基準にする敵（null なら最小HPの敵）
 * @param options ダメージ予測オプション（敵HPプレビューと同一構造）
 * @returns killPotentialKey(explorerId, commandId) -> KillCategory のマップ
 */
export function classifyCommandsKillPotential(
  party: ExplorerState[],
  enemies: EnemyInstance[],
  baseSlots: CommandSlot[],
  hoverEnemyId: string | null,
  options: DamagePredictOptions = {}
): Map<string, KillCategory> {
  const result = new Map<string, KillCategory>()
  const ref = getReferenceEnemy(enemies, hoverEnemyId)
  if (!ref) return result

  const shielded = ref.battleBuffs.some(b => b.type === 'shield')
  const aliveEnemyCount = enemies.filter(e => e.currentHp > 0).length

  // 各キャラの利用可能コマンドについて、バフ反映済み単体 min と solo 判定を算出
  const perMember = new Map<string, CommandEntry[]>()
  for (const member of party) {
    if (member.hp <= 0) {
      perMember.set(member.id, [])
      continue
    }
    const entries: CommandEntry[] = []
    for (const command of getAvailableCommands(member)) {
      if (!isAttackCommand(command)) {
        entries.push({ command, rawMin: 0, isAttack: false, soloKill: false })
        continue
      }
      const rawMin = computeRawMin(command, member, party, baseSlots, ref, aliveEnemyCount, options)
      const soloKill = applyShield([rawMin], shielded) >= ref.currentHp
      entries.push({ command, rawMin, isAttack: true, soloKill })
    }
    perMember.set(member.id, entries)
  }

  // 各キャラの「非solo コマンドの中での最大火力（rawMin）」。コンボ判定のパートナー火力に使う。
  // ★solo コマンドを除外するのが肝。除外しないと単騎キルが1つでもあると全コマンドが combo になる。
  const bestNonSolo = new Map<string, number>()
  for (const [id, entries] of perMember) {
    let best = 0
    for (const e of entries) {
      if (e.isAttack && !e.soloKill && e.rawMin > best) best = e.rawMin
    }
    bestNonSolo.set(id, best)
  }

  // 分類
  for (const member of party) {
    const entries = perMember.get(member.id) ?? []
    for (const e of entries) {
      const key = killPotentialKey(member.id, e.command.id)
      if (!e.isAttack) {
        result.set(key, 'nonAttack')
        continue
      }
      if (e.soloKill) {
        result.set(key, 'solo')
        continue
      }
      // コンボ火力 = 自分の rawMin + 他キャラそれぞれの bestNonSolo。
      // これは「各キャラが基準の敵へ最大火力（非solo）を振り直した場合」の理論値であり、
      // 現在の確定コマンドのままで倒せることを保証するものではない（立案支援としての潜在値）。
      const partnerMins: number[] = []
      for (const other of party) {
        if (other.id === member.id) continue
        const b = bestNonSolo.get(other.id) ?? 0
        if (b > 0) partnerMins.push(b)
      }
      const comboTotal = applyShield([e.rawMin, ...partnerMins], shielded)
      result.set(key, comboTotal >= ref.currentHp ? 'combo' : 'none')
    }
  }

  return result
}
