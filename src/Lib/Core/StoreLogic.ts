import { StoreState, StoreCategory, ShopOption, ShopSlot } from '../Types/Game'
import { WeaponData, ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { SpellData } from '../Types/Spell'
import { RelicData, RelicInstance } from '../Types/Relic'
import { PotionData, PotionInstance } from '../Types/Potion'
import { ExplorerState } from '../Types/Explorer'
import { IPurchasable } from '../Types/Purchasable'
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

const SLOTS_PER_CATEGORY = 3

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

/** 配列をシード付きでシャッフル */
function shuffleArray<T>(array: T[], seed: number): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 7) * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
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

/** カテゴリ別アイテム生成: 魔法（基本魔法=MP0かつ割合消費なしを除外） */
function generateSpellItems(seed: number, count: number, rareRate: number = 0, floor: number = 1): SpellData[] {
  const allSpells = Object.values(spellsData).filter(s =>
    s.mpCost > 0 || (s.mpCostRate !== undefined && s.mpCostRate > 0)
  )
  const filtered = applyFloorFilter(allSpells, floor, count)
  return pickWithRarity(filtered, count, seed + 50, rareRate)
}

/** カテゴリ別アイテム生成: レリック */
function generateRelicItems(seed: number, count: number, rareRate: number = 0, floor: number = 1): RelicData[] {
  const allRelics = Object.values(relicsData)
  const filtered = applyFloorFilter(allRelics, floor, count)
  return pickWithRarity(filtered, count, seed + 100, rareRate)
}

/** カテゴリ別アイテム生成: ポーション（Rareなし） */
function generatePotionItems(seed: number, count: number, _rareRate: number = 0): PotionData[] {
  const allPotions = Object.values(potionsData)
  return pickRandom(allPotions, count, seed + 200)
}

/** カテゴリに応じたShopSlot配列を生成 */
function generateSlotsForCategory(category: StoreCategory, seed: number, count: number, rareRate: number = 0, floor: number = 1): ShopSlot[] {
  switch (category) {
    case 'weapon':
      return generateWeaponItems(seed, count, rareRate, floor).map(item => ({ category: 'weapon' as const, item }))
    case 'spell':
      return generateSpellItems(seed, count, rareRate, floor).map(item => ({ category: 'spell' as const, item }))
    case 'relic':
      return generateRelicItems(seed, count, rareRate, floor).map(item => ({ category: 'relic' as const, item }))
    case 'potion':
      // ポーションは階層制限なし（全階層共通）
      return generatePotionItems(seed, count, rareRate).map(item => ({ category: 'potion' as const, item }))
  }
}

/** ショップ候補を1つ生成 */
function generateShopOption(
  categories: [StoreCategory, StoreCategory],
  seed: number,
  rareRate: number = 0,
  floor: number = 1,
): ShopOption {
  const slotsA = generateSlotsForCategory(categories[0], seed, SLOTS_PER_CATEGORY, rareRate, floor)
  const slotsB = generateSlotsForCategory(categories[1], seed + 300, SLOTS_PER_CATEGORY, rareRate, floor)
  return {
    categories,
    slots: [...slotsA, ...slotsB],
  }
}

/** ストア状態を生成（2択ショップ） */
export function createStoreState(seed: number, stage: number = 1): StoreState {
  const floor = getFloor(stage)
  const rareRate = floor === 3 ? getTuningValue('floor_3_rare_rate', 0.7)
                 : floor === 2 ? getTuningValue('floor_2_rare_rate', 0.5)
                 : 0

  // 4カテゴリをシャッフルして2+2に分割
  const allCategories: StoreCategory[] = ['weapon', 'spell', 'relic', 'potion']
  const shuffled = shuffleArray(allCategories, seed)

  const shopA = generateShopOption(
    [shuffled[0], shuffled[1]],
    seed,
    rareRate,
    floor,
  )
  const shopB = generateShopOption(
    [shuffled[2], shuffled[3]],
    seed + 500,
    rareRate,
    floor,
  )

  return {
    shopOptions: [shopA, shopB],
    selectedShopIndex: null,
    rerollCost: getTuningValue('base_reroll_cost', 3),
    rareRate,
    floor,
  }
}

/** 選択済みショップのリロール */
export function rerollStore(storeState: StoreState, seed: number): StoreState {
  if (storeState.selectedShopIndex === null) return storeState

  const idx = storeState.selectedShopIndex
  const shop = storeState.shopOptions[idx]
  const newShop = generateShopOption(shop.categories, seed, storeState.rareRate, storeState.floor)

  const newOptions: [ShopOption, ShopOption] = [...storeState.shopOptions]
  newOptions[idx] = { ...newShop }

  return {
    ...storeState,
    shopOptions: newOptions,
    rerollCost: storeState.rerollCost + 1,
  }
}

/** 武器の売却価格を計算（使用回数を考慮） */
export function getSellPrice(weapon: ExplorerWeapon): number {
  if (weapon.id === 'punch') {
    return 0
  }

  const weaponInstance = weapon as WeaponInstance
  const basePrice = weaponInstance.price

  if (weaponInstance.maxUses === null || weaponInstance.currentUses === null) {
    return Math.floor(basePrice / 2)
  }

  const usageRatio = weaponInstance.currentUses / weaponInstance.maxUses
  const minSellPrice = basePrice >= 10 ? 2 : 1
  return Math.floor((basePrice - minSellPrice) * usageRatio * 0.5 + minSellPrice)
}

/** 通常アイテムの売却価格（半額） */
export function getSellPriceItem(item: IPurchasable): number {
  return Math.floor(item.price / 2)
}

/** 武器枠に空きがあるかチェック */
export function canBuyWeapon(explorer: ExplorerState): boolean {
  const purchasedWeapons = explorer.weapons.filter(w => w.maxUses !== null)
  return purchasedWeapons.length < explorer.weaponSlotCount
}

/** 魔法枠に空きがあるかチェック */
export function canBuySpell(explorer: ExplorerState): boolean {
  return explorer.spells.length < explorer.magicSlotCount
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
