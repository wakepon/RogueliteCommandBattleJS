/** レアリティ */
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Unique'

/** アイテム基本情報 */
export interface IItem {
  id: string
  name: string
  rarity: Rarity
}
