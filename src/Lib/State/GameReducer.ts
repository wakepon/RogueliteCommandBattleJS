import { GameState, ResultState, EventState, MapState, createInitialGameState } from '../Types/Game'
import { RunState, createInitialRun } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance, WeaponData } from '../Types/Weapon'
import { SpellData } from '../Types/Spell'
import { BattleCommand } from '../Types/Battle'
import { RelicData } from '../Types/Relic'
import { PotionData } from '../Types/Potion'
import { BattleState } from '../Types/Battle'
import { createBattleState } from './BattleStateFactory'
import { battleReducer, BattleAction } from './BattleReducer'
import { isSpell, isWeapon, isWeaponInstance, isPotion } from '../Core/CommandValidator'
import { calculateReward } from '../Core/RewardCalculator'
import { addExpAndProcessLevelUp, LevelUpInfo } from '../Core/LevelUpCalculator'
import {
  createStoreState,
  rerollStore,
  getSellPrice,
  getSellPriceItem,
} from '../Core/StoreLogic'
import { isEventStage } from '../Core/StageManager'
import {
  applyRest,
  getRandomRelic,
  isRelicSlotFull,
  addRelic,
  replaceRelic,
  repairWeapons,
} from '../Core/EventLogic'
import { generateMapNodes } from '../Core/MapGenerator'

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'CONTINUE_GAME'; run: RunState }
  | { type: 'RETURN_TITLE' }
  | { type: 'BATTLE_ACTION'; action: BattleAction }
  | { type: 'END_BATTLE'; result: 'victory' | 'defeat' }
  | { type: 'OPEN_STORE' }
  | { type: 'BUY_WEAPON'; slotIndex: number; item: WeaponData }
  | { type: 'BUY_SPELL'; slotIndex: number; item: SpellData }
  | { type: 'BUY_RELIC'; slotIndex: number; item: RelicData }
  | { type: 'BUY_POTION'; slotIndex: number; item: PotionData }
  | { type: 'SELL_WEAPON'; weaponIndex: number }
  | { type: 'SELL_SPELL'; spellIndex: number }
  | { type: 'SELL_RELIC'; relicIndex: number }
  | { type: 'SELL_POTION'; potionIndex: number }
  | { type: 'REROLL_STORE' }
  | { type: 'CLOSE_STORE' }
  // イベント関連アクション
  | { type: 'OPEN_EVENT' }
  | { type: 'SELECT_REST' }
  | { type: 'SELECT_TREASURE' }
  | { type: 'CONFIRM_TREASURE' }
  | { type: 'CANCEL_TREASURE' }
  | { type: 'REPLACE_RELIC'; sellRelicId: string }
  | { type: 'SELECT_REPAIR' }
  | { type: 'TOGGLE_REPAIR_WEAPON'; weaponId: string }
  | { type: 'CONFIRM_REPAIR' }
  | { type: 'CLOSE_EVENT' }
  // マップ関連アクション
  | { type: 'ADVANCE_FROM_MAP' }

/** 武器の使用回数を減らす */
function consumeWeaponUse(weapon: ExplorerWeapon): ExplorerWeapon {
  // パンチなど currentUses が null の場合は消費しない
  if (weapon.currentUses === null) {
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
  gold: number
): { updatedExplorer: ExplorerState; updatedGold: number } {
  if (isWeapon(command)) {
    // 武器の使用回数を減らす
    const updatedWeapons = explorer.weapons.map(w => {
      if (w.id === command.id) {
        return consumeWeaponUse(w)
      }
      return w
    })

    // goldCostの消費
    let newGold = gold
    if (isWeaponInstance(command) && command.goldCost !== undefined) {
      newGold = gold - command.goldCost
    }

    return {
      updatedExplorer: {
        ...explorer,
        weapons: updatedWeapons,
      },
      updatedGold: newGold,
    }
  }

  if (isSpell(command)) {
    // MPを消費
    return {
      updatedExplorer: {
        ...explorer,
        mp: explorer.mp - command.mpCost,
      },
      updatedGold: gold,
    }
  }

  return { updatedExplorer: explorer, updatedGold: gold }
}

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
    // 今回のアクションでHPが0以下になった敵をカウント
    return enemy.currentHp <= 0 && previousEnemy && previousEnemy.currentHp > 0
  }).length
}

/** 次のステージへ進みマップ画面に遷移する共通ヘルパー */
function advanceToMapPhase(state: GameState, run: RunState): GameState {
  const newStage = run.currentStage + 1
  const advancedRun: RunState = {
    ...run,
    currentStage: newStage,
    stats: {
      ...run.stats,
      maxStageReached: Math.max(run.stats.maxStageReached, newStage),
    },
  }
  const mapState: MapState = {
    nodes: generateMapNodes(advancedRun.seed),
    currentStage: newStage,
  }
  return {
    ...state,
    phase: 'map',
    run: advancedRun,
    mapState,
    storeState: null,
    eventState: null,
  }
}

/** レベルアップポップアップをバトルステートに追加 */
function addLevelUpPopupsToBattle(
  battleState: BattleState,
  levelUps: LevelUpInfo[]
): BattleState {
  if (levelUps.length === 0) {
    return battleState
  }

  // 最初のレベルアップのみポップアップに追加（順次表示のため）
  return battleReducer(battleState, {
    type: 'ADD_LEVEL_UP_POPUP',
    levelUpInfo: levelUps[0],
  })
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const run = createInitialRun()
      const battleState = createBattleState(run.currentStage, run.party, run.seed)
      return {
        ...state,
        phase: 'battle',
        run,
        battleState,
      }
    }

    case 'CONTINUE_GAME': {
      const { run } = action
      // ストア画面から再開（セーブは戦闘終了後に行われるため）
      const storeState = createStoreState(run.seed + run.currentStage)
      return {
        ...state,
        phase: 'store',
        run,
        storeState,
      }
    }

    case 'RETURN_TITLE':
      return createInitialGameState()

    case 'END_BATTLE': {
      if (!state.battleState || !state.run) {
        return state
      }

      if (action.result === 'victory') {
        // 貯金箱レリック判定
        const hasPiggyBank = state.run.relics.some(r => r.id === 'piggy_bank')

        // 報酬計算
        const reward = calculateReward(
          state.battleState.enemies,
          state.run.gold,
          state.battleState.stolenGold,
          hasPiggyBank
        )

        // 討伐数 = 倒した敵の数
        const killCount = state.battleState.enemies.length

        // ResultState を作成（レベルアップ情報を含む）
        const resultState: ResultState = {
          result: 'victory',
          goldEarned: reward.total,
          baseGold: reward.baseGold,
          interestGold: reward.interestGold,
          stolenGold: reward.stolenGold,
          killCount,
          levelUps: state.run.battleLevelUps,
        }

        // RunState を更新（ゴールド加算、討伐数更新、レベルアップ情報クリア）
        const newRun: RunState = {
          ...state.run,
          gold: state.run.gold + reward.total,
          stats: {
            ...state.run.stats,
            totalKillCount: state.run.stats.totalKillCount + killCount,
            totalGoldEarned: state.run.stats.totalGoldEarned + reward.total,
          },
          battleLevelUps: [], // 次の戦闘のためにクリア
        }

        return {
          ...state,
          phase: 'result',
          run: newRun,
          battleState: null,
          resultState,
        }
      }

      // 敗北時
      const resultState: ResultState = {
        result: 'defeat',
        goldEarned: 0,
        baseGold: 0,
        interestGold: 0,
        stolenGold: 0,
        killCount: 0,
        levelUps: [],
      }

      return {
        ...state,
        phase: 'result',
        battleState: null,
        resultState,
      }
    }

    case 'BATTLE_ACTION': {
      if (!state.battleState || !state.run) {
        return state
      }

      const battleAction = action.action

      // EXECUTE_COMMANDの場合はExplorerStateとgoldも更新する
      if (battleAction.type === 'EXECUTE_COMMAND') {
        const { selectedCommand } = state.battleState

        if (!selectedCommand) {
          return state
        }

        // ポーションの場合: 効果適用 + potions消費
        if (isPotion(selectedCommand)) {
          const newBattleState = battleReducer(state.battleState, battleAction)

          // ポーション効果を適用
          let updatedExplorer = battleAction.explorer
          const { effect } = selectedCommand
          if (effect.type === 'healHp') {
            updatedExplorer = {
              ...updatedExplorer,
              hp: Math.min(updatedExplorer.hp + effect.value, updatedExplorer.maxHp),
            }
          } else if (effect.type === 'healMp') {
            updatedExplorer = {
              ...updatedExplorer,
              mp: Math.min(updatedExplorer.mp + effect.value, updatedExplorer.maxMp),
            }
          }

          // potionsから1個消費（同名ポーションの最初の1つを削除）
          const potionIndex = state.run.potions.findIndex(p => p.id === selectedCommand.id)
          const updatedPotions = state.run.potions.filter((_, i) => i !== potionIndex)

          const newRun: RunState = {
            ...updatePartyMember(state.run, updatedExplorer),
            potions: updatedPotions,
          }

          return {
            ...state,
            battleState: newBattleState,
            run: newRun,
          }
        }

        // BattleReducerで戦闘状態を更新
        let newBattleState = battleReducer(state.battleState, battleAction)

        // ExplorerStateとgoldを更新
        const { updatedExplorer: explorerAfterCost, updatedGold } = consumeCommandCost(
          battleAction.explorer,
          selectedCommand,
          state.run.gold
        )

        // 敵討伐判定（今回倒した敵の数）
        const defeatedCount = countDefeatedEnemies(state.battleState.enemies, newBattleState.enemies)

        let finalExplorer = explorerAfterCost

        // スペルの効果を適用（ヒールなど）
        if (isSpell(selectedCommand) && selectedCommand.effect) {
          if (selectedCommand.effect.type === 'heal') {
            finalExplorer = {
              ...finalExplorer,
              hp: Math.min(finalExplorer.hp + selectedCommand.effect.value, finalExplorer.maxHp),
            }
          }
        }

        let newLevelUps: LevelUpInfo[] = []

        // 敵を倒した場合、経験値加算とレベルアップ処理
        if (defeatedCount > 0) {
          const levelUpResult = addExpAndProcessLevelUp(finalExplorer, defeatedCount)
          finalExplorer = levelUpResult.updatedExplorer
          newLevelUps = levelUpResult.levelUps

          // レベルアップポップアップを追加
          if (newLevelUps.length > 0) {
            newBattleState = addLevelUpPopupsToBattle(newBattleState, newLevelUps)
          }
        }

        // RunStateを更新
        const newRun: RunState = {
          ...updatePartyMember(state.run, finalExplorer),
          gold: updatedGold,
          // レベルアップ情報を一時保存（END_BATTLEで使用）
          battleLevelUps: [...state.run.battleLevelUps, ...newLevelUps],
        }

        return {
          ...state,
          battleState: newBattleState,
          run: newRun,
        }
      }

      // ENEMY_ACTIONの場合はExplorerのHPを減らす
      if (battleAction.type === 'ENEMY_ACTION') {
        const newBattleState = battleReducer(state.battleState, battleAction)

        // explorer の HP を減らす
        const updatedExplorer = {
          ...battleAction.explorer,
          hp: Math.max(0, battleAction.explorer.hp - battleAction.damage),
        }

        const newRun = updatePartyMember(state.run, updatedExplorer)

        return {
          ...state,
          battleState: newBattleState,
          run: newRun,
        }
      }

      // PROCESS_TURN_ENDの場合は毒ダメージ等を反映したexplorerを更新
      if (battleAction.type === 'PROCESS_TURN_END') {
        const newBattleState = battleReducer(state.battleState, battleAction)

        const newRun = updatePartyMember(state.run, battleAction.updatedExplorer)

        return {
          ...state,
          battleState: newBattleState,
          run: newRun,
        }
      }

      // その他のBattleActionはそのままBattleReducerに委譲
      const newBattleState = battleReducer(state.battleState, battleAction)

      return {
        ...state,
        battleState: newBattleState,
      }
    }

    case 'OPEN_STORE': {
      if (!state.run) {
        return state
      }

      const storeState = createStoreState(state.run.seed + state.run.currentStage)

      return {
        ...state,
        phase: 'store',
        storeState,
        resultState: null,
      }
    }

    case 'BUY_WEAPON': {
      if (!state.run || !state.storeState) {
        return state
      }

      const { slotIndex, item } = action
      const explorer = state.run.party[0]

      // ゴールドが足りない
      if (state.run.gold < item.price) {
        return state
      }

      // WeaponInstanceを作成
      const weaponInstance: WeaponInstance = {
        ...item,
        currentUses: item.maxUses === null ? null : item.maxUses,
      }

      // Explorerの武器を更新
      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: [...explorer.weapons, weaponInstance],
      }

      // スロットをnullに
      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          party: [updatedExplorer, ...state.run.party.slice(1)],
        },
        storeState: {
          ...state.storeState,
          weaponSlots: newWeaponSlots,
        },
      }
    }

    case 'BUY_SPELL': {
      if (!state.run || !state.storeState) {
        return state
      }

      const { slotIndex, item } = action
      const explorer = state.run.party[0]

      // ゴールドが足りない
      if (state.run.gold < item.price) {
        return state
      }

      // Explorerの魔法を更新
      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: [...explorer.spells, item],
      }

      // スロットをnullに
      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          party: [updatedExplorer, ...state.run.party.slice(1)],
        },
        storeState: {
          ...state.storeState,
          weaponSlots: newWeaponSlots,
        },
      }
    }

    case 'BUY_RELIC': {
      if (!state.run || !state.storeState) {
        return state
      }

      const { slotIndex, item } = action

      // ゴールドが足りない
      if (state.run.gold < item.price) {
        return state
      }

      // スロットをnullに
      const newRelicSlots = [...state.storeState.relicSlots]
      newRelicSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          relics: [...state.run.relics, item],
        },
        storeState: {
          ...state.storeState,
          relicSlots: newRelicSlots,
        },
      }
    }

    case 'BUY_POTION': {
      if (!state.run || !state.storeState) {
        return state
      }

      const { slotIndex, item } = action

      // ゴールドが足りない
      if (state.run.gold < item.price) {
        return state
      }

      // スロットをnullに
      const newRelicSlots = [...state.storeState.relicSlots]
      newRelicSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          potions: [...state.run.potions, item],
        },
        storeState: {
          ...state.storeState,
          relicSlots: newRelicSlots,
        },
      }
    }

    case 'SELL_WEAPON': {
      if (!state.run) {
        return state
      }

      const explorer = state.run.party[0]
      const weapon = explorer.weapons[action.weaponIndex]

      // パンチは売れない
      if (!weapon || weapon.id === 'punch') {
        return state
      }

      const sellPrice = getSellPrice(weapon)

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: explorer.weapons.filter((_, i) => i !== action.weaponIndex),
      }

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold + sellPrice,
          party: [updatedExplorer, ...state.run.party.slice(1)],
        },
      }
    }

    case 'SELL_SPELL': {
      if (!state.run) {
        return state
      }

      const explorer = state.run.party[0]
      const spell = explorer.spells[action.spellIndex]

      if (!spell) {
        return state
      }

      const sellPrice = getSellPriceItem(spell)

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: explorer.spells.filter((_, i) => i !== action.spellIndex),
      }

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold + sellPrice,
          party: [updatedExplorer, ...state.run.party.slice(1)],
        },
      }
    }

    case 'SELL_RELIC': {
      if (!state.run) {
        return state
      }

      const relic = state.run.relics[action.relicIndex]

      if (!relic) {
        return state
      }

      const sellPrice = getSellPriceItem(relic)

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold + sellPrice,
          relics: state.run.relics.filter((_, i) => i !== action.relicIndex),
        },
      }
    }

    case 'SELL_POTION': {
      if (!state.run) {
        return state
      }

      const potion = state.run.potions[action.potionIndex]

      if (!potion) {
        return state
      }

      const sellPrice = getSellPriceItem(potion)

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold + sellPrice,
          potions: state.run.potions.filter((_, i) => i !== action.potionIndex),
        },
      }
    }

    case 'REROLL_STORE': {
      if (!state.run || !state.storeState) {
        return state
      }

      // ゴールドが足りない
      if (state.run.gold < state.storeState.rerollCost) {
        return state
      }

      // 新しいシードを生成
      const newSeed = state.run.seed + state.run.currentStage + Date.now()
      const newStoreState = rerollStore(state.storeState, newSeed)

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - state.storeState.rerollCost,
        },
        storeState: newStoreState,
      }
    }

    case 'CLOSE_STORE': {
      if (!state.run) {
        return state
      }
      return advanceToMapPhase(state, state.run)
    }

    case 'OPEN_EVENT': {
      if (!state.run) {
        return state
      }

      const eventState: EventState = {
        subPhase: 'selecting',
        revealedRelic: null,
        selectedWeaponIds: [],
      }

      return {
        ...state,
        phase: 'event',
        eventState,
        resultState: null,
      }
    }

    case 'SELECT_REST': {
      if (!state.run || !state.eventState) {
        return state
      }

      // パーティメンバーのHPを回復
      const updatedParty = state.run.party.map(applyRest)

      return advanceToMapPhase(state, { ...state.run, party: updatedParty })
    }

    case 'SELECT_TREASURE': {
      if (!state.run || !state.eventState) {
        return state
      }

      // ランダムなレリックを取得
      const existingRelicIds = state.run.relics.map(r => r.id)
      const seed = state.run.seed + state.run.currentStage
      const revealedRelic = getRandomRelic(seed, existingRelicIds)

      // レリック枠が満杯かどうかで次のサブフェーズを決定
      const isFull = isRelicSlotFull(state.run.relics)

      return {
        ...state,
        eventState: {
          ...state.eventState,
          subPhase: isFull ? 'treasureReplace' : 'treasureReveal',
          revealedRelic,
        },
      }
    }

    case 'CONFIRM_TREASURE': {
      if (!state.run || !state.eventState || !state.eventState.revealedRelic) {
        return state
      }

      // レリックを追加して次のステージへ
      const newRun = addRelic(state.run, state.eventState.revealedRelic)
      return advanceToMapPhase(state, newRun)
    }

    case 'CANCEL_TREASURE': {
      if (!state.run || !state.eventState) {
        return state
      }

      // レリックを獲得せずに次のステージへ
      return advanceToMapPhase(state, state.run)
    }

    case 'REPLACE_RELIC': {
      if (!state.run || !state.eventState || !state.eventState.revealedRelic) {
        return state
      }

      // 既存のレリックを売却して新しいレリックを追加
      const newRun = replaceRelic(
        state.run,
        action.sellRelicId,
        state.eventState.revealedRelic
      )

      return advanceToMapPhase(state, newRun)
    }

    case 'SELECT_REPAIR': {
      if (!state.run || !state.eventState) {
        return state
      }

      return {
        ...state,
        eventState: {
          ...state.eventState,
          subPhase: 'repairSelection',
          selectedWeaponIds: [],
        },
      }
    }

    case 'TOGGLE_REPAIR_WEAPON': {
      if (!state.eventState) {
        return state
      }

      const { weaponId } = action
      const { selectedWeaponIds } = state.eventState
      const MAX_REPAIR_COUNT = 2

      // 既に選択されていれば解除
      if (selectedWeaponIds.includes(weaponId)) {
        return {
          ...state,
          eventState: {
            ...state.eventState,
            selectedWeaponIds: selectedWeaponIds.filter(id => id !== weaponId),
          },
        }
      }

      // 最大数に達している場合は追加しない
      if (selectedWeaponIds.length >= MAX_REPAIR_COUNT) {
        return state
      }

      return {
        ...state,
        eventState: {
          ...state.eventState,
          selectedWeaponIds: [...selectedWeaponIds, weaponId],
        },
      }
    }

    case 'CONFIRM_REPAIR': {
      if (!state.run || !state.eventState) {
        return state
      }

      const { selectedWeaponIds } = state.eventState

      // 選択された武器がなければ何もしない
      if (selectedWeaponIds.length === 0) {
        return state
      }

      // パーティメンバーの武器を修理して次のステージへ
      const updatedParty = state.run.party.map(explorer =>
        repairWeapons(explorer, selectedWeaponIds)
      )

      return advanceToMapPhase(state, { ...state.run, party: updatedParty })
    }

    case 'CLOSE_EVENT': {
      if (!state.run) {
        return state
      }

      return advanceToMapPhase(state, state.run)
    }

    case 'ADVANCE_FROM_MAP': {
      if (!state.run || !state.mapState) {
        return state
      }

      // イベントステージの場合 → イベント画面へ
      if (isEventStage(state.run.currentStage)) {
        return {
          ...state,
          phase: 'event',
          eventState: {
            subPhase: 'selecting',
            revealedRelic: null,
            selectedWeaponIds: [],
          },
          mapState: null,
        }
      }

      // 通常バトル / ボス → バトル開始
      const battleState = createBattleState(
        state.run.currentStage,
        state.run.party,
        state.run.seed
      )

      return {
        ...state,
        phase: 'battle',
        battleState,
        mapState: null,
      }
    }

    default:
      return state
  }
}
