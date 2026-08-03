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
  totalBrokenWeaponCount?: number  // 破片の大剣: ラン中に耐久0になった累計回数
}

/** ダメージのブレ幅（±baseDamage×ratio）をランダムに算出する */
function generateVarianceOffset(baseDamage: number, ratio: number): number {
  if (ratio <= 0 || baseDamage <= 0) return 0
  const range = Math.round(baseDamage * ratio)
  if (range <= 0) return 0
  return Math.floor(Math.random() * (2 * range + 1)) - range
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
    totalBrokenWeaponCount = 0,
  } = options
  const contributors: DamageContributor[] = []

  const hasPrecision = attacker.battleBuffs.some(b => b.type === 'precision')
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

  // 連携の紋章: 同ターン連携時のステータスボーナス
  const comboBuff = attacker.battleBuffs.find(b => b.type === 'comboStatBonus')
  const comboStatBonus = comboBuff ? comboBuff.value : 0
  if (comboStatBonus > 0) {
    contributors.push({ name: '連携の紋章', label: `${scaleStat === 'str' ? 'STR' : 'INT'}+${comboStatBonus}` })
  }

  const baseStat = scaleStat === 'int' ? attacker.int : attacker.str
  const effectiveStat = baseStat + positionBonus + brokenBonus + comboStatBonus

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

  // 復讐ダメージ (旧仕様・スケーリング型: 互換のため残置)
  if ('effect' in weapon && weapon.effect?.type === 'revengeDamage') {
    const bonusPower = Math.floor(attacker.damageTakenLastTurn * weapon.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 復讐(フラット型) (復讐の大剣): 前ターンにダメージを受けていたらPower+powerBonus
  if ('effect' in weapon && weapon.effect?.type === 'revengeFlat') {
    if (attacker.damageTakenLastTurn > 0) {
      const bonusPower = weapon.effect.powerBonus
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // HP割合しきい値 (怒りの大剣: HP以下 / 余裕のナイフ: HP以上) でPower+powerBonus
  if ('effect' in weapon && weapon.effect?.type === 'hpThresholdBonus') {
    const hpRatio = attacker.hp / attacker.maxHp
    const meetsCondition = weapon.effect.when === 'below'
      ? hpRatio <= weapon.effect.thresholdRate
      : hpRatio >= weapon.effect.thresholdRate
    if (meetsCondition) {
      const bonusPower = weapon.effect.powerBonus
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 先行味方攻撃しきい値 (追撃のナイフ): requiredCount回以上でPower+powerBonus
  if ('effect' in weapon && weapon.effect?.type === 'allyFollowUpBonus') {
    const allyAttacks = countAllyAttacksThisTurn(commandSlots, currentCommandIndex)
    if (allyAttacks >= weapon.effect.requiredCount) {
      const bonusPower = weapon.effect.powerBonus
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveStat * bonusPower * buffMultiplier)
      contributors.push({ name: weapon.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 破壊回数参照 (破片の大剣): ラン中に耐久0になった回数をPower加算
  if ('effect' in weapon && weapon.effect?.type === 'breakCountBonus') {
    if (totalBrokenWeaponCount > 0) {
      conditionalPowerBonus += totalBrokenWeaponCount
      const dmgContribution = Math.floor(effectiveStat * totalBrokenWeaponCount * buffMultiplier)
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

  // ダメージのブレ（baseDamage×variance比率）。精密時は最大ロール確定。
  const base = Math.floor(rawDamage)
  const offset = varianceOffset
    ?? (hasPrecision ? Math.round(base * weapon.variance) : generateVarianceOffset(base, weapon.variance))
  const damage = base + offset + shieldBashBonus

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

  // 連携の紋章: 同ターン連携時のステータスボーナス
  const comboBuff = attacker.battleBuffs.find(b => b.type === 'comboStatBonus')
  const comboStatBonus = comboBuff ? comboBuff.value : 0
  if (comboStatBonus > 0) {
    contributors.push({ name: '連携の紋章', label: `INT+${comboStatBonus}` })
  }

  const effectiveInt = attacker.int + positionBonus + comboStatBonus

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

  // 復讐ダメージ (旧仕様・スケーリング型: 互換のため残置)
  if (spell.effect?.type === 'revengeDamage') {
    const bonusPower = Math.floor(attacker.damageTakenLastTurn * spell.effect.coefficient)
    if (bonusPower > 0) {
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveInt * bonusPower * buffMultiplier)
      contributors.push({ name: spell.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 復讐(フラット型) (復讐の氷弾): 前ターンにダメージを受けていたらPower+powerBonus
  if (spell.effect?.type === 'revengeFlat') {
    if (attacker.damageTakenLastTurn > 0) {
      const bonusPower = spell.effect.powerBonus
      conditionalPowerBonus += bonusPower
      const dmgContribution = Math.floor(effectiveInt * bonusPower * buffMultiplier)
      contributors.push({ name: spell.name, label: `ダメージ+${dmgContribution}` })
    }
  }

  // 先行味方攻撃しきい値 (追撃の炎): requiredCount回以上でPower+powerBonus
  if (spell.effect?.type === 'allyFollowUpBonus') {
    const allyAttacks = countAllyAttacksThisTurn(commandSlots, currentCommandIndex)
    if (allyAttacks >= spell.effect.requiredCount) {
      const bonusPower = spell.effect.powerBonus
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

  // 弱体デバフ
  const spellWeakness = attacker.battleDebuffs.find(d => d.type === 'weakness')
  if (spellWeakness && spellWeakness.type === 'weakness') {
    rawDamage *= (1.0 - spellWeakness.value)
    contributors.push({ name: '攻撃ダウン', label: `×${(1.0 - spellWeakness.value).toFixed(2)}` })
  }

  // ダメージのブレ（baseDamage×variance比率）。精密時は最大ロール確定。
  const base = Math.floor(rawDamage)
  const offset = varianceOffset
    ?? (hasPrecision ? Math.round(base * spell.variance) : generateVarianceOffset(base, spell.variance))
  const damage = base + offset

  return {
    damage: Math.max(0, damage),
    isCritical: false,
    contributors,
  }
}
