import { GameState, createInitialGameState } from '../Types/Game'
import { RunState, createInitialRun } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { createBattleState } from './BattleStateFactory'
import { battleReducer, BattleAction } from './BattleReducer'
import { isSpell, isWeapon, isWeaponInstance } from '../Core/CommandValidator'

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'RETURN_TITLE' }
  | { type: 'BATTLE_ACTION'; action: BattleAction }

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
  command: ExplorerWeapon | SpellInstance,
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

        // BattleReducerで戦闘状態を更新
        const newBattleState = battleReducer(state.battleState, battleAction)

        // ExplorerStateとgoldを更新
        const { updatedExplorer, updatedGold } = consumeCommandCost(
          battleAction.explorer,
          selectedCommand,
          state.run.gold
        )
        const newRun = {
          ...updatePartyMember(state.run, updatedExplorer),
          gold: updatedGold,
        }

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

    default:
      return state
  }
}
