import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'
import { GameState, createInitialGameState } from '../Lib/Types/Game'
import { gameReducer, GameAction } from '../Lib/State/GameReducer'
import { WeaponData } from '../Lib/Types/Weapon'
import { SpellData } from '../Lib/Types/Spell'
import { RelicData } from '../Lib/Types/Relic'
import { PotionData } from '../Lib/Types/Potion'

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  startGame: () => void
  returnToTitle: () => void
  endBattle: (result: 'victory' | 'defeat') => void
  openStore: () => void
  buyWeapon: (slotIndex: number, item: WeaponData) => void
  buySpell: (slotIndex: number, item: SpellData) => void
  buyRelic: (slotIndex: number, item: RelicData) => void
  buyPotion: (slotIndex: number, item: PotionData) => void
  sellWeapon: (weaponIndex: number) => void
  sellSpell: (spellIndex: number) => void
  sellRelic: (relicIndex: number) => void
  sellPotion: (potionIndex: number) => void
  rerollStore: () => void
  closeStore: () => void
}

const GameContext = createContext<GameContextType | null>(null)

interface GameProviderProps {
  children: ReactNode
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, createInitialGameState())

  const startGame = useCallback(() => dispatch({ type: 'START_GAME' }), [])
  const returnToTitle = useCallback(() => dispatch({ type: 'RETURN_TITLE' }), [])
  const endBattle = useCallback((result: 'victory' | 'defeat') => dispatch({ type: 'END_BATTLE', result }), [])
  const openStore = useCallback(() => dispatch({ type: 'OPEN_STORE' }), [])
  const buyWeapon = useCallback((slotIndex: number, item: WeaponData) =>
    dispatch({ type: 'BUY_WEAPON', slotIndex, item }), [])
  const buySpell = useCallback((slotIndex: number, item: SpellData) =>
    dispatch({ type: 'BUY_SPELL', slotIndex, item }), [])
  const buyRelic = useCallback((slotIndex: number, item: RelicData) =>
    dispatch({ type: 'BUY_RELIC', slotIndex, item }), [])
  const buyPotion = useCallback((slotIndex: number, item: PotionData) =>
    dispatch({ type: 'BUY_POTION', slotIndex, item }), [])
  const sellWeapon = useCallback((weaponIndex: number) =>
    dispatch({ type: 'SELL_WEAPON', weaponIndex }), [])
  const sellSpell = useCallback((spellIndex: number) =>
    dispatch({ type: 'SELL_SPELL', spellIndex }), [])
  const sellRelic = useCallback((relicIndex: number) =>
    dispatch({ type: 'SELL_RELIC', relicIndex }), [])
  const sellPotion = useCallback((potionIndex: number) =>
    dispatch({ type: 'SELL_POTION', potionIndex }), [])
  const rerollStore = useCallback(() => dispatch({ type: 'REROLL_STORE' }), [])
  const closeStore = useCallback(() => dispatch({ type: 'CLOSE_STORE' }), [])

  return (
    <GameContext.Provider value={{
      state,
      dispatch,
      startGame,
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
      rerollStore,
      closeStore,
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
