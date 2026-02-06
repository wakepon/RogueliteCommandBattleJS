import { createContext, useContext, useReducer, ReactNode } from 'react'
import { GameState, createInitialGameState } from '../Lib/Types/Game'
import { gameReducer, GameAction } from '../Lib/State/GameReducer'

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  startGame: () => void
  returnToTitle: () => void
}

const GameContext = createContext<GameContextType | null>(null)

interface GameProviderProps {
  children: ReactNode
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, createInitialGameState())

  const startGame = () => dispatch({ type: 'START_GAME' })
  const returnToTitle = () => dispatch({ type: 'RETURN_TITLE' })

  return (
    <GameContext.Provider value={{ state, dispatch, startGame, returnToTitle }}>
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
