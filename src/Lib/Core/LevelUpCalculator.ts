import { ExplorerState, CharacterClass } from '../Types/Explorer'
import { getTuningValue } from '../Tuning/TuningStore'
import { getBalancedGrowth, applyGrowthType, applyLevelUpRecovery } from './GrowthTypeCalculator'

/** レベルアップ時の情報 */
export interface LevelUpInfo {
  explorerId: string
  previousLevel: number
  newLevel: number
  hpRecovered: number
  mpRecovered: number
  characterName: string
  characterClass: CharacterClass
  statsGained: {
    maxHp: number
    maxMp: number
    str: number
    int: number
  }
}

/**
 * 次のレベルに必要な討伐数を計算
 * 必要討伐数 = floor(3 × log2(現在のレベル + 1))
 *
 * レベル別の必要討伐数:
 * - Lv1→2: 3体
 * - Lv2→3: 5体
 * - Lv3→4: 6体
 * - Lv4→5: 7体
 */
export function getRequiredKillsForNextLevel(currentLevel: number): number {
  const coefficient = getTuningValue('levelup_formula_coefficient', 3)
  const raw = Math.floor(coefficient * Math.log2(currentLevel + 1))
  const cap = getTuningValue('levelup_required_kills_cap', 0)
  return cap > 0 ? Math.min(raw, cap) : raw
}

/**
 * レベルアップ可能か判定
 * 経験値が必要討伐数以上ならtrue
 */
function canLevelUp(explorer: ExplorerState): boolean {
  const required = getRequiredKillsForNextLevel(explorer.level)
  return explorer.exp >= required
}

/**
 * レベルアップを1回適用
 * - level +1
 * - exp から必要分を消費
 * - バランス型の成長を自動適用
 * - HP/MP回復を適用
 */
function applyLevelUp(explorer: ExplorerState): {
  updatedExplorer: ExplorerState
  levelUpInfo: LevelUpInfo
} {
  const requiredExp = getRequiredKillsForNextLevel(explorer.level)
  const previousLevel = explorer.level
  const newLevel = previousLevel + 1

  let updatedExplorer: ExplorerState = {
    ...explorer,
    level: newLevel,
    exp: explorer.exp - requiredExp,
  }

  const growth = getBalancedGrowth(explorer.characterClass)
  updatedExplorer = applyGrowthType(updatedExplorer, growth)

  const beforeRecovery = updatedExplorer
  updatedExplorer = applyLevelUpRecovery(updatedExplorer)

  const levelUpInfo: LevelUpInfo = {
    explorerId: explorer.id,
    previousLevel,
    newLevel,
    characterName: explorer.name,
    characterClass: explorer.characterClass,
    hpRecovered: updatedExplorer.hp - beforeRecovery.hp,
    mpRecovered: updatedExplorer.mp - beforeRecovery.mp,
    statsGained: {
      maxHp: growth.stats.maxHp,
      maxMp: growth.stats.maxMp,
      str: growth.stats.str,
      int: growth.stats.int,
    },
  }

  return { updatedExplorer, levelUpInfo }
}

/**
 * 経験値を加算し、レベルアップを処理（複数回レベルアップ対応）
 * killCount が必要討伐数以上ならレベルアップ
 */
export function addExpAndProcessLevelUp(
  explorer: ExplorerState,
  expGained: number
): {
  updatedExplorer: ExplorerState
  levelUps: LevelUpInfo[]
} {
  let currentExplorer = {
    ...explorer,
    exp: explorer.exp + expGained,
  }
  const levelUps: LevelUpInfo[] = []

  // レベルアップ可能な限り繰り返す
  while (canLevelUp(currentExplorer)) {
    const { updatedExplorer, levelUpInfo } = applyLevelUp(currentExplorer)
    currentExplorer = updatedExplorer
    levelUps.push(levelUpInfo)
  }

  return {
    updatedExplorer: currentExplorer,
    levelUps,
  }
}

/**
 * パーティー全体にEXPを配分し、レベルアップを処理
 *
 * ルール:
 * - 敵を倒すと全員のkillCount+1（EXP+1）
 * - 止めを刺したキャラはさらにトドメEXP分（デフォルト+1、tuningで調整可）
 * - 戦闘不能キャラにもEXPは入る（次バトルで復活するため）
 */
export function distributeExpToParty(
  party: ExplorerState[],
  killerExplorerId: string,
  defeatedCount: number,
  options?: {
    extraBonusToAll?: number        // 全員に追加EXP（教育の魔弾）
    extraKillerBonus?: number       // キラーに追加EXP（導きバフ）
  }
): {
  updatedParty: ExplorerState[]
  allLevelUps: LevelUpInfo[]
} {
  if (defeatedCount <= 0) {
    return { updatedParty: party, allLevelUps: [] }
  }

  const allLevelUps: LevelUpInfo[] = []
  const extraBonusToAll = options?.extraBonusToAll ?? 0
  const extraKillerBonus = options?.extraKillerBonus ?? 0
  // トドメEXP: 撃破1体あたりのキラーボーナス（tuningで調整可、デフォルト1）
  const finishExpBonus = getTuningValue('finish_exp_bonus', 1)

  const updatedParty = party.map(member => {
    // 全員にdefeatedCount分のEXP + 追加ボーナス
    const baseExp = defeatedCount + extraBonusToAll
    // 止めを刺したキャラにはさらにトドメEXP×撃破数 + 追加キラーボーナス
    const bonusExp = member.id === killerExplorerId ? finishExpBonus * defeatedCount + extraKillerBonus : 0
    const totalExp = baseExp + bonusExp

    const { updatedExplorer, levelUps } = addExpAndProcessLevelUp(member, totalExp)
    allLevelUps.push(...levelUps)

    return {
      ...updatedExplorer,
      killCount: updatedExplorer.killCount + totalExp,
    }
  })

  return { updatedParty, allLevelUps }
}
