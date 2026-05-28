import { CharacterClass } from './Explorer'

/** 成長タイプ名 */
export type GrowthTypeName = 'attack' | 'hp' | 'mp' | 'balance' | 'allBonus'

/** 成長タイプによるステータス上昇値 */
export interface GrowthStats {
  str: number
  int: number
  maxHp: number
  maxMp: number
}

/** 成長タイプの選択肢（1つ分） */
export interface GrowthTypeOption {
  type: GrowthTypeName
  label: string
  stats: GrowthStats
  weight: number
}

/** レベルアップ時の成長方向選択（2択） */
export interface GrowthChoice {
  options: [GrowthTypeOption, GrowthTypeOption]
  explorerId: string
  explorerName: string
  characterClass: CharacterClass
}
