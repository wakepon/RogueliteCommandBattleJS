import { EnemyInstance } from './Enemy'
import { ExplorerWeapon } from './Weapon'
import { SpellInstance } from './Spell'
import { PotionInstance } from './Potion'
import { LevelUpInfo } from '../Core/LevelUpCalculator'
import { EnemyActionResult } from '../Core/EnemyAI'
import { GrowthChoice } from './GrowthType'

/** バトルコマンド型（武器・魔法・ポーション） */
export type BattleCommand = ExplorerWeapon | SpellInstance | PotionInstance

/** アクターID（行動順管理用） */
export type ActorId =
  | { type: 'explorer'; id: string }
  | { type: 'enemy'; instanceId: string }

/** 戦闘結果 */
export type BattleResult = 'ongoing' | 'victory' | 'defeat'

/** バトルフェーズ */
export type BattlePhase = 'command' | 'partyAction' | 'enemyAction' | 'turnEnd'

/** コマンドスロット（1キャラ分のコマンドセット） */
export interface CommandSlot {
  explorerId: string
  command: BattleCommand | null
  targetId: string | null
  weaponIndex?: number  // 同ID武器の区別用: weapons配列内のインデックス
}

/** ダメージ寄与者（ポップアップ表示用） */
export interface DamageContributor {
  name: string
  label: string
}

/** ダメージポップアップ（敵への攻撃用） */
export interface DamagePopup {
  id: string
  targetId: string  // enemy instanceId
  damage: number
  timestamp: number
  contributors?: DamageContributor[]
  delayMs?: number        // 表示開始までの遅延（マルチヒット順次表示用）
  fadeAfterMs?: number    // 作成時刻からフェード開始までのms
  fadeDurationMs?: number // フェードアウトの長さ（ms）
  hitIndex?: number       // マルチヒットの何番目か（Y座標オフセット用）
}

/** プレイヤーへのダメージポップアップ */
export interface PlayerDamagePopup {
  id: string
  targetExplorerId?: string  // ダメージを受けたキャラのID
  damage: number  // シールド軽減後の最終ダメージ値
  label?: string  // テキストラベル（例: 武器名）
  shielded?: boolean  // シールドバフによるダメージ軽減が発生した場合 true（"Shielded -X" 表示用）
  timestamp: number
}

/** レベルアップポップアップ */
export interface LevelUpPopup {
  id: string
  levelUpInfo: LevelUpInfo
  timestamp: number
}

/** 経験値獲得ポップアップ（敵位置からメンバーの経験値バーへ飛ぶエフェクト） */
export interface ExpPopup {
  id: string
  enemyInstanceId: string      // 発射元（敵のDOM位置を参照）
  targetExplorerId: string     // 到達先（メンバーの経験値バーDOM位置を参照）
  amount: number               // 付与される経験値量
  bonusLabel?: string          // 例: "とどめボーナス" / レリック名。未指定なら基本EXP
  delayMs: number              // ポップアップ生成から発射開始までの遅延
  timestamp: number
}

/** 敵行動予告 */
export interface EnemyIntent {
  enemyInstanceId: string
  actionName: string
  damage: number  // 0 = 非攻撃行動
  storedAction: EnemyActionResult  // 実行時に使用（インテントと行動の一致を保証）
}

/** レリック戦闘内状態 */
export interface RelicBattleState {
  killStreakActive: boolean   // 血染めの手袋
}

/** 戦闘状態 */
export interface BattleState {
  turn: number
  turnLimit: number
  phase: BattlePhase
  enemies: EnemyInstance[]

  // コマンド選択フェーズ
  commandSlots: CommandSlot[]         // 各パーティーメンバーのコマンドセット
  activeExplorerIndex: number         // 現在コマンド選択中のキャラ（commandSlots内のインデックス）

  // パーティー行動フェーズ
  currentCommandIndex: number         // 現在実行中のコマンドスロット番号

  // 敵行動フェーズ
  currentEnemyIndex: number           // 現在行動中の敵番号

  // 敵行動予告
  enemyIntents: EnemyIntent[]

  // 共有状態
  relicState: RelicBattleState

  // UI状態（コマンド選択中の一時状態）
  selectedCommand: BattleCommand | null
  selectedTargetId: string | null
  damagePopups: DamagePopup[]
  playerDamagePopups: PlayerDamagePopup[]
  levelUpPopups: LevelUpPopup[]
  expPopups: ExpPopup[]
  battleMessage: string | null
  battleMessageId: number

  // 後方互換: actionQueue（Phase 2移行期間は維持。TurnIndicator等で使用）
  actionQueue: ActorId[]
  currentActorIndex: number

  // 階層倍率（第二階層以降で使用）
  enemyHpMultiplier: number
  enemyDamageMultiplier: number

  // レベルアップ時の成長方向選択キュー
  pendingGrowthChoices: GrowthChoice[]

  // ゲームオーバー状態（敗北時にオーバーレイを表示する）
  isGameOver?: boolean
}
