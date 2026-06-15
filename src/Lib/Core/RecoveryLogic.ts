import { ExplorerState } from '../Types/Explorer'
import { RecoveryMenuId } from '../Types/Game'
import { RunState } from '../Types/Run'
import { WeaponInstance } from '../Types/Weapon'

/** HP/MP回復のコスト表（回数 → コスト） */
const HEAL_COST_TABLE = [3, 3, 2, 2, 1]

/** 変換のコスト表（回数 → コスト） */
const CONVERT_COST_TABLE = [2, 1, 1]

/** 武器修理のコスト倍率表（回数 → 倍率） */
const REPAIR_COST_MULTIPLIERS = [1.0, 1.0, 0.7, 0.5]

const HP_HEAL_AMOUNT = 10
const MP_HEAL_AMOUNT = 5
const CONVERT_HP_COST = 15
const CONVERT_MP_GAIN = 10
const CONVERT_MP_COST = 10
const CONVERT_HP_GAIN = 15

/** コスト表から回数に応じたコストを取得（テーブル末尾を超えたら最後の値を使用） */
function getCostFromTable(table: readonly number[], useCount: number): number {
  const index = Math.min(useCount, table.length - 1)
  return table[index]
}

/** 回復メニューの次回コストを計算 */
export function getRecoveryCost(menuId: RecoveryMenuId, useCount: number, run: RunState): number {
  switch (menuId) {
    case 'healHp':
    case 'healMp':
      return getCostFromTable(HEAL_COST_TABLE, useCount)
    case 'convertHpToMp':
    case 'convertMpToHp':
      return getCostFromTable(CONVERT_COST_TABLE, useCount)
    case 'repairWeapons': {
      const weaponCount = countRepairableWeapons(run.party)
      const baseCost = Math.max(2, weaponCount)
      const multiplier = getCostFromTable(REPAIR_COST_MULTIPLIERS, useCount)
      return Math.max(1, Math.ceil(baseCost * multiplier))
    }
  }
}

/** 修理可能な武器数をカウント */
function countRepairableWeapons(party: ExplorerState[]): number {
  let count = 0
  for (const member of party) {
    for (const weapon of member.weapons) {
      if (weapon.id === 'punch') continue
      const w = weapon as WeaponInstance
      if (w.noRepair) continue
      if (w.maxUses === null) continue
      count++
    }
  }
  return count
}

/** 回復メニューが実行可能かチェック */
export function canExecuteRecovery(
  menuId: RecoveryMenuId,
  useCount: number,
  run: RunState,
  targetId?: string
): boolean {
  const cost = getRecoveryCost(menuId, useCount, run)
  if (run.gold < cost) return false

  switch (menuId) {
    case 'healHp': {
      if (!targetId) return false
      const member = run.party.find(m => m.id === targetId)
      if (!member) return false
      return member.hp < member.maxHp
    }
    case 'healMp': {
      if (!targetId) return false
      const member = run.party.find(m => m.id === targetId)
      if (!member) return false
      return member.mp < member.maxMp
    }
    case 'repairWeapons': {
      return run.party.some(member =>
        member.weapons.some(weapon => {
          if (weapon.id === 'punch') return false
          const w = weapon as WeaponInstance
          if (w.noRepair) return false
          if (w.maxUses === null) return false
          return w.currentUses !== null && w.currentUses < w.maxUses
        })
      )
    }
    case 'convertHpToMp': {
      if (!targetId) return false
      const member = run.party.find(m => m.id === targetId)
      if (!member) return false
      return member.hp > CONVERT_HP_COST && member.mp < member.maxMp
    }
    case 'convertMpToHp': {
      if (!targetId) return false
      const member = run.party.find(m => m.id === targetId)
      if (!member) return false
      return member.mp >= CONVERT_MP_COST && member.hp < member.maxHp
    }
  }
}

/** HP回復を適用 */
function applyHealHp(run: RunState, targetId: string): RunState {
  return {
    ...run,
    party: run.party.map(member => {
      if (member.id !== targetId) return member
      return { ...member, hp: Math.min(member.hp + HP_HEAL_AMOUNT, member.maxHp) }
    }),
  }
}

/** MP回復を適用 */
function applyHealMp(run: RunState, targetId: string): RunState {
  return {
    ...run,
    party: run.party.map(member => {
      if (member.id !== targetId) return member
      return { ...member, mp: Math.min(member.mp + MP_HEAL_AMOUNT, member.maxMp) }
    }),
  }
}

/** 武器修理を適用（全武器+1） */
function applyRepairWeapons(run: RunState): RunState {
  return {
    ...run,
    party: run.party.map(member => ({
      ...member,
      weapons: member.weapons.map(weapon => {
        if (weapon.id === 'punch') return weapon
        const w = weapon as WeaponInstance
        if (w.noRepair) return weapon
        if (w.maxUses === null || w.currentUses === null) return weapon
        if (w.currentUses >= w.maxUses) return weapon
        return { ...w, currentUses: Math.min(w.currentUses + 1, w.maxUses) }
      }),
    })),
  }
}

/** HP→MP変換を適用 */
function applyConvertHpToMp(run: RunState, targetId: string): RunState {
  return {
    ...run,
    party: run.party.map(member => {
      if (member.id !== targetId) return member
      return {
        ...member,
        hp: member.hp - CONVERT_HP_COST,
        mp: Math.min(member.mp + CONVERT_MP_GAIN, member.maxMp),
      }
    }),
  }
}

/** MP→HP変換を適用 */
function applyConvertMpToHp(run: RunState, targetId: string): RunState {
  return {
    ...run,
    party: run.party.map(member => {
      if (member.id !== targetId) return member
      return {
        ...member,
        mp: member.mp - CONVERT_MP_COST,
        hp: Math.min(member.hp + CONVERT_HP_GAIN, member.maxHp),
      }
    }),
  }
}

/** 回復を実行してRunStateを更新 */
export function executeRecovery(
  menuId: RecoveryMenuId,
  useCount: number,
  run: RunState,
  targetId?: string
): RunState {
  const cost = getRecoveryCost(menuId, useCount, run)
  let updatedRun = { ...run, gold: run.gold - cost }

  switch (menuId) {
    case 'healHp':
      updatedRun = applyHealHp(updatedRun, targetId!)
      break
    case 'healMp':
      updatedRun = applyHealMp(updatedRun, targetId!)
      break
    case 'repairWeapons':
      updatedRun = applyRepairWeapons(updatedRun)
      break
    case 'convertHpToMp':
      updatedRun = applyConvertHpToMp(updatedRun, targetId!)
      break
    case 'convertMpToHp':
      updatedRun = applyConvertMpToHp(updatedRun, targetId!)
      break
  }

  return updatedRun
}

/** 回復メニューの初期状態を生成 */
export function createRecoveryState() {
  return {
    useCounts: {
      healHp: 0,
      healMp: 0,
      repairWeapons: 0,
      convertHpToMp: 0,
      convertMpToHp: 0,
    } as Record<RecoveryMenuId, number>,
  }
}

/** 回復メニューの表示情報 */
export interface RecoveryMenuInfo {
  id: RecoveryMenuId
  label: string
  description: string
  needsTarget: boolean
}

export const RECOVERY_MENUS: RecoveryMenuInfo[] = [
  { id: 'healHp', label: 'HP回復', description: '+10 HP', needsTarget: true },
  { id: 'healMp', label: 'MP回復', description: '+5 MP', needsTarget: true },
  { id: 'repairWeapons', label: '武器修理', description: '全武器 +1', needsTarget: false },
  { id: 'convertHpToMp', label: 'HP→MP変換', description: 'HP-15 → MP+10', needsTarget: true },
  { id: 'convertMpToHp', label: 'MP→HP変換', description: 'MP-10 → HP+15', needsTarget: true },
]
