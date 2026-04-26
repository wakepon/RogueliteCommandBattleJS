import { ExplorerState } from '../Types/Explorer'

/**
 * 前衛となるメンバーIDを返す。
 *
 * ルール:
 * - party 配列の先頭(index 0)が生存者であれば、そのメンバーが前衛
 * - 先頭が死体（または party が空）の場合は前衛なし（null）
 *   → このとき被弾率計算側は生存者全員を後衛重みで按分する
 *
 * これにより「死体を idx0 に置いて被弾を分散させる」戦術が成立する。
 */
export function getFrontMemberId(party: ExplorerState[]): string | null {
  if (party.length === 0) return null
  const head = party[0]
  if (head.hp <= 0) return null
  return head.id
}

/** 指定IDが前衛かどうか */
export function isFrontMember(party: ExplorerState[], memberId: string): boolean {
  return getFrontMemberId(party) === memberId
}
