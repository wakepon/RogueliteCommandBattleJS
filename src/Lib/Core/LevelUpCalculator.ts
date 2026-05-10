import { ExplorerState, CharacterClass } from '../Types/Explorer'
import { getTuningValue } from '../Tuning/TuningStore'

/** レベルアップ時の情報 */
export interface LevelUpInfo {
  explorerId: string
  previousLevel: number
  newLevel: number
  hpRecovered: number
  mpRecovered: number
  characterName: string
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
export function canLevelUp(explorer: ExplorerState): boolean {
  const required = getRequiredKillsForNextLevel(explorer.level)
  return explorer.exp >= required
}

// クラス別レベルアップ成長値（Tuning対応）
function getClassGrowth(): Record<CharacterClass, { maxHp: number; maxMp: number; str: number; int: number }> {
  return {
    warrior: {
      maxHp: getTuningValue('warrior_growth_maxHp', 7),
      maxMp: getTuningValue('warrior_growth_maxMp', 1),
      str: getTuningValue('warrior_growth_str', 2),
      int: getTuningValue('warrior_growth_int', 0),
    },
    mage: {
      maxHp: getTuningValue('mage_growth_maxHp', 3),
      maxMp: getTuningValue('mage_growth_maxMp', 4),
      str: getTuningValue('mage_growth_str', 0),
      int: getTuningValue('mage_growth_int', 2),
    },
    cleric: {
      maxHp: getTuningValue('cleric_growth_maxHp', 5),
      maxMp: getTuningValue('cleric_growth_maxMp', 3),
      str: getTuningValue('cleric_growth_str', 1),
      int: getTuningValue('cleric_growth_int', 1),
    },
  }
}

/**
 * レベルアップを1回適用
 * - level +1
 * - exp から必要分を消費
 * - クラス別の成長値でステータス増加
 * - HP/MP: 旧最大値の一定割合回復（Tuning設定、上限は新最大値）
 */
export function applyLevelUp(explorer: ExplorerState): {
  updatedExplorer: ExplorerState
  levelUpInfo: LevelUpInfo
} {
  const requiredExp = getRequiredKillsForNextLevel(explorer.level)
  const previousLevel = explorer.level
  const newLevel = previousLevel + 1

  // クラス別成長値を取得
  const growth = getClassGrowth()[explorer.characterClass]

  // 新しい最大値を計算
  const newMaxHp = explorer.maxHp + growth.maxHp
  const newMaxMp = explorer.maxMp + growth.maxMp

  const updatedExplorer: ExplorerState = {
    ...explorer,
    level: newLevel,
    exp: explorer.exp - requiredExp,
    maxHp: newMaxHp,
    maxMp: newMaxMp,
    hp: Math.min(explorer.hp + Math.ceil(explorer.maxHp * getTuningValue('levelup_hp_recovery_rate', 0.5)), newMaxHp),
    mp: Math.min(explorer.mp + Math.ceil(explorer.maxMp * getTuningValue('levelup_mp_recovery_rate', 0.5)), newMaxMp),
    str: explorer.str + growth.str,
    int: explorer.int + growth.int,
  }

  const levelUpInfo: LevelUpInfo = {
    explorerId: explorer.id,
    previousLevel,
    newLevel,
    characterName: explorer.name,
    hpRecovered: newMaxHp - explorer.hp,
    mpRecovered: newMaxMp - explorer.mp,
    statsGained: {
      maxHp: growth.maxHp,
      maxMp: growth.maxMp,
      str: growth.str,
      int: growth.int,
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
 * - 止めを刺したキャラはさらに+1（合計+2）
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

  const updatedParty = party.map(member => {
    // 全員にdefeatedCount分のEXP + 追加ボーナス
    const baseExp = defeatedCount + extraBonusToAll
    // 止めを刺したキャラにはさらに+defeatedCount + 追加キラーボーナス
    const bonusExp = member.id === killerExplorerId ? defeatedCount + extraKillerBonus : 0
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
