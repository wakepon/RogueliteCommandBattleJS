import { describe, it, expect } from 'vitest'
import { calculateWeaponDamage, calculateSpellDamage } from './DamageCalculator'
import { ExplorerState } from '../Types/Explorer'
import { WeaponInstance, PunchInstance } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { EnemyInstance } from '../Types/Enemy'

// テスト用のモックデータ
function createMockExplorer(overrides: Partial<ExplorerState> = {}): ExplorerState {
  return {
    id: 'test-explorer',
    name: 'Test Explorer',
    hp: 50,
    maxHp: 50,
    mp: 20,
    maxMp: 20,
    str: 5,
    int: 5,
    agi: 5,
    level: 1,
    exp: 0,
    weapons: [],
    spells: [],
    battleBuffs: [],
    battleDebuffs: [],
    ...overrides,
  }
}

function createMockEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'slime',
    instanceId: 'slime-1',
    name: 'スライム',
    type: 'normal',
    hp: 20,
    currentHp: 20,
    attack: 3,
    agi: 2,
    gold: 1,
    behavior: 'basic_attack',
    battleBuffs: [],
    battleDebuffs: [],
    ...overrides,
  }
}

function createMockWeapon(overrides: Partial<WeaponInstance> = {}): WeaponInstance {
  return {
    id: 'test_sword',
    name: 'テスト剣',
    rarity: 'Common',
    price: 10,
    commandCategory: 'weapon',
    targetType: 'enemySingle',
    power: 5,
    maxUses: 10,
    currentUses: 10,
    ...overrides,
  }
}

function createMockPunch(): PunchInstance {
  return {
    id: 'punch',
    name: 'パンチ',
    commandCategory: 'weapon',
    targetType: 'enemySingle',
    power: 1,
    maxUses: null,
    currentUses: null,
  }
}

function createMockSpell(overrides: Partial<SpellInstance> = {}): SpellInstance {
  return {
    id: 'fire',
    name: 'ファイア',
    rarity: 'Common',
    price: 6,
    commandCategory: 'spell',
    targetType: 'enemySingle',
    mpCost: 3,
    power: 8,
    effect: null,
    ...overrides,
  }
}

describe('DamageCalculator', () => {
  describe('calculateWeaponDamage', () => {
    it('基本ダメージ計算: STR × power × ブレ補正', () => {
      const explorer = createMockExplorer({ str: 5 })
      const weapon = createMockWeapon({ power: 5 })
      const enemy = createMockEnemy()

      // ブレ補正を1.0に固定してテスト
      const result = calculateWeaponDamage(explorer, weapon, enemy, 1.0)

      // 5 × 5 × 1.0 = 25
      expect(result.damage).toBe(25)
      expect(result.isCritical).toBe(false)
    })

    it('STRが高いほどダメージが増える', () => {
      const weakExplorer = createMockExplorer({ str: 3 })
      const strongExplorer = createMockExplorer({ str: 10 })
      const weapon = createMockWeapon({ power: 5 })
      const enemy = createMockEnemy()

      const weakResult = calculateWeaponDamage(weakExplorer, weapon, enemy, 1.0)
      const strongResult = calculateWeaponDamage(strongExplorer, weapon, enemy, 1.0)

      // 3 × 5 = 15, 10 × 5 = 50
      expect(weakResult.damage).toBe(15)
      expect(strongResult.damage).toBe(50)
    })

    it('武器のpowerが高いほどダメージが増える', () => {
      const explorer = createMockExplorer({ str: 5 })
      const weakWeapon = createMockWeapon({ power: 2 })
      const strongWeapon = createMockWeapon({ power: 10 })
      const enemy = createMockEnemy()

      const weakResult = calculateWeaponDamage(explorer, weakWeapon, enemy, 1.0)
      const strongResult = calculateWeaponDamage(explorer, strongWeapon, enemy, 1.0)

      // 5 × 2 = 10, 5 × 10 = 50
      expect(weakResult.damage).toBe(10)
      expect(strongResult.damage).toBe(50)
    })

    it('パンチ（power=1）はSTR分のダメージを与える', () => {
      const explorer = createMockExplorer({ str: 5 })
      const punch = createMockPunch()
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, punch, enemy, 1.0)

      // 5 × 1 × 1.0 = 5
      expect(result.damage).toBe(5)
    })

    it('ブレ補正0.9でダメージが10%減少', () => {
      const explorer = createMockExplorer({ str: 10 })
      const weapon = createMockWeapon({ power: 10 })
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, weapon, enemy, 0.9)

      // 10 × 10 × 0.9 = 90
      expect(result.damage).toBe(90)
    })

    it('ブレ補正1.1でダメージが10%増加', () => {
      const explorer = createMockExplorer({ str: 10 })
      const weapon = createMockWeapon({ power: 10 })
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, weapon, enemy, 1.1)

      // 10 × 10 × 1.1 = 110
      expect(result.damage).toBe(110)
    })

    it('STRバフがダメージを増加させる', () => {
      const explorer = createMockExplorer({
        str: 5,
        battleBuffs: [{ type: 'str', value: 2, duration: 'battle' }],
      })
      const weapon = createMockWeapon({ power: 5 })
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, weapon, enemy, 1.0)

      // 5 × 5 × 1.2 (バフ倍率) × 1.0 = 30
      expect(result.damage).toBe(30)
    })

    it('複数のSTRバフが累積する', () => {
      const explorer = createMockExplorer({
        str: 5,
        battleBuffs: [
          { type: 'str', value: 2, duration: 'battle' },
          { type: 'str', value: 3, duration: 'battle' },
        ],
      })
      const weapon = createMockWeapon({ power: 5 })
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, weapon, enemy, 1.0)

      // 5 × 5 × 1.5 (2+3=5, 5×0.1=0.5, 1+0.5=1.5) × 1.0 = 37.5 → 37
      expect(result.damage).toBe(37)
    })

    it('INTバフは武器ダメージに影響しない', () => {
      const explorer = createMockExplorer({
        str: 5,
        battleBuffs: [{ type: 'int', value: 5, duration: 'battle' }],
      })
      const weapon = createMockWeapon({ power: 5 })
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, weapon, enemy, 1.0)

      // INTバフは無視される: 5 × 5 × 1.0 × 1.0 = 25
      expect(result.damage).toBe(25)
    })

    it('ダメージは小数点以下切り捨て', () => {
      const explorer = createMockExplorer({ str: 3 })
      const weapon = createMockWeapon({ power: 3 })
      const enemy = createMockEnemy()

      // 3 × 3 × 0.95 = 8.55 → 8
      const result = calculateWeaponDamage(explorer, weapon, enemy, 0.95)

      expect(result.damage).toBe(8)
    })

    it('ダメージは最低0', () => {
      const explorer = createMockExplorer({ str: 0 })
      const weapon = createMockWeapon({ power: 5 })
      const enemy = createMockEnemy()

      const result = calculateWeaponDamage(explorer, weapon, enemy, 1.0)

      // 0 × 5 = 0
      expect(result.damage).toBe(0)
    })
  })

  describe('calculateSpellDamage', () => {
    it('基本ダメージ計算: INT × power × ブレ補正', () => {
      const explorer = createMockExplorer({ int: 5 })
      const spell = createMockSpell({ power: 8 })
      const enemy = createMockEnemy()

      const result = calculateSpellDamage(explorer, spell, enemy, 1.0)

      // 5 × 8 × 1.0 = 40
      expect(result.damage).toBe(40)
      expect(result.isCritical).toBe(false)
    })

    it('INTが高いほどダメージが増える', () => {
      const weakExplorer = createMockExplorer({ int: 3 })
      const strongExplorer = createMockExplorer({ int: 10 })
      const spell = createMockSpell({ power: 8 })
      const enemy = createMockEnemy()

      const weakResult = calculateSpellDamage(weakExplorer, spell, enemy, 1.0)
      const strongResult = calculateSpellDamage(strongExplorer, spell, enemy, 1.0)

      // 3 × 8 = 24, 10 × 8 = 80
      expect(weakResult.damage).toBe(24)
      expect(strongResult.damage).toBe(80)
    })

    it('INTバフがダメージを増加させる', () => {
      const explorer = createMockExplorer({
        int: 5,
        battleBuffs: [{ type: 'int', value: 2, duration: 'battle' }],
      })
      const spell = createMockSpell({ power: 8 })
      const enemy = createMockEnemy()

      const result = calculateSpellDamage(explorer, spell, enemy, 1.0)

      // 5 × 8 × 1.2 (バフ倍率) × 1.0 = 48
      expect(result.damage).toBe(48)
    })

    it('STRバフは魔法ダメージに影響しない', () => {
      const explorer = createMockExplorer({
        int: 5,
        battleBuffs: [{ type: 'str', value: 5, duration: 'battle' }],
      })
      const spell = createMockSpell({ power: 8 })
      const enemy = createMockEnemy()

      const result = calculateSpellDamage(explorer, spell, enemy, 1.0)

      // STRバフは無視される: 5 × 8 × 1.0 × 1.0 = 40
      expect(result.damage).toBe(40)
    })

    it('ヒール魔法（power=0）はダメージ0', () => {
      const explorer = createMockExplorer({ int: 10 })
      const healSpell = createMockSpell({
        id: 'heal',
        name: 'ヒール',
        power: 0,
        effect: { type: 'heal', value: 15 },
      })
      const enemy = createMockEnemy()

      const result = calculateSpellDamage(explorer, healSpell, enemy, 1.0)

      // 10 × 0 = 0
      expect(result.damage).toBe(0)
    })
  })

  describe('ブレ補正の範囲', () => {
    it('ブレ補正なしの場合、ランダムな値が使われる', () => {
      const explorer = createMockExplorer({ str: 10 })
      const weapon = createMockWeapon({ power: 10 })
      const enemy = createMockEnemy()

      // 複数回実行して結果が範囲内であることを確認
      for (let i = 0; i < 100; i++) {
        const result = calculateWeaponDamage(explorer, weapon, enemy)
        // 10 × 10 × (0.9〜1.1) = 90〜110
        expect(result.damage).toBeGreaterThanOrEqual(90)
        expect(result.damage).toBeLessThanOrEqual(110)
      }
    })
  })
})
