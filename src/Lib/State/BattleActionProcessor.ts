import { GameState } from '../Types/Game'
import { RunState } from '../Types/Run'
import { ExplorerState, Buff } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { BattleCommand, BattleState, ExpPopup, BonusGain } from '../Types/Battle'
import { SpellData } from '../Types/Spell'
import { RelicInstance } from '../Types/Relic'
import { battleReducer, BattleAction, createPlayerDamagePopup, createExpPopup } from './BattleReducer'
import {
  applyDefenseReduction,
  applyChargeToEnemy,
  consumeChargeFromEnemy,
  applyChargeToAllAllies,
  applySelfDefenseBuff,
  applyHealSelf,
  applyHealAlly,
  applySummonEnemy,
} from './EnemyEffectProcessor'
import { isSpell, isWeapon, isWeaponInstance } from '../Core/CommandValidator'
import { calculateWeaponDamage, calculateSpellDamage } from '../Core/DamageCalculator'
import { consumeNextActionBuffs } from '../Core/BuffProcessor'
import { distributeExpToParty, LevelUpInfo } from '../Core/LevelUpCalculator'
import {
  getWeaponDurabilitySaveChance,
  getWeaponAttackMpRecover,
  getThornsDamage,
  getRegenPerTurn,
  hasRelicEffect,
  getWeaponBreakIncrement,
  getWeaponBreakAttackBonus,
  getDamageTakenToMpRate,
  getLevelUpDamageBoost,
  hasDeathProtection,
} from '../Core/RelicProcessor'
import { processShieldDamageReduction } from '../Core/BuffProcessor'

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
 * 闘気の腕輪: レベルアップしたキャラに次攻撃ダメージ倍率バフを付与
 * 戦闘中レベルアップ発生時に呼ぶ。複数回レベルアップは1回分のみ付与。
 */
function applyLevelUpDamageBoost(
  run: RunState,
  levelUps: LevelUpInfo[],
  relics: RelicInstance[]
): RunState {
  if (levelUps.length === 0) return run
  const multiplier = getLevelUpDamageBoost(relics)
  if (multiplier <= 1.0) return run

  // 同じキャラが複数回レベルアップしても1バフのみ付与
  const levelUpExplorerIds = new Set(levelUps.map(l => l.explorerId))
  let updatedRun = run
  for (const explorerId of levelUpExplorerIds) {
    const member = updatedRun.party.find(e => e.id === explorerId)
    if (!member) continue
    // 既に同バフがあれば重複付与しない（同ターン複数撃破で連続レベルアップした場合）
    if (member.battleBuffs.some(b => b.type === 'levelUpDamageBoost')) continue
    const boostBuff: Buff = {
      type: 'levelUpDamageBoost',
      value: multiplier,
      duration: 'nextAction',
    }
    const updatedMember: ExplorerState = {
      ...member,
      battleBuffs: [...member.battleBuffs, boostBuff],
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
  gold: number,
  durabilitySaveChance: number,
  weaponIndex?: number
): { updatedExplorer: ExplorerState; updatedGold: number } {
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

    let newGold = gold
    if (isWeaponInstance(command) && command.goldCost !== undefined) {
      newGold = gold - command.goldCost
    }

    // hpCost消費（呪いの槍など）- HP最低1を保証
    let updatedExplorer: ExplorerState = { ...explorer, weapons: updatedWeapons }
    if (isWeaponInstance(command) && command.hpCost !== undefined) {
      updatedExplorer = { ...updatedExplorer, hp: Math.max(1, updatedExplorer.hp - command.hpCost) }
    }

    return {
      updatedExplorer,
      updatedGold: newGold,
    }
  }

  if (isSpell(command)) {
    return {
      updatedExplorer: { ...explorer, mp: explorer.mp - command.mpCost },
      updatedGold: gold,
    }
  }

  return { updatedExplorer: explorer, updatedGold: gold }
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

  // enemyAll武器: 全敵にダメージ
  if (isWeapon(selectedCommand) && isWeaponInstance(selectedCommand) && selectedCommand.targetType === 'enemyAll') {
    return executeEnemyAllAttack(state, battleAction, relics, selectedCommand)
  }

  // enemyAll魔法: 全敵にダメージ
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'enemyAll') {
    return executeSpellAllAttack(state, battleAction, relics, selectedCommand)
  }

  const isWeaponAttack = isWeapon(selectedCommand)

  const targetEnemy = state.battleState.enemies.find(e => e.instanceId === selectedTargetId)
  if (!targetEnemy) return state

  // 空振り: ターゲットが既に倒されている場合、リソース消費なしでスキップ
  if (targetEnemy.currentHp <= 0) {
    const newBattleState = battleReducer(state.battleState, battleAction)
    return { ...state, battleState: newBattleState }
  }

  // ダメージ計算
  let calculatedDamage = 0
  let contributors: import('../Core/DamageCalculator').DamageContributor[] = []

  if (isWeaponAttack) {
    const result = calculateWeaponDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
      killStreakActive: state.battleState.relicState.killStreakActive,
      weaponBreakMultiplier: state.run.weaponBreakMultiplier ?? 0,
      party: state.run.party,
    })
    calculatedDamage = result.damage
    contributors = result.contributors
  } else if (isSpell(selectedCommand)) {
    const result = calculateSpellDamage(battleAction.explorer, selectedCommand, targetEnemy, {
      relics,
      party: state.run.party,
    })
    calculatedDamage = result.damage
    contributors = result.contributors

    // ゴールドバースト: 所持金の一定割合を消費してダメージ追加
    if (selectedCommand.effect?.type === 'goldDamage') {
      const goldToConsume = Math.ceil(state.run.gold * selectedCommand.effect.rate)
      const goldBonusDamage = goldToConsume * selectedCommand.effect.multiplier
      calculatedDamage += Math.floor(goldBonusDamage)
      if (goldToConsume > 0) {
        contributors.push({ name: 'ゴールドバースト', label: `${goldToConsume}G→+${Math.floor(goldBonusDamage)}` })
      }
    }
  } else {
    return state
  }

  // 敵のdefenseバフによるダメージ軽減
  const reducedDamage = applyDefenseReduction(calculatedDamage, targetEnemy.battleBuffs)
  if (reducedDamage !== calculatedDamage) {
    const defenseBuff = targetEnemy.battleBuffs.find(b => b.type === 'defense')!
    const reduction = defenseBuff.value / 100
    contributors.push({ name: 'ガード', label: `×${(1.0 - reduction).toFixed(1)}` })
    calculatedDamage = reducedDamage
  }

  // BattleReducerに事前計算済みダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamage,
    contributors,
  })

  // コスト消費（同ID武器区別のためweaponIndexを渡す）
  const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  let { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
    battleAction.explorer, selectedCommand, state.run.gold, durabilitySaveChance, currentSlot?.weaponIndex
  )

  // ゴールドバースト: ゴールド消費
  if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'goldDamage') {
    const goldToConsume = Math.ceil(state.run.gold * selectedCommand.effect.rate)
    updatedGold -= goldToConsume
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

  // 魂喰いの剣: トドメを刺したら耐久を消費しない（巻き戻し）
  if (isWeaponAttack && isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'killPreserveDurability' && defeatedCount > 0) {
    const targetIndex = currentSlot?.weaponIndex !== undefined
      ? currentSlot.weaponIndex
      : finalExplorer.weapons.findIndex(w => w.id === selectedCommand.id)
    if (targetIndex >= 0) {
      const beforeWeapon = battleAction.explorer.weapons[targetIndex]
      finalExplorer = {
        ...finalExplorer,
        weapons: finalExplorer.weapons.map((w, i) => {
          if (i !== targetIndex) return w
          // 消費前の耐久に巻き戻す
          if (beforeWeapon && 'currentUses' in beforeWeapon) {
            return { ...w, currentUses: beforeWeapon.currentUses } as typeof w
          }
          return w
        }),
      }
    }
  }

  // ストレス発散: パンチ以外の武器攻撃後にMP回復
  if (isWeaponAttack) {
    const mpRecover = getWeaponAttackMpRecover(relics)
    if (mpRecover && (!mpRecover.excludeWeaponId || selectedCommand.id !== mpRecover.excludeWeaponId)) {
      finalExplorer = {
        ...finalExplorer,
        mp: Math.min(finalExplorer.mp + mpRecover.value, finalExplorer.maxMp),
      }
    }
  }

  // 血染めの手袋: killStreakActive を1度に決定
  if (isWeaponAttack) {
    const killedWithWeapon = defeatedCount > 0 && hasRelicEffect(relics, 'killStreakBonus')
    const nextKillStreakActive = killedWithWeapon
    if (nextKillStreakActive !== state.battleState.relicState.killStreakActive) {
      newBattleState = battleReducer(newBattleState, {
        type: 'UPDATE_RELIC_STATE',
        relicState: { killStreakActive: nextKillStreakActive },
      })
    }
  }

  // 武器破壊検出: 耐久が0になった武器があればレリック効果を適用
  let updatedWeaponBreakMultiplier = state.run.weaponBreakMultiplier ?? 0
  if (isWeaponAttack) {
    const weaponBefore = battleAction.explorer.weapons.find(w => w.id === selectedCommand.id)
    const weaponAfter = finalExplorer.weapons.find(w => w.id === selectedCommand.id)
    if (weaponBefore && weaponAfter &&
        weaponBefore.currentUses !== null && weaponBefore.currentUses > 0 &&
        weaponAfter.currentUses !== null && weaponAfter.currentUses <= 0) {
      // 不死鳥の残り火: 蓄積倍率を加算
      const breakIncrement = getWeaponBreakIncrement(relics)
      if (breakIncrement > 0) {
        updatedWeaponBreakMultiplier += breakIncrement
      }
      // 鍛冶師の金槌: 次の武器攻撃にPowerボーナス
      const breakBonus = getWeaponBreakAttackBonus(relics)
      if (breakBonus > 0) {
        finalExplorer = {
          ...finalExplorer,
          battleBuffs: [...finalExplorer.battleBuffs, { type: 'weaponPowerBonus', value: breakBonus, duration: 'nextAction' as const }],
        }
      }
    }
  }

  // 魔法の goldOnHit 効果: ゴールド獲得
  // ボーナスゴールド獲得記録（リザルト画面の内訳表示用）
  const localBonusGains: BonusGain[] = []
  let extraGold = 0
  if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'goldOnHit') {
    extraGold += selectedCommand.effect.value
    if (extraGold > 0) {
      localBonusGains.push({ source: selectedCommand.name, value: extraGold })
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
    gold: updatedGold + extraGold,
    weaponBreakMultiplier: updatedWeaponBreakMultiplier,
  }

  if (defeatedCount > 0) {
    // 商人の護符など: 敵撃破時ゴールド追加（レリックごとに source 名を保持）
    const goldPerKillRelics = relics.filter(r => r.passiveEffect?.type === 'goldPerKill')
    for (const relic of goldPerKillRelics) {
      const perKill = (relic.passiveEffect as { value: number }).value
      const total = perKill * defeatedCount
      if (total > 0) {
        updatedRun = { ...updatedRun, gold: updatedRun.gold + total }
        localBonusGains.push({ source: relic.name, value: total })
      }
    }

    // 教育の魔弾: トドメで全員にボーナスEXP
    let extraBonusToAll = 0
    if (isSpell(selectedCommand) && selectedCommand.effect?.type === 'killBonusExpToAll') {
      extraBonusToAll = defeatedCount
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
      // 闘気の腕輪: レベルアップしたキャラに次攻撃ダメージ倍率バフ付与
      updatedRun = applyLevelUpDamageBoost(updatedRun, newLevelUps, relics)
    }
  }

  // ボーナスゴールド獲得を battleState.bonusGains に反映
  if (localBonusGains.length > 0) {
    newBattleState = {
      ...newBattleState,
      bonusGains: [...newBattleState.bonusGains, ...localBonusGains],
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
  spell: SpellData
): GameState {
  if (!state.battleState || !state.run) return state
  const partySnapshot = state.run.party

  // 生存中の全敵に対してダメージ計算
  const aliveEnemies = state.battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) {
    return state
  }
  let allContributors: import('../Core/DamageCalculator').DamageContributor[] = []
  const calculatedDamages = aliveEnemies.map((enemy, i) => {
    const result = calculateSpellDamage(battleAction.explorer, spell, enemy, {
      relics,
      party: partySnapshot,
    })
    if (i === 0) allContributors = result.contributors
    // defenseバフによる軽減
    const finalDamage = applyDefenseReduction(result.damage, enemy.battleBuffs)
    return { targetId: enemy.instanceId, damage: finalDamage }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
    contributors: allContributors,
  })

  // MP消費
  const { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
    battleAction.explorer, spell, state.run.gold, 0
  )

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
  let updatedRun = {
    ...updatePartyMember(state.run, finalExplorer),
    gold: updatedGold,
  }

  if (defeatedCount > 0) {
    // 導きバフ: 攻撃者にバフがあればキラーに追加EXP、バフを消費
    const guidance = consumeGuidanceBuff(finalExplorer)
    finalExplorer = guidance.updatedExplorer
    // バフが除去された場合は常にpartyへ同期（冪等・将来value=0仕様にも耐える）
    updatedRun = updatePartyMember(updatedRun, finalExplorer)

    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount,
      { extraKillerBonus: guidance.extraKillerBonus }
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    // 敵位置→経験値バーへ飛ぶ EXP エフェクトを追加
    const defeatedEnemyIds = getDefeatedEnemyIds(state.battleState.enemies, newBattleState.enemies)
    newBattleState = addExpPopupsToBattle(newBattleState, defeatedEnemyIds, updatedRun.party, finalExplorer.id, {
      extraKillerBonus: guidance.extraKillerBonus,
    })

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
      // 闘気の腕輪: レベルアップしたキャラに次攻撃ダメージ倍率バフ付与
      updatedRun = applyLevelUpDamageBoost(updatedRun, newLevelUps, relics)
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

  // 生存中の全敵に対してダメージ計算
  const aliveEnemies = state.battleState.enemies.filter(e => e.currentHp > 0)
  if (aliveEnemies.length === 0) {
    return state
  }
  let allContributors: import('../Core/DamageCalculator').DamageContributor[] = []
  const calculatedDamages = aliveEnemies.map((enemy, i) => {
    const result = calculateWeaponDamage(battleAction.explorer, weapon, enemy, {
      relics,
      killStreakActive: state.battleState!.relicState.killStreakActive,
      party: partySnapshot,
    })
    if (i === 0) allContributors = result.contributors
    // defenseバフによる軽減
    const finalDamage = applyDefenseReduction(result.damage, enemy.battleBuffs)
    return { targetId: enemy.instanceId, damage: finalDamage }
  })

  // BattleReducerに全体ダメージを渡す
  let newBattleState = battleReducer(state.battleState, {
    ...battleAction,
    calculatedDamages,
    contributors: allContributors,
  })

  // コスト消費（同ID武器区別のためweaponIndexを渡す）
  const currentSlotAoe = state.battleState.commandSlots[state.battleState.currentCommandIndex]
  const durabilitySaveChance = getWeaponDurabilitySaveChance(relics)
  const { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
    battleAction.explorer, weapon, state.run.gold, durabilitySaveChance, currentSlotAoe?.weaponIndex
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

  // ストレス発散: パンチ以外の武器攻撃後にMP回復
  const mpRecover = getWeaponAttackMpRecover(relics)
  if (mpRecover && (!mpRecover.excludeWeaponId || weapon.id !== mpRecover.excludeWeaponId)) {
    finalExplorer = {
      ...finalExplorer,
      mp: Math.min(finalExplorer.mp + mpRecover.value, finalExplorer.maxMp),
    }
  }

  // 血染めの手袋: killStreakActive を1度に決定
  const killedWithWeapon = defeatedCount > 0 && hasRelicEffect(relics, 'killStreakBonus')
  const nextKillStreakActive = killedWithWeapon
  if (nextKillStreakActive !== state.battleState.relicState.killStreakActive) {
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_RELIC_STATE',
      relicState: { killStreakActive: nextKillStreakActive },
    })
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
    gold: updatedGold,
  }

  if (defeatedCount > 0) {
    // 導きバフ: 攻撃者にバフがあればキラーに追加EXP、バフを消費
    const guidance = consumeGuidanceBuff(finalExplorer)
    finalExplorer = guidance.updatedExplorer
    // バフが除去された場合は常にpartyへ同期（冪等・将来value=0仕様にも耐える）
    updatedRun = updatePartyMember(updatedRun, finalExplorer)

    // パーティー全員にEXP配分（止めキャラにボーナス）
    const { updatedParty, allLevelUps } = distributeExpToParty(
      updatedRun.party, finalExplorer.id, defeatedCount,
      { extraKillerBonus: guidance.extraKillerBonus }
    )
    newLevelUps = allLevelUps
    updatedRun = { ...updatedRun, party: updatedParty }

    // 敵位置→経験値バーへ飛ぶ EXP エフェクトを追加
    const defeatedEnemyIds = getDefeatedEnemyIds(state.battleState.enemies, newBattleState.enemies)
    newBattleState = addExpPopupsToBattle(newBattleState, defeatedEnemyIds, updatedRun.party, finalExplorer.id, {
      extraKillerBonus: guidance.extraKillerBonus,
    })

    if (newLevelUps.length > 0) {
      newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
      // 闘気の腕輪: レベルアップしたキャラに次攻撃ダメージ倍率バフ付与
      updatedRun = applyLevelUpDamageBoost(updatedRun, newLevelUps, relics)
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
  _relics: RelicInstance[]
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand, selectedTargetId } = state.battleState
  if (!selectedCommand || !isSpell(selectedCommand) || !selectedTargetId) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // MP消費は術者に適用
  const { updatedExplorer: explorerAfterCost } = consumeCommandCost(
    battleAction.explorer, selectedCommand, state.run.gold, 0
  )

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

  // 生命変換（HP→MP）
  if (selectedCommand.effect?.type === 'hpToMp') {
    updatedTarget = {
      ...updatedTarget,
      hp: Math.max(1, updatedTarget.hp - selectedCommand.effect.hpCost),
      mp: Math.min(updatedTarget.mp + selectedCommand.effect.mpGain, updatedTarget.maxMp),
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

  // 師弟の絆: 導きバフ付与（次のトドメで+1ボーナスEXP）
  if (selectedCommand.effect?.type === 'guidanceBuff') {
    const guidanceBuff: Buff = {
      type: 'guidance',
      value: 1,
      duration: 'battle',
    }
    updatedTarget = {
      ...updatedTarget,
      battleBuffs: [...updatedTarget.battleBuffs, guidanceBuff],
    }
  }

  // 戦場の鍛冶（武器耐久回復）
  if (selectedCommand.effect?.type === 'repairWeapons') {
    const repairValue = selectedCommand.effect.value
    updatedTarget = {
      ...updatedTarget,
      weapons: updatedTarget.weapons.map(w => {
        if (w.currentUses === null || w.maxUses === null) return w
        return { ...w, currentUses: Math.min(w.currentUses + repairValue, w.maxUses) } as typeof w
      }),
    }
  }

  // 術者とターゲットが同じ場合は1回、異なる場合は2回updatePartyMember
  let updatedRun = updatePartyMember(state.run, updatedTarget)
  if (!isSelfTarget) {
    updatedRun = updatePartyMember(updatedRun, explorerAfterCost)
  }

  // ゴールドバースト（所持金消費→ダメージ）は敵単体対象なのでここでは処理しない

  return {
    ...state,
    battleState: newBattleState,
    run: updatedRun,
  }
}

/** 味方全体対象スペル（癒しの風など）を実行 */
function executeAllyAllSpellCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand || !isSpell(selectedCommand)) return state

  let newBattleState = battleReducer(state.battleState, battleAction)

  // MP消費は術者に適用
  const { updatedExplorer: explorerAfterCost } = consumeCommandCost(
    battleAction.explorer, selectedCommand, state.run.gold, 0
  )

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

  // 祈り: 対象キャラにtargetRateUpバフを付与
  if (isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'targetRateUp') {
    const targetMember = state.run.party.find(e => e.id === selectedTargetId)
    if (targetMember) {
      const newBuff: Buff = {
        type: 'targetRateUp',
        value: selectedCommand.effect.value,
        duration: 1,  // 次の敵フェーズ終了時にクリア
      }
      const updatedMember = {
        ...targetMember,
        battleBuffs: [...targetMember.battleBuffs, newBuff],
      }
      return {
        ...state,
        battleState: newBattleState,
        run: updatePartyMember(state.run, updatedMember),
      }
    }
  }

  // 守護の盾: 対象キャラにシールドバフ付与（武器耐久消費あり）
  if (isWeaponInstance(selectedCommand) && selectedCommand.effect?.type === 'shield') {
    const targetMember = state.run.party.find(e => e.id === selectedTargetId)
    if (targetMember) {
      const shieldBuff: Buff = {
        type: 'shield',
        value: selectedCommand.effect.value,
        duration: 1,
      }
      const updatedTarget = {
        ...targetMember,
        battleBuffs: [...targetMember.battleBuffs, shieldBuff],
      }

      // 攻撃者（武器の使用者）のコスト消費（耐久+hpCost+goldCost）
      const durabilitySaveChance = getWeaponDurabilitySaveChance(state.run.relics)
      const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
      const { updatedExplorer: updatedAttacker } = consumeCommandCost(
        battleAction.explorer, selectedCommand, state.run.gold, durabilitySaveChance, currentSlot?.weaponIndex
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

/** EXECUTE_COMMANDを処理 */
export function processExecuteCommand(
  state: GameState,
  battleAction: BattleAction & { type: 'EXECUTE_COMMAND' }
): GameState {
  if (!state.battleState || !state.run) return state

  const { selectedCommand } = state.battleState
  if (!selectedCommand) return state

  const relics = state.run.relics

  // 味方対象スペル（ヒール、精密など）
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'allySingle') {
    return applyRegenAfterAction(executeAllySpellCommand(state, battleAction, relics))
  }

  // 味方全体対象スペル（癒しの風など）
  if (isSpell(selectedCommand) && selectedCommand.targetType === 'allyAll') {
    return applyRegenAfterAction(executeAllyAllSpellCommand(state, battleAction))
  }

  // 味方対象武器（祈りなど）— 攻撃ではなくサポート行動
  if (isWeapon(selectedCommand) && selectedCommand.targetType === 'allySingle') {
    return applyRegenAfterAction(executeAllyWeaponCommand(state, battleAction))
  }

  return applyRegenAfterAction(executeAttackCommand(state, battleAction, relics))
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
  let perHitDamage = battleAction.damage

  // 壊れかけの鎧: shieldActive時に1hit目のみダメージ0化
  let newBattleState = state.battleState
  let shieldAbsorbed = false
  if (state.battleState.relicState.shieldActive && perHitDamage > 0) {
    shieldAbsorbed = true
    newBattleState = battleReducer(state.battleState, {
      type: 'UPDATE_RELIC_STATE',
      relicState: { shieldActive: false },
    })
  }

  // 合計ダメージ: シールドは1hit目のみ防ぐ
  const actualDamage = shieldAbsorbed
    ? perHitDamage * (hits - 1)
    : perHitDamage * hits

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
    effectState = applyHealAlly(effectState, battleAction.healAlly.amount)
  }

  // summonEnemyId: 戦闘中に敵を追加
  if (battleAction.summonEnemyId) {
    effectState = applySummonEnemy(effectState, battleAction.enemyId, battleAction.summonEnemyId)
  }

  // エフェクト適用結果をbattleReducer経由で反映
  if (effectState.enemies !== newBattleState.enemies) {
    newBattleState = battleReducer(newBattleState, {
      type: 'UPDATE_ENEMIES',
      enemies: effectState.enemies,
    })
  }

  // ダメージ処理: isAoeの場合は全生存メンバーにダメージ
  let newRun = state.run
  if (battleAction.isAoe && actualDamage > 0) {
    // 全体攻撃: BattleReducerにポップアップ用のダメージを通知
    newBattleState = battleReducer(newBattleState, {
      ...battleAction,
      damage: actualDamage,
    })

    // 全生存パーティーメンバーにダメージ適用（シールドバフ考慮、ポップアップは軽減後の値で作成）
    const aliveMembers = newRun.party.filter(m => m.hp > 0)
    const aoePopups = []
    for (const member of aliveMembers) {
      const { reducedDamage: memberDamage, updatedBuffs: memberBuffs } = processShieldDamageReduction(member.battleBuffs, actualDamage)
      // 苦痛のリング: 被ダメの一定割合をMP回復
      const dmgToMpRate = getDamageTakenToMpRate(relics)
      const mpRecovery = dmgToMpRate > 0 ? Math.ceil(memberDamage * dmgToMpRate) : 0
      const updatedMember = {
        ...member,
        hp: Math.max(0, member.hp - memberDamage),
        mp: Math.min(member.mp + mpRecovery, member.maxMp),
        battleBuffs: memberBuffs,
      }
      newRun = updatePartyMember(newRun, updatedMember)
      // メンバーごとにシールド軽減後のダメージでポップアップ作成（軽減発生時は shielded フラグ）
      aoePopups.push(createPlayerDamagePopup(memberDamage, member.id, undefined, memberDamage < actualDamage))
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

    // シールドバフによるダメージ軽減
    const { reducedDamage: shieldedDamage, updatedBuffs: shieldedBuffs } = processShieldDamageReduction(battleAction.explorer.battleBuffs, actualDamage)

    // ダメージポップアップを作成（シールド軽減後の値を使用、軽減発生時は shielded フラグ）
    if (actualDamage > 0) {
      newBattleState = {
        ...newBattleState,
        playerDamagePopups: [
          ...newBattleState.playerDamagePopups,
          createPlayerDamagePopup(shieldedDamage, battleAction.targetExplorerId, undefined, shieldedDamage < actualDamage),
        ],
      }
    }

    // 苦痛のリング: 被ダメの一定割合をMP回復
    const dmgToMpRate = getDamageTakenToMpRate(relics)
    const mpRecovery = dmgToMpRate > 0 ? Math.ceil(shieldedDamage * dmgToMpRate) : 0

    let updatedExplorer = {
      ...battleAction.explorer,
      hp: Math.max(0, battleAction.explorer.hp - shieldedDamage),
      mp: Math.min(battleAction.explorer.mp + mpRecovery, battleAction.explorer.maxMp),
      battleBuffs: shieldedBuffs,
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

    // applyWeakness: プレイヤーに弱体デバフ付与
    if (battleAction.applyWeakness) {
      const { value, duration } = battleAction.applyWeakness
      const existingWeakness = updatedExplorer.battleDebuffs.find(d => d.type === 'weakness')
      if (existingWeakness) {
        // 既存の弱体を上書き（duration更新）
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: updatedExplorer.battleDebuffs.map(d =>
            d.type === 'weakness'
              ? { ...d, value, duration }
              : d
          ),
        }
      } else {
        updatedExplorer = {
          ...updatedExplorer,
          battleDebuffs: [
            ...updatedExplorer.battleDebuffs,
            { type: 'weakness' as const, value, duration },
          ],
        }
      }
    }

    newRun = updatePartyMember(newRun, updatedExplorer)
  }

  // 反撃の棘: 被攻撃時に敵にダメージ（ダメージが発生した場合のみ）
  const thornsDmg = getThornsDamage(relics)
  if (thornsDmg > 0 && actualDamage > 0) {
    const attackingEnemy = newBattleState.enemies.find(
      e => e.instanceId === battleAction.enemyId
    )
    if (attackingEnemy && attackingEnemy.currentHp > 0) {
      const updatedEnemies = newBattleState.enemies.map(enemy => {
        if (enemy.instanceId === battleAction.enemyId) {
          return { ...enemy, currentHp: Math.max(0, enemy.currentHp - thornsDmg) }
        }
        return enemy
      })
      newBattleState = battleReducer(newBattleState, {
        type: 'UPDATE_ENEMIES',
        enemies: updatedEnemies,
      })
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
