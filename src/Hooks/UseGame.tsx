import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'
import { GameState, createInitialGameState } from '../Lib/Types/Game'
import { gameReducer, GameAction } from '../Lib/State/GameReducer'

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  startGame: () => void
  returnToTitle: () => void
  endBattle: (result: 'victory' | 'defeat') => void
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

  return (
    <GameContext.Provider value={{ state, dispatch, startGame, returnToTitle, endBattle }}>
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
