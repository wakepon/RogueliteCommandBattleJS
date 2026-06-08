import { Buff, Debuff } from './Explorer'

/** 敵タイプ */
export type EnemyType = 'normal' | 'elite' | 'boss'

/** 敵データ（マスター） */
export interface EnemyData {
  id: string
  name: string
  type: EnemyType
  hp: number
  attack: number
  agi: number
  behavior: string
}

/** 敵インスタンス */
export interface EnemyInstance extends EnemyData {
  instanceId: string
  currentHp: number
  battleBuffs: Buff[]
  battleDebuffs: Debuff[]
  hasSummoned?: boolean  // 仲間呼び1回制限用
  justSummoned?: boolean // 召喚されたターンは行動しない
}
