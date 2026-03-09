import { GameState, ResultState, EventState, MapState, createInitialGameState } from '../Types/Game'
import { RunState, createInitialRun } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { WeaponInstance, WeaponData } from '../Types/Weapon'
import { SpellData } from '../Types/Spell'
import { RelicData } from '../Types/Relic'
import { PotionData } from '../Types/Potion'
import { createBattleState } from './BattleStateFactory'
import { battleReducer, BattleAction } from './BattleReducer'
import { calculateReward } from '../Core/RewardCalculator'
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
import { getInterestCapBonus } from '../Core/RelicProcessor'
import {
  processExecuteCommand,
  processEnemyAction,
  processTurnEndAction,
} from './BattleActionProcessor'

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
  | { type: 'ADVANCE_FROM_MAP' }

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

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const run = createInitialRun()
      const battleState = createBattleState(run.currentStage, run.party, run.seed, run.relics)
      return { ...state, phase: 'battle', run, battleState }
    }

    case 'CONTINUE_GAME': {
      const { run } = action
      const storeState = createStoreState(run.seed + run.currentStage)
      return { ...state, phase: 'store', run, storeState }
    }

    case 'RETURN_TITLE':
      return createInitialGameState()

    case 'END_BATTLE': {
      if (!state.battleState || !state.run) return state

      if (action.result === 'victory') {
        const interestCapBonus = getInterestCapBonus(state.run.relics)
        const hasPiggyBank = interestCapBonus > 0

        const reward = calculateReward(
          state.battleState.enemies,
          state.run.gold,
          state.battleState.stolenGold,
          hasPiggyBank
        )

        const killCount = state.battleState.enemies.length

        const resultState: ResultState = {
          result: 'victory',
          goldEarned: reward.total,
          baseGold: reward.baseGold,
          interestGold: reward.interestGold,
          stolenGold: reward.stolenGold,
          killCount,
          levelUps: state.run.battleLevelUps,
        }

        const newRun: RunState = {
          ...state.run,
          gold: state.run.gold + reward.total,
          stats: {
            ...state.run.stats,
            totalKillCount: state.run.stats.totalKillCount + killCount,
            totalGoldEarned: state.run.stats.totalGoldEarned + reward.total,
          },
          battleLevelUps: [],
        }

        return { ...state, phase: 'result', run: newRun, battleState: null, resultState }
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

      return { ...state, phase: 'result', battleState: null, resultState }
    }

    case 'BATTLE_ACTION': {
      if (!state.battleState || !state.run) return state

      const battleAction = action.action

      if (battleAction.type === 'EXECUTE_COMMAND') {
        return processExecuteCommand(state, battleAction)
      }

      if (battleAction.type === 'ENEMY_ACTION') {
        return processEnemyAction(state, battleAction)
      }

      if (battleAction.type === 'PROCESS_TURN_END') {
        return processTurnEndAction(state, battleAction)
      }

      // その他のBattleActionはそのままBattleReducerに委譲
      const newBattleState = battleReducer(state.battleState, battleAction)
      return { ...state, battleState: newBattleState }
    }

    case 'OPEN_STORE': {
      if (!state.run) return state
      const storeState = createStoreState(state.run.seed + state.run.currentStage)
      return { ...state, phase: 'store', storeState, resultState: null }
    }

    case 'BUY_WEAPON': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action
      const explorer = state.run.party[0]

      if (state.run.gold < item.price) return state

      const weaponInstance: WeaponInstance = {
        ...item,
        currentUses: item.maxUses === null ? null : item.maxUses,
      }

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: [...explorer.weapons, weaponInstance],
      }

      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          party: [updatedExplorer, ...state.run.party.slice(1)],
        },
        storeState: { ...state.storeState, weaponSlots: newWeaponSlots },
      }
    }

    case 'BUY_SPELL': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action
      const explorer = state.run.party[0]

      if (state.run.gold < item.price) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: [...explorer.spells, item],
      }

      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          party: [updatedExplorer, ...state.run.party.slice(1)],
        },
        storeState: { ...state.storeState, weaponSlots: newWeaponSlots },
      }
    }

    case 'BUY_RELIC': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action
      if (state.run.gold < item.price) return state

      const newRelicSlots = [...state.storeState.relicSlots]
      newRelicSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          relics: [...state.run.relics, item],
        },
        storeState: { ...state.storeState, relicSlots: newRelicSlots },
      }
    }

    case 'BUY_POTION': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action
      if (state.run.gold < item.price) return state

      const newRelicSlots = [...state.storeState.relicSlots]
      newRelicSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          potions: [...state.run.potions, item],
        },
        storeState: { ...state.storeState, relicSlots: newRelicSlots },
      }
    }

    case 'SELL_WEAPON': {
      if (!state.run) return state

      const explorer = state.run.party[0]
      const weapon = explorer.weapons[action.weaponIndex]

      if (!weapon || weapon.id === 'punch') return state

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
      if (!state.run) return state

      const explorer = state.run.party[0]
      const spell = explorer.spells[action.spellIndex]
      if (!spell) return state

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
      if (!state.run) return state

      const relic = state.run.relics[action.relicIndex]
      if (!relic) return state

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
      if (!state.run) return state

      const potion = state.run.potions[action.potionIndex]
      if (!potion) return state

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
      if (!state.run || !state.storeState) return state
      if (state.run.gold < state.storeState.rerollCost) return state

      const newSeed = state.run.seed + state.run.currentStage + Date.now()
      const newStoreState = rerollStore(state.storeState, newSeed)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold - state.storeState.rerollCost },
        storeState: newStoreState,
      }
    }

    case 'CLOSE_STORE': {
      if (!state.run) return state
      return advanceToMapPhase(state, state.run)
    }

    case 'OPEN_EVENT': {
      if (!state.run) return state

      const eventState: EventState = {
        subPhase: 'selecting',
        revealedRelic: null,
        selectedWeaponIds: [],
      }

      return { ...state, phase: 'event', eventState, resultState: null }
    }

    case 'SELECT_REST': {
      if (!state.run || !state.eventState) return state
      const updatedParty = state.run.party.map(applyRest)
      return advanceToMapPhase(state, { ...state.run, party: updatedParty })
    }

    case 'SELECT_TREASURE': {
      if (!state.run || !state.eventState) return state

      const existingRelicIds = state.run.relics.map(r => r.id)
      const seed = state.run.seed + state.run.currentStage
      const revealedRelic = getRandomRelic(seed, existingRelicIds)
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
      if (!state.run || !state.eventState?.revealedRelic) return state
      const newRun = addRelic(state.run, state.eventState.revealedRelic)
      return advanceToMapPhase(state, newRun)
    }

    case 'CANCEL_TREASURE': {
      if (!state.run || !state.eventState) return state
      return advanceToMapPhase(state, state.run)
    }

    case 'REPLACE_RELIC': {
      if (!state.run || !state.eventState?.revealedRelic) return state
      const newRun = replaceRelic(state.run, action.sellRelicId, state.eventState.revealedRelic)
      return advanceToMapPhase(state, newRun)
    }

    case 'SELECT_REPAIR': {
      if (!state.run || !state.eventState) return state
      return {
        ...state,
        eventState: { ...state.eventState, subPhase: 'repairSelection', selectedWeaponIds: [] },
      }
    }

    case 'TOGGLE_REPAIR_WEAPON': {
      if (!state.eventState) return state

      const { weaponId } = action
      const { selectedWeaponIds } = state.eventState
      const MAX_REPAIR_COUNT = 2

      if (selectedWeaponIds.includes(weaponId)) {
        return {
          ...state,
          eventState: {
            ...state.eventState,
            selectedWeaponIds: selectedWeaponIds.filter(id => id !== weaponId),
          },
        }
      }

      if (selectedWeaponIds.length >= MAX_REPAIR_COUNT) return state

      return {
        ...state,
        eventState: {
          ...state.eventState,
          selectedWeaponIds: [...selectedWeaponIds, weaponId],
        },
      }
    }

    case 'CONFIRM_REPAIR': {
      if (!state.run || !state.eventState) return state

      const { selectedWeaponIds } = state.eventState
      if (selectedWeaponIds.length === 0) return state

      const updatedParty = state.run.party.map(explorer =>
        repairWeapons(explorer, selectedWeaponIds)
      )

      return advanceToMapPhase(state, { ...state.run, party: updatedParty })
    }

    case 'CLOSE_EVENT': {
      if (!state.run) return state
      return advanceToMapPhase(state, state.run)
    }

    case 'ADVANCE_FROM_MAP': {
      if (!state.run || !state.mapState) return state

      if (isEventStage(state.run.currentStage)) {
        return {
          ...state,
          phase: 'event',
          eventState: { subPhase: 'selecting', revealedRelic: null, selectedWeaponIds: [] },
          mapState: null,
        }
      }

      const battleState = createBattleState(
        state.run.currentStage, state.run.party, state.run.seed, state.run.relics
      )

      return { ...state, phase: 'battle', battleState, mapState: null }
    }

    default:
      return state
  }
}
