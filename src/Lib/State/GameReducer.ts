import { GameState, ResultState, EventState, MapState, StoreState, createInitialGameState } from '../Types/Game'
import { RunState, createInitialRun } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance, WeaponData } from '../Types/Weapon'
import { SpellData, SpellInstance } from '../Types/Spell'
import { RelicData } from '../Types/Relic'
import { PotionData } from '../Types/Potion'
import { createBattleState, applyBloodPact, createActionQueue } from './BattleStateFactory'
import { battleReducer, BattleAction, createPlayerDamagePopup } from './BattleReducer'
import {
  createStoreState,
  rerollStore,
} from '../Core/StoreLogic'
import { isEventStage } from '../Core/StageManager'
import {
  applyRest,
  getRandomRelic,
  isRelicSlotFull,
  addRelic,
  replaceRelic,
  repairWeapons,
  getRepairableWeapons,
} from '../Core/EventLogic'
import { generateMapNodes } from '../Core/MapGenerator'
import { getPotionEffectMultiplier, getBattleEndBonusExp } from '../Core/RelicProcessor'
import { addExpAndProcessLevelUp } from '../Core/LevelUpCalculator'
import {
  processExecuteCommand,
  processEnemyAction,
  processTurnEndAction,
} from './BattleActionProcessor'
import { calculateMemberDiffs } from '../Core/BattleResultDiff'
import { createPotionShopState, canBuyShopPotion, applyPotionToMember, canUseImmediately, canStorePotion, canUseOnMember, createPotionInstance } from '../Core/PotionShopLogic'
import { canBuyPotion, canBuyRelic } from '../Core/StoreLogic'
import { grantWeaponToParty, grantSpellToParty, buildDebugEnemy, replaceEnemyAt, rebuildEnemyIntents } from './DebugActions'

/** ショップスロットのアイテムを更新するヘルパー */
function updateShopSlotItem(storeState: StoreState, slotIndex: number, newItem: unknown): StoreState {
  const newSlots = storeState.slots.map((slot, i) => {
    if (i !== slotIndex) return slot
    return { ...slot, item: newItem } as typeof slot
  })
  return { ...storeState, slots: newSlots }
}

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
  | { type: 'DISCARD_WEAPON'; weaponIndex: number; memberIndex: number }
  | { type: 'DISCARD_SPELL'; spellIndex: number; memberIndex: number }
  | { type: 'DISCARD_RELIC'; relicIndex: number }
  | { type: 'DISCARD_POTION'; potionIndex: number }
  | { type: 'UNDO_BUY_WEAPON'; shopSlotIndex: number; item: WeaponData; memberIndex: number; weaponIndex: number }
  | { type: 'UNDO_BUY_SPELL'; shopSlotIndex: number; item: SpellData; memberIndex: number; spellIndex: number }
  | { type: 'UNDO_BUY_RELIC'; shopSlotIndex: number; item: RelicData; relicIndex: number }
  | { type: 'UNDO_BUY_POTION'; shopSlotIndex: number; item: PotionData; potionIndex: number }
  | { type: 'UNDO_DISCARD_WEAPON'; weapon: ExplorerWeapon; memberIndex: number }
  | { type: 'UNDO_DISCARD_SPELL'; spell: SpellInstance; memberIndex: number }
  | { type: 'UNDO_DISCARD_RELIC'; relic: RelicData }
  | { type: 'UNDO_DISCARD_POTION'; potion: PotionData }
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
  | { type: 'CONFIRM_REPAIR'; explorerId: string }
  | { type: 'CLOSE_EVENT' }
  | { type: 'ADVANCE_FROM_MAP' }
  | { type: 'REORDER_PARTY'; fromIndex: number; toIndex: number }
  | { type: 'USE_POTION_INSTANT'; potionId: string; targetId: string }
  | { type: 'BUY_AND_USE_POTION'; shopSlotIndex: number; targetId: string }
  | { type: 'BUY_AND_STORE_POTION'; shopSlotIndex: number }
  // === デバッグ専用アクション（DEV時のみUIから発行される） ===
  | { type: 'DEBUG_GRANT_WEAPON'; item: WeaponData }
  | { type: 'DEBUG_GRANT_SPELL'; item: SpellData }
  | { type: 'DEBUG_GRANT_RELIC'; item: RelicData }
  | { type: 'DEBUG_DISCARD_WEAPON'; memberIndex: number; weaponIndex: number }
  | { type: 'DEBUG_DISCARD_SPELL'; memberIndex: number; spellIndex: number }
  | { type: 'DEBUG_REPLACE_ENEMY'; index: number; enemyId: string }
  | { type: 'DEBUG_ADD_ENEMY'; enemyId: string }
  | { type: 'DEBUG_KILL_ALL_ENEMIES' }

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
    potionShopState: null,
    eventState: null,
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const initialRun = createInitialRun()
      const battleState = createBattleState(initialRun.currentStage, initialRun.party, initialRun.seed, initialRun.relics)
      const run: RunState = {
        ...initialRun,
        battleStartSnapshot: { party: initialRun.party },
      }
      return { ...state, phase: 'battle', run, battleState }
    }

    case 'CONTINUE_GAME': {
      const { run } = action
      const storeState = createStoreState(run.seed + run.currentStage, run.currentStage)
      const potionShopState = createPotionShopState(run.seed + run.currentStage + 777)
      const mapState: MapState = {
        nodes: generateMapNodes(run.seed),
        currentStage: run.currentStage,
      }
      return { ...state, phase: 'store', run, storeState, potionShopState, mapState }
    }

    case 'RETURN_TITLE':
      return createInitialGameState()

    case 'END_BATTLE': {
      if (!state.battleState || !state.run) return state
      // 既にゲームオーバーになっている場合は冪等（二重発火防止）
      if (state.battleState.isGameOver) return state

      if (action.result === 'victory') {
        const killCount = state.battleState.enemies.length
        const goldEarned = state.battleState.enemies.reduce((sum, e) => sum + (e.goldReward ?? 0), 0)

        // 戦闘不能キャラをHP1で復活 + バフ/デバフをクリア
        let revivedParty: ExplorerState[] = state.run.party.map(member => ({
          ...member,
          hp: member.hp <= 0 ? 1 : member.hp,
          battleBuffs: [],
          battleDebuffs: [],
        }))

        // 修羅の証: 戦闘後に全員にボーナスEXP
        const shuraBonus = getBattleEndBonusExp(state.run.relics)
        if (shuraBonus) {
          revivedParty = revivedParty.map(member => {
            const { updatedExplorer } = addExpAndProcessLevelUp(member, shuraBonus.expValue)
            return {
              ...updatedExplorer,
              killCount: updatedExplorer.killCount + shuraBonus.expValue,
            }
          })
        }

        const snapshot = state.run.battleStartSnapshot
        const memberDiffs = snapshot
          ? calculateMemberDiffs(snapshot.party, revivedParty)
          : []

        const resultState: ResultState = {
          result: 'victory',
          killCount,
          goldEarned,
          memberDiffs,
        }

        const newRun: RunState = {
          ...state.run,
          gold: state.run.gold + goldEarned,
          party: revivedParty,
          stats: {
            ...state.run.stats,
            totalKillCount: state.run.stats.totalKillCount + killCount,
          },
          battleLevelUps: [],
          battleStartSnapshot: null,
        }

        return { ...state, phase: 'result', run: newRun, battleState: null, resultState }
      }

      // 敗北時: バトル画面を残したまま isGameOver フラグを立てる
      const defeatedRun: RunState = {
        ...state.run,
        battleStartSnapshot: null,
      }

      return {
        ...state,
        run: defeatedRun,
        battleState: { ...state.battleState, isGameOver: true },
      }
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
      const ownedRelicIds = state.run.relics.map(r => r.id)
      const storeState = createStoreState(state.run.seed + state.run.currentStage, state.run.currentStage, ownedRelicIds)
      const potionShopState = createPotionShopState(state.run.seed + state.run.currentStage + 777)
      const mapState: MapState = {
        nodes: generateMapNodes(state.run.seed),
        currentStage: state.run.currentStage,
      }
      return { ...state, phase: 'store', storeState, resultState: null, potionShopState, mapState }
    }

    case 'BUY_WEAPON': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item, memberIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const weaponInstance: WeaponInstance = {
        ...item,
        currentUses: item.maxUses === null ? null : item.maxUses,
        enhancements: [],
      }

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: [...explorer.weapons, weaponInstance],
      }

      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
        storeState: updateShopSlotItem(state.storeState, slotIndex, null),
      }
    }

    case 'BUY_SPELL': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item, memberIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: [...explorer.spells, { ...item, currentUses: item.maxUses === null ? null : item.maxUses, enhancements: [] }],
      }

      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
        storeState: updateShopSlotItem(state.storeState, slotIndex, null),
      }
    }

    case 'BUY_RELIC': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action

      return {
        ...state,
        run: {
          ...state.run,
          relics: [...state.run.relics, item],
        },
        storeState: updateShopSlotItem(state.storeState, slotIndex, null),
      }
    }

    case 'BUY_POTION': {
      if (!state.run || !state.storeState) return state

      const { slotIndex, item } = action

      return {
        ...state,
        run: {
          ...state.run,
          potions: [...state.run.potions, item],
        },
        storeState: updateShopSlotItem(state.storeState, slotIndex, null),
      }
    }

    case 'DISCARD_WEAPON': {
      if (!state.run) return state

      const explorer = state.run.party[action.memberIndex]
      if (!explorer) return state
      const weapon = explorer.weapons[action.weaponIndex]

      if (!weapon || weapon.id === 'punch') return state
      // 無限使用の無料武器（魔力弾、祈り等）は削除不可
      if (weapon.maxUses === null && !('price' in weapon && weapon.price > 0)) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: explorer.weapons.filter((_, i) => i !== action.weaponIndex),
      }

      const updatedParty = state.run.party.map((m, i) => i === action.memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
      }
    }

    case 'DISCARD_SPELL': {
      if (!state.run) return state

      const explorer = state.run.party[action.memberIndex]
      if (!explorer) return state
      const spell = explorer.spells[action.spellIndex]
      if (!spell) return state
      if (spell.price === 0 || spell.slotFree) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: explorer.spells.filter((_, i) => i !== action.spellIndex),
      }

      const updatedParty = state.run.party.map((m, i) => i === action.memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
      }
    }

    case 'DISCARD_RELIC': {
      if (!state.run) return state

      const relic = state.run.relics[action.relicIndex]
      if (!relic) return state

      return {
        ...state,
        run: {
          ...state.run,
          relics: state.run.relics.filter((_, i) => i !== action.relicIndex),
        },
      }
    }

    case 'DISCARD_POTION': {
      if (!state.run) return state

      const potion = state.run.potions[action.potionIndex]
      if (!potion) return state

      return {
        ...state,
        run: {
          ...state.run,
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
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
        storeState: updateShopSlotItem(state.storeState, shopSlotIndex, item),
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
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
        storeState: updateShopSlotItem(state.storeState, shopSlotIndex, item),
      }
    }

    case 'UNDO_BUY_RELIC': {
      if (!state.run || !state.storeState) return state
      const { shopSlotIndex, item, relicIndex } = action
      if (!state.run.relics[relicIndex]) return state

      return {
        ...state,
        run: {
          ...state.run,
          relics: state.run.relics.filter((_, i) => i !== relicIndex),
        },
        storeState: updateShopSlotItem(state.storeState, shopSlotIndex, item),
      }
    }

    case 'UNDO_BUY_POTION': {
      if (!state.run || !state.storeState) return state
      const { shopSlotIndex, item, potionIndex } = action
      if (!state.run.potions[potionIndex]) return state

      return {
        ...state,
        run: {
          ...state.run,
          potions: state.run.potions.filter((_, i) => i !== potionIndex),
        },
        storeState: updateShopSlotItem(state.storeState, shopSlotIndex, item),
      }
    }

    // === 削除取り消し ===

    case 'UNDO_DISCARD_WEAPON': {
      if (!state.run) return state
      const { weapon, memberIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: [...explorer.weapons, weapon],
      }
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
      }
    }

    case 'UNDO_DISCARD_SPELL': {
      if (!state.run) return state
      const { spell, memberIndex } = action
      const explorer = state.run.party[memberIndex]
      if (!explorer) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: [...explorer.spells, spell],
      }
      const updatedParty = state.run.party.map((m, i) => i === memberIndex ? updatedExplorer : m)

      return {
        ...state,
        run: { ...state.run, party: updatedParty },
      }
    }

    case 'UNDO_DISCARD_RELIC': {
      if (!state.run) return state
      const { relic } = action

      return {
        ...state,
        run: {
          ...state.run,
          relics: [...state.run.relics, relic],
        },
      }
    }

    case 'UNDO_DISCARD_POTION': {
      if (!state.run) return state
      const { potion } = action

      return {
        ...state,
        run: {
          ...state.run,
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
      // slotFree魔法（魔力弾・祈り等）は移動不可
      if (spell.slotFree) return state

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

      const newSeed = state.run.seed + state.run.currentStage + Date.now()
      const rerollExcludeIds = state.run.relics.map(r => r.id)
      const newStoreState = rerollStore(state.storeState, newSeed, rerollExcludeIds)

      return {
        ...state,
        storeState: newStoreState,
      }
    }

    case 'CLOSE_STORE': {
      if (!state.run) return state
      return advanceToMapPhase(state, state.run)
    }

    case 'BUY_AND_USE_POTION': {
      if (!state.run || !state.potionShopState) return state
      const run = state.run
      const { shopSlotIndex, targetId } = action
      const slot = state.potionShopState.shopSlots[shopSlotIndex]
      if (!slot) return state
      if (!canBuyShopPotion(slot.stock, slot.potion.price, run.gold)) return state
      if (!canUseImmediately(slot.potion.effect)) return state
      const target = run.party.find(m => m.id === targetId)
      if (!target || !canUseOnMember(slot.potion.effect, target)) return state
      const updatedParty = run.party.map(m =>
        m.id === targetId ? applyPotionToMember(slot.potion, m, run.relics) : m
      )
      const updatedRun = { ...run, party: updatedParty, gold: run.gold - slot.potion.price }
      const updatedShopSlots = state.potionShopState.shopSlots.map((s, i) =>
        i === shopSlotIndex ? { ...s, stock: s.stock - 1 } : s
      )
      return {
        ...state,
        run: updatedRun,
        potionShopState: { ...state.potionShopState, shopSlots: updatedShopSlots },
      }
    }

    case 'BUY_AND_STORE_POTION': {
      if (!state.run || !state.potionShopState) return state
      const { shopSlotIndex } = action
      const slot = state.potionShopState.shopSlots[shopSlotIndex]
      if (!slot) return state
      if (!canBuyShopPotion(slot.stock, slot.potion.price, state.run.gold)) return state
      if (!canStorePotion(slot.potion.effect)) return state
      if (!canBuyPotion(state.run.potions, state.run.relics)) return state
      const newPotion = createPotionInstance(slot.potion)
      const updatedRun = {
        ...state.run,
        potions: [...state.run.potions, newPotion],
        gold: state.run.gold - slot.potion.price,
      }
      const updatedShopSlots = state.potionShopState.shopSlots.map((s, i) =>
        i === shopSlotIndex ? { ...s, stock: s.stock - 1 } : s
      )
      return {
        ...state,
        run: updatedRun,
        potionShopState: { ...state.potionShopState, shopSlots: updatedShopSlots },
      }
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

      const { explorerId } = action
      const targetExplorer = state.run.party.find(m => m.id === explorerId)
      if (!targetExplorer) return state

      // 対象キャラの修理可能な全武器IDを収集
      const repairableIds = getRepairableWeapons(targetExplorer.weapons).map(w => w.id)
      if (repairableIds.length === 0) return state

      const updatedParty = state.run.party.map(explorer =>
        explorer.id === explorerId ? repairWeapons(explorer, repairableIds) : explorer
      )

      return advanceToMapPhase(state, { ...state.run, party: updatedParty })
    }

    case 'CLOSE_EVENT': {
      if (!state.run) return state
      return advanceToMapPhase(state, state.run)
    }

    case 'REORDER_PARTY': {
      if (!state.run) return state
      const { fromIndex, toIndex } = action
      const newParty = [...state.run.party]
      const [moved] = newParty.splice(fromIndex, 1)
      newParty.splice(toIndex, 0, moved)

      // battleState がある場合、commandSlots も同じ順に並び替え
      const newBattleState = state.battleState
        ? (() => {
            const newSlots = newParty
              .filter(m => m.hp > 0)
              .map(m => {
                const existing = state.battleState!.commandSlots.find(s => s.explorerId === m.id)
                return existing ?? { explorerId: m.id, command: null, targetId: null }
              })
            const activeSlot = state.battleState!.commandSlots[state.battleState!.activeExplorerIndex]
            const newActiveIndex = activeSlot
              ? newSlots.findIndex(s => s.explorerId === activeSlot.explorerId)
              : 0
            // actionQueue も整合のため再生成（生存メンバー順 + 敵配列順）
            const newActionQueue = createActionQueue(newParty, state.battleState!.enemies)
            return {
              ...state.battleState!,
              commandSlots: newSlots,
              activeExplorerIndex: Math.max(0, newActiveIndex),
              actionQueue: newActionQueue,
            }
          })()
        : state.battleState

      return {
        ...state,
        run: { ...state.run, party: newParty },
        battleState: newBattleState,
      }
    }

    case 'USE_POTION_INSTANT': {
      if (!state.run || !state.battleState) return state
      if (state.battleState.phase !== 'command') return state

      const potion = state.run.potions.find(p => p.id === action.potionId)
      if (!potion) return state

      const target = state.run.party.find(e => e.id === action.targetId)
      if (!target) return state

      const potionMultiplier = getPotionEffectMultiplier(state.run.relics)
      const { effect } = potion
      let updatedTarget = target
      const popups = [...state.battleState.playerDamagePopups]

      if (effect.type === 'healHp') {
        const healAmount = effect.full ? updatedTarget.maxHp : Math.floor(effect.value * potionMultiplier)
        const newHp = Math.min(updatedTarget.hp + healAmount, updatedTarget.maxHp)
        const actualHeal = newHp - updatedTarget.hp
        updatedTarget = { ...updatedTarget, hp: newHp }
        if (actualHeal > 0) {
          popups.push(createPlayerDamagePopup(-actualHeal, action.targetId))
        }
      } else if (effect.type === 'healMp') {
        const healAmount = effect.full ? updatedTarget.maxMp : Math.floor(effect.value * potionMultiplier)
        const newMp = Math.min(updatedTarget.mp + healAmount, updatedTarget.maxMp)
        const actualHeal = newMp - updatedTarget.mp
        updatedTarget = { ...updatedTarget, mp: newMp }
        if (actualHeal > 0) {
          popups.push(createPlayerDamagePopup(-actualHeal, action.targetId))
        }
      } else if (effect.type === 'repairWeapons') {
        // 修理可能な武器がなければポーション消費しない（noRepair武器は除外）
        const hasRepairableWeapon = updatedTarget.weapons.some(
          w => w.currentUses !== null && w.maxUses !== null && w.currentUses < w.maxUses
            && !('noRepair' in w && (w as WeaponInstance).noRepair)
        )
        if (!hasRepairableWeapon) return state

        const repairValue = Math.floor(effect.value * potionMultiplier)
        updatedTarget = {
          ...updatedTarget,
          weapons: updatedTarget.weapons.map(w => {
            if (w.currentUses === null || w.maxUses === null) return w
            if ('noRepair' in w && (w as WeaponInstance).noRepair) return w
            const newUses = Math.min(w.currentUses + repairValue, w.maxUses)
            const actualRepair = newUses - w.currentUses
            if (actualRepair > 0) {
              popups.push(createPlayerDamagePopup(-actualRepair, action.targetId, w.name))
            }
            return { ...w, currentUses: newUses } as typeof w
          }),
        }
      } else if (effect.type === 'boostStr') {
        updatedTarget = { ...updatedTarget, str: updatedTarget.str + effect.value }
      } else if (effect.type === 'boostInt') {
        updatedTarget = { ...updatedTarget, int: updatedTarget.int + effect.value }
      } else if (effect.type === 'boostMaxHp') {
        updatedTarget = { ...updatedTarget, maxHp: updatedTarget.maxHp + effect.value, hp: updatedTarget.hp + effect.value }
      } else if (effect.type === 'boostMaxMp') {
        updatedTarget = { ...updatedTarget, maxMp: updatedTarget.maxMp + effect.value, mp: updatedTarget.mp + effect.value }
      } else if (effect.type === 'taunt' || effect.type === 'statBoost' || effect.type === 'damageReduction' || effect.type === 'aoeConvert') {
        // バフ付与ポーション共通: 持続ターン計算
        const buffDuration = effect.type === 'aoeConvert'
          ? 'nextAction' as const
          : 1

        if (effect.type === 'taunt') {
          // 挑発: 被弾率100%
          updatedTarget = {
            ...updatedTarget,
            battleBuffs: [...updatedTarget.battleBuffs, { type: 'taunt', value: 1, duration: buffDuration as number }],
          }
        } else if (effect.type === 'statBoost') {
          // 興奮: STR+N, INT+N
          const strBoost = Math.floor(effect.strValue * potionMultiplier)
          const intBoost = Math.floor(effect.intValue * potionMultiplier)
          updatedTarget = {
            ...updatedTarget,
            battleBuffs: [
              ...updatedTarget.battleBuffs,
              { type: 'str', value: strBoost, duration: buffDuration as number },
              { type: 'int', value: intBoost, duration: buffDuration as number },
            ],
          }
        } else if (effect.type === 'damageReduction') {
          // 防御: 被ダメ×rate軽減
          updatedTarget = {
            ...updatedTarget,
            battleBuffs: [...updatedTarget.battleBuffs, { type: 'damageReduction', value: effect.rate, duration: buffDuration as number }],
          }
        } else {
          // 全体化: 次の単体攻撃を全体化（nextAction）
          updatedTarget = {
            ...updatedTarget,
            battleBuffs: [...updatedTarget.battleBuffs, { type: 'aoeConvert', value: 1, duration: 'nextAction' as const }],
          }
        }
      }

      // ポーションを1個消費
      const potionIndex = state.run.potions.findIndex(p => p.id === action.potionId)
      const updatedPotions = state.run.potions.filter((_, i) => i !== potionIndex)

      const updatedParty = state.run.party.map(e =>
        e.id === action.targetId ? updatedTarget : e
      )

      return {
        ...state,
        run: { ...state.run, party: updatedParty, potions: updatedPotions },
        battleState: { ...state.battleState, playerDamagePopups: popups },
      }
    }

    // === デバッグ専用アクション（DEV時のみUIから発行される） ===

    case 'DEBUG_GRANT_WEAPON': {
      if (!state.run) return state
      const updatedParty = grantWeaponToParty(state.run.party, action.item)
      if (!updatedParty) return state
      return { ...state, run: { ...state.run, party: updatedParty } }
    }

    case 'DEBUG_GRANT_SPELL': {
      if (!state.run) return state
      const updatedParty = grantSpellToParty(state.run.party, action.item)
      if (!updatedParty) return state
      return { ...state, run: { ...state.run, party: updatedParty } }
    }

    case 'DEBUG_GRANT_RELIC': {
      if (!state.run) return state
      if (!canBuyRelic(state.run.relics)) return state
      return {
        ...state,
        run: { ...state.run, relics: [...state.run.relics, action.item] },
      }
    }

    case 'DEBUG_DISCARD_WEAPON': {
      if (!state.run) return state
      const explorer = state.run.party[action.memberIndex]
      if (!explorer) return state
      const weapon = explorer.weapons[action.weaponIndex]
      // パンチは常時必須のためデバッグでも削除不可
      if (!weapon || weapon.id === 'punch') return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        weapons: explorer.weapons.filter((_, i) => i !== action.weaponIndex),
      }
      const updatedParty = state.run.party.map((m, i) => i === action.memberIndex ? updatedExplorer : m)
      return { ...state, run: { ...state.run, party: updatedParty } }
    }

    case 'DEBUG_DISCARD_SPELL': {
      if (!state.run) return state
      const explorer = state.run.party[action.memberIndex]
      if (!explorer || !explorer.spells[action.spellIndex]) return state

      const updatedExplorer: ExplorerState = {
        ...explorer,
        spells: explorer.spells.filter((_, i) => i !== action.spellIndex),
      }
      const updatedParty = state.run.party.map((m, i) => i === action.memberIndex ? updatedExplorer : m)
      return { ...state, run: { ...state.run, party: updatedParty } }
    }

    case 'DEBUG_REPLACE_ENEMY':
    case 'DEBUG_ADD_ENEMY': {
      if (!state.run || !state.battleState) return state
      // 行動キュー実行中の差し替えは不整合の元になるためコマンドフェーズ限定
      if (state.battleState.phase !== 'command') return state

      const newEnemy = buildDebugEnemy(action.enemyId, state.battleState.enemyHpMultiplier)
      const newEnemies = action.type === 'DEBUG_REPLACE_ENEMY'
        ? replaceEnemyAt(state.battleState.enemies, action.index, newEnemy)
        : [...state.battleState.enemies, newEnemy]

      // 行動予告とアクションキューを敵リストの変更に合わせて再構築
      const enemyIntents = rebuildEnemyIntents(
        state.battleState.enemyIntents, newEnemies, state.run.party, state.battleState.enemyDamageMultiplier
      )
      const actionQueue = createActionQueue(state.run.party, newEnemies)

      return {
        ...state,
        battleState: { ...state.battleState, enemies: newEnemies, enemyIntents, actionQueue },
      }
    }

    case 'DEBUG_KILL_ALL_ENEMIES': {
      if (!state.battleState) return state
      if (state.battleState.phase !== 'command') return state
      // 敵を全消去して既存の勝利判定（checkBattleResult）に乗せる。EXP/ゴールドは付与しない
      return {
        ...state,
        battleState: { ...state.battleState, enemies: [], enemyIntents: [] },
      }
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

      // 血の契約: 戦闘開始時にHP削減+STRバフをRunState.partyにも反映
      // 復讐系（前ターン被ダメ参照）が前の戦闘の値を持ち越さないよう、被ダメ記録を初期化
      const adjustedParty = applyBloodPact(state.run.party, state.run.relics).map(m => ({
        ...m,
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
      }))
      const battleState = createBattleState(
        state.run.currentStage, adjustedParty, state.run.seed, state.run.relics
      )

      return {
        ...state,
        phase: 'battle',
        battleState,
        mapState: null,
        run: {
          ...state.run,
          party: adjustedParty,
          battleStartSnapshot: { party: adjustedParty },
        },
      }
    }

    default:
      return state
  }
}
