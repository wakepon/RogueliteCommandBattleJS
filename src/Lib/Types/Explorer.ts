import { ExplorerWeapon, createPunch, WeaponInstance, WeaponData } from './Weapon'
import { SpellInstance, SpellData } from './Spell'
import WeaponsData from '../Data/Weapons.json'
import SpellsData from '../Data/Spells.json'
import { getTuningValue } from '../Tuning/TuningStore'

// マスターデータを型付け
const weaponsData = WeaponsData as Record<string, WeaponData>
const spellsData = SpellsData as Record<string, SpellData>

// キャラクタークラス
export type CharacterClass = 'warrior' | 'mage' | 'cleric'

// バトル中のバフ
export interface Buff {
  type: string
  value: number
  duration: number | 'battle' | 'nextAction'
}

// バトル中のデバフ
export type Debuff =
  | { type: 'poison'; stacks: number }
  | { type: 'weakness'; value: number; duration: number; justApplied?: boolean }
  | { type: 'vulnerability'; multiplier: number; duration: number; justApplied?: boolean }

// Explorer（プレイヤーキャラクター）の状態
// 前衛/後衛は party 配列順から派生（getFrontMemberId 参照）
export interface ExplorerState {
  id: string
  name: string
  characterClass: CharacterClass
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

// 武器インスタンスを生成（マスターデータから、Tuningオーバーライド付き）
export function createWeaponInstance(weaponId: string): WeaponInstance {
  const data = weaponsData[weaponId]
  if (!data) {
    throw new Error(`${weaponId} not found in weapons data`)
  }

  return {
    ...data,
    currentUses: data.maxUses === null ? null : data.maxUses,
    enhancements: [],
  } as WeaponInstance
}

// 魔法インスタンスを生成（マスターデータから）
export function createSpellInstance(spellId: string): SpellInstance {
  const data = spellsData[spellId]
  if (!data) {
    throw new Error(`${spellId} not found in spells data`)
  }
  let power = data.power
  let variance = data.variance

  // 魔力弾はTuningでオーバーライド可能
  if (spellId === 'magic_bullet') {
    power = getTuningValue('magic_bullet_power', data.power)
    variance = getTuningValue('magic_bullet_variance', data.variance)
  }

  return { ...data, power, variance, enhancements: [] }
}

// クラス別初期ステータス
interface ClassTemplate {
  name: string
  characterClass: CharacterClass
  hp: number
  mp: number
  str: number
  int: number
  weaponSlotCount: number
  magicSlotCount: number
  weapons: () => ExplorerWeapon[]
  spells: () => SpellInstance[]
}

/** Tuning対応のクラステンプレートを取得 */
function getClassTemplates(): Record<CharacterClass, ClassTemplate> {
  return {
    warrior: {
      name: '戦士',
      characterClass: 'warrior',
      hp: getTuningValue('warrior_hp', 60),
      mp: getTuningValue('warrior_mp', 5),
      str: getTuningValue('warrior_str', 7),
      int: getTuningValue('warrior_int', 3),
      weaponSlotCount: getTuningValue('warrior_weaponSlotCount', 4),
      magicSlotCount: getTuningValue('warrior_magicSlotCount', 0),
      weapons: () => [createPunch(), createWeaponInstance('rusty_knife')],
      spells: () => [],
    },
    mage: {
      name: '魔法使い',
      characterClass: 'mage',
      hp: getTuningValue('mage_hp', 30),
      mp: getTuningValue('mage_mp', 25),
      str: getTuningValue('mage_str', 3),
      int: getTuningValue('mage_int', 7),
      weaponSlotCount: getTuningValue('mage_weaponSlotCount', 0),
      magicSlotCount: getTuningValue('mage_magicSlotCount', 4),
      weapons: () => [],
      spells: () => [createSpellInstance('magic_bullet'), createSpellInstance('fire')],
    },
    cleric: {
      name: '僧侶',
      characterClass: 'cleric',
      hp: getTuningValue('cleric_hp', 40),
      mp: getTuningValue('cleric_mp', 15),
      str: getTuningValue('cleric_str', 4),
      int: getTuningValue('cleric_int', 5),
      weaponSlotCount: getTuningValue('cleric_weaponSlotCount', 1),
      magicSlotCount: getTuningValue('cleric_magicSlotCount', 3),
      weapons: () => [],
      spells: () => [createSpellInstance('prayer'), createSpellInstance('heal')],
    },
  }
}

// クラスを指定してExplorerを生成
function createExplorerByClass(characterClass: CharacterClass, index: number): ExplorerState {
  const template = getClassTemplates()[characterClass]
  return {
    id: `explorer-${index}`,
    name: template.name,
    characterClass: template.characterClass,
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

