import { createContext, useContext, useReducer, useCallback, useEffect, useState, useRef, ReactNode } from 'react'
import { GameState, createInitialGameState } from '../Lib/Types/Game'
import { gameReducer, GameAction } from '../Lib/State/GameReducer'
import { ExplorerWeapon, WeaponData } from '../Lib/Types/Weapon'
import { SpellData } from '../Lib/Types/Spell'
import { RelicData } from '../Lib/Types/Relic'
import { PotionData } from '../Lib/Types/Potion'
import { SaveManager } from '../Lib/Storage'
import { initTuningReceiver } from '../Lib/Tuning'

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  hasSaveData: boolean
  startGame: () => void
  continueGame: () => void
  returnToTitle: () => void
  endBattle: (result: 'victory' | 'defeat') => void
  openStore: () => void
  buyWeapon: (slotIndex: number, item: WeaponData, memberIndex: number) => void
  buySpell: (slotIndex: number, item: SpellData, memberIndex: number) => void
  buyRelic: (slotIndex: number, item: RelicData) => void
  buyPotion: (slotIndex: number, item: PotionData) => void
  sellWeapon: (weaponIndex: number, memberIndex: number) => void
  sellSpell: (spellIndex: number, memberIndex: number) => void
  sellRelic: (relicIndex: number) => void
  sellPotion: (potionIndex: number) => void
  undoBuyWeapon: (shopSlotIndex: number, item: WeaponData, memberIndex: number, weaponIndex: number) => void
  undoBuySpell: (shopSlotIndex: number, item: SpellData, memberIndex: number, spellIndex: number) => void
  undoBuyRelic: (shopSlotIndex: number, item: RelicData, relicIndex: number) => void
  undoBuyPotion: (shopSlotIndex: number, item: PotionData, potionIndex: number) => void
  undoSellWeapon: (weapon: ExplorerWeapon, memberIndex: number, sellPrice: number) => void
  undoSellSpell: (spell: SpellData, memberIndex: number, sellPrice: number) => void
  undoSellRelic: (relic: RelicData, sellPrice: number) => void
  undoSellPotion: (potion: PotionData, sellPrice: number) => void
  transferWeapon: (fromMemberIndex: number, weaponIndex: number, toMemberIndex: number) => void
  transferSpell: (fromMemberIndex: number, spellIndex: number, toMemberIndex: number) => void
  rerollStore: () => void
  closeStore: () => void
  // イベント関連アクション
  openEvent: () => void
  selectRest: () => void
  selectTreasure: () => void
  confirmTreasure: () => void
  cancelTreasure: () => void
  replaceRelic: (sellRelicId: string) => void
  selectRepair: () => void
  toggleRepairWeapon: (weaponId: string) => void
  confirmRepair: () => void
  closeEvent: () => void
  // マップ関連アクション
  advanceFromMap: () => void
}

const GameContext = createContext<GameContextType | null>(null)

interface GameProviderProps {
  children: ReactNode
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, createInitialGameState())
  const [hasSaveData, setHasSaveData] = useState(() => SaveManager.hasSave())

  const startGame = useCallback(() => {
    // 新規ゲーム開始時は既存のセーブデータをクリア
    SaveManager.clear()
    setHasSaveData(false)
    dispatch({ type: 'START_GAME' })
  }, [])

  const continueGame = useCallback(() => {
    const savedRun = SaveManager.load()
    if (savedRun) {
      dispatch({ type: 'CONTINUE_GAME', run: savedRun })
    }
  }, [])

  const returnToTitle = useCallback(() => {
    // タイトルへ戻る時はセーブデータをクリア
    SaveManager.clear()
    setHasSaveData(false)
    dispatch({ type: 'RETURN_TITLE' })
  }, [])
  const endBattle = useCallback((result: 'victory' | 'defeat') => dispatch({ type: 'END_BATTLE', result }), [])
  const openStore = useCallback(() => dispatch({ type: 'OPEN_STORE' }), [])
  const buyWeapon = useCallback((slotIndex: number, item: WeaponData, memberIndex: number) =>
    dispatch({ type: 'BUY_WEAPON', slotIndex, item, memberIndex }), [])
  const buySpell = useCallback((slotIndex: number, item: SpellData, memberIndex: number) =>
    dispatch({ type: 'BUY_SPELL', slotIndex, item, memberIndex }), [])
  const buyRelic = useCallback((slotIndex: number, item: RelicData) =>
    dispatch({ type: 'BUY_RELIC', slotIndex, item }), [])
  const buyPotion = useCallback((slotIndex: number, item: PotionData) =>
    dispatch({ type: 'BUY_POTION', slotIndex, item }), [])
  const sellWeapon = useCallback((weaponIndex: number, memberIndex: number) =>
    dispatch({ type: 'SELL_WEAPON', weaponIndex, memberIndex }), [])
  const sellSpell = useCallback((spellIndex: number, memberIndex: number) =>
    dispatch({ type: 'SELL_SPELL', spellIndex, memberIndex }), [])
  const sellRelic = useCallback((relicIndex: number) =>
    dispatch({ type: 'SELL_RELIC', relicIndex }), [])
  const sellPotion = useCallback((potionIndex: number) =>
    dispatch({ type: 'SELL_POTION', potionIndex }), [])
  const undoBuyWeapon = useCallback((shopSlotIndex: number, item: WeaponData, memberIndex: number, weaponIndex: number) =>
    dispatch({ type: 'UNDO_BUY_WEAPON', shopSlotIndex, item, memberIndex, weaponIndex }), [])
  const undoBuySpell = useCallback((shopSlotIndex: number, item: SpellData, memberIndex: number, spellIndex: number) =>
    dispatch({ type: 'UNDO_BUY_SPELL', shopSlotIndex, item, memberIndex, spellIndex }), [])
  const undoBuyRelic = useCallback((shopSlotIndex: number, item: RelicData, relicIndex: number) =>
    dispatch({ type: 'UNDO_BUY_RELIC', shopSlotIndex, item, relicIndex }), [])
  const undoBuyPotion = useCallback((shopSlotIndex: number, item: PotionData, potionIndex: number) =>
    dispatch({ type: 'UNDO_BUY_POTION', shopSlotIndex, item, potionIndex }), [])
  const undoSellWeapon = useCallback((weapon: ExplorerWeapon, memberIndex: number, sellPrice: number) =>
    dispatch({ type: 'UNDO_SELL_WEAPON', weapon, memberIndex, sellPrice }), [])
  const undoSellSpell = useCallback((spell: SpellData, memberIndex: number, sellPrice: number) =>
    dispatch({ type: 'UNDO_SELL_SPELL', spell, memberIndex, sellPrice }), [])
  const undoSellRelic = useCallback((relic: RelicData, sellPrice: number) =>
    dispatch({ type: 'UNDO_SELL_RELIC', relic, sellPrice }), [])
  const undoSellPotion = useCallback((potion: PotionData, sellPrice: number) =>
    dispatch({ type: 'UNDO_SELL_POTION', potion, sellPrice }), [])
  const transferWeapon = useCallback((fromMemberIndex: number, weaponIndex: number, toMemberIndex: number) =>
    dispatch({ type: 'TRANSFER_WEAPON', fromMemberIndex, weaponIndex, toMemberIndex }), [])
  const transferSpell = useCallback((fromMemberIndex: number, spellIndex: number, toMemberIndex: number) =>
    dispatch({ type: 'TRANSFER_SPELL', fromMemberIndex, spellIndex, toMemberIndex }), [])
  const rerollStore = useCallback(() => dispatch({ type: 'REROLL_STORE' }), [])
  const closeStore = useCallback(() => dispatch({ type: 'CLOSE_STORE' }), [])
  // イベント関連アクション
  const openEvent = useCallback(() => dispatch({ type: 'OPEN_EVENT' }), [])
  const selectRest = useCallback(() => dispatch({ type: 'SELECT_REST' }), [])
  const selectTreasure = useCallback(() => dispatch({ type: 'SELECT_TREASURE' }), [])
  const confirmTreasure = useCallback(() => dispatch({ type: 'CONFIRM_TREASURE' }), [])
  const cancelTreasure = useCallback(() => dispatch({ type: 'CANCEL_TREASURE' }), [])
  const replaceRelic = useCallback((sellRelicId: string) =>
    dispatch({ type: 'REPLACE_RELIC', sellRelicId }), [])
  const selectRepair = useCallback(() => dispatch({ type: 'SELECT_REPAIR' }), [])
  const toggleRepairWeapon = useCallback((weaponId: string) =>
    dispatch({ type: 'TOGGLE_REPAIR_WEAPON', weaponId }), [])
  const confirmRepair = useCallback(() => dispatch({ type: 'CONFIRM_REPAIR' }), [])
  const closeEvent = useCallback(() => dispatch({ type: 'CLOSE_EVENT' }), [])
  // マップ関連アクション
  const advanceFromMap = useCallback(() => dispatch({ type: 'ADVANCE_FROM_MAP' }), [])

  // Tuning Editorからのリアルタイム反映（DEV時のみ）
  useEffect(() => {
    initTuningReceiver()
  }, [])

  // 自動セーブ: ストア画面に「遷移した」ときのみセーブ
  // （ストア画面での買い物ごとにセーブしない）
  const previousPhaseRef = useRef(state.phase)
  useEffect(() => {
    const wasNotStore = previousPhaseRef.current !== 'store'
    const isNowStore = state.phase === 'store'

    if (wasNotStore && isNowStore && state.run) {
      SaveManager.save(state.run)
      setHasSaveData(true)
    }

    previousPhaseRef.current = state.phase
  }, [state.phase, state.run])

  return (
    <GameContext.Provider value={{
      state,
      dispatch,
      hasSaveData,
      startGame,
      continueGame,
      returnToTitle,
      endBattle,
      openStore,
      buyWeapon,
      buySpell,
      buyRelic,
      buyPotion,
      sellWeapon,
      sellSpell,
      sellRelic,
      sellPotion,
      undoBuyWeapon,
      undoBuySpell,
      undoBuyRelic,
      undoBuyPotion,
      undoSellWeapon,
      undoSellSpell,
      undoSellRelic,
      undoSellPotion,
      transferWeapon,
      transferSpell,
      rerollStore,
      closeStore,
      openEvent,
      selectRest,
      selectTreasure,
      confirmTreasure,
      cancelTreasure,
      replaceRelic,
      selectRepair,
      toggleRepairWeapon,
      confirmRepair,
      closeEvent,
      advanceFromMap,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame(): GameContextType {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}
