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

/** ポーションショップが出現するステージか（3バトルごと） */
export function isPotionShopStage(stage: number): boolean {
  const eventsBefore = [4, 11, 18].filter(e => e <= stage).length
  const battleIndex = stage - eventsBefore
  return battleIndex > 0 && battleIndex % 3 === 0
}

/** ボスステージかどうかを判定（各階層最終戦） */
export function isBossStage(stage: number): boolean {
  return stage === 7 || stage === 14 || stage === 21
}

/** ステージが属する階層を取得 */
export function getFloor(stage: number): number {
  return stage <= 7 ? 1 : stage <= 14 ? 2 : 3
}
