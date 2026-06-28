import { StoreState, StoreCategory, ShopSlot } from '../Types/Game'
import { WeaponData } from '../Types/Weapon'
import { SpellData } from '../Types/Spell'
import { RelicData, RelicInstance } from '../Types/Relic'
import { PotionData, PotionInstance } from '../Types/Potion'
import { ExplorerState } from '../Types/Explorer'
import WeaponsData from '../Data/Weapons.json'
import SpellsData from '../Data/Spells.json'
import RelicsData from '../Data/Relics.json'
import PotionsData from '../Data/Potions.json'
import { getTuningValue } from '../Tuning/TuningStore'
import { getFloor } from './StageManager'
import { getPotionSlotBonus } from './RelicProcessor'

// マスターデータを型付け
const weaponsData = WeaponsData as Record<string, WeaponData>
const spellsData = SpellsData as Record<string, SpellData>
const relicsData = RelicsData as Record<string, RelicData>
const potionsData = PotionsData as Record<string, PotionData>

const MAX_SELECTIONS = 2

/** 簡易的な疑似乱数生成器（シード付き） */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/** 配列からランダムに複数選択 */
function pickRandom<T>(array: T[], count: number, seed: number): T[] {
  if (array.length === 0 || count <= 0) return []

  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }

  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/** レアリティ加重ピック: rareRate > 0 なら各スロットでRareを優先的に選出 */
function pickWithRarity<T extends { rarity: string }>(
  items: T[],
  count: number,
  seed: number,
  rareRate: number
): T[] {
  if (rareRate <= 0) return pickRandom(items, count, seed)

  const rarePool = items.filter(i => i.rarity === 'Rare')
  const otherPool = items.filter(i => i.rarity !== 'Rare')

  const result: T[] = []
  for (let i = 0; i < count; i++) {
    const useRare = seededRandom(seed + i * 100) < rareRate && rarePool.length > 0
    // フォールバック: 選ばれたプールが空なら、もう一方のプールを使用
    const primaryPool = useRare ? rarePool : otherPool
    const pool = primaryPool.length > 0 ? primaryPool : (useRare ? otherPool : rarePool)
    if (pool.length === 0) continue
    const picked = pickRandom(pool, 1, seed + i * 200)
    if (picked.length > 0) result.push(picked[0])
  }
  return result
}

/** 階層に応じたレアリティフィルタ */
function filterByFloorRarity<T extends { rarity: string }>(items: T[], floor: number): T[] {
  if (floor <= 1) {
    return items.filter(i => i.rarity === 'Common' || i.rarity === 'Uncommon')
  } else if (floor === 2) {
    return items.filter(i => i.rarity === 'Uncommon' || i.rarity === 'Rare')
  }
  // 第3階層以降: Rare（+将来のEpic）のみ
  return items.filter(i => i.rarity === 'Rare')
}

/** フィルタ後の候補不足時にフォールバック */
function applyFloorFilter<T extends { rarity: string }>(items: T[], floor: number, minCount: number): T[] {
  const filtered = filterByFloorRarity(items, floor)
  if (filtered.length < minCount) {
    return items
  }
  return filtered
}

/** カテゴリ別アイテム生成: 武器（耐久∞を除外） */
function generateWeaponItems(seed: number, count: number, rareRate: number = 0, floor: number = 1): WeaponData[] {
  const allWeapons = Object.values(weaponsData).filter(w => w.maxUses !== null)
  const filtered = applyFloorFilter(allWeapons, floor, count)
  return pickWithRarity(filtered, count, seed, rareRate)
}

/** カテゴリ別アイテム生成: 魔法（slotFree魔法・基本魔法=MP0かつ割合消費なしを除外） */
function generateSpellItems(seed: number, count: number, rareRate: number = 0, floor: number = 1): SpellData[] {
  // slotFree（魔力弾・祈り等の初期無料魔法）以外を販売対象とする
  // ※ 渇きの火のようにMP消費0でも特殊効果を持つ魔法を除外しないこと
  const allSpells = Object.values(spellsData).filter(s => !s.slotFree)
  const filtered = applyFloorFilter(allSpells, floor, count)
  return pickWithRarity(filtered, count, seed + 50, rareRate)
}

/** カテゴリ別アイテム生成: レリック */
function generateRelicItems(seed: number, count: number, rareRate: number = 0, floor: number = 1, excludeIds: string[] = []): RelicData[] {
  const allRelics = Object.values(relicsData).filter(r => !excludeIds.includes(r.id))
  const filtered = applyFloorFilter(allRelics, floor, count)
  return pickWithRarity(filtered, count, seed + 100, rareRate)
}

/** カテゴリ別アイテム生成: ポーション（Rareなし） */
function generatePotionItems(seed: number, count: number, _rareRate: number = 0): PotionData[] {
  const allPotions = Object.values(potionsData)
  return pickRandom(allPotions, count, seed + 200)
}

/** カテゴリに応じたShopSlot配列を生成 */
function generateSlotsForCategory(category: StoreCategory, seed: number, count: number, rareRate: number = 0, floor: number = 1, excludeRelicIds: string[] = []): ShopSlot[] {
  switch (category) {
    case 'weapon':
      return generateWeaponItems(seed, count, rareRate, floor).map(item => ({ category: 'weapon' as const, item }))
    case 'spell':
      return generateSpellItems(seed, count, rareRate, floor).map(item => ({ category: 'spell' as const, item }))
    case 'relic':
      return generateRelicItems(seed, count, rareRate, floor, excludeRelicIds).map(item => ({ category: 'relic' as const, item }))
    case 'potion':
      return generatePotionItems(seed, count, rareRate).map(item => ({ category: 'potion' as const, item }))
  }
}

/** 5枠の報酬スロットを生成 */
function generateRewardSlots(seed: number, rareRate: number, floor: number, excludeRelicIds: string[] = []): ShopSlot[] {
  const weaponSlot = generateSlotsForCategory('weapon', seed, 1, rareRate, floor)
  const spellSlot = generateSlotsForCategory('spell', seed + 10, 1, rareRate, floor)

  // 3枠目: 武器か魔法をランダムで決定
  const randomCategory: StoreCategory = seededRandom(seed + 20) < 0.5 ? 'weapon' : 'spell'
  const randomSlot = generateSlotsForCategory(randomCategory, seed + 30, 1, rareRate, floor)

  const relicSlot = generateSlotsForCategory('relic', seed + 40, 1, rareRate, floor, excludeRelicIds)
  const potionSlot = generateSlotsForCategory('potion', seed + 50, 1, rareRate, floor)

  return [...weaponSlot, ...spellSlot, ...randomSlot, ...relicSlot, ...potionSlot]
}

/** ストア状態を生成（5枠から2つ選択） */
export function createStoreState(seed: number, stage: number = 1, excludeRelicIds: string[] = []): StoreState {
  const floor = getFloor(stage)
  const rareRate = floor === 3 ? getTuningValue('floor_3_rare_rate', 0.7)
                 : floor === 2 ? getTuningValue('floor_2_rare_rate', 0.5)
                 : 0

  return {
    slots: generateRewardSlots(seed, rareRate, floor, excludeRelicIds),
    maxSelections: MAX_SELECTIONS,
    rerollCount: 0,
    rareRate,
    floor,
  }
}

/** 報酬スロットのリロール */
export function rerollStore(storeState: StoreState, seed: number, excludeRelicIds: string[] = []): StoreState {
  return {
    ...storeState,
    slots: generateRewardSlots(seed, storeState.rareRate, storeState.floor, excludeRelicIds),
    rerollCount: storeState.rerollCount + 1,
  }
}


/** 武器枠に空きがあるかチェック */
export function canBuyWeapon(explorer: ExplorerState): boolean {
  const purchasedWeapons = explorer.weapons.filter(w => w.maxUses !== null)
  return purchasedWeapons.length < explorer.weaponSlotCount
}

/** 魔法枠に空きがあるかチェック（slotFree魔法は枠を消費しない） */
export function canBuySpell(explorer: ExplorerState): boolean {
  const purchasedSpells = explorer.spells.filter(s => !s.slotFree)
  return purchasedSpells.length < explorer.magicSlotCount
}

/** レリック枠に空きがあるかチェック */
export function canBuyRelic(relics: RelicInstance[]): boolean {
  return relics.length < getTuningValue('max_relic_count', 5)
}

/** ポーション枠に空きがあるかチェック */
export function canBuyPotion(potions: PotionInstance[], relics: RelicInstance[] = []): boolean {
  const slotBonus = getPotionSlotBonus(relics)
  return potions.length < getTuningValue('max_potion_count', 2) + slotBonus
}

/** 武器かどうかを判定 */
export function isWeaponData(item: WeaponData | SpellData): item is WeaponData {
  return item.commandCategory === 'weapon'
}

/** 魔法かどうかを判定 */
export function isSpellData(item: WeaponData | SpellData): item is SpellData {
  return item.commandCategory === 'spell'
}

/** カテゴリの日本語表示名 */
export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  weapon: '武器',
  spell: '魔法',
  relic: 'レリック',
  potion: 'ポーション',
}
