import { EnemyInstance } from './Enemy'
import { ExplorerWeapon } from './Weapon'
import { SpellInstance } from './Spell'
import { LevelUpInfo } from '../Core/LevelUpCalculator'

/** アクターID（行動順管理用） */
export type ActorId =
  | { type: 'explorer'; id: string }
  | { type: 'enemy'; instanceId: string }

/** 戦闘結果 */
export type BattleResult = 'ongoing' | 'victory' | 'defeat'

/** ダメージポップアップ（敵への攻撃用） */
export interface DamagePopup {
  id: string
  targetId: string  // enemy instanceId
  damage: number
  timestamp: number
}

/** プレイヤーへのダメージポップアップ */
export interface PlayerDamagePopup {
  id: string
  damage: number
  timestamp: number
}

/** レベルアップポップアップ */
export interface LevelUpPopup {
  id: string
  levelUpInfo: LevelUpInfo
  timestamp: number
}

/** 戦闘状態 */
export interface BattleState {
  turn: number
  turnLimit: number
  enemies: EnemyInstance[]
  actionQueue: ActorId[]
  currentActorIndex: number
  stolenGold: number

  // UI状態
  selectedCommand: ExplorerWeapon | SpellInstance | null
  selectedTargetId: string | null
  damagePopups: DamagePopup[]
  playerDamagePopups: PlayerDamagePopup[]
  levelUpPopups: LevelUpPopup[]
}
