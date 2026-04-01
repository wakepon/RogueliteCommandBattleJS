import { StoreState } from '../Types/Game'
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

// マスターデータを型付け
const weaponsData = WeaponsData as Record<string, WeaponData>
const spellsData = SpellsData as Record<string, SpellData>
const relicsData = RelicsData as Record<string, RelicData>
const potionsData = PotionsData as Record<string, PotionData>

// 定数
const WEAPON_SLOT_COUNT = 4
const RELIC_SLOT_COUNT = 2
const POTION_SLOT_COUNT = 2
const BASE_REROLL_COST = 3
const MAX_RELIC_COUNT = 5
const MAX_POTION_COUNT = 2
// MAX_WEAPON_COUNT, MAX_SPELL_COUNT は ExplorerState.weaponSlotCount/magicSlotCount に移行

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

/** 武器/魔法枠の商品を抽選 */
export function generateWeaponSlotItems(seed: number): (WeaponData | SpellData)[] {
  const allWeapons = Object.values(weaponsData)
  const allSpells = Object.values(spellsData)
  const allItems = [...allWeapons, ...allSpells]

  return pickRandom(allItems, WEAPON_SLOT_COUNT, seed)
}

/** レリック枠の商品を抽選 */
export function generateRelicSlotItems(seed: number): RelicData[] {
  const allRelics = Object.values(relicsData)
  return pickRandom(allRelics, RELIC_SLOT_COUNT, seed + 100)
}

/** ポーション枠の商品を抽選 */
export function generatePotionSlotItems(seed: number): PotionData[] {
  const allPotions = Object.values(potionsData)
  return pickRandom(allPotions, POTION_SLOT_COUNT, seed + 200)
}

/** ストア状態を生成 */
export function createStoreState(seed: number): StoreState {
  return {
    weaponSlots: generateWeaponSlotItems(seed),
    relicSlots: generateRelicSlotItems(seed),
    potionSlots: generatePotionSlotItems(seed),
    rerollCost: BASE_REROLL_COST,
  }
}

/** 売却可能かどうかを判定 */
export function isSellable(item: unknown): item is IPurchasable {
  return item !== null &&
    typeof item === 'object' &&
    'price' in item &&
    typeof (item as IPurchasable).price === 'number'
}

/** 武器の売却価格を計算（使用回数を考慮） */
export function getSellPrice(weapon: ExplorerWeapon): number {
  // パンチは売却不可
  if (weapon.id === 'punch') {
    return 0
  }

  const weaponInstance = weapon as WeaponInstance
  const basePrice = weaponInstance.price

  // 無制限使用の場合は半額
  if (weaponInstance.maxUses === null || weaponInstance.currentUses === null) {
    return Math.floor(basePrice / 2)
  }

  // 使用回数に応じて価格を計算
  // 売却価格 = 購入価格 × (残り使用回数 / 最大使用回数) × 0.5
  const usageRatio = weaponInstance.currentUses / weaponInstance.maxUses
  return Math.floor(basePrice * usageRatio * 0.5)
}

/** 通常アイテムの売却価格（半額） */
export function getSellPriceItem(item: IPurchasable): number {
  return Math.floor(item.price / 2)
}

/** 武器枠に空きがあるかチェック（無限行動は枠に含まないためlength - 無限行動数で判定） */
export function canBuyWeapon(explorer: ExplorerState): boolean {
  // 無限行動（パンチ、魔力弾、祈り等）はスロット数に含まない
  const purchasedWeapons = explorer.weapons.filter(w => w.maxUses !== null)
  return purchasedWeapons.length < explorer.weaponSlotCount
}

/** 魔法枠に空きがあるかチェック */
export function canBuySpell(explorer: ExplorerState): boolean {
  return explorer.spells.length < explorer.magicSlotCount
}

/** レリック枠に空きがあるかチェック */
export function canBuyRelic(relics: RelicInstance[]): boolean {
  return relics.length < MAX_RELIC_COUNT
}

/** ポーション枠に空きがあるかチェック */
export function canBuyPotion(potions: PotionInstance[]): boolean {
  return potions.length < MAX_POTION_COUNT
}

/** リロール処理 */
export function rerollStore(storeState: StoreState, seed: number): StoreState {
  return {
    weaponSlots: generateWeaponSlotItems(seed),
    relicSlots: generateRelicSlotItems(seed),
    potionSlots: generatePotionSlotItems(seed),
    rerollCost: storeState.rerollCost + 1,
  }
}

/** 武器かどうかを判定 */
export function isWeaponData(item: WeaponData | SpellData): item is WeaponData {
  return item.commandCategory === 'weapon'
}

/** 魔法かどうかを判定 */
export function isSpellData(item: WeaponData | SpellData): item is SpellData {
  return item.commandCategory === 'spell'
}

/** レリックかどうかを判定 */
export function isRelicData(item: RelicData | PotionData): item is RelicData {
  return 'passiveEffect' in item
}

/** ポーションかどうかを判定 */
export function isPotionData(item: RelicData | PotionData): item is PotionData {
  return 'effect' in item && 'commandCategory' in item && item.commandCategory === 'potion'
}
