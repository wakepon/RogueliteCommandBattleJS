import { GameState, createInitialGameState } from '../Types/Game'
import { createInitialRun } from '../Types/Run'

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'RETURN_TITLE' }

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        phase: 'battle',
        run: createInitialRun(),
        battleState: { turn: 1 },
      }
    case 'RETURN_TITLE':
      return createInitialGameState()
    default:
      return state
  }
}
