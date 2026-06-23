import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { EnemyInstance } from '../Types/Enemy'
import { RelicInstance } from '../Types/Relic'
import { CommandSlot, DamageContributor } from '../Types/Battle'
import { getTuningValue } from '../Tuning/TuningStore'
import {
  getVulnerabilityPowerBoost,
  getBrokenWeaponStrBonus,
  getPositionStatBonus,
} from './RelicProcessor'

export type { DamageContributor }

export interface DamageResult {
  damage: number
  isCritical: boolean
  contributors: DamageContributor[]
}

/** ダメージ計算のオプション */
interface DamageOptions {
  varianceOffset?: number
  relics?: RelicInstance[]
  party?: ExplorerState[]
  explorerIndex?: number
  brokenWeaponCount?: number
  commandSlots?: CommandSlot[]
  currentCommandIndex?: number
  hasHpCostPowerBoost?: boolean
  hpCostPowerBoostValue?: number
}

function generateVarianceOffset(variance: number): number {
  if (variance <= 0) return 0
  return Math.floor(Math.random() * (2 * variance + 1)) - variance
}

function calculateBuffMultiplier(buffs: Buff[], stat: 'str' | 'int'): number {
  const statBuffs = buffs.filter(buff => buff.type === stat)
  const totalValue = statBuffs.reduce((sum, buff) => sum + buff.value, 0)
  return 1.0 + (totalValue * getTuningValue('buff_multiplier_per_point', 0.1))
}

/** 同ターンの先行スロットで味方が攻撃した回数をカウント */
function countAllyAttacksThisTurn(commandSlots?: CommandSlot[], currentCommandIndex?: number): number {
  if (!commandSlots || currentCommandIndex === undefined || currentCommandIndex <= 0) return 0
  let count = 0
  for (let i = 0; i < currentCommandIndex; i++) {
    const slot = commandSlots[i]
    if (slot.command && slot.targetId) {
      const cmd = slot.command
      if ('commandCategory' in cmd) {
        const cat = (cmd as { commandCategory: string }).commandCategory
        const targetType = (cmd as { targetType: string }).targetType
        if ((cat === 'weapon' || cat === 'spell') && targetType.startsWith('enemy')) {
          count++
        }
      }
    }
  }
  return count
}

/**
 * 武器ダメージを計算する
 */
export function calculateWeaponDamage(
  attacker: ExplorerState,
  weapon: ExplorerWeapon,
  target: EnemyInstance,
  options: DamageOptions = {}
): DamageResult {
  const {
    varianceOffset, relics = [], party, explorerIndex,
    brokenWeaponCount = 0, commandSlots, currentCommandIndex,
    hasHpCostPowerBoost = false, hpCostPowerBoostValue = 0,
  } = options
  const contributors: DamageContributor[] = []

  const hasPrecision = attacker.battleBuffs.some(b => b.type === 'precision')
  const offset = varianceOffset ?? (hasPrecision ? weapon.variance : generateVarianceOffset(weapon.variance))
  if (hasPrecision) {
    contributors.push({ name: '精密', label: '（確定）' })
  }

  const scaleStat = ('scaleStat' in weapon && weapon.scaleStat === 'int') ? 'int' : 'str'
  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, scaleStat)

  // ポジションボーナス
  let positionBonus = 0
  if (explorerIndex !== undefined && party) {
    const posBonus = getPositionStatBonus(relics, explorerIndex, party.length)
    positionBonus = scaleStat === 'str' ? posBonus.strBonus : posBonus.intBonus
    if (positionBonus > 0) {
      const label = explorerIndex === 0 ? '前衛の矜持' : '後衛の底力'
      contributors.push({ name: label, label: `+${positionBonus}` })
    }
  }

  // 努力の証: 壊れた武器STRボーナス
  let brokenBonus = 0
  if (brokenWeaponCount > 0 && scaleStat === 'str') {
    const strPerWeapon = getBrokenWeaponStrBonus(relics)
    brokenBonus = Math.floor(brokenWeaponCount * strPerWeapon)
    if (brokenBonus > 0) {
      contributors.push({ name: '努力の証', label: `STR+${brokenBonus}` })
    }
  }

  const baseStat = scaleStat === 'int' ? attacker.int : attacker.str
  const effectiveStat = baseStat + positionBonus + brokenBonus

  // 条件付きPowerボーナス計算
  let conditionalPowerBonus = 0

  // 自身HP参照 (怒りの大剣): 失ったHP割合×係数
  if ('effect' in weapon && weapon.effect?.type === 'selfHpConditional') {
    const lostHpRatio = 1 - attacker.hp / attacker.maxHp
    const bonusPower = Math.floor(lostHpRatio * weapon.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // ターゲットHP参照 (処刑の大剣): 敵が失ったHP割合×係数
  if ('effect' in weapon && weapon.effect?.type === 'targetHpConditional') {
    const lostHpRatio = 1 - target.currentHp / target.hp
    const bonusPower = Math.floor(lostHpRatio * weapon.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 追撃回数参照 (追撃のナイフ): 先行攻撃回数×係数
  if ('effect' in weapon && weapon.effect?.type === 'followUp') {
    const allyAttacks = countAllyAttacksThisTurn(commandSlots, currentCommandIndex)
    const bonusPower = allyAttacks * weapon.effect.coefficient
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // レベルスケール (成長のナイフ)
  if ('effect' in weapon && weapon.effect?.type === 'levelScale') {
    const levelBonus = attacker.level
    conditionalPowerBonus += levelBonus
    const dmgContribution = Math.floor(effectiveStat * levelBonus * buffMultiplier)
    contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
  }

  // 復讐ダメージ (復讐の大剣)
  if ('effect' in weapon && weapon.effect?.type === 'revengeDamage') {
    const bonusPower = Math.floor(attacker.damageTakenLastTurn * weapon.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 武器強化バフ
  const weaponPowerBonusValue = attacker.battleBuffs
    .filter(b => b.type === 'weaponPowerBonus')
    .reduce((sum, b) => sum + b.value, 0)
  if (weaponPowerBonusValue > 0) {
    contributors.push({ name: '武器強化', label: `+${weaponPowerBonusValue}` })
  }

  // バフ倍率の寄与者
  if (buffMultiplier > 1.0) {
    const statLabel = scaleStat === 'str' ? 'STR' : 'INT'
    contributors.push({ name: `${statLabel}バフ`, label: `×${buffMultiplier.toFixed(1)}` })
  }

  const effectivePower = weapon.power + conditionalPowerBonus + weaponPowerBonusValue
  let rawDamage = effectiveStat * effectivePower * buffMultiplier

  // 修羅の血脈: HP消費時のPowerブースト
  if (hasHpCostPowerBoost && hpCostPowerBoostValue > 0) {
    rawDamage += effectiveStat * hpCostPowerBoostValue * buffMultiplier
    contributors.push({ name: '修羅の血脈', label: `+${hpCostPowerBoostValue}` })
  }

  // 逆境の鎧: 被ダメ増加状態中のPowerボーナス
  const hasVulnerability = attacker.battleDebuffs.some(d => d.type === 'vulnerability')
  if (hasVulnerability) {
    const vulnBonus = getVulnerabilityPowerBoost(relics)
    if (vulnBonus > 0) {
      rawDamage += effectiveStat * vulnBonus * buffMultiplier
      contributors.push({ name: '逆境の鎧', label: `+${vulnBonus}` })
    }
  }

  // 連携の紋章バフ
  const comboBuff = attacker.battleBuffs.find(b => b.type === 'comboPowerBonus')
  if (comboBuff) {
    rawDamage += effectiveStat * comboBuff.value * buffMultiplier
    contributors.push({ name: '連携の紋章', label: `+${comboBuff.value}` })
  }

  // シールドバッシュ
  let shieldBashBonus = 0
  if ('effect' in weapon && weapon.effect?.type === 'shieldBash') {
    const shieldBuff = attacker.battleBuffs.find(b => b.type === 'shield')
    if (shieldBuff) {
      shieldBashBonus = shieldBuff.value
      contributors.push({ name: '盾殴り', label: `+${shieldBashBonus}` })
    }
  }

  // 弱体デバフ
  const weaknessDebuff = attacker.battleDebuffs.find(d => d.type === 'weakness')
  if (weaknessDebuff && weaknessDebuff.type === 'weakness') {
    rawDamage *= (1.0 - weaknessDebuff.value)
    contributors.push({ name: '攻撃ダウン', label: `×${(1.0 - weaknessDebuff.value).toFixed(2)}` })
  }

  const damage = Math.floor(rawDamage) + offset + shieldBashBonus

  return {
    damage: Math.max(0, damage),
    isCritical: false,
    contributors,
  }
}

/**
 * 魔法ダメージを計算する
 */
export function calculateSpellDamage(
  attacker: ExplorerState,
  spell: SpellInstance,
  target: EnemyInstance,
  options: DamageOptions = {}
): DamageResult {
  const {
    varianceOffset, relics = [], party, explorerIndex,
    commandSlots, currentCommandIndex,
    hasHpCostPowerBoost = false, hpCostPowerBoostValue = 0,
  } = options
  const contributors: DamageContributor[] = []

  const hasPrecision = attacker.battleBuffs.some(b => b.type === 'precision')
  const offset = varianceOffset ?? (hasPrecision ? spell.variance : generateVarianceOffset(spell.variance))
  if (hasPrecision) {
    contributors.push({ name: '精密', label: '（確定）' })
  }

  const buffMultiplier = calculateBuffMultiplier(attacker.battleBuffs, 'int')

  // ポジションボーナス
  let positionBonus = 0
  if (explorerIndex !== undefined && party) {
    const posBonus = getPositionStatBonus(relics, explorerIndex, party.length)
    positionBonus = posBonus.intBonus
    if (positionBonus > 0) {
      const label = explorerIndex === 0 ? '前衛の矜持' : '後衛の底力'
      contributors.push({ name: label, label: `INT+${positionBonus}` })
    }
  }

  const effectiveInt = attacker.int + positionBonus

  // バフ倍率の寄与者
  if (buffMultiplier > 1.0) {
    contributors.push({ name: 'INTバフ', label: `×${buffMultiplier.toFixed(1)}` })
  }

  // 条件付きPowerボーナス計算
  let conditionalPowerBonus = 0

  // ターゲットHP参照 (処刑の雷): 敵が失ったHP割合×係数
  if (spell.effect?.type === 'targetHpConditional') {
    const lostHpRatio = 1 - target.currentHp / target.hp
    const bonusPower = Math.floor(lostHpRatio * spell.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveInt * bonusPower * buffMultiplier)
      contributors.push({ name: spell.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 追撃回数参照 (追撃の炎): 先行攻撃回数×係数
  if (spell.effect?.type === 'followUp') {
    const allyAttacks = countAllyAttacksThisTurn(commandSlots, currentCommandIndex)
    const bonusPower = allyAttacks * spell.effect.coefficient
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveInt * bonusPower * buffMultiplier)
      contributors.push({ name: spell.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 消費MP参照 (渇きの火): 消費済みMP割合×係数
  if (spell.effect?.type === 'lowMpConditional') {
    const usedMpRatio = 1 - attacker.mp / attacker.maxMp
    const bonusPower = Math.floor(usedMpRatio * spell.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveInt * bonusPower * buffMultiplier)
      contributors.push({ name: spell.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 復讐ダメージ (復讐の氷弾)
  if (spell.effect?.type === 'revengeDamage') {
    const bonusPower = Math.floor(attacker.damageTakenLastTurn * spell.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveInt * bonusPower * buffMultiplier)
      contributors.push({ name: spell.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  const effectivePower = spell.power + conditionalPowerBonus
  let rawDamage = effectiveInt * effectivePower * buffMultiplier

  // 修羅の血脈: HP消費時のPowerブースト
  if (hasHpCostPowerBoost && hpCostPowerBoostValue > 0) {
    rawDamage += effectiveInt * hpCostPowerBoostValue * buffMultiplier
    contributors.push({ name: '修羅の血脈', label: `+${hpCostPowerBoostValue}` })
  }

  // 逆境の鎧
  const hasVulnerability = attacker.battleDebuffs.some(d => d.type === 'vulnerability')
  if (hasVulnerability) {
    const vulnBonus = getVulnerabilityPowerBoost(relics)
    if (vulnBonus > 0) {
      rawDamage += effectiveInt * vulnBonus * buffMultiplier
      contributors.push({ name: '逆境の鎧', label: `+${vulnBonus}` })
    }
  }

  // 連携の紋章バフ
  const comboBuff = attacker.battleBuffs.find(b => b.type === 'comboPowerBonus')
  if (comboBuff) {
    rawDamage += effectiveInt * comboBuff.value * buffMultiplier
    contributors.push({ name: '連携の紋章', label: `+${comboBuff.value}` })
  }

  // 弱体デバフ
  const spellWeakness = attacker.battleDebuffs.find(d => d.type === 'weakness')
  if (spellWeakness && spellWeakness.type === 'weakness') {
    rawDamage *= (1.0 - spellWeakness.value)
    contributors.push({ name: '攻撃ダウン', label: `×${(1.0 - spellWeakness.value).toFixed(2)}` })
  }

  const damage = Math.floor(rawDamage) + offset

  return {
    damage: Math.max(0, damage),
    isCritical: false,
    contributors,
  }
}
