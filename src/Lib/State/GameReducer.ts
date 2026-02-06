import { GameState, ResultState, createInitialGameState } from '../Types/Game'
import { RunState, createInitialRun } from '../Types/Run'
import { ExplorerState } from '../Types/Explorer'
import { ExplorerWeapon, WeaponInstance } from '../Types/Weapon'
import { SpellInstance } from '../Types/Spell'
import { createBattleState } from './BattleStateFactory'
import { battleReducer, BattleAction } from './BattleReducer'
import { isSpell, isWeapon, isWeaponInstance } from '../Core/CommandValidator'
import { calculateReward } from '../Core/RewardCalculator'

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'RETURN_TITLE' }
  | { type: 'BATTLE_ACTION'; action: BattleAction }
  | { type: 'END_BATTLE'; result: 'victory' | 'defeat' }

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

    case 'END_BATTLE': {
      if (!state.battleState || !state.run) {
        return state
      }

      if (action.result === 'victory') {
        // 報酬計算
        const reward = calculateReward(
          state.battleState.enemies,
          state.run.gold,
          state.battleState.stolenGold
        )

        // 討伐数 = 倒した敵の数
        const killCount = state.battleState.enemies.length

        // ResultState を作成
        const resultState: ResultState = {
          result: 'victory',
          goldEarned: reward.total,
          baseGold: reward.baseGold,
          interestGold: reward.interestGold,
          stolenGold: reward.stolenGold,
          killCount,
        }

        // RunState を更新（ゴールド加算、討伐数更新）
        const newRun: RunState = {
          ...state.run,
          gold: state.run.gold + reward.total,
          stats: {
            ...state.run.stats,
            totalKillCount: state.run.stats.totalKillCount + killCount,
            totalGoldEarned: state.run.stats.totalGoldEarned + reward.total,
          },
        }

        return {
          ...state,
          phase: 'result',
          run: newRun,
          battleState: null,
          resultState,
        }
      }

      // 敗北時
      const resultState: ResultState = {
        result: 'defeat',
        goldEarned: 0,
        baseGold: 0,
        interestGold: 0,
        stolenGold: 0,
        killCount: 0,
      }

      return {
        ...state,
        phase: 'result',
        battleState: null,
        resultState,
      }
    }

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

      // ENEMY_ACTIONの場合はExplorerのHPを減らす
      if (battleAction.type === 'ENEMY_ACTION') {
        const newBattleState = battleReducer(state.battleState, battleAction)

        // explorer の HP を減らす
        const updatedExplorer = {
          ...battleAction.explorer,
          hp: Math.max(0, battleAction.explorer.hp - battleAction.damage),
        }

        const newRun = updatePartyMember(state.run, updatedExplorer)

        return {
          ...state,
          battleState: newBattleState,
          run: newRun,
        }
      }

      // PROCESS_TURN_ENDの場合は毒ダメージ等を反映したexplorerを更新
      if (battleAction.type === 'PROCESS_TURN_END') {
        const newBattleState = battleReducer(state.battleState, battleAction)

        const newRun = updatePartyMember(state.run, battleAction.updatedExplorer)

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
