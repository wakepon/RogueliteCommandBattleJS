import { GameState, createInitialGameState } from '../Types/Game'
import { createInitialRun } from '../Types/Run'
import { createBattleState } from './BattleStateFactory'

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'RETURN_TITLE' }

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
    case 'RETURN_TITLE':
      return createInitialGameState()
    default:
      return state
  }
}
