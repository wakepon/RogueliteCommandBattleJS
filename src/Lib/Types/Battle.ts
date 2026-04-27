import { EnemyInstance } from './Enemy'
import { ExplorerWeapon } from './Weapon'
import { SpellInstance } from './Spell'
import { PotionInstance } from './Potion'
import { LevelUpInfo } from '../Core/LevelUpCalculator'
import { EnemyActionResult } from '../Core/EnemyAI'

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
}

/** プレイヤーへのダメージポップアップ */
export interface PlayerDamagePopup {
  id: string
  targetExplorerId?: string  // ダメージを受けたキャラのID
  damage: number
  label?: string  // テキストラベル（例: 武器名）
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
  shieldActive: boolean      // 壊れかけの鎧
  killStreakActive: boolean   // 血染めの手袋
}

/** 戦闘中のボーナスゴールド獲得記録（リザルト画面での内訳表示用） */
export interface BonusGain {
  source: string  // 表示名（魔法名/レリック名）
  value: number   // 加算量（負も可：将来の支払い系を想定）
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
  stolenGold: number
  relicState: RelicBattleState

  // 戦闘中の魔法/レリック効果によるゴールド獲得記録（END_BATTLE で集計し ResultState.bonusEntries に変換）
  bonusGains: BonusGain[]

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

  // ゲームオーバー状態（敗北時にオーバーレイを表示する）
  isGameOver?: boolean
}
