import { GameState } from '../Types/Game'
import { RunState } from '../Types/Run'
import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { BattleCommand, BattleState, ExpPopup, PlayerDamagePopup, DamagePopup } from '../Types/Battle'
import type { DamageContributor } from '../Core/DamageCalculator'
import { SpellInstance } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { battleReducer, BattleAction, createPlayerDamagePopup, createExpPopup, createDamagePopup } from './BattleReducer'
import {
  applyDefenseReduction,
  applyChargeToEnemy,
  consumeChargeFromEnemy,
  applyChargeToAllAllies,
  applySelfDefenseBuff,
  applyHealSelf,
  applyHealAlly,
  applySummonEnemy,
  applyShieldToEnemySelf,
  applyShieldToEnemyAlly,
  applyGuardToEnemy,
  processEnemyShieldDamageReduction,
} from './EnemyEffectProcessor'
import { isSpell, isWeapon, isWeaponInstance } from '../Core/CommandValidator'
import { getEffectiveMpCost, isFullMpCost } from '../Core/MpCostCalculator'
import { getTuningValue } from '../Tuning/TuningStore'
import { calculateWeaponDamage, calculateSpellDamage } from '../Core/DamageCalculator'
import { consumeNextActionBuffs } from '../Core/BuffProcessor'
import { distributeExpToParty, LevelUpInfo } from '../Core/LevelUpCalculator'
import {
  getWeaponDurabilitySaveChance,
  getRegenPerTurn,
  getDamageTakenToMpValue,
  getLevelUpStatBoost,
  hasDeathProtection,
  getThornsStackBonus,
  getComboAttackBonus,
  getHpCostPowerBoost,
  getKillMpRecover,
  getKnifeUseDurabilityRestore,
  getBrokenWeaponStrBonus,
  getMpSpendShield,
} from '../Core/RelicProcessor'
import { processShieldDamageReduction, applyVulnerabilityMultiplier } from '../Core/BuffProcessor'

/** RunStateのpartyを更新 */
function updatePartyMember(run: RunState, updatedExplorer: ExplorerState): RunState {
  return {
    ...run,
    party: run.party.map(e =>
      e.id === updatedExplorer.id ? updatedExplorer : e
    ),
  }
}

/** 敵討伐数をカウント（今回倒した敵の数） */
function countDefeatedEnemies(
  previousEnemies: BattleState['enemies'],
  currentEnemies: BattleState['enemies']
): number {
  return currentEnemies.filter((enemy, index) => {
    const previousEnemy = previousEnemies[index]
    return enemy.currentHp <= 0 && previousEnemy && previousEnemy.currentHp > 0
  }).length
}

/** 今回撃破された敵（instanceId配列）を取得 */
function getDefeatedEnemyIds(
  previousEnemies: BattleState['enemies'],
  currentEnemies: BattleState['enemies']
): string[] {
  return currentEnemies
    .filter((enemy, index) => {
      const previousEnemy = previousEnemies[index]
      return enemy.currentHp <= 0 && previousEnemy && previousEnemy.currentHp > 0
    })
    .map(enemy => enemy.instanceId)
}

/**
 * 撃破された敵ごとに、経験値獲得エフェクト用のポップアップ群を生成する
 * - 基本EXP: 撃破敵 × 全メンバー分、delay=0 で発射
 * - トドメボーナス: 撃破敵 × トドメを刺したメンバー分、delay=EXP_BONUS_DELAY_MS
 * - 将来のレリックボーナスはこの関数で追加予定（拡張ポイント）
 */
const EXP_BONUS_DELAY_MS = 500   // 基本EXP発射からトドメボーナス発射までの遅延
function buildExpPopupsForDefeats(
  defeatedEnemyIds: string[],
  party: ExplorerState[],
  killerExplorerId: string,
  options?: {
    extraBonusToAll?: number    // 教育の魔弾などで全員に追加付与されるEXP
    extraKillerBonus?: number   // 導きバフなどでキラーに追加付与されるEXP
  }
): ExpPopup[] {
  if (defeatedEnemyIds.length === 0) return []

  const popups: ExpPopup[] = []

  // 基本EXP: 敵 × 全メンバー
  for (const enemyId of defeatedEnemyIds) {
    for (const member of party) {
      popups.push(createExpPopup(enemyId, member.id, 1, 0))
    }
  }

  // トドメボーナス: 敵 × トドメを刺したメンバー（基本EXP発射から0.5s後）
  for (const enemyId of defeatedEnemyIds) {
    popups.push(createExpPopup(enemyId, killerExplorerId, 1, EXP_BONUS_DELAY_MS, 'とどめボーナス'))
  }

  // 教育の魔弾ボーナス: 敵 × 全メンバー（とどめボーナスからさらに0.5s後）
  if (options?.extraBonusToAll && options.extraBonusToAll > 0) {
    for (const enemyId of defeatedEnemyIds) {
      for (const member of party) {
        popups.push(createExpPopup(enemyId, member.id, options.extraBonusToAll, EXP_BONUS_DELAY_MS * 2, '魔弾ボーナス'))
      }
    }
  }

  // 導きバフボーナス: 敵 × キラーのみ（同上の遅延）
  if (options?.extraKillerBonus && options.extraKillerBonus > 0) {
    for (const enemyId of defeatedEnemyIds) {
      popups.push(createExpPopup(enemyId, killerExplorerId, options.extraKillerBonus, EXP_BONUS_DELAY_MS * 2, '導き'))
    }
  }

  return popups
}

/**
 * 身代わりの人形: 致死ダメージを受けた生存メンバーをHP1で復活させ、レリックを消滅させる。
 * AoEで複数致死の場合は全員を復活させる（レリック消滅は1回のみ）。
 * 復活時に毒デバフも解除（復活直後に再死亡するのを防ぐ）。
 * battleState にレリック名ラベル付きポップアップを追加する。
 */
function applyDeathProtection(
  run: RunState,
  battleState: BattleState,
  beforeParty: ExplorerState[]
): { run: RunState; battleState: BattleState } {
  if (!hasDeathProtection(run.relics)) return { run, battleState }

  const beforeHpById = new Map(beforeParty.map(p => [p.id, p.hp]))
  const downedMembers = run.party.filter(
    m => m.hp <= 0 && (beforeHpById.get(m.id) ?? 0) > 0
  )
  if (downedMembers.length === 0) return { run, battleState }

  const relic = run.relics.find(r => r.passiveEffect.type === 'deathProtection')
  const label = relic?.name ?? '身代わりの人形'

  let updatedRun = run
  const popups = [...battleState.playerDamagePopups]
  for (const m of downedMembers) {
    // HP1で復活 + 毒デバフ解除（復活直後の即死ループ防止）
    updatedRun = updatePartyMember(updatedRun, {
      ...m,
      hp: 1,
      battleDebuffs: m.battleDebuffs.filter(d => d.type !== 'poison'),
    })
    popups.push(createPlayerDamagePopup(0, m.id, label))
  }
  return {
    run: {
      ...updatedRun,
      relics: updatedRun.relics.filter(r => r.passiveEffect.type !== 'deathProtection'),
    },
    battleState: { ...battleState, playerDamagePopups: popups },
  }
}

/**
 * 闘気の腕輪: レベルアップしたキャラにSTR/INT永続加算
 * 戦闘中レベルアップ発生時に呼ぶ。
 */
function applyLevelUpStatBoost(
  run: RunState,
  levelUps: LevelUpInfo[],
  relics: RelicInstance[]
): RunState {
  if (levelUps.length === 0) return run
  const boost = getLevelUpStatBoost(relics)
  if (!boost) return run

  // 同じキャラが複数回レベルアップしてもレベルアップ回数分加算
  const levelUpCounts = new Map<string, number>()
  for (const lu of levelUps) {
    levelUpCounts.set(lu.explorerId, (levelUpCounts.get(lu.explorerId) ?? 0) + 1)
  }

  let updatedRun = run
  for (const [explorerId, count] of levelUpCounts) {
    const member = updatedRun.party.find(e => e.id === explorerId)
    if (!member) continue
    const updatedMember: ExplorerState = {
      ...member,
      str: member.str + boost.strBonus * count,
      int: member.int + boost.intBonus * count,
    }
    updatedRun = updatePartyMember(updatedRun, updatedMember)
  }
  return updatedRun
}

/**
 * 導きバフを消費して追加キラーボーナスEXPを返す（攻撃者から'guidance'バフを除去）
 *
 * 設計: 複数付与時は1回の撃破で1個ずつ消費する（findIndexで最初の1つのみ除去）。
 */
function consumeGuidanceBuff(
  explorer: ExplorerState
): { updatedExplorer: ExplorerState; extraKillerBonus: number } {
  const guidanceIndex = explorer.battleBuffs.findIndex(b => b.type === 'guidance')
  if (guidanceIndex < 0) {
    return { updatedExplorer: explorer, extraKillerBonus: 0 }
  }
  const extraKillerBonus = explorer.battleBuffs[guidanceIndex].value
  const updatedExplorer: ExplorerState = {
    ...explorer,
    battleBuffs: explorer.battleBuffs.filter((_, i) => i !== guidanceIndex),
  }
  return { updatedExplorer, extraKillerBonus }
}

/** 武器の使用回数を減らす（レリック効果考慮） */
function consumeWeaponUse(
  weapon: ExplorerWeapon,
  durabilitySaveChance: number
): ExplorerWeapon {
  if (weapon.currentUses === null) {
    return weapon
  }

  // 武器お手入れ用油: 確率で耐久を温存
  if (durabilitySaveChance > 0 && Math.random() < durabilitySaveChance) {
    return weapon
  }

  return {
    ...weapon,
    currentUses: weapon.currentUses - 1,
  } as WeaponInstance
}

/** ExplorerStateのMP/武器使用回数を消費 */
function consumeCommandCost(
  explorer: ExplorerState,
  command: BattleCommand,
  durabilitySaveChance: number,
  weaponIndex?: number
): ExplorerState {
  if (isWeapon(command)) {
    // weaponIndexが指定されていればそのインデックスの武器を消費（同ID武器の区別）
    // 指定がなければidで最初にマッチしたものを消費（後方互換）
    const targetIndex = weaponIndex !== undefined
      ? weaponIndex
      : explorer.weapons.findIndex(w => w.id === command.id)
    const updatedWeapons = explorer.weapons.map((w, i) => {
      if (i === targetIndex) {
        return consumeWeaponUse(w, durabilitySaveChance)
      }
      return w
    })

    // hpCost消費（呪いの槍など）- HP最低1を保証、自傷ダメージを復讐用に記録
    // 戦場の鍛冶用に「最後に使用した武器」のインデックスを記録（耐久のある武器のみ。パンチ等の無限武器は無視）
    const recordLastUsed = targetIndex >= 0 && command.maxUses !== null
    let updatedExplorer: ExplorerState = {
      ...explorer,
      weapons: updatedWeapons,
      lastUsedWeaponIndex: recordLastUsed ? targetIndex : explorer.lastUsedWeaponIndex,
    }
    if (isWeaponInstance(command) && command.hpCost !== undefined) {
      const newHp = Math.max(1, updatedExplorer.hp - command.hpCost)
      const actualHpLoss = updatedExplorer.hp - newHp
      updatedExplorer = {
        ...updatedExplorer,
        hp: newHp,
        damageTakenThisTurn: updatedExplorer.damageTakenThisTurn + actualHpLoss,
      }
    }

    return updatedExplorer
  }

  if (isSpell(command)) {
    // 全MP消費型は倍率対象外で現在MPを全消費。それ以外は全体倍率を適用した実効コスト
    const mpToConsume = isFullMpCost(command)
      ? explorer.mp
      : getEffectiveMpCost(command, explorer.maxMp)
    let updatedExplorer: ExplorerState = { ...explorer, mp: Math.max(0, explorer.mp - mpToConsume) }
    // hpCost消費（反動魔法など）- HP最低1を保証、自傷ダメージを復讐用に記録
    if (command.hpCost !== undefined && command.hpCost > 0) {
      const newHp = Math.max(1, updatedExplorer.hp - command.hpCost)
      const actualHpLoss = updatedExplorer.hp - newHp
      updatedExplorer = {
        ...updatedExplorer,
        hp: newHp,
        damageTakenThisTurn: updatedExplorer.damageTakenThisTurn + actualHpLoss,
      }
    }
    return updatedExplorer
  }

  return explorer
}

/** 魔力の残滓: MP消費量が閾値以上ならシールドバフを付与 */
function applyMpSpendShield(explorer: ExplorerState, mpSpent: number, relics: RelicInstance[]): ExplorerState {
  const mpShield = getMpSpendShield(relics)
  if (!mpShield || mpSpent < mpShield.mpThreshold) return explorer
  const existingShield = explorer.battleBuffs.find(b => b.type === 'shield')
  if (existingShield) {
    return {
      ...explorer,
      battleBuffs: explorer.battleBuffs.map(b =>
        b === existingShield ? { ...b, value: b.value + mpShield.shieldValue } : b
      ),
    }
  }
  return {
    ...explorer,
    battleBuffs: [...explorer.battleBuffs, { type: 'shield' as const, value: mpShield.shieldValue, duration: 'battle' as const }],
  }
}

/** 撃破発生時のEXPポップアップをバトルステートに追加 */
function addExpPopupsToBattle(
  battleState: BattleState,
  defeatedEnemyIds: string[],
  party: ExplorerState[],
  killerExplorerId: string,
  options?: { extraBonusToAll?: number; extraKillerBonus?: number }
): BattleState {
  const popups = buildExpPopupsForDefeats(defeatedEnemyIds, party, killerExplorerId, options)
  if (popups.length === 0) return battleState
  return battleReducer(battleState, { type: 'ADD_EXP_POPUPS', expPopups: popups })
}

/** レベルアップポップアップをバトルステートに追加（全件キューイング） */
function addLevelUpPopupsToBattle(
  battleState: BattleState,
  levelUps: LevelUpInfo[]
): BattleState {
  if (levelUps.length === 0) {
    return battleState
  }
  let result = battleState
  for (const levelUp of levelUps) {
    result = battleReducer(result, {
      type: 'ADD_LEVEL_UP_POPUP',
      levelUpInfo: levelUp,
    })
  }
  return result
}


/** 攻撃コマンド（武器/魔法）を実行 */
function executeAttackCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand, selectedTargetId } = state.battleState
  if (!selectedCommand || !selectedTargetId) return state

  // 全体化バフ: 単体攻撃を全体攻撃に変換（nextActionで消費）
  const hasAoeConvert = battleAction.explorer.battleBuffs.some(b => b.type === 'aoeConvert')

  // enemyAll武器 or 全体化バフ付き単体武器: 全敵にダメージ
  if (isWeapon(selectedCommand) && isWeaponInstance(selectedCommand) &&
      (selectedCommand.targetType === 'enemyAll' || (hasAoeConvert && selectedCommand.targetType === 'enemySingle'))) {
    return executeEnemyAllAttack(state, battleAction, relics, selectedCommand)
  }

  // enemyAll魔法 or 全体化バフ付き単体魔法: 全敵にダメージ
  if (isSpell(selectedCommand) &&
      (selectedCommand.targetType === 'enemyAll' || (hasAoeConvert && selectedCommand.targetType === 'enemySingle'))) {
    return executeSpellAllAttack(state, battleAction, relics, selectedCommand)
  }

  const isWeaponAttack = isWeapon(selectedCommand)

  // 庇うリダイレクト: guardバフを持つ生存敵がいれば、単体攻撃のターゲットをそちらに変更
  let finalTargetId = selectedTargetId
  const guardEnemy = state.battleState.enemies.find(
    e => e.currentHp > 0 && e.battleBuffs.some(b => b.type === 'guard')
  )
  if (guardEnemy && guardEnemy.instanceId !== selectedTargetId) {
    finalTargetId = guardEnemy.instanceId
  }

  const targetEnemy = state.battleState.enemies.find(e => e.instanceId === finalTargetId)
  if (!targetEnemy) return state

  // 空振り: ターゲットが既に倒されている場合、リソース消費なしでスキップ
  if (targetEnemy.currentHp <= 0) {
    const newBattleState = battleReducer(state.battleState, battleAction)
    return { ...state, battleState: newBattleState }
  }

  // ダメージ計算
  let calculatedDamage = 0
  let contributors: DamageContributor[] = []
  const explorerIndex = state.run.party.findIndex(e => e.id === battleAction.explorer.id)

  if (isWeaponAttack && isWeaponInstance(selectedCommand)) {
    // 変換武器: HP系ステータスから直接ダメージを算出（通常のダメージ計算をバイパス）
    if (selectedCommand.effect?.type === 'hpPercentDamage') {
      calculatedDamage = Math.floor(battleAction.explorer.maxHp * selectedCommand.effect.rate)
      contributors.push({ name: '生命変換', label: `最大HP${battleAction.explorer.maxHp}×${Math.floor(selectedCommand.effect.rate * 100)}%→${calculatedDamage}` })
    } else if (selectedCommand.effect?.type === 'currentHpDamage') {
      calculatedDamage = Math.max(0, battleAction.explorer.hp - 1)
      contributors.push({ name: '捨て身', label: `現在HP${battleAction.explorer.hp}-1→${calculatedDamage}` })
    } else {
      // 反動系の自傷も「HP消費」とみなし修羅の血脈の対象にする
      const hasHpCost = ('hpCost' in selectedCommand && (selectedCommand.hpCost ?? 0) > 0)
        || selectedCommand.effect?.type === 'recoilSelfDamage'
      const hpCostBoost = getHpCostPowerBoost(relics)
      const result = calculateWeaponDamage(battleAction.explorer, selectedCommand, targetEnemy, {
        relics,
        brokenWeaponCount: state.run.brokenWeaponCount ?? 0,
        totalBrokenWeaponCount: state.run.totalBrokenWeaponCount ?? 0,
        party: state.run.party,
        explorerIndex,
        commandSlots: state.battleState.commandSlots,
        currentCommandIndex: state.battleState.currentCommandIndex,
        hasHpCostPowerBoost: hasHpCost && hpCostBoost !== null,
        hpCostPowerBoostValue: hpCostBoost?.powerBonus ?? 0,
      })
      calculatedDamage = result.damage
      contributors = result.contributors
    }
  } else if (isWeaponAttack) {
    // パンチなど非WeaponInstance
    const result = calculateWeaponDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
      brokenWeaponCount: state.run.brokenWeaponCount ?? 0,
      party: state.run.party,
      explorerIndex,
    })
    calculatedDamage = result.damage
    contributors = result.contributors
  } else if (isSpell(selectedCommand)) {
    // 魔力放出: 現在MP全量をダメージに変換
    if (selectedCommand.effect?.type === 'mpAllDamage') {
      calculatedDamage = battleAction.explorer.mp
      contributors.push({ name: '魔力放出', label: `現在MP${battleAction.explorer.mp}→${calculatedDamage}` })
    } else {
      // 反動フレイムの自傷も「HP消費」とみなし修羅の血脈の対象にする
      const hasSpellHpCost = (selectedCommand.hpCost !== undefined && selectedCommand.hpCost > 0)
        || selectedCommand.effect?.type === 'recoilSelfDamage'
      const spellHpCostBoost = getHpCostPowerBoost(relics)
      const result = calculateSpellDamage(battleAction.explorer, selectedCommand, targetEnemy, {
        relics,
        party: state.run.party,
        explorerIndex,
        commandSlots: state.battleState.commandSlots,
        currentCommandIndex: state.battleState.currentCommandIndex,
        hasHpCostPowerBoost: hasSpellHpCost && spellHpCostBoost !== null,
        hpCostPowerBoostValue: spellHpCostBoost?.powerBonus ?? 0,
      })
      calculatedDamage = result.damage
      contributors = result.contributors
    }

  } else {
    return state
  }

  // 連携の紋章: DamageCalculator側でcomboStatBonusバフを参照済み
  // （バフはprocessExecuteCommandで攻撃実行直前に付与され、同ターン内のその攻撃に適用される）

  // 敵のdefenseバフによるダメージ軽減
  const reducedDamage = applyDefenseReduction(calculatedDamage, targetEnemy.battleBuffs)
  if (reducedDamage !== calculatedDamage) {
    const defenseBuff = targetEnemy.battleBuffs.find(b => b.type === 'defense')!
    const reduction = defenseBuff.value / 100
    contributors.push({ name: 'ガード', label: `×${(1.0 - reduction).toFixed(1)}` })
    calculatedDamage = reducedDamage
  }

  // 敵のシールドバフによるダメージ50%軽減
  const { reducedDamage: shieldReducedDamage, updatedBuffs: enemyUpdatedBuffs } =
    processEnemyShieldDamageReduction(targetEnemy.battleBuffs, calculatedDamage)
  const wasShielded = shieldReducedDamage !== calculatedDamage
  if (wasShielded) {
    contributors.push({ name: 'シールド', label: '×0.5' })
    calculatedDamage = shieldReducedDamage
  }

  // BattleReducerに事前計算済みダメージを渡す（庇うリダイレクト時はoverrideTargetIdを渡す）
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamage,
    contributors,
    overrideTargetId: finalTargetId !== selectedTargetId ? finalTargetId : undefined,
    shielded: wasShielded,
  })

  // 敵のシールドバフが変化した場合、敵の状態を更新
  if (enemyUpdatedBuffs !== targetEnemy.battleBuffs) {
    const shieldUpdatedEnemies = newBattleState.enemies.map(e =>
      e.instanceId === targetEnemy.instanceId ? { ...e, battleBuffs: enemyUpdatedBuffs } : e
    )
    newBattleState = battleReducer(newBattleState, { type: 'UPDATE_ENEMIES', enemies: shieldUpdatedEnemies })
  }

  // コスト消費（同ID武器区別のためweaponIndexを渡す）
  const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  let explorerAfterCost = consumeCommandCost(
    battleAction.explorer, selectedCommand, durabilitySaveChance, currentSlot?.weaponIndex
  )
  // 魔力の残滓: 魔法使用時、MP消費量が閾値以上ならシールド付与
  if (isSpell(selectedCommand)) {
    const mpSpent = battleAction.explorer.mp - explorerAfterCost.mp
    explorerAfterCost = applyMpSpendShield(explorerAfterCost, mpSpent, relics)
  }

  const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // 武器の lifesteal 効果
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'lifesteal') {
    const lifestealValue = selectedCommand.effect.value
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + lifestealValue, finalExplorer.maxHp),
    }
  }

  // シールドバッシュ: 攻撃後にシールドを消費
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'shieldBash') {
    finalExplorer = {
      ...finalExplorer,
      battleBuffs: finalExplorer.battleBuffs.filter(b => b.type !== 'shield'),
    }
  }

  // 捨て身の一撃: HPを1にする（自傷ダメージを復讐用に記録）
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'currentHpDamage') {
    const selfDamage = finalExplorer.hp - 1
    finalExplorer = {
      ...finalExplorer,
      hp: 1,
      damageTakenThisTurn: finalExplorer.damageTakenThisTurn + selfDamage,
    }
  }

  // 武器の lifestealPercent 効果: ダメージの rate% をHP回復
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'lifestealPercent') {
    const healAmount = Math.floor(calculatedDamage * selectedCommand.effect.rate)
    finalExplorer = { ...finalExplorer, hp: Math.min(finalExplorer.hp + healAmount, finalExplorer.maxHp) }
  }

  // 武器の manaSteal 効果: ダメージの rate% をMP回復
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'manaSteal') {
    const mpAmount = Math.floor(calculatedDamage * selectedCommand.effect.rate)
    finalExplorer = { ...finalExplorer, mp: Math.min(finalExplorer.mp + mpAmount, finalExplorer.maxMp) }
  }

  // 反動の自傷ダメージ: 与えたダメージ×rate のHP損失（最低HP1保証、復讐用に記録）
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'recoilSelfDamage') {
    const recoil = Math.floor(calculatedDamage * selectedCommand.effect.rate)
    if (recoil > 0) {
      const newHp = Math.max(1, finalExplorer.hp - recoil)
      const actualLoss = finalExplorer.hp - newHp
      finalExplorer = {
        ...finalExplorer,
        hp: newHp,
        damageTakenThisTurn: finalExplorer.damageTakenThisTurn + actualLoss,
      }
      if (actualLoss > 0) {
        newBattleState = {
          ...newBattleState,
          playerDamagePopups: [
            ...newBattleState.playerDamagePopups,
            createPlayerDamagePopup(actualLoss, finalExplorer.id, '反動'),
          ],
        }
      }
    }
  }

  // 鍛錬のナイフ: 次のターンのみSTR+value（発動待ちバフを付与、ターン終了時にstrへ変換）
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'nextTurnStrGain') {
    finalExplorer = {
      ...finalExplorer,
      battleBuffs: [...finalExplorer.battleBuffs, { type: 'strNextTurn', value: selectedCommand.effect.value, duration: 'battle' }],
    }
  }

  // 反動フレイム: 与えたダメージ×rate の自傷（最低HP1保証、復讐用に記録）
  if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'recoilSelfDamage') {
    const recoil = Math.floor(calculatedDamage * selectedCommand.effect.rate)
    if (recoil > 0) {
      const newHp = Math.max(1, finalExplorer.hp - recoil)
      const actualLoss = finalExplorer.hp - newHp
      finalExplorer = {
        ...finalExplorer,
        hp: newHp,
        damageTakenThisTurn: finalExplorer.damageTakenThisTurn + actualLoss,
      }
      if (actualLoss > 0) {
        newBattleState = {
          ...newBattleState,
          playerDamagePopups: [
            ...newBattleState.playerDamagePopups,
            createPlayerDamagePopup(actualLoss, finalExplorer.id, '反動'),
          ],
        }
      }
    }
  }

  // 渇きの火: 与えたダメージ×rate のMP減少
  if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'recoilMpDrain') {
    const mpLoss = Math.floor(calculatedDamage * selectedCommand.effect.rate)
    if (mpLoss > 0) {
      finalExplorer = {
        ...finalExplorer,
        mp: Math.max(0, finalExplorer.mp - mpLoss),
      }
    }
  }

  // 武器の combatStrGain 効果: 使用後にSTR+value(戦闘中永続)
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'combatStrGain') {
    const gainValue = selectedCommand.effect.value
    const existingBuff = finalExplorer.battleBuffs.find(b => b.type === 'combatStrGain')
    if (existingBuff) {
      finalExplorer = {
        ...finalExplorer,
        battleBuffs: finalExplorer.battleBuffs.map(b =>
          b.type === 'combatStrGain' ? { ...b, value: b.value + gainValue } : b
        ),
        str: finalExplorer.str + gainValue,
      }
    } else {
      finalExplorer = {
        ...finalExplorer,
        battleBuffs: [...finalExplorer.battleBuffs, { type: 'combatStrGain', value: gainValue, duration: 999 }],
        str: finalExplorer.str + gainValue,
      }
    }
  }

  // 武器破壊検出: 耐久が0になった武器があれば壊れた本数カウントを加算
  let updatedBrokenWeaponCount = state.run.brokenWeaponCount ?? 0
  let updatedTotalBrokenWeaponCount = state.run.totalBrokenWeaponCount ?? 0
  if (isWeaponAttack) {
    const weaponBefore = battleAction.explorer.weapons.find(w => w.id === selectedCommand.id)
    const weaponAfter = finalExplorer.weapons.find(w => w.id === selectedCommand.id)
    if (weaponBefore && weaponAfter &&
        weaponBefore.currentUses !== null && weaponBefore.currentUses > 0 &&
        weaponAfter.currentUses !== null && weaponAfter.currentUses <= 0) {
      // 破片の大剣: ラン中の破壊回数を常時加算
      updatedTotalBrokenWeaponCount += 1
      // 努力の証: 壊れた武器カウントを加算（レリック所持中のみ）
      if (getBrokenWeaponStrBonus(relics) > 0) {
        updatedBrokenWeaponCount += 1
      }
    }
  }

  // 研ぎ師の名刺: ナイフカテゴリ武器使用で使用回数カウント
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.category === 'knife') {
    const knifeRestore = getKnifeUseDurabilityRestore(relics)
    if (knifeRestore) {
      const newKnifeCount = (state.battleState.relicState.knifeUseCount ?? 0) + 1
      if (newKnifeCount >= knifeRestore.usesRequired) {
        // カウントリセット + 全ナイフ武器の耐久回復
        newBattleState = battleReducer(newBattleState, {
          type: 'UPDATE_RELIC_STATE',
          relicState: { knifeUseCount: 0 },
        })
        finalExplorer = {
          ...finalExplorer,
          weapons: finalExplorer.weapons.map(w => {
            if (w.currentUses === null || w.maxUses === null) return w
            if ('category' in w && w.category === 'knife') {
              return { ...w, currentUses: Math.min(w.currentUses + knifeRestore.restoreAmount, w.maxUses) } as typeof w
            }
            return w
          }),
        }
      } else {
        newBattleState = battleReducer(newBattleState, {
          type: 'UPDATE_RELIC_STATE',
          relicState: { knifeUseCount: newKnifeCount },
        })
      }
    }
  }

  // 後隙の武器: 使用後に自身にvulnerabilityデバフ付与
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'selfVulnerability') {
    const vulnDebuff = {
      type: 'vulnerability' as const,
      multiplier: selectedCommand.effect.multiplier,
      duration: selectedCommand.effect.duration,
      justApplied: true,
    }
    const hasVuln = finalExplorer.battleDebuffs.some(d => d.type === 'vulnerability')
    finalExplorer = {
      ...finalExplorer,
      battleDebuffs: hasVuln
        ? finalExplorer.battleDebuffs.map(d => d.type === 'vulnerability' ? vulnDebuff : d)
        : [...finalExplorer.battleDebuffs, vulnDebuff],
    }
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    brokenWeaponCount: updatedBrokenWeaponCount,
    totalBrokenWeaponCount: updatedTotalBrokenWeaponCount,
  }

  if (defeatedCount > 0) {
    // 討伐の対価: 撃破時MP回復
    const killMpRecover = getKillMpRecover(relics)
    if (killMpRecover > 0) {
      finalExplorer = {
        ...finalExplorer,
        mp: Math.min(finalExplorer.mp + killMpRecover * defeatedCount, finalExplorer.maxMp),
      }
      updatedRun = updatePartyMember(updatedRun, finalExplorer)
    }

    // 教育の魔弾/稽古の武器: トドメで全員にボーナスEXP
    let extraBonusToAll = 0
    if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'killBonusExpToAll') {
      extraBonusToAll = selectedCommand.effect.expAmount * defeatedCount
    }
    if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'killBonusExpToAll') {
      extraBonusToAll = selectedCommand.effect.expAmount * defeatedCount
    }

    // 導きバフ: 攻撃者にバフがあればキラーに追加EXP、バフを消費
    const guidance = consumeGuidanceBuff(finalExplorer)
    finalExplorer = guidance.updatedExplorer
    updatedRun = updatePartyMember(updatedRun, finalExplorer)

    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount,
      { extraBonusToAll, extraKillerBonus: guidance.extraKillerBonus }
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    // 敵位置→経験値バーへ飛ぶ EXP エフェクトを追加
    const defeatedEnemyIds = getDefeatedEnemyIds(state.battleState.enemies, newBattleState.enemies)
    newBattleState = addExpPopupsToBattle(newBattleState, defeatedEnemyIds, updatedRun.party, finalExplorer.id, {
      extraBonusToAll,
      extraKillerBonus: guidance.extraKillerBonus,
    })

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
      // 闘気の腕輪: レベルアップしたキャラにSTR/INT永続加算
      updatedRun = applyLevelUpStatBoost(updatedRun, newLevelUps, relics)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** enemyAll魔法攻撃を実行 */
function executeSpellAllAttack(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[],
  spell: SpellInstance
): GameState {
  if (!state.battleState || !state.run) return state
  const partySnapshot = state.run.party
  const explorerIndex = state.run.party.findIndex(e => e.id === battleAction.explorer.id)

  // 生存中の全敵に対してダメージ計算
  const aliveEnemies = state.battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) {
    return state
  }
  let allContributors: DamageContributor[] = []
  const shieldUpdates = new Map<string, import('../Types/Explorer').Buff[]>()
  const calculatedDamages = aliveEnemies.map((enemy, i) => {
    const result = calculateSpellDamage(battleAction.explorer, spell, enemy, {
      relics,
      party: partySnapshot,
      explorerIndex,
    })
    if (i === 0) allContributors = result.contributors
    // defenseバフによる軽減
    const defReduced = applyDefenseReduction(result.damage, enemy.battleBuffs)
    // シールドバフによる吸収
    const { reducedDamage: finalDmg, updatedBuffs } = processEnemyShieldDamageReduction(enemy.battleBuffs, defReduced)
    if (updatedBuffs !== enemy.battleBuffs) shieldUpdates.set(enemy.instanceId, updatedBuffs)
    return { targetId: enemy.instanceId, damage: finalDmg, shielded: finalDmg !== defReduced }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
    contributors: allContributors,
  })

  // 敵シールドバフの消費を反映
  if (shieldUpdates.size > 0) {
    const shieldConsumedEnemies = newBattleState.enemies.map(enemy => {
      const updated = shieldUpdates.get(enemy.instanceId)
      if (updated) return { ...enemy, battleBuffs: updated }
      return enemy
    })
    newBattleState = battleReducer(newBattleState, { type: 'UPDATE_ENEMIES', enemies: shieldConsumedEnemies })
  }

  // MP消費
  let explorerAfterCost = consumeCommandCost(
    battleAction.explorer, spell, 0
  )
  const mpSpent = battleAction.explorer.mp - explorerAfterCost.mp
  explorerAfterCost = applyMpSpendShield(explorerAfterCost, mpSpent, relics)

  const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // スペルの効果を適用（ヒールなど）
  if (spell.effect?.type === 'heal') {
    const healedHp = Math.min(finalExplorer.hp + spell.effect.value, finalExplorer.maxHp)
    const actualHeal = healedHp - finalExplorer.hp
    finalExplorer = { ...finalExplorer, hp: healedHp }
    if (actualHeal > 0) {
      newBattleState = {
        ...newBattleState,
        playerDamagePopups: [
          ...newBattleState.playerDamagePopups,
          createPlayerDamagePopup(-actualHeal, finalExplorer.id),
        ],
      }
    }
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = updatePartyMember(state.run, finalExplorer)

  if (defeatedCount > 0) {
    // 教育の魔弾: トドメで全員にボーナスEXP
    let extraBonusToAll = 0
    if (spell.effect?.type === 'killBonusExpToAll') {
      extraBonusToAll = spell.effect.expAmount * defeatedCount
    }

    // 導きバフ: 攻撃者にバフがあればキラーに追加EXP、バフを消費
    const guidance = consumeGuidanceBuff(finalExplorer)
    finalExplorer = guidance.updatedExplorer
    // バフが除去された場合は常にpartyへ同期（冪等・将来value=0仕様にも耐える）
    updatedRun = updatePartyMember(updatedRun, finalExplorer)

    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount,
      { extraBonusToAll, extraKillerBonus: guidance.extraKillerBonus }
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    // 敵位置→経験値バーへ飛ぶ EXP エフェクトを追加
    const defeatedEnemyIds = getDefeatedEnemyIds(state.battleState.enemies, newBattleState.enemies)
    newBattleState = addExpPopupsToBattle(newBattleState, defeatedEnemyIds, updatedRun.party, finalExplorer.id, {
      extraBonusToAll,
      extraKillerBonus: guidance.extraKillerBonus,
    })

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
      // 闘気の腕輪: レベルアップしたキャラにSTR/INT永続加算
      updatedRun = applyLevelUpStatBoost(updatedRun, newLevelUps, relics)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** enemyAll武器攻撃を実行 */
function executeEnemyAllAttack(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[],
  weapon: WeaponInstance
): GameState {
  if (!state.battleState || !state.run) return state
  const partySnapshot = state.run.party
  const explorerIndex = state.run.party.findIndex(e => e.id === battleAction.explorer.id)

  // 生存中の全敵に対してダメージ計算
  const aliveEnemies = state.battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) {
    return state
  }
  let allContributors: DamageContributor[] = []
  const weaponShieldUpdates = new Map<string, Buff[]>()

  const hasAoeHpCost = (weapon.hpCost !== undefined && weapon.hpCost > 0)
    || weapon.effect?.type === 'recoilSelfDamage'
  const aoeHpCostBoost = getHpCostPowerBoost(relics)

  const calculatedDamages = aliveEnemies.map((enemy, i) => {
    const result = calculateWeaponDamage(battleAction.explorer, weapon, enemy, {
      relics,
      brokenWeaponCount: state.run!.brokenWeaponCount ?? 0,
      totalBrokenWeaponCount: state.run!.totalBrokenWeaponCount ?? 0,
      party: partySnapshot,
      explorerIndex,
      commandSlots: state.battleState!.commandSlots,
      currentCommandIndex: state.battleState!.currentCommandIndex,
      hasHpCostPowerBoost: hasAoeHpCost && aoeHpCostBoost !== null,
      hpCostPowerBoostValue: aoeHpCostBoost?.powerBonus ?? 0,
    })
    if (i === 0) allContributors = result.contributors
    let dmg = result.damage
    // defenseバフによる軽減
    dmg = applyDefenseReduction(dmg, enemy.battleBuffs)
    // シールドバフによる吸収
    const { reducedDamage: finalDamage, updatedBuffs } = processEnemyShieldDamageReduction(enemy.battleBuffs, dmg)
    if (updatedBuffs !== enemy.battleBuffs) weaponShieldUpdates.set(enemy.instanceId, updatedBuffs)
    return { targetId: enemy.instanceId, damage: finalDamage, shielded: finalDamage !== dmg }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
    contributors: allContributors,
  })

  // 敵シールドバフの消費を反映
  if (weaponShieldUpdates.size > 0) {
    const updatedEnemiesForShield = newBattleState.enemies.map(enemy => {
      const updated = weaponShieldUpdates.get(enemy.instanceId)
      if (updated) return { ...enemy, battleBuffs: updated }
      return enemy
    })
    newBattleState = battleReducer(newBattleState, { type: 'UPDATE_ENEMIES', enemies: updatedEnemiesForShield })
  }

  // コスト消費（同ID武器区別のためweaponIndexを渡す）
  const currentSlotAoe = state.battleState.commandSlots[state.battleState.currentCommandIndex]
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  const explorerAfterCost = consumeCommandCost(
    battleAction.explorer, weapon, durabilitySaveChance, currentSlotAoe?.weaponIndex
  )

  const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // 武器の lifesteal 効果（全体攻撃時は合計ダメージに対して1回）
  if (weapon.effect?.type === 'lifesteal') {
    const lifestealValue = weapon.effect.value
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + lifestealValue, finalExplorer.maxHp),
    }
  }

  // シールドバッシュ: 攻撃後にシールドを消費
  if (weapon.effect?.type === 'shieldBash') {
    finalExplorer = {
      ...finalExplorer,
      battleBuffs: finalExplorer.battleBuffs.filter(b => b.type !== 'shield'),
    }
  }

  // 反動の大鎌: 与えたダメージ(敵1体分=先頭ターゲット)×rate の自傷
  if (weapon.effect?.type === 'recoilSelfDamage') {
    const baseDamage = calculatedDamages[0]?.damage ?? 0
    const recoil = Math.floor(baseDamage * weapon.effect.rate)
    if (recoil > 0) {
      const newHp = Math.max(1, finalExplorer.hp - recoil)
      const actualLoss = finalExplorer.hp - newHp
      finalExplorer = {
        ...finalExplorer,
        hp: newHp,
        damageTakenThisTurn: finalExplorer.damageTakenThisTurn + actualLoss,
      }
      if (actualLoss > 0) {
        newBattleState = {
          ...newBattleState,
          playerDamagePopups: [
            ...newBattleState.playerDamagePopups,
            createPlayerDamagePopup(actualLoss, finalExplorer.id, '反動'),
          ],
        }
      }
    }
  }

  // 後隙の武器: 使用後にvulnerabilityデバフ付与
  if (weapon.effect?.type === 'selfVulnerability') {
    const vulnDebuff = {
      type: 'vulnerability' as const,
      multiplier: weapon.effect.multiplier,
      duration: weapon.effect.duration,
      justApplied: true,
    }
    const hasVuln = finalExplorer.battleDebuffs.some(d => d.type === 'vulnerability')
    finalExplorer = {
      ...finalExplorer,
      battleDebuffs: hasVuln
        ? finalExplorer.battleDebuffs.map(d => d.type === 'vulnerability' ? vulnDebuff : d)
        : [...finalExplorer.battleDebuffs, vulnDebuff],
    }
  }

  // 武器破壊検出: 耐久が0になった武器があれば壊れた本数カウントを加算
  let updatedBrokenWeaponCountAoe = state.run.brokenWeaponCount ?? 0
  let updatedTotalBrokenWeaponCountAoe = state.run.totalBrokenWeaponCount ?? 0
  const weaponBeforeAoe = battleAction.explorer.weapons.find(w => w.id === weapon.id)
  const weaponAfterAoe = finalExplorer.weapons.find(w => w.id === weapon.id)
  if (weaponBeforeAoe && weaponAfterAoe &&
      weaponBeforeAoe.currentUses !== null && weaponBeforeAoe.currentUses > 0 &&
      weaponAfterAoe.currentUses !== null && weaponAfterAoe.currentUses <= 0) {
    updatedTotalBrokenWeaponCountAoe += 1
    if (getBrokenWeaponStrBonus(relics) > 0) {
      updatedBrokenWeaponCountAoe += 1
    }
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    brokenWeaponCount: updatedBrokenWeaponCountAoe,
    totalBrokenWeaponCount: updatedTotalBrokenWeaponCountAoe,
  }

  if (defeatedCount > 0) {
    // 討伐の対価: 撃破時MP回復
    const killMpRecoverAoe = getKillMpRecover(relics)
    if (killMpRecoverAoe > 0) {
      finalExplorer = {
        ...finalExplorer,
        mp: Math.min(finalExplorer.mp + killMpRecoverAoe * defeatedCount, finalExplorer.maxMp),
      }
      updatedRun = updatePartyMember(updatedRun, finalExplorer)
    }

    // 稽古の武器: トドメで全員にボーナスEXP
    let extraBonusToAll = 0
    if (weapon.effect?.type === 'killBonusExpToAll') {
      extraBonusToAll = weapon.effect.expAmount * defeatedCount
    }

    // 導きバフ: 攻撃者にバフがあればキラーに追加EXP、バフを消費
    const guidance = consumeGuidanceBuff(finalExplorer)
    finalExplorer = guidance.updatedExplorer
    updatedRun = updatePartyMember(updatedRun, finalExplorer)

    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount,
      { extraBonusToAll, extraKillerBonus: guidance.extraKillerBonus }
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    // 敵位置→経験値バーへ飛ぶ EXP エフェクトを追加
    const defeatedEnemyIds = getDefeatedEnemyIds(state.battleState.enemies, newBattleState.enemies)
    newBattleState = addExpPopupsToBattle(newBattleState, defeatedEnemyIds, updatedRun.party, finalExplorer.id, {
      extraBonusToAll,
      extraKillerBonus: guidance.extraKillerBonus,
    })

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
      // 闘気の腕輪: レベルアップしたキャラにSTR/INT永続加算
      updatedRun = applyLevelUpStatBoost(updatedRun, newLevelUps, relics)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** enemyRandom武器攻撃を実行（事前選択されたターゲットリストに順次ダメージ） */
function executeEnemyRandomAttack(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[],
  weapon: WeaponInstance
): GameState {
  if (!state.battleState || !state.run) return state

  const targets = battleAction.randomEnemyTargets
  if (!targets || targets.length === 0) return state

  const explorerIndex = state.run.party.findIndex(e => e.id === battleAction.explorer.id)
  let newBattleState = state.battleState
  const snapshotEnemies = state.battleState.enemies

  // 各ターゲットに対して順次ダメージ処理（同じ敵に複数回ヒットする可能性あり）
  // reducer経由ではなく直接 enemies/popups を更新（reducerはslot.targetIdを参照するため）
  const HIT_INTERVAL_MS = 500
  const fadeAfterMs = (targets.length - 1) * HIT_INTERVAL_MS
  const fadeDurationMs = 1000

  let updatedEnemies = newBattleState.enemies
  const newPopups: DamagePopup[] = []
  let allContributors: DamageContributor[] = []

  const randomHpCostBoost = getHpCostPowerBoost(relics)
  const hasRandomHpCost = weapon.hpCost !== undefined && weapon.hpCost > 0

  for (let i = 0; i < targets.length; i++) {
    const targetId = targets[i]
    // ダメージ計算用: 生存敵を優先、死亡済みなら元データでオーバーキル表示
    const aliveEnemy = updatedEnemies.find(e => e.instanceId === targetId && e.currentHp > 0)
    const targetEnemy = aliveEnemy ?? updatedEnemies.find(e => e.instanceId === targetId)
    if (!targetEnemy) continue

    const result = calculateWeaponDamage(battleAction.explorer, weapon, targetEnemy, {
      relics,
      brokenWeaponCount: state.run.brokenWeaponCount ?? 0,
      totalBrokenWeaponCount: state.run.totalBrokenWeaponCount ?? 0,
      party: state.run.party,
      explorerIndex,
      commandSlots: state.battleState.commandSlots,
      currentCommandIndex: state.battleState.currentCommandIndex,
      hasHpCostPowerBoost: hasRandomHpCost && randomHpCostBoost !== null,
      hpCostPowerBoostValue: randomHpCostBoost?.powerBonus ?? 0,
    })
    if (allContributors.length === 0) {
      allContributors = result.contributors
    }

    let dmg = result.damage
    dmg = applyDefenseReduction(dmg, targetEnemy.battleBuffs)
    // シールドバフによる吸収（ランダムhit中もシールド状態を追跡）
    const { reducedDamage: finalDamage, updatedBuffs: randomShieldBuffs } = processEnemyShieldDamageReduction(targetEnemy.battleBuffs, dmg)
    if (randomShieldBuffs !== targetEnemy.battleBuffs) {
      updatedEnemies = updatedEnemies.map(e =>
        e.instanceId === targetId ? { ...e, battleBuffs: randomShieldBuffs } : e
      )
    }

    if (aliveEnemy) {
      updatedEnemies = updatedEnemies.map(e => {
        if (e.instanceId !== targetId) return e
        const newHp = Math.max(0, e.currentHp - finalDamage)
        const shouldTransform = e.id === 'sleep_tiger'
          && e.name !== 'マッドタイガー'
          && newHp / e.hp <= 0.8
        return { ...e, currentHp: newHp, ...(shouldTransform ? { name: 'マッドタイガー' } : {}) }
      })
    }
    newPopups.push({
      ...createDamagePopup(targetId, finalDamage, result.contributors, finalDamage !== dmg),
      delayMs: i * HIT_INTERVAL_MS,
      fadeAfterMs,
      fadeDurationMs,
      hitIndex: i,
    })
  }

  newBattleState = {
    ...newBattleState,
    enemies: updatedEnemies,
    damagePopups: [...newBattleState.damagePopups, ...newPopups],
  }

  // コスト消費（耐久は1回だけ消費）
  const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  const explorerAfterCost = consumeCommandCost(
    battleAction.explorer, weapon, durabilitySaveChance, currentSlot?.weaponIndex
  )

  const defeatedCount = countDefeatedEnemies(snapshotEnemies, newBattleState.enemies)

  let finalExplorer = explorerAfterCost

  // 武器の lifesteal 効果
  if (weapon.effect?.type === 'lifesteal') {
    const lifestealValue = weapon.effect.value
    finalExplorer = {
      ...finalExplorer,
      hp: Math.min(finalExplorer.hp + lifestealValue, finalExplorer.maxHp),
    }
  }

  // シールドバッシュ: 攻撃後にシールドを消費
  if (weapon.effect?.type === 'shieldBash') {
    finalExplorer = {
      ...finalExplorer,
      battleBuffs: finalExplorer.battleBuffs.filter(b => b.type !== 'shield'),
    }
  }

  // 後隙の武器: 使用後にvulnerabilityデバフ付与
  if (weapon.effect?.type === 'selfVulnerability') {
    const vulnDebuff = {
      type: 'vulnerability' as const,
      multiplier: weapon.effect.multiplier,
      duration: weapon.effect.duration,
      justApplied: true,
    }
    const hasVuln = finalExplorer.battleDebuffs.some(d => d.type === 'vulnerability')
    finalExplorer = {
      ...finalExplorer,
      battleDebuffs: hasVuln
        ? finalExplorer.battleDebuffs.map(d => d.type === 'vulnerability' ? vulnDebuff : d)
        : [...finalExplorer.battleDebuffs, vulnDebuff],
    }
  }

  // 武器破壊検出: 耐久が0になった武器があれば壊れた本数カウントを加算
  let updatedBrokenWeaponCountRand = state.run.brokenWeaponCount ?? 0
  let updatedTotalBrokenWeaponCountRand = state.run.totalBrokenWeaponCount ?? 0
  const weaponBefore = battleAction.explorer.weapons.find(w => w.id === weapon.id)
  const weaponAfter = finalExplorer.weapons.find(w => w.id === weapon.id)
  if (weaponBefore && weaponAfter &&
      weaponBefore.currentUses !== null && weaponBefore.currentUses > 0 &&
      weaponAfter.currentUses !== null && weaponAfter.currentUses <= 0) {
    updatedTotalBrokenWeaponCountRand += 1
    if (getBrokenWeaponStrBonus(relics) > 0) {
      updatedBrokenWeaponCountRand += 1
    }
  }

  // 攻撃後にnextActionバフ（精密など）を消費
  finalExplorer = {
    ...finalExplorer,
    battleBuffs: consumeNextActionBuffs(finalExplorer.battleBuffs),
  }

  let newLevelUps: LevelUpInfo[] = []

  // まず攻撃者の結果をrunに反映
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    brokenWeaponCount: updatedBrokenWeaponCountRand,
    totalBrokenWeaponCount: updatedTotalBrokenWeaponCountRand,
  }

  if (defeatedCount > 0) {
    // 討伐の対価: 撃破時MP回復
    const killMpRecoverRand = getKillMpRecover(relics)
    if (killMpRecoverRand > 0) {
      finalExplorer = {
        ...finalExplorer,
        mp: Math.min(finalExplorer.mp + killMpRecoverRand * defeatedCount, finalExplorer.maxMp),
      }
      updatedRun = updatePartyMember(updatedRun, finalExplorer)
    }

    // 稽古の武器: トドメで全員にボーナスEXP
    let extraBonusToAll = 0
    if (weapon.effect?.type === 'killBonusExpToAll') {
      extraBonusToAll = weapon.effect.expAmount * defeatedCount
    }

    // 導きバフ: 攻撃者にバフがあればキラーに追加EXP、バフを消費
    const guidance = consumeGuidanceBuff(finalExplorer)
    finalExplorer = guidance.updatedExplorer
    updatedRun = updatePartyMember(updatedRun, finalExplorer)

    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount,
      { extraBonusToAll, extraKillerBonus: guidance.extraKillerBonus }
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    // 敵位置→経験値バーへ飛ぶ EXP エフェクトを追加
    const defeatedEnemyIds = getDefeatedEnemyIds(snapshotEnemies, newBattleState.enemies)
    newBattleState = addExpPopupsToBattle(newBattleState, defeatedEnemyIds, updatedRun.party, finalExplorer.id, {
      extraBonusToAll,
      extraKillerBonus: guidance.extraKillerBonus,
    })

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
      // 闘気の腕輪: レベルアップしたキャラにSTR/INT永続加算
      updatedRun = applyLevelUpStatBoost(updatedRun, newLevelUps, relics)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: {
      ...updatedRun,
      battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
    },
  }
}

/** 味方対象スペル（ヒールなど）を実行 */
function executeAllySpellCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand, selectedTargetId } = state.battleState
  if (!selectedCommand || !isSpell(selectedCommand) || !selectedTargetId) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // MP消費は術者に適用
  let explorerAfterCost = consumeCommandCost(
    battleAction.explorer, selectedCommand, 0
  )
  const mpSpentAlly = battleAction.explorer.mp - explorerAfterCost.mp
  explorerAfterCost = applyMpSpendShield(explorerAfterCost, mpSpentAlly, relics)

  // ターゲットに効果を適用（術者と異なる場合がある）
  const isSelfTarget = battleAction.explorer.id === selectedTargetId
  const targetMember = isSelfTarget
    ? explorerAfterCost
    : state.run.party.find(e => e.id === selectedTargetId)
  if (!targetMember) return state

  let updatedTarget = targetMember

  if (selectedCommand.effect?.type === 'heal') {
    const healedHp = Math.min(updatedTarget.hp + selectedCommand.effect.value, updatedTarget.maxHp)
    const actualHeal = healedHp - updatedTarget.hp
    updatedTarget = { ...updatedTarget, hp: healedHp }
    if (actualHeal > 0) {
      newBattleState = {
        ...newBattleState,
        playerDamagePopups: [
          ...newBattleState.playerDamagePopups,
          createPlayerDamagePopup(-actualHeal, updatedTarget.id),
        ],
      }
    }
  }

  // バフ効果（精密など）
  if (selectedCommand.effect?.type === 'buff') {
    const newBuff: Buff = {
      type: selectedCommand.effect.stat,
      value: selectedCommand.effect.value,
      duration: selectedCommand.effect.duration,
    }
    updatedTarget = {
      ...updatedTarget,
      battleBuffs: [...updatedTarget.battleBuffs, newBuff],
    }
  }

  // シールド効果（バリア）
  if (selectedCommand.effect?.type === 'shield') {
    const shieldBuff: Buff = {
      type: 'shield',
      value: selectedCommand.effect.value,
      duration: 1,
    }
    updatedTarget = {
      ...updatedTarget,
      battleBuffs: [...updatedTarget.battleBuffs, shieldBuff],
    }
  }

  // 武器強化（次の武器攻撃Power+N）
  if (selectedCommand.effect?.type === 'weaponPowerBuff') {
    const wpBuff: Buff = {
      type: 'weaponPowerBonus',
      value: selectedCommand.effect.value,
      duration: 'nextAction',
    }
    updatedTarget = {
      ...updatedTarget,
      battleBuffs: [...updatedTarget.battleBuffs, wpBuff],
    }
  }

  // 祈り: 被ターゲット率UP
  if (selectedCommand.effect?.type === 'targetRateUp') {
    const newBuff: Buff = {
      type: 'targetRateUp',
      value: selectedCommand.effect.value,
      duration: 1,
    }
    updatedTarget = {
      ...updatedTarget,
      battleBuffs: [...updatedTarget.battleBuffs, newBuff],
    }
  }

  // 魔力の盾: 最大MP×rate のシールド付与
  if (selectedCommand.effect?.type === 'mpPercentShield') {
    const shieldValue = Math.floor(explorerAfterCost.maxMp * selectedCommand.effect.rate)
    if (shieldValue > 0) {
      const shieldBuff: Buff = {
        type: 'shield',
        value: shieldValue,
        duration: 1,
      }
      updatedTarget = {
        ...updatedTarget,
        battleBuffs: [...updatedTarget.battleBuffs, shieldBuff],
      }
    }
  }

  // 戦場の鍛冶（武器耐久回復）
  if (selectedCommand.effect?.type === 'repairWeapons') {
    const repairValue = selectedCommand.effect.value
    updatedTarget = {
      ...updatedTarget,
      weapons: updatedTarget.weapons.map(w => {
        if (w.currentUses === null || w.maxUses === null) return w
        if ('noRepair' in w && (w as WeaponInstance).noRepair) return w
        return { ...w, currentUses: Math.min(w.currentUses + repairValue, w.maxUses) } as typeof w
      }),
    }
  }

  // 魔力の盾(新): シールド(base + 術者INT×intMultiplier)付与
  if (selectedCommand.effect?.type === 'scalingShieldInt') {
    const shieldValue = selectedCommand.effect.base + explorerAfterCost.int * selectedCommand.effect.intMultiplier
    if (shieldValue > 0) {
      const shieldBuff: Buff = { type: 'shield', value: shieldValue, duration: 1 }
      updatedTarget = {
        ...updatedTarget,
        battleBuffs: [...updatedTarget.battleBuffs, shieldBuff],
      }
    }
  }

  // 戦場の鍛冶(新): 対象が最後に使用した武器の耐久のみ回復
  if (selectedCommand.effect?.type === 'repairLastWeapon') {
    const repairValue = selectedCommand.effect.value
    const idx = updatedTarget.lastUsedWeaponIndex
    if (idx !== undefined && idx >= 0 && idx < updatedTarget.weapons.length) {
      updatedTarget = {
        ...updatedTarget,
        weapons: updatedTarget.weapons.map((w, i) => {
          if (i !== idx) return w
          if (w.currentUses === null || w.maxUses === null) return w
          if ('noRepair' in w && (w as WeaponInstance).noRepair) return w
          return { ...w, currentUses: Math.min(w.currentUses + repairValue, w.maxUses) } as typeof w
        }),
      }
    }
  }

  // MPチャージ: 対象のMPを回復
  if (selectedCommand.effect?.type === 'healMp') {
    const healedMp = Math.min(updatedTarget.mp + selectedCommand.effect.value, updatedTarget.maxMp)
    updatedTarget = { ...updatedTarget, mp: healedMp }
  }

  // 蘇生呪文: 戦闘不能の対象をHP=hpで復活（毒も解除して即再死亡を防ぐ）
  if (selectedCommand.effect?.type === 'revive' && updatedTarget.hp <= 0) {
    const reviveHp = Math.min(selectedCommand.effect.hp, updatedTarget.maxHp)
    updatedTarget = {
      ...updatedTarget,
      hp: reviveHp,
      battleDebuffs: updatedTarget.battleDebuffs.filter(d => d.type !== 'poison'),
    }
    newBattleState = {
      ...newBattleState,
      playerDamagePopups: [
        ...newBattleState.playerDamagePopups,
        createPlayerDamagePopup(-reviveHp, updatedTarget.id, '蘇生'),
      ],
    }
  }

  // 棘スタック付与（蓄積可能）
  if (selectedCommand.effect?.type === 'thorns') {
    const thornsValue = selectedCommand.effect.value + getThornsStackBonus(state.run.relics)
    const existingThorns = updatedTarget.battleBuffs.find(b => b.type === 'thorns')
    if (existingThorns) {
      // 蓄積: 既存の棘バフに加算
      updatedTarget = {
        ...updatedTarget,
        battleBuffs: updatedTarget.battleBuffs.map(b =>
          b.type === 'thorns' ? { ...b, value: b.value + thornsValue } : b
        ),
      }
    } else {
      const thornsBuff: Buff = {
        type: 'thorns',
        value: thornsValue,
        duration: 'battle',
      }
      updatedTarget = {
        ...updatedTarget,
        battleBuffs: [...updatedTarget.battleBuffs, thornsBuff],
      }
    }
  }

  // 術者とターゲットが同じ場合は1回、異なる場合は2回updatePartyMember
  let updatedRun = updatePartyMember(state.run, updatedTarget)
  if (!isSelfTarget) {
    updatedRun = updatePartyMember(updatedRun, explorerAfterCost)
  }

  return {
    ...state,
    battleState: newBattleState,
    run: updatedRun,
  }
}

/** 味方全体対象スペル（癒しの風など）を実行 */
function executeAllyAllSpellCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' },
  relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand || !isSpell(selectedCommand)) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // MP消費は術者に適用
  let explorerAfterCost = consumeCommandCost(
    battleAction.explorer, selectedCommand, 0
  )
  const mpSpentAll = battleAction.explorer.mp - explorerAfterCost.mp
  explorerAfterCost = applyMpSpendShield(explorerAfterCost, mpSpentAll, relics)

  let updatedRun = updatePartyMember(state.run, explorerAfterCost)

  // ヒール: 生存中の全メンバーにHP回復を適用
  if (selectedCommand.effect?.type === 'heal') {
    const healValue = selectedCommand.effect.value
    const popups = [...newBattleState.playerDamagePopups]

    for (const member of updatedRun.party) {
      // 戦闘不能メンバーはスキップ（全体ヒールで蘇生させない設計）
      if (member.hp <= 0) continue
      const healedHp = Math.min(member.hp + healValue, member.maxHp)
      const actualHeal = healedHp - member.hp
      if (actualHeal > 0) {
        const updatedMember: ExplorerState = { ...member, hp: healedHp }
        updatedRun = updatePartyMember(updatedRun, updatedMember)
        popups.push(createPlayerDamagePopup(-actualHeal, member.id))
      }
    }

    newBattleState = {
      ...newBattleState,
      playerDamagePopups: popups,
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: updatedRun,
  }
}

/** 味方対象武器（祈りなど）を実行 */
function executeAllyWeaponCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand, selectedTargetId } = state.battleState
  if (!selectedCommand || !isWeapon(selectedCommand) || !selectedTargetId) return state

  const newBattleState = battleReducer(state.battleState, battleAction)

  // シールド系武器（守護の盾=scalingShield / 棘の盾=thornsShield）
  // シールド値は使用者(攻撃者)のSTRでスケールする
  const effect = isWeaponInstance(selectedCommand) ? selectedCommand.effect : undefined
  if (effect && (effect.type === 'scalingShield' || effect.type === 'thornsShield')) {
    const targetMember = state.run.party.find(e => e.id === selectedTargetId)
    if (targetMember) {
      const casterStr = battleAction.explorer.str
      const shieldValue = effect.type === 'scalingShield'
        ? effect.base + casterStr * effect.strMultiplier
        : effect.shieldBase + casterStr * effect.shieldStrMultiplier
      const shieldBuff: Buff = { type: 'shield', value: shieldValue, duration: 1 }

      let targetBuffs = [...targetMember.battleBuffs, shieldBuff]

      // 棘の盾: 棘スタックも付与（蓄積可能、レリックボーナス考慮）
      if (effect.type === 'thornsShield') {
        const thornsStacks = effect.thornStacks + getThornsStackBonus(state.run.relics)
        const existingThorns = targetBuffs.find(b => b.type === 'thorns')
        if (existingThorns) {
          targetBuffs = targetBuffs.map(b =>
            b.type === 'thorns' ? { ...b, value: b.value + thornsStacks } : b
          )
        } else {
          targetBuffs.push({ type: 'thorns', value: thornsStacks, duration: 'battle' })
        }
      }

      const updatedTarget = { ...targetMember, battleBuffs: targetBuffs }

      // 攻撃者（武器の使用者）のコスト消費（耐久+hpCost）
      const durabilitySaveChance = getWeaponDurabilitySaveChance(state.run.relics)
      const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
      const updatedAttacker = consumeCommandCost(
        battleAction.explorer, selectedCommand, durabilitySaveChance, currentSlot?.weaponIndex
      )

      // 術者とターゲットが同じ場合は1回、異なる場合は2回updatePartyMember（祈りパターンと統一）
      const isSelfTarget = battleAction.explorer.id === targetMember.id
      const mergedTarget: ExplorerState = isSelfTarget
        ? { ...updatedTarget, weapons: updatedAttacker.weapons, hp: updatedAttacker.hp }
        : updatedTarget

      let updatedRun = updatePartyMember(state.run, mergedTarget)
      if (!isSelfTarget) {
        updatedRun = updatePartyMember(updatedRun, updatedAttacker)
      }

      return {
        ...state,
        battleState: newBattleState,
        run: updatedRun,
      }
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: state.run,
  }
}

/** 味方全体対象武器（護りの壁など）を実行 */
function executeAllyAllWeaponCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand || !isWeapon(selectedCommand) || !isWeaponInstance(selectedCommand)) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // 武器耐久消費
  const durabilitySaveChance = getWeaponDurabilitySaveChance(state.run.relics)
  const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
  const explorerAfterCost = consumeCommandCost(
    battleAction.explorer, selectedCommand, durabilitySaveChance, currentSlot?.weaponIndex
  )

  let updatedRun = updatePartyMember(state.run, explorerAfterCost)

  // 棘の盾(全体版): 対象にシールド+棘バフを付与（シールドは使用者STRでスケール）
  if (selectedCommand.effect?.type === 'thornsShield') {
    const casterStr = battleAction.explorer.str
    const shieldValue = selectedCommand.effect.shieldBase + casterStr * selectedCommand.effect.shieldStrMultiplier
    for (const member of updatedRun.party) {
      if (member.hp <= 0) continue
      const shieldBuff: Buff = {
        type: 'shield',
        value: shieldValue,
        duration: 1,
      }
      // 棘スタック付与（蓄積可能）
      const existingThorns = member.battleBuffs.find(b => b.type === 'thorns')
      const thornsStacks = selectedCommand.effect.thornStacks + getThornsStackBonus(state.run.relics)
      let memberBuffs = [...member.battleBuffs, shieldBuff]
      if (existingThorns) {
        memberBuffs = memberBuffs.map(b =>
          b.type === 'thorns' ? { ...b, value: b.value + thornsStacks } : b
        )
      } else {
        const thornsBuff: Buff = {
          type: 'thorns',
          value: thornsStacks,
          duration: 'battle',
        }
        memberBuffs.push(thornsBuff)
      }
      const updatedMember: ExplorerState = {
        ...member,
        battleBuffs: memberBuffs,
      }
      updatedRun = updatePartyMember(updatedRun, updatedMember)
    }
  }

  return {
    ...state,
    battleState: newBattleState,
    run: updatedRun,
  }
}

/** EXECUTE_COMMANDを処理 */
export function processExecuteCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand) return state

  const relics = state.run.relics

  // 連携の紋章: 同ターンに規定人数以上が攻撃する場合、comboStatBonusバフを行動者に付与
  let effectiveState = state
  const combo = getComboAttackBonus(relics)
  if (combo) {
    const attackerCount = new Set(
      state.battleState.commandSlots
        .filter(slot => slot.command && (isWeapon(slot.command) || isSpell(slot.command))
          && slot.command.targetType !== 'allySingle'
          && slot.command.targetType !== 'allyAll')
        .map(slot => slot.explorerId)
    ).size
    if (attackerCount >= combo.requiredCount) {
      const explorer = battleAction.explorer
      const hasComboBuff = explorer.battleBuffs.some(b => b.type === 'comboStatBonus')
      if (!hasComboBuff) {
        const updatedExplorer: ExplorerState = {
          ...explorer,
          battleBuffs: [...explorer.battleBuffs, { type: 'comboStatBonus', value: combo.statBonus, duration: 'nextAction' }],
        }
        const updatedRun = updatePartyMember(state.run, updatedExplorer)
        effectiveState = {
          ...state,
          run: updatedRun,
        }
        // battleAction.explorerも更新
        battleAction = { ...battleAction, explorer: updatedExplorer }
      }
    }
  }

  // 味方対象スペル（ヒール、精密など）
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'allySingle') {
    return applyRegenAfterAction(executeAllySpellCommand(effectiveState, battleAction, relics))
  }

  // 味方全体対象スペル（癒しの風など）
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'allyAll') {
    return applyRegenAfterAction(executeAllyAllSpellCommand(effectiveState, battleAction, relics))
  }

  // 味方対象武器（守護の盾など）— 攻撃ではなくサポート行動
  if (isWeapon(selectedCommand) && selectedCommand.targetType === 'allySingle') {
    return applyRegenAfterAction(executeAllyWeaponCommand(effectiveState, battleAction))
  }

  // 味方全体対象武器（護りの壁など）— サポート行動
  if (isWeapon(selectedCommand) && selectedCommand.targetType === 'allyAll') {
    return applyRegenAfterAction(executeAllyAllWeaponCommand(effectiveState, battleAction))
  }

  // ランダム敵対象武器（三節棍など）— 事前選択されたターゲットリストに攻撃
  if (isWeapon(selectedCommand) && isWeaponInstance(selectedCommand) && selectedCommand.targetType === 'enemyRandom') {
    return applyRegenAfterAction(executeEnemyRandomAttack(effectiveState, battleAction, relics, selectedCommand))
  }

  return applyRegenAfterAction(executeAttackCommand(effectiveState, battleAction, relics))
}

/** 行動後に再生のコケの回復を適用（行動したキャラに適用） */
function applyRegenAfterAction(result: GameState, explorerId?: string): GameState {
  if (!result.run || !result.battleState) return result

  const regenAmount = getRegenPerTurn(result.run.relics)
  if (regenAmount <= 0) return result

  // 行動キャラを特定（指定がなければcommandSlotsから取得）
  const targetId = explorerId
    ?? result.battleState.commandSlots[result.battleState.currentCommandIndex]?.explorerId
    ?? result.run.party[0].id
  const explorer = result.run.party.find(e => e.id === targetId) ?? result.run.party[0]

  const healedHp = Math.min(explorer.hp + regenAmount, explorer.maxHp)
  const actualHeal = healedHp - explorer.hp
  if (actualHeal <= 0) return result

  const updatedExplorer = { ...explorer, hp: healedHp }
  return {
    ...result,
    run: updatePartyMember(result.run, updatedExplorer),
    battleState: {
      ...result.battleState,
      playerDamagePopups: [
        ...result.battleState.playerDamagePopups,
        createPlayerDamagePopup(-actualHeal, targetId),
      ],
    },
  }
}

/** ENEMY_ACTIONを処理 */
export function processEnemyAction(
  state: GameState,
  battleAction: BattleAction & { type: 'ENEMY_ACTION' }
): GameState {
  if (!state.battleState || !state.run) return state

  const relics = state.run.relics
  const hits = battleAction.hits ?? 1
  const perHitDamage = battleAction.damage

  let newBattleState = state.battleState

  const actualDamage = perHitDamage * hits

  // 敵エフェクトの適用（EnemyEffectProcessorのピュア関数で状態変換し、UPDATE_ENEMIESで反映）
  let effectState = newBattleState

  // 力溜め付与: 敵にchargeバフを追加
  if (battleAction.applyCharge) {
    effectState = applyChargeToEnemy(effectState, battleAction.enemyId)
  }

  // 力溜め消費: 敵のchargeバフを除去
  if (battleAction.consumeCharge) {
    effectState = consumeChargeFromEnemy(effectState, battleAction.enemyId)
  }

  // chargeAllAllies: 行動敵以外の全生存敵にchargeバフ付与
  if (battleAction.chargeAllAllies) {
    effectState = applyChargeToAllAllies(effectState, battleAction.enemyId)
  }

  // applySelfDefense: 行動敵に防御バフ付与（既存バフ上書き）
  if (battleAction.applySelfDefense) {
    const { value, duration } = battleAction.applySelfDefense
    effectState = applySelfDefenseBuff(effectState, battleAction.enemyId, value, duration)
  }

  // healSelf: 行動敵の自己回復
  if (battleAction.healSelf && battleAction.healSelf > 0) {
    effectState = applyHealSelf(effectState, battleAction.enemyId, battleAction.healSelf)
  }

  // healAlly: 最もHP割合が低い生存敵（自身含む）を回復
  if (battleAction.healAlly) {
    effectState = applyHealAlly(effectState, battleAction.healAlly)
  }

  // summonEnemyId: 戦闘中に敵を追加
  if (battleAction.summonEnemyId) {
    effectState = applySummonEnemy(effectState, battleAction.enemyId, battleAction.summonEnemyId, battleAction.unlimitedSummon)
  }

  // applyShieldToSelf: 行動敵にシールドバフ付与
  if (battleAction.applyShieldToSelf && battleAction.applyShieldToSelf > 0) {
    effectState = applyShieldToEnemySelf(effectState, battleAction.enemyId, battleAction.applyShieldToSelf)
  }

  // applyShieldToAlly: 最もHP割合が低い味方にシールドバフ付与
  if (battleAction.applyShieldToAlly && battleAction.applyShieldToAlly > 0) {
    effectState = applyShieldToEnemyAlly(effectState, battleAction.applyShieldToAlly)
  }

  // applyGuard: 庇うバフ付与（プレイヤーの単体攻撃をリダイレクト）
  if (battleAction.applyGuard) {
    effectState = applyGuardToEnemy(effectState, battleAction.enemyId)
  }

  // transformName: 敵の表示名を変更
  if (battleAction.transformName) {
    effectState = {
      ...effectState,
      enemies: effectState.enemies.map(enemy =>
        enemy.instanceId === battleAction.enemyId
          ? { ...enemy, name: battleAction.transformName! }
          : enemy
      ),
    }
  }

  // エフェクト適用結果をbattleReducer経由で反映
  if (effectState.enemies !== newBattleState.enemies) {
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_ENEMIES',
      enemies: effectState.enemies,
    })
  }

  // ダメージ処理
  const preDamageByMemberId = new Map<string, number>()
  let newRun = state.run
  if (battleAction.randomTargetHits && battleAction.randomTargetHits.length > 0) {
    // ランダムターゲット: 各hitを対象ごとに独立処理（poison/weakness等のデバフは未対応）
    newBattleState = battleReducer(newBattleState, {
      ...battleAction,
      damage: battleAction.damage,
    })

    const perHitDamage = battleAction.damage
    const randomPopups: PlayerDamagePopup[] = []

    for (let i = 0; i < battleAction.randomTargetHits.length; i++) {
      const hit = battleAction.randomTargetHits[i]
      const member = newRun.party.find(m => m.id === hit.targetExplorerId)
      if (!member || member.hp <= 0) continue

      // vulnerabilityデバフによるダメージ倍化
      const amplifiedDamage = applyVulnerabilityMultiplier(member.battleDebuffs, perHitDamage)
      const existing = preDamageByMemberId.get(hit.targetExplorerId) ?? 0
      preDamageByMemberId.set(hit.targetExplorerId, existing + amplifiedDamage)
      const { reducedDamage, updatedBuffs } = processShieldDamageReduction(member.battleBuffs, amplifiedDamage)
      const dmgToMpValue = getDamageTakenToMpValue(relics)
      const mpRecovery = dmgToMpValue

      const updatedMember = {
        ...member,
        hp: Math.max(0, member.hp - reducedDamage),
        mp: Math.min(member.mp + mpRecovery, member.maxMp),
        battleBuffs: updatedBuffs,
        damageTakenThisTurn: member.damageTakenThisTurn + amplifiedDamage,
      }
      newRun = updatePartyMember(newRun, updatedMember)
      if (reducedDamage > 0) {
        randomPopups.push(createPlayerDamagePopup(reducedDamage, hit.targetExplorerId, undefined, reducedDamage < amplifiedDamage))
      }
    }

    newBattleState = {
      ...newBattleState,
      playerDamagePopups: [...newBattleState.playerDamagePopups, ...randomPopups],
    }
  } else if (battleAction.isAoe && actualDamage > 0) {
    // 全体攻撃: BattleReducerにポップアップ用のダメージを通知
    newBattleState = battleReducer(newBattleState, {
      ...battleAction,
      damage: actualDamage,
    })

    // 全生存パーティーメンバーにダメージ適用（vulnerability倍化→シールドバフ考慮、ポップアップは軽減後の値で作成）
    const aliveMembers = newRun.party.filter(m => m.hp > 0)
    const aoePopups = []
    for (const member of aliveMembers) {
      // vulnerabilityデバフによるダメージ倍化
      const amplifiedDamage = applyVulnerabilityMultiplier(member.battleDebuffs, actualDamage)
      preDamageByMemberId.set(member.id, amplifiedDamage)
      const { reducedDamage: memberDamage, updatedBuffs: memberBuffs } = processShieldDamageReduction(member.battleBuffs, amplifiedDamage)
      // 苦痛のリング: 被ダメ→MP固定回復
      const dmgToMpValue = getDamageTakenToMpValue(relics)
      const mpRecovery = dmgToMpValue
      const updatedMember = {
        ...member,
        hp: Math.max(0, member.hp - memberDamage),
        mp: Math.min(member.mp + mpRecovery, member.maxMp),
        damageTakenThisTurn: member.damageTakenThisTurn + amplifiedDamage,
        battleBuffs: memberBuffs,
      }
      newRun = updatePartyMember(newRun, updatedMember)
      // メンバーごとにシールド軽減後のダメージでポップアップ作成（軽減発生時は shielded フラグ）
      aoePopups.push(createPlayerDamagePopup(memberDamage, member.id, undefined, memberDamage < amplifiedDamage))
    }

    newBattleState = {
      ...newBattleState,
      playerDamagePopups: [...newBattleState.playerDamagePopups, ...aoePopups],
    }
  } else {
    // 単体攻撃
    newBattleState = battleReducer(newBattleState, {
      ...battleAction,
      damage: actualDamage,
    })

    // vulnerabilityデバフによるダメージ倍化
    const amplifiedDamage = applyVulnerabilityMultiplier(battleAction.explorer.battleDebuffs, actualDamage)
    preDamageByMemberId.set(battleAction.targetExplorerId, amplifiedDamage)

    // シールドバフによるダメージ軽減
    const { reducedDamage: shieldedDamage, updatedBuffs: shieldedBuffs } = processShieldDamageReduction(battleAction.explorer.battleBuffs, amplifiedDamage)

    // ダメージポップアップを作成（シールド軽減後の値を使用、軽減発生時は shielded フラグ）
    if (amplifiedDamage > 0) {
      newBattleState = {
        ...newBattleState,
        playerDamagePopups: [
          ...newBattleState.playerDamagePopups,
          createPlayerDamagePopup(shieldedDamage, battleAction.targetExplorerId, undefined, shieldedDamage < amplifiedDamage),
        ],
      }
    }

    // 苦痛のリング: 被ダメ→MP固定回復
    const dmgToMpValue = getDamageTakenToMpValue(relics)
    const mpRecovery = dmgToMpValue

    let updatedExplorer = {
      ...battleAction.explorer,
      hp: Math.max(0, battleAction.explorer.hp - shieldedDamage),
      mp: Math.min(battleAction.explorer.mp + mpRecovery, battleAction.explorer.maxMp),
      battleBuffs: shieldedBuffs,
      damageTakenThisTurn: battleAction.explorer.damageTakenThisTurn + amplifiedDamage,
    }

    // 毒付与: プレイヤーのbattleDebuffsにpoisonを加算
    if (battleAction.poisonStacks > 0) {
      const existingPoison = updatedExplorer.battleDebuffs.find(d => d.type === 'poison')
      if (existingPoison && existingPoison.type === 'poison') {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: updatedExplorer.battleDebuffs.map(d =>
            d.type === 'poison'
              ? { ...d, stacks: d.stacks + battleAction.poisonStacks }
              : d
          ),
        }
      } else {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: [
            ...updatedExplorer.battleDebuffs,
            { type: 'poison' as const, stacks: battleAction.poisonStacks },
          ],
        }
      }
    }

    // MPドレイン: プレイヤーのmpを減少（最低0）
    if (battleAction.mpDrain > 0) {
      updatedExplorer = {
        ...updatedExplorer,
        mp: Math.max(0, updatedExplorer.mp - battleAction.mpDrain),
      }
    }

    // applyVulnerability: プレイヤーに被ダメ増加デバフ付与（弱体の呪い）
    if (battleAction.applyVulnerability) {
      const { multiplier, duration } = battleAction.applyVulnerability
      const existingVuln = updatedExplorer.battleDebuffs.find(d => d.type === 'vulnerability')
      if (existingVuln) {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: updatedExplorer.battleDebuffs.map(d =>
            d.type === 'vulnerability'
              ? { ...d, multiplier, duration, justApplied: true }
              : d
          ),
        }
      } else {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: [
            ...updatedExplorer.battleDebuffs,
            { type: 'vulnerability' as const, multiplier, duration, justApplied: true },
          ],
        }
      }
    }

    // weaponSeal: 対象の武器耐久-1（ランダムな武器1本）
    if (battleAction.weaponSeal) {
      const usableWeapons = updatedExplorer.weapons
        .map((w, i) => ({ weapon: w, index: i }))
        .filter(({ weapon }) => weapon.currentUses !== null && weapon.currentUses > 0)
      if (usableWeapons.length > 0) {
        const targetWeapon = usableWeapons[Math.floor(Math.random() * usableWeapons.length)]
        updatedExplorer = {
          ...updatedExplorer,
          weapons: updatedExplorer.weapons.map((w, i) => {
            if (i === targetWeapon.index && w.currentUses !== null) {
              return { ...w, currentUses: Math.max(0, w.currentUses - 1) } as typeof w
            }
            return w
          }),
        }
      }
    }

    // applyWeakness: プレイヤーに弱体デバフ付与
    if (battleAction.applyWeakness) {
      const { value, duration } = battleAction.applyWeakness
      const existingWeakness = updatedExplorer.battleDebuffs.find(d => d.type === 'weakness')
      if (existingWeakness) {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: updatedExplorer.battleDebuffs.map(d =>
            d.type === 'weakness'
              ? { ...d, value, duration, justApplied: true }
              : d
          ),
        }
      } else {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: [
            ...updatedExplorer.battleDebuffs,
            { type: 'weakness' as const, value, duration, justApplied: true },
          ],
        }
      }
    }

    newRun = updatePartyMember(newRun, updatedExplorer)
  }

  // weaponSealAll: 全パーティーメンバーの武器耐久-1（リッチPhase2）
  if (battleAction.weaponSealAll) {
    for (const member of newRun.party) {
      if (member.hp <= 0) continue
      const usableWeapons = member.weapons
        .map((w, i) => ({ weapon: w, index: i }))
        .filter(({ weapon }) => weapon.currentUses !== null && weapon.currentUses > 0)
      if (usableWeapons.length > 0) {
        const targetWeapon = usableWeapons[Math.floor(Math.random() * usableWeapons.length)]
        const updatedMember = {
          ...member,
          weapons: member.weapons.map((w, i) => {
            if (i === targetWeapon.index && w.currentUses !== null) {
              return { ...w, currentUses: Math.max(0, w.currentUses - 1) } as typeof w
            }
            return w
          }),
        }
        newRun = updatePartyMember(newRun, updatedMember)
      }
    }
  }

  // mpDrainAll: 全パーティーメンバーのMP吸収（リッチPhase1）
  if (battleAction.mpDrainAll && battleAction.mpDrainAll > 0) {
    for (const member of newRun.party) {
      if (member.hp <= 0) continue
      const updatedMember = {
        ...member,
        mp: Math.max(0, member.mp - battleAction.mpDrainAll),
      }
      newRun = updatePartyMember(newRun, updatedMember)
    }
  }

  // 棘反射: 被ダメージ（シールド前） × (スタック × 50%) を攻撃元に反射、スタック-1
  if (actualDamage > 0) {
    const hitMembers = battleAction.isAoe
      ? newRun.party.filter(m => {
          const wasAlive = state.run!.party.find(p => p.id === m.id)
          return wasAlive && wasAlive.hp > 0
        })
      : [newRun.party.find(m => m.id === battleAction.targetExplorerId)].filter(Boolean) as ExplorerState[]

    let totalBuffThornsDmg = 0
    for (const member of hitMembers) {
      const thornsBuff = member.battleBuffs.find(b => b.type === 'thorns')
      if (thornsBuff && thornsBuff.value > 0) {
        const preDamage = preDamageByMemberId.get(member.id) ?? 0
        const thornsStackRate = getTuningValue('thorns_base_rate', 0.5)
        totalBuffThornsDmg += Math.floor(preDamage * (thornsBuff.value * thornsStackRate))
      }
    }

    // 被弾メンバーの棘スタックを1減少
    for (const member of hitMembers) {
      const currentMember = newRun.party.find(m => m.id === member.id)
      if (!currentMember) continue
      const thornsBuff = currentMember.battleBuffs.find(b => b.type === 'thorns')
      if (thornsBuff && thornsBuff.value > 0) {
        const newValue = thornsBuff.value - 1
        const updatedBuffs = newValue <= 0
          ? currentMember.battleBuffs.filter(b => b.type !== 'thorns')
          : currentMember.battleBuffs.map(b =>
              b.type === 'thorns' ? { ...b, value: newValue } : b
            )
        newRun = updatePartyMember(newRun, {
          ...currentMember,
          battleBuffs: updatedBuffs,
        })
      }
    }

    if (totalBuffThornsDmg > 0) {
      const attackingEnemy = newBattleState.enemies.find(
        e => e.instanceId === battleAction.enemyId
      )
      if (attackingEnemy && attackingEnemy.currentHp > 0) {
        const updatedEnemies = newBattleState.enemies.map(enemy => {
          if (enemy.instanceId === battleAction.enemyId) {
            const newHp = Math.max(0, enemy.currentHp - totalBuffThornsDmg)
            const shouldTransform = enemy.id === 'sleep_tiger'
              && enemy.name !== 'マッドタイガー'
              && newHp / enemy.hp <= 0.8
            return { ...enemy, currentHp: newHp, ...(shouldTransform ? { name: 'マッドタイガー' } : {}) }
          }
          return enemy
        })
        newBattleState = battleReducer(newBattleState, {
          type: 'UPDATE_ENEMIES',
          enemies: updatedEnemies,
        })
      }
    }
  }

  // 身代わりの人形: 致死メンバーをHP1で耐え、レリック消滅（AoEで複数致死なら全員復活）
  if (state.run) {
    const result = applyDeathProtection(newRun, newBattleState, state.run.party)
    newRun = result.run
    newBattleState = result.battleState
  }

  return {
    ...state,
    battleState: newBattleState,
    run: newRun,
  }
}

/** PROCESS_TURN_ENDを処理 */
export function processTurnEndAction(
  state: GameState,
  battleAction: BattleAction & { type: 'PROCESS_TURN_END' }
): GameState {
  if (!state.battleState || !state.run) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // 敵のバフ持続ターン減少（defenseバフ等）
  const updatedEnemies = newBattleState.enemies.map(enemy => {
    if (enemy.currentHp <= 0) return enemy
    const updatedBuffs = enemy.battleBuffs
      .map(b => {
        if (typeof b.duration === 'number') {
          return { ...b, duration: b.duration - 1 }
        }
        return b
      })
      .filter(b => {
        if (typeof b.duration === 'number' && b.duration <= 0) return false
        return true
      })
    return { ...enemy, battleBuffs: updatedBuffs }
  })
  newBattleState = battleReducer(newBattleState, {
    type: 'UPDATE_ENEMIES',
    enemies: updatedEnemies,
  })

  // 毒ダメージ適用後のrunを構築し、身代わりの人形で致死回避判定
  const beforeParty = state.run.party
  let newRun = {
    ...state.run,
    party: battleAction.updatedParty,
  }
  const result = applyDeathProtection(newRun, newBattleState, beforeParty)
  newRun = result.run
  newBattleState = result.battleState

  return {
    ...state,
    battleState: newBattleState,
    run: newRun,
  }
}
