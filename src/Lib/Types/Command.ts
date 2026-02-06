/** コマンドカテゴリ */
export type CommandCategory = 'weapon' | 'spell' | 'potion'

/** 戦闘コマンドとして選択可能 */
export interface ICommandable {
  commandCategory: CommandCategory
}

/** ターゲットタイプ */
export type TargetType = 'enemySingle' | 'allySingle' | 'enemyAll' | 'allyAll' | 'enemyRandom'

/** ターゲット選択 */
export interface ITargetable {
  targetType: TargetType
  minTargetCount?: number
  maxTargetCount?: number
}
