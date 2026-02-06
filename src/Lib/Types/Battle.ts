import { EnemyInstance } from './Enemy'

/** アクターID（行動順管理用） */
export type ActorId =
  | { type: 'explorer'; id: string }
  | { type: 'enemy'; instanceId: string }

/** 戦闘状態 */
export interface BattleState {
  turn: number
  turnLimit: number
  enemies: EnemyInstance[]
  actionQueue: ActorId[]
  currentActorIndex: number
  stolenGold: number
}
