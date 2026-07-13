import { ExplorerState } from '../Types/Explorer'
import { MemberBattleDiff, WeaponUsesDiff } from '../Types/Game'
import { getRequiredKillsForNextLevel } from './LevelUpCalculator'

/**
 * バトル開始時スナップショットと現在のパーティ状態から
 * メンバー別の差分情報を計算する
 *
 * - メンバーは id で対応付け
 * - 武器は配列インデックスで対応付け（バトル中に武器増減はない前提）
 * - maxUses === null（無制限武器）は usesDiff: 0
 */
export function calculateMemberDiffs(
  snapshotParty: ExplorerState[],
  currentParty: ExplorerState[]
): MemberBattleDiff[] {
  return currentParty.map(current => {
    const snap = snapshotParty.find(s => s.id === current.id) ?? current

    const weapons: WeaponUsesDiff[] = current.weapons.map((w, i) => {
      const snapW = snap.weapons[i]
      const startUses = snapW?.currentUses ?? null
      const usesDiff =
        startUses === null || w.currentUses === null
          ? 0
          : w.currentUses - startUses
      return {
        weaponId: w.id,
        weaponName: w.name,
        currentUses: w.currentUses,
        maxUses: w.maxUses,
        usesBefore: startUses,
        usesDiff,
        broken: w.maxUses !== null && w.currentUses === 0,
      }
    })

    return {
      explorerId: current.id,
      name: current.name,
      characterClass: current.characterClass,
      hp: current.hp,
      maxHp: current.maxHp,
      mp: current.mp,
      maxMp: current.maxMp,
      level: current.level,
      exp: current.exp,
      expRequired: getRequiredKillsForNextLevel(current.level),
      str: current.str,
      int: current.int,
      weapons,
      hpDiff: current.hp - snap.hp,
      maxHpDiff: current.maxHp - snap.maxHp,
      mpDiff: current.mp - snap.mp,
      maxMpDiff: current.maxMp - snap.maxMp,
      levelDiff: current.level - snap.level,
      hpBefore: snap.hp,
      maxHpBefore: snap.maxHp,
      mpBefore: snap.mp,
      maxMpBefore: snap.maxMp,
      levelBefore: snap.level,
      expBefore: snap.exp,
      expRequiredBefore: getRequiredKillsForNextLevel(snap.level),
    }
  })
}
