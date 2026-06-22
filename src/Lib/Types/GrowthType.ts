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

