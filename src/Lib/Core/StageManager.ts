/** 総ステージ数 */
export const TOTAL_STAGES = 21

/** イベントステージかどうかを判定 */
export function isEventStage(stage: number): boolean {
  return stage === 4 || stage === 11 || stage === 18
}

/** 最終ステージかどうかを判定 */
export function isFinalStage(stage: number): boolean {
  return stage === TOTAL_STAGES
}

/** ボスステージかどうかを判定（各階層最終戦） */
export function isBossStage(stage: number): boolean {
  return stage === 7 || stage === 14 || stage === 21
}

/** ステージが属する階層を取得 */
export function getFloor(stage: number): number {
  return stage <= 7 ? 1 : stage <= 14 ? 2 : 3
}
