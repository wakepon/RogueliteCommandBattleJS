import { PotionData, PotionEffect, PotionInstance } from '../Types/Potion'
import { PotionShopState } from '../Types/Game'
import { ExplorerState } from '../Types/Explorer'
import { WeaponInstance } from '../Types/Weapon'
import { RelicInstance } from '../Types/Relic'
import { getPotionEffectMultiplier } from './RelicProcessor'
import PotionsData from '../Data/Potions.json'

const allPotions = Object.values(PotionsData) as PotionData[]

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

/** ポーションショップの商品枠数（ランダム3枠） */
const SHOP_POTION_COUNT = 3
/** 各商品の在庫（1個限り） */
const INITIAL_STOCK = 1
/** 商品価格（全て5Gに統一） */
const SHOP_POTION_PRICE = 5

/** 種系ポーション（永続ステータス上昇）の効果タイプ */
const SEED_POTION_EFFECTS = ['boostStr', 'boostInt', 'boostMaxHp', 'boostMaxMp']

function isSeedPotion(potion: PotionData): boolean {
  return SEED_POTION_EFFECTS.includes(potion.effect.type)
}

/** ポーションショップ状態を生成（種系を除外し、ランダム3枠・各1個・価格5Gで並べる） */
export function createPotionShopState(seed: number): PotionShopState {
  const candidates = allPotions.filter(p => !isSeedPotion(p))
  const selected = pickRandom(candidates, SHOP_POTION_COUNT, seed + 1)
  return {
    shopSlots: selected.map(potion => ({
      potion: { ...potion, price: SHOP_POTION_PRICE },
      stock: INITIAL_STOCK,
    })),
  }
}

/** 購入可能かチェック */
export function canBuyShopPotion(stock: number, price: number, gold: number): boolean {
  return stock > 0 && gold >= price
}

/** ショップ内で即使用可能か（回復系・種系） */
export function canUseImmediately(effect: PotionEffect): boolean {
  switch (effect.type) {
    case 'healHp':
    case 'repairWeapons':
    case 'boostStr':
    case 'boostInt':
    case 'boostMaxHp':
    case 'boostMaxMp':
      return true
    default:
      return false
  }
}

/** ポーション枠に保存可能か（回復系・バフ系、種系は不可） */
export function canStorePotion(effect: PotionEffect): boolean {
  switch (effect.type) {
    case 'healHp':
    case 'repairWeapons':
    case 'taunt':
    case 'statBoost':
    case 'damageReduction':
    case 'aoeConvert':
      return true
    default:
      return false
  }
}

/** ポーションの対象メンバーに使用可能かチェック */
export function canUseOnMember(effect: PotionEffect, member: ExplorerState): boolean {
  switch (effect.type) {
    case 'healHp':
      return member.hp < member.maxHp
    case 'repairWeapons':
      return member.weapons.some(w => {
        if (w.id === 'punch') return false
        const wi = w as WeaponInstance
        if (wi.noRepair || wi.maxUses === null || wi.currentUses === null) return false
        return wi.currentUses < wi.maxUses
      })
    case 'boostStr':
    case 'boostInt':
    case 'boostMaxHp':
    case 'boostMaxMp':
      return true
    default:
      return false
  }
}

/** ポーション効果をメンバーに適用（ショップ内即使用、レリック倍率適用） */
export function applyPotionToMember(potion: PotionData, member: ExplorerState, relics: RelicInstance[]): ExplorerState {
  const effect = potion.effect
  const multiplier = getPotionEffectMultiplier(relics)
  switch (effect.type) {
    case 'healHp': {
      if (effect.full) return { ...member, hp: member.maxHp }
      const healAmount = Math.floor(effect.value * multiplier)
      return { ...member, hp: Math.min(member.hp + healAmount, member.maxHp) }
    }
    case 'repairWeapons': {
      const repairValue = Math.floor(effect.value * multiplier)
      return {
        ...member,
        weapons: member.weapons.map(w => {
          if (w.id === 'punch') return w
          const wi = w as WeaponInstance
          if (wi.noRepair || wi.maxUses === null || wi.currentUses === null) return w
          return { ...wi, currentUses: Math.min(wi.currentUses + repairValue, wi.maxUses) }
        }),
      }
    }
    case 'boostStr':
      return { ...member, str: member.str + effect.value }
    case 'boostInt':
      return { ...member, int: member.int + effect.value }
    case 'boostMaxHp':
      return { ...member, maxHp: member.maxHp + effect.value, hp: member.hp + effect.value }
    case 'boostMaxMp':
      return { ...member, maxMp: member.maxMp + effect.value, mp: member.mp + effect.value }
    default:
      return member
  }
}

/** ポーション効果の説明テキスト */
export function getPotionEffectDescription(effect: PotionEffect): string {
  switch (effect.type) {
    case 'healHp': return effect.full ? 'HPを全回復' : `HP +${effect.value}`
    case 'repairWeapons': return `武器修復 +${effect.value}`
    case 'taunt': return '挑発（1ターン）'
    case 'statBoost': return `STR+${effect.strValue} INT+${effect.intValue}（1ターン）`
    case 'damageReduction': return `被ダメ${Math.round(effect.rate * 100)}%減（1ターン）`
    case 'aoeConvert': return '次の攻撃を全体化'
    case 'boostStr': return `STR 永続+${effect.value}`
    case 'boostInt': return `INT 永続+${effect.value}`
    case 'boostMaxHp': return `最大HP 永続+${effect.value}`
    case 'boostMaxMp': return `最大MP 永続+${effect.value}`
  }
}

/** ポーションをインスタンス化（データと同一だが型変換用） */
export function createPotionInstance(potion: PotionData): PotionInstance {
  return { ...potion }
}
