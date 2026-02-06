// バトル中のバフ
export interface Buff {
  type: string
  value: number
  duration: number | 'battle' | 'nextAction'
}

// バトル中のデバフ
export interface Debuff {
  type: 'poison'
  stacks: number
}

// Explorer（プレイヤーキャラクター）の状態
export interface ExplorerState {
  id: string
  name: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  str: number
  int: number
  agi: number
  level: number
  exp: number
  weapons: string[]  // TODO: Slice 2でExplorerWeapon[]に変更
  spells: string[]   // TODO: Slice 3でSpellInstance[]に変更
  battleBuffs: Buff[]
  battleDebuffs: Debuff[]
}

// 初期Explorer生成
export function createInitialExplorer(): ExplorerState {
  return {
    id: 'explorer-1',
    name: 'Explorer',
    hp: 50,
    maxHp: 50,
    mp: 20,
    maxMp: 20,
    str: 5,
    int: 5,
    agi: 5,
    level: 1,
    exp: 0,
    weapons: ['punch'],  // パンチは常に持っている
    spells: [],
    battleBuffs: [],
    battleDebuffs: [],
  }
}
