import { ExplorerWeapon, PUNCH, WeaponInstance, WeaponData } from './Weapon'
import { SpellInstance, SpellData } from './Spell'
import WeaponsData from '../Data/Weapons.json'
import SpellsData from '../Data/Spells.json'

// マスターデータを型付け
const weaponsData = WeaponsData as Record<string, WeaponData>
const spellsData = SpellsData as Record<string, SpellData>

// キャラクタークラス
export type CharacterClass = 'warrior' | 'mage' | 'cleric'

// 前衛/後衛
export type Position = 'front' | 'back'

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
  characterClass: CharacterClass
  position: Position
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  str: number
  int: number
  level: number
  exp: number
  killCount: number              // 個別討伐数（レベルアップ判定用）
  weaponSlotCount: number        // 武器枠の上限（無限行動は含まない）
  magicSlotCount: number         // 魔法枠の上限
  weapons: ExplorerWeapon[]
  spells: SpellInstance[]
  battleBuffs: Buff[]
  battleDebuffs: Debuff[]
}

// 武器インスタンスを生成（マスターデータから）
export function createWeaponInstance(weaponId: string): WeaponInstance {
  const data = weaponsData[weaponId]
  if (!data) {
    throw new Error(`${weaponId} not found in weapons data`)
  }
  return {
    ...data,
    currentUses: data.maxUses === null ? null : data.maxUses,
  } as WeaponInstance
}

// 魔法インスタンスを生成（マスターデータから）
export function createSpellInstance(spellId: string): SpellInstance {
  const data = spellsData[spellId]
  if (!data) {
    throw new Error(`${spellId} not found in spells data`)
  }
  return { ...data }
}

// クラス別初期ステータス
interface ClassTemplate {
  name: string
  characterClass: CharacterClass
  position: Position
  hp: number
  mp: number
  str: number
  int: number
  weaponSlotCount: number
  magicSlotCount: number
  weapons: () => ExplorerWeapon[]
  spells: () => SpellInstance[]
}

const CLASS_TEMPLATES: Record<CharacterClass, ClassTemplate> = {
  warrior: {
    name: '戦士',
    characterClass: 'warrior',
    position: 'front',
    hp: 60,
    mp: 5,
    str: 7,
    int: 3,
    weaponSlotCount: 4,
    magicSlotCount: 0,
    weapons: () => [createWeaponInstance('rusty_knife'), PUNCH],
    spells: () => [],
  },
  mage: {
    name: '魔法使い',
    characterClass: 'mage',
    position: 'back',
    hp: 30,
    mp: 25,
    str: 3,
    int: 7,
    weaponSlotCount: 0,
    magicSlotCount: 4,
    weapons: () => [createWeaponInstance('magic_bullet')],
    spells: () => [createSpellInstance('fire')],
  },
  cleric: {
    name: '僧侶',
    characterClass: 'cleric',
    position: 'back',
    hp: 40,
    mp: 15,
    str: 4,
    int: 5,
    weaponSlotCount: 1,
    magicSlotCount: 3,
    weapons: () => [createWeaponInstance('prayer')],
    spells: () => [createSpellInstance('heal'), createSpellInstance('precision')],
  },
}

// クラスを指定してExplorerを生成
function createExplorerByClass(characterClass: CharacterClass, index: number): ExplorerState {
  const template = CLASS_TEMPLATES[characterClass]
  return {
    id: `explorer-${index}`,
    name: template.name,
    characterClass: template.characterClass,
    position: template.position,
    hp: template.hp,
    maxHp: template.hp,
    mp: template.mp,
    maxMp: template.mp,
    str: template.str,
    int: template.int,
    level: 1,
    exp: 0,
    killCount: 0,
    weaponSlotCount: template.weaponSlotCount,
    magicSlotCount: template.magicSlotCount,
    weapons: template.weapons(),
    spells: template.spells(),
    battleBuffs: [],
    battleDebuffs: [],
  }
}

// 初期パーティー生成（3人）
export function createInitialParty(): ExplorerState[] {
  return [
    createExplorerByClass('warrior', 1),
    createExplorerByClass('mage', 2),
    createExplorerByClass('cleric', 3),
  ]
}

// 後方互換: 単体Explorer生成（テスト等で使用）
export function createInitialExplorer(): ExplorerState {
  return createExplorerByClass('warrior', 1)
}
