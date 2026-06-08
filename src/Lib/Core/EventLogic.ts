import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { RelicData, RelicInstance } from '../Types/Relic'
import { RunState } from '../Types/Run'
import RelicsData from '../Data/Relics.json'
import { getTuningValue } from '../Tuning/TuningStore'

// マスターデータを型付け
const relicsData = RelicsData as Record<string, RelicData>

/** 簡易的な疑似乱数生成器（シード付き） */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/**
 * 休憩による回復量を計算
 * @param maxHp - 最大HP
 * @returns 回復量（最大HPの50%、端数切り上げ）
 */
export function calculateRestHeal(maxHp: number): number {
  return Math.ceil(maxHp * getTuningValue('rest_heal_percent', 0.5))
}

/**
 * 休憩を適用してExplorerを更新
 * @param explorer - 対象のExplorer
 * @returns 回復後のExplorer
 */
export function applyRest(explorer: ExplorerState): ExplorerState {
  const healAmount = calculateRestHeal(explorer.maxHp)
  const newHp = Math.min(explorer.hp + healAmount, explorer.maxHp)

  return {
    ...explorer,
    hp: newHp,
  }
}

/**
 * 武器が修理可能かどうかを判定
 * パンチや無制限使用の武器は修理不可
 * @param weapon - 判定する武器
 * @returns 修理可能ならtrue
 */
function isRepairable(weapon: ExplorerWeapon): boolean {
  // パンチは修理不可
  if (weapon.id === 'punch') {
    return false
  }

  const weaponInstance = weapon as WeaponInstance

  // 強化デメリットで修復不可になった武器
  if (weaponInstance.noRepair) {
    return false
  }

  // 無制限使用の武器は修理不可
  if (weaponInstance.maxUses === null || weaponInstance.currentUses === null) {
    return false
  }

  // 使用回数が減っている場合のみ修理可能
  return weaponInstance.currentUses < weaponInstance.maxUses
}

/**
 * 修理可能な武器一覧を取得
 * @param weapons - 武器配列
 * @returns 修理可能な武器の配列
 */
export function getRepairableWeapons(weapons: ExplorerWeapon[]): WeaponInstance[] {
  return weapons.filter(isRepairable) as WeaponInstance[]
}

/**
 * 武器修理が選択可能かどうかを判定
 * @param explorers - パーティメンバー
 * @returns 修理可能な武器があればtrue
 */
export function canRepairWeapons(explorers: ExplorerState[]): boolean {
  return explorers.some((explorer) =>
    explorer.weapons.some(isRepairable)
  )
}

/**
 * 武器を修理（使用回数を全回復）
 * @param weapon - 修理する武器
 * @returns 修理後の武器
 */
function repairWeapon(weapon: WeaponInstance): WeaponInstance {
  return {
    ...weapon,
    currentUses: weapon.maxUses,
  }
}

/**
 * 複数の武器を修理
 * @param explorer - 対象のExplorer
 * @param weaponIds - 修理する武器IDの配列
 * @returns 武器が修理されたExplorer
 */
export function repairWeapons(
  explorer: ExplorerState,
  weaponIds: string[]
): ExplorerState {
  const updatedWeapons = explorer.weapons.map((weapon) => {
    if (weaponIds.includes(weapon.id) && isRepairable(weapon)) {
      return repairWeapon(weapon as WeaponInstance)
    }
    return weapon
  })

  return {
    ...explorer,
    weapons: updatedWeapons,
  }
}

/**
 * ランダムなレリックを取得
 * @param seed - 乱数シード
 * @param excludeIds - 除外するレリックID（既に所持しているもの）
 * @returns ランダムに選ばれたレリック
 */
export function getRandomRelic(seed: number, excludeIds: string[] = []): RelicData {
  const availableRelics = Object.values(relicsData).filter(
    (relic) => !excludeIds.includes(relic.id)
  )

  if (availableRelics.length === 0) {
    // 全てのレリックを所持している場合は最初のレリックを返す
    return Object.values(relicsData)[0]
  }

  const index = Math.floor(seededRandom(seed) * availableRelics.length)
  return availableRelics[index]
}

/**
 * レリック枠が満杯かどうかを判定
 * @param relics - 所持レリック
 * @returns 満杯ならtrue
 */
export function isRelicSlotFull(relics: RelicInstance[]): boolean {
  return relics.length >= getTuningValue('max_relic_count', 5)
}

/**
 * レリックを追加
 * @param run - 現在のRun状態
 * @param relic - 追加するレリック
 * @returns 更新されたRun状態
 */
export function addRelic(run: RunState, relic: RelicInstance): RunState {
  if (isRelicSlotFull(run.relics)) {
    return run
  }

  return {
    ...run,
    relics: [...run.relics, relic],
  }
}

/**
 * レリックを入れ替え（破棄して新しいものを追加）
 * @param run - 現在のRun状態
 * @param sellRelicId - 破棄するレリックのID
 * @param newRelic - 新しいレリック
 * @returns 更新されたRun状態
 */
export function replaceRelic(
  run: RunState,
  sellRelicId: string,
  newRelic: RelicInstance
): RunState {
  const sellRelic = run.relics.find((r) => r.id === sellRelicId)
  if (!sellRelic) {
    return run
  }

  const updatedRelics = [
    ...run.relics.filter((r) => r.id !== sellRelicId),
    newRelic,
  ]

  return {
    ...run,
    relics: updatedRelics,
  }
}
