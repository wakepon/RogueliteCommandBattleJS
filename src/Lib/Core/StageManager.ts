/** 総ステージ数 */
export const TOTAL_STAGES = 11

/** イベントステージかどうかを判定 */
export function isEventStage(stage: number): boolean {
  return stage === 4 || stage === 9
}

/** 最終ステージかどうかを判定 */
export function isFinalStage(stage: number): boolean {
  return stage === TOTAL_STAGES
}

/** ボスステージかどうかを判定（第一階層ドラゴン + 最終ボス） */
export function isBossStage(stage: number): boolean {
  return stage === 7 || stage === TOTAL_STAGES
}

/** ステージが属する階層を取得 */
export function getFloor(stage: number): number {
  return stage <= 7 ? 1 : 2
}
