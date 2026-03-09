/** 総ステージ数 */
export const TOTAL_STAGES = 7

/** イベントステージかどうかを判定 */
export function isEventStage(stage: number): boolean {
  return stage === 4
}

/** 次のステージ番号を取得 */
export function getNextStage(currentStage: number): number {
  return currentStage + 1
}

/** 最終ステージかどうかを判定 */
export function isFinalStage(stage: number): boolean {
  return stage === TOTAL_STAGES
}
