import { GameState, ResultState, EventState, MapState, createInitialGameState } from '../Types/Game'
import { RunState, createInitialRun } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance, WeaponData } from '../Types/Weapon'
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
  | { type: 'BUY_WEAPON'; slotIndex: number; item: WeaponData; memberIndex: number }
  | { type: 'BUY_SPELL'; slotIndex: number; item: SpellData; memberIndex: number }
  | { type: 'BUY_RELIC'; slotIndex: number; item: RelicData }
  | { type: 'BUY_POTION'; slotIndex: number; item: PotionData }
  | { type: 'SELL_WEAPON'; weaponIndex: number; memberIndex: number }
  | { type: 'SELL_SPELL'; spellIndex: number; memberIndex: number }
  | { type: 'SELL_RELIC'; relicIndex: number }
  | { type: 'SELL_POTION'; potionIndex: number }
  | { type: 'UNDO_BUY_WEAPON'; shopSlotIndex: number; item: WeaponData; memberIndex: number; weaponIndex: number }
  | { type: 'UNDO_BUY_SPELL'; shopSlotIndex: number; item: SpellData; memberIndex: number; spellIndex: number }
  | { type: 'UNDO_BUY_RELIC'; shopSlotIndex: number; item: RelicData; relicIndex: number }
  | { type: 'UNDO_BUY_POTION'; shopSlotIndex: number; item: PotionData; potionIndex: number }
  | { type: 'UNDO_SELL_WEAPON'; weapon: ExplorerWeapon; memberIndex: number; sellPrice: number }
  | { type: 'UNDO_SELL_SPELL'; spell: SpellData; memberIndex: number; sellPrice: number }
  | { type: 'UNDO_SELL_RELIC'; relic: RelicData; sellPrice: number }
  | { type: 'UNDO_SELL_POTION'; potion: PotionData; sellPrice: number }
  | { type: 'TRANSFER_WEAPON'; fromMemberIndex: number; weaponIndex: number; toMemberIndex: number }
  | { type: 'TRANSFER_SPELL'; fromMemberIndex: number; spellIndex: number; toMemberIndex: number }
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
      const mapState: MapState = {
        nodes: generateMapNodes(run.seed),
        currentStage: run.currentStage,
      }
      return { ...state, phase: 'store', run, storeState, mapState }
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

        // 戦闘不能キャラをHP1で復活 + バフ/デバフをクリア
        const revivedParty = state.run.party.map(member => ({
          ...member,
          hp: member.hp <= 0 ? 1 : member.hp,
          battleBuffs: [],
          battleDebuffs: [],
        }))

        const newRun: RunState = {
          ...state.run,
          gold: state.run.gold + reward.total,
          party: revivedParty,
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
        // パーティー行動フェーズ: commandSlotsから現在のスロットの情報を使用
        const currentSlot = state.battleState.commandSlots[state.battleState.currentCommandIndex]
        if (!currentSlot?.command || !currentSlot.targetId) return state

        // BattleActionProcessorに渡すために、selectedCommand/selectedTargetIdを一時的にセット
        const stateWithSlotInfo: GameState = {
          ...state,
          battleState: {
            ...state.battleState,
            selectedCommand: currentSlot.command,
            selectedTargetId: currentSlot.targetId,
          },
        }

        // 該当するExplorerを取得
        const explorer = state.run.party.find(e => e.id === currentSlot.explorerId) ?? state.run.party[0]
        return processExecuteCommand(stateWithSlotInfo, { ...battleAction, explorer })
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
      const mapState: MapState = {
        nodes: generateMapNodes(state.run.seed),
        currentStage: state.run.currentStage,
      }
      return { ...state, phase: 'store', storeState, resultState: null, mapState }
    }

    case 'BUY_WEAPON': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item, memberIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

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

      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold - item.price, party: updatedParty },
        storeState: { ...state.storeState, weaponSlots: newWeaponSlots },
      }
    }

    case 'BUY_SPELL': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item, memberIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: [...explorer.spells, item],
      }

      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[slotIndex] = null

      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold - item.price, party: updatedParty },
        storeState: { ...state.storeState, weaponSlots: newWeaponSlots },
      }
    }

    case 'BUY_RELIC': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action

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

      const newPotionSlots = [...state.storeState.potionSlots]
      newPotionSlots[slotIndex] = null

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - item.price,
          potions: [...state.run.potions, item],
        },
        storeState: { ...state.storeState, potionSlots: newPotionSlots },
      }
    }

    case 'SELL_WEAPON': {
      if (!state.run) return state

      const explorer = state.run.party[action.memberIndex]
      if (!explorer) return state
      const weapon = explorer.weapons[action.weaponIndex]

      if (!weapon || weapon.id === 'punch') return state
      // 無限使用の無料武器（魔力弾、祈り）は売却不可
      if (weapon.maxUses === null && !('price' in weapon && weapon.price > 0)) return state

      const sellPrice = getSellPrice(weapon)
      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: explorer.weapons.filter((_, i) => i !== action.weaponIndex),
      }

      const updatedParty = state.run.party.map((m, i) => i === action.memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold + sellPrice, party: updatedParty },
      }
    }

    case 'SELL_SPELL': {
      if (!state.run) return state

      const explorer = state.run.party[action.memberIndex]
      if (!explorer) return state
      const spell = explorer.spells[action.spellIndex]
      if (!spell) return state

      const sellPrice = getSellPriceItem(spell)
      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: explorer.spells.filter((_, i) => i !== action.spellIndex),
      }

      const updatedParty = state.run.party.map((m, i) => i === action.memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold + sellPrice, party: updatedParty },
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

    // === 購入取り消し ===

    case 'UNDO_BUY_WEAPON': {
      if (!state.run || !state.storeState) return state
      const { shopSlotIndex, item, memberIndex, weaponIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer || !explorer.weapons[weaponIndex]) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: explorer.weapons.filter((_, i) => i !== weaponIndex),
      }
      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[shopSlotIndex] = item
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold + item.price, party: updatedParty },
        storeState: { ...state.storeState, weaponSlots: newWeaponSlots },
      }
    }

    case 'UNDO_BUY_SPELL': {
      if (!state.run || !state.storeState) return state
      const { shopSlotIndex, item, memberIndex, spellIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer || !explorer.spells[spellIndex]) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: explorer.spells.filter((_, i) => i !== spellIndex),
      }
      const newWeaponSlots = [...state.storeState.weaponSlots]
      newWeaponSlots[shopSlotIndex] = item
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold + item.price, party: updatedParty },
        storeState: { ...state.storeState, weaponSlots: newWeaponSlots },
      }
    }

    case 'UNDO_BUY_RELIC': {
      if (!state.run || !state.storeState) return state
      const { shopSlotIndex, item, relicIndex } = action
      if (!state.run.relics[relicIndex]) return state

      const newRelicSlots = [...state.storeState.relicSlots]
      newRelicSlots[shopSlotIndex] = item

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold + item.price,
          relics: state.run.relics.filter((_, i) => i !== relicIndex),
        },
        storeState: { ...state.storeState, relicSlots: newRelicSlots },
      }
    }

    case 'UNDO_BUY_POTION': {
      if (!state.run || !state.storeState) return state
      const { shopSlotIndex, item, potionIndex } = action
      if (!state.run.potions[potionIndex]) return state

      const newPotionSlots = [...state.storeState.potionSlots]
      newPotionSlots[shopSlotIndex] = item

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold + item.price,
          potions: state.run.potions.filter((_, i) => i !== potionIndex),
        },
        storeState: { ...state.storeState, potionSlots: newPotionSlots },
      }
    }

    // === 売却取り消し ===

    case 'UNDO_SELL_WEAPON': {
      if (!state.run) return state
      const { weapon, memberIndex, sellPrice } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: [...explorer.weapons, weapon],
      }
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold - sellPrice, party: updatedParty },
      }
    }

    case 'UNDO_SELL_SPELL': {
      if (!state.run) return state
      const { spell, memberIndex, sellPrice } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: [...explorer.spells, spell],
      }
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, gold: state.run.gold - sellPrice, party: updatedParty },
      }
    }

    case 'UNDO_SELL_RELIC': {
      if (!state.run) return state
      const { relic, sellPrice } = action

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - sellPrice,
          relics: [...state.run.relics, relic],
        },
      }
    }

    case 'UNDO_SELL_POTION': {
      if (!state.run) return state
      const { potion, sellPrice } = action

      return {
        ...state,
        run: {
          ...state.run,
          gold: state.run.gold - sellPrice,
          potions: [...state.run.potions, potion],
        },
      }
    }

    // === メンバー間装備移動 ===

    case 'TRANSFER_WEAPON': {
      if (!state.run) return state
      const { fromMemberIndex, weaponIndex, toMemberIndex } = action
      const fromExplorer = state.run.party[fromMemberIndex]
      const toExplorer = state.run.party[toMemberIndex]
      if (!fromExplorer || !toExplorer) return state
      const weapon = fromExplorer.weapons[weaponIndex]
      if (!weapon) return state

      const updatedFrom: ExplorerState = { ...fromExplorer, weapons: fromExplorer.weapons.filter((_, i) => i !== weaponIndex) }
      const updatedTo: ExplorerState = { ...toExplorer, weapons: [...toExplorer.weapons, weapon] }
      const updatedParty = state.run.party.map((m, i) => {
        if (i === fromMemberIndex) return updatedFrom
        if (i === toMemberIndex) return updatedTo
        return m
      })
      return { ...state, run: { ...state.run, party: updatedParty } }
    }

    case 'TRANSFER_SPELL': {
      if (!state.run) return state
      const { fromMemberIndex, spellIndex, toMemberIndex } = action
      const fromExplorer = state.run.party[fromMemberIndex]
      const toExplorer = state.run.party[toMemberIndex]
      if (!fromExplorer || !toExplorer) return state
      const spell = fromExplorer.spells[spellIndex]
      if (!spell) return state

      const updatedFrom: ExplorerState = { ...fromExplorer, spells: fromExplorer.spells.filter((_, i) => i !== spellIndex) }
      const updatedTo: ExplorerState = { ...toExplorer, spells: [...toExplorer.spells, spell] }
      const updatedParty = state.run.party.map((m, i) => {
        if (i === fromMemberIndex) return updatedFrom
        if (i === toMemberIndex) return updatedTo
        return m
      })
      return { ...state, run: { ...state.run, party: updatedParty } }
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
