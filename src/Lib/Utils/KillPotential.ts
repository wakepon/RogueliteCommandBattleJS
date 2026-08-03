import { ExplorerState } from '../Types/Explorer'
import { CommandSlot, BattleCommand } from '../Types/Battle'
import { EnemyInstance } from '../Types/Enemy'
import { isWeapon, isSpell, getAvailableCommands } from '../Core/CommandValidator'
import { calculateDetailedDamagePreview, DamagePredictOptions } from './DamagePredictor'

/** 分類マップのキー（同ID武器が複数あっても同カテゴリになるので index は不要） */
export function killPotentialKey(explorerId: string, commandId: string): string {
  return `${explorerId}::${commandId}`
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

/**
 * 「行動予定を踏まえて、このコマンド C（所有者 owner）を対象の敵へ振ったときの合計 min ダメージ」を求める。
 *
 * 確定済み commandSlots（＝行動予定。ドラッグ中ホバーの仮反映を含む）を土台に、owner のスロットへ C を
 * 差し替える。他キャラが既に対象の敵へセット済みの攻撃はそのまま残すため、返り値には「他キャラの行動予定
 * 分のダメージ」＋「C 自身のダメージ」が合算される。これにより、例えば戦士がナイフを行動予定に入れて敵HPが
 * 削れる予定なら、魔法使いのアイスがその残りを確殺できるかを判定できる。
 *
 * 精密・武器強化・連携の紋章・追撃系・敵シールドの「最初の1発50%軽減」は
 * calculateDetailedDamagePreview がスロット全体から行動順どおりに計算する。
 */
function computePlanMin(
  command: BattleCommand,
  owner: ExplorerState,
  party: ExplorerState[],
  baseSlots: CommandSlot[],
  ref: EnemyInstance,
  aliveEnemyCount: number,
  options: DamagePredictOptions
): number {
  const hasOwnerSlot = baseSlots.some(s => s.explorerId === owner.id)
  const slots: CommandSlot[] = baseSlots.map(slot =>
    slot.explorerId === owner.id
      ? { explorerId: owner.id, command, targetId: ref.instanceId }
      : slot
  )
  // owner のスロットが土台に無い場合の保険（通常は1キャラ1スロットで存在する）
  if (!hasOwnerSlot) {
    slots.push({ explorerId: owner.id, command, targetId: ref.instanceId })
  }

  const shielded = ref.battleBuffs.some(b => b.type === 'shield')
  const preview = calculateDetailedDamagePreview(
    slots,
    ref.instanceId,
    party,
    options,
    undefined,
    aliveEnemyCount,
    shielded,
    ref.currentHp,
    ref.hp
  )
  return preview.totalMin
}

/**
 * 各コマンドについて、生存中の敵ごとに「行動予定を踏まえてそのコマンドで確定撃破できるか」を判定する。
 *
 * 判定は既存の calculateDetailedDamagePreview を用いるため、精密・武器強化・レリック・
 * 戦闘開始バフ・連携の紋章がすべて反映される（土台に渡す baseSlots が確定済み/ホバー仮反映を含む）。
 * 行動予定に技を追加すると baseSlots（previewCommandSlots）が変わり、他キャラの攻撃分だけ敵HPが削れる
 * 予定になるため、その残りを確殺できるコマンドが赤へ切り替わる（呼び出し側の再計算で更新）。
 *
 * 返り値の配列は `enemies` 配列（＝画面の左→右の表示順。撃破済みの敵カードも含む）に対応する。
 * これによりセグメント数＝表示中の敵カード数となり、幅は戦闘開始時と敵増援時にだけ変わる
 * （敵の撃破では変わらない）。各要素は:
 *   - true : 行動予定を踏まえてこのコマンドで確殺できる（赤）
 *   - false: 生存敵だが確殺できない（灰）
 *   - null : 撃破済みの敵（無色。撃破済みカードに確殺ラインを出さない）
 * 攻撃技でないコマンド（回復・防御・バフ等）は空配列を返す（確殺ラインを表示しない）。
 *
 * ここでの「確定」は乱数のブレを考慮しても必ず倒せるライン（合計 totalMin >= 敵の残HP）を指す。
 *
 * @param party パーティ
 * @param enemies 敵リスト（撃破済みも含む表示順）
 * @param baseSlots 判定の土台となるコマンドスロット（確定済み。ドラッグ中ホバーの仮反映を含んでよい）
 * @param options ダメージ予測オプション（敵HPプレビューと同一構造）
 * @returns killPotentialKey(explorerId, commandId) -> 敵カードごとの確殺フラグ配列（null=撃破済み）
 */
export function classifyCommandsSoloKillPerEnemy(
  party: ExplorerState[],
  enemies: EnemyInstance[],
  baseSlots: CommandSlot[],
  options: DamagePredictOptions = {}
): Map<string, (boolean | null)[]> {
  const result = new Map<string, (boolean | null)[]>()
  const aliveEnemyCount = enemies.filter(e => e.currentHp > 0).length
  if (aliveEnemyCount === 0) return result

  for (const member of party) {
    if (member.hp <= 0) continue
    for (const command of getAvailableCommands(member)) {
      const key = killPotentialKey(member.id, command.id)
      if (!isAttackCommand(command)) {
        result.set(key, [])
        continue
      }
      // 敵カードごと（撃破済み含む）に判定。撃破済みは null（無色）、
      // 生存敵は「行動予定の他攻撃＋このコマンドの合計 min で確殺できるか」
      const flags = enemies.map(enemy => {
        if (enemy.currentHp <= 0) return null
        const planMin = computePlanMin(command, member, party, baseSlots, enemy, aliveEnemyCount, options)
        return planMin >= enemy.currentHp
      })
      result.set(key, flags)
    }
  }

  return result
}
