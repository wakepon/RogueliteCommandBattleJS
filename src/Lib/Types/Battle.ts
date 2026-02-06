import { EnemyInstance } from './Enemy'
import { ExplorerWeapon } from './Weapon'
import { SpellInstance } from './Spell'

/** アクターID（行動順管理用） */
export type ActorId =
  | { type: 'explorer'; id: string }
  | { type: 'enemy'; instanceId: string }

/** ダメージポップアップ */
export interface DamagePopup {
  id: string
  targetId: string  // enemy instanceId
  damage: number
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
}
