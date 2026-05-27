import { BattleState, BattleCommand, CommandSlot, EnemyIntent, DamagePopup, PlayerDamagePopup, LevelUpPopup, ExpPopup, RelicBattleState, DamageContributor } from '../Types/Battle'
import { ExplorerState } from '../Types/Explorer'
import { isSpell, isWeapon, LevelUpInfo } from '../Core'
import { GrowthChoice } from '../Types/GrowthType'

/** バトルアクション型 */
export type BattleAction =
  // コマンド選択フェーズ
  | { type: 'SELECT_COMMAND'; command: BattleCommand }
  | { type: 'CANCEL_COMMAND' }
  | { type: 'SELECT_TARGET'; targetId: string }
  | { type: 'SET_COMMAND_SLOT' }  // 現在のコマンド+ターゲットをスロットに確定
  | { type: 'SET_COMMAND_SLOT_DIRECT'; explorerId: string; command: BattleCommand; targetId: string; weaponIndex?: number }  // D&Dで直接スロットにセット
  | { type: 'CHANGE_ACTIVE_EXPLORER'; index: number }  // コマンド入力キャラ切替
  | { type: 'START_EXECUTION' }  // 実行開始 → partyAction phase
  // パーティー行動フェーズ
  | { type: 'EXECUTE_COMMAND'; explorer: ExplorerState; calculatedDamage?: number; calculatedDamages?: Array<{targetId: string; damage: number}>; contributors?: DamageContributor[]; randomEnemyTargets?: string[] }
  | { type: 'ADVANCE_PARTY_ACTION' }  // 次のパーティーメンバーの行動へ
  // 敵行動フェーズ
  | { type: 'ENEMY_ACTION'; enemyId: string; targetExplorerId: string; damage: number; explorer: ExplorerState;
      actionName: string; poisonStacks: number; mpDrain: number;
      applyCharge: boolean; consumeCharge: boolean; hits: number;
      chargeAllAllies?: boolean; summonEnemyId?: string; healSelf?: number;
      healAlly?: { amount?: number; percentOfMaxHp?: number }; isAoe?: boolean;
      applyWeakness?: { value: number; duration: number };
      applySelfDefense?: { value: number; duration: number };
      transformName?: string;
      isRandomTarget?: boolean;
      randomTargetHits?: Array<{ targetExplorerId: string }> }
  | { type: 'ADVANCE_ENEMY_ACTION' }  // 次の敵の行動へ
  // ターン終了
  | { type: 'PROCESS_TURN_END'; totalPoisonDamage: number; updatedParty: ExplorerState[] }
  | { type: 'START_NEW_TURN'; commandSlots: CommandSlot[]; enemyIntents: EnemyIntent[] }
  // ポップアップ管理
  | { type: 'REMOVE_POPUP'; popupId: string }
  | { type: 'REMOVE_PLAYER_POPUP'; popupId: string }
  | { type: 'ADD_LEVEL_UP_POPUP'; levelUpInfo: LevelUpInfo }
  | { type: 'REMOVE_LEVEL_UP_POPUP'; popupId: string }
  | { type: 'ADD_EXP_POPUPS'; expPopups: ExpPopup[] }
  | { type: 'REMOVE_EXP_POPUP'; popupId: string }
  // 状態更新
  | { type: 'UPDATE_RELIC_STATE'; relicState: Partial<RelicBattleState> }
  | { type: 'UPDATE_ENEMIES'; enemies: BattleState['enemies'] }
  // 成長方向選択
  | { type: 'ADD_GROWTH_CHOICE'; choice: GrowthChoice }
  | { type: 'REMOVE_GROWTH_CHOICE'; explorerId: string }
  // 後方互換
  | { type: 'NEXT_ACTOR' }

/** ユニークIDを生成 */
function generatePopupId(): string {
  return `popup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/** ダメージポップアップを作成（敵へのダメージ用） */
export function createDamagePopup(targetId: string, damage: number, contributors?: DamageContributor[]): DamagePopup {
  return {
    id: generatePopupId(),
    targetId,
    damage,
    timestamp: Date.now(),
    contributors,
  }
}

/** プレイヤーダメージポップアップを作成 */
export function createPlayerDamagePopup(damage: number, targetExplorerId?: string, label?: string, shielded?: boolean): PlayerDamagePopup {
  return {
    id: generatePopupId(),
    targetExplorerId,
    damage,
    label,
    shielded,
    timestamp: Date.now(),
  }
}

/** レベルアップポップアップを作成 */
function createLevelUpPopup(levelUpInfo: LevelUpInfo): LevelUpPopup {
  return {
    id: generatePopupId(),
    levelUpInfo,
    timestamp: Date.now(),
  }
}

/** 経験値ポップアップを作成 */
export function createExpPopup(
  enemyInstanceId: string,
  targetExplorerId: string,
  amount: number,
  delayMs: number,
  bonusLabel?: string
): ExpPopup {
  return {
    id: generatePopupId(),
    enemyInstanceId,
    targetExplorerId,
    amount,
    bonusLabel,
    delayMs,
    timestamp: Date.now(),
  }
}

/** バトル状態のReducer */
export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    // ===== コマンド選択フェーズ =====

    case 'SELECT_COMMAND': {
      return {
        ...state,
        selectedCommand: action.command,
      }
    }

    case 'CANCEL_COMMAND': {
      return {
        ...state,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    case 'SELECT_TARGET': {
      return {
        ...state,
        selectedTargetId: action.targetId,
      }
    }

    case 'SET_COMMAND_SLOT': {
      const { selectedCommand, selectedTargetId, activeExplorerIndex, commandSlots } = state
      if (!selectedCommand || !selectedTargetId) return state
      if (activeExplorerIndex >= commandSlots.length) return state

      const updatedSlots = commandSlots.map((slot, i) => {
        if (i === activeExplorerIndex) {
          return { ...slot, command: selectedCommand, targetId: selectedTargetId }
        }
        return slot
      })

      // 次の未設定スロットへ自動移動（巡回探索）
      let nextIndex = activeExplorerIndex
      for (let offset = 1; offset < updatedSlots.length; offset++) {
        const i = (activeExplorerIndex + offset) % updatedSlots.length
        if (!updatedSlots[i].command) {
          nextIndex = i
          break
        }
      }

      return {
        ...state,
        commandSlots: updatedSlots,
        activeExplorerIndex: nextIndex,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    case 'SET_COMMAND_SLOT_DIRECT': {
      const { explorerId, command, targetId, weaponIndex } = action
      const slotIndex = state.commandSlots.findIndex(s => s.explorerId === explorerId)
      if (slotIndex < 0) return state

      const updatedSlots = state.commandSlots.map((slot, i) => {
        if (i === slotIndex) {
          return { ...slot, command, targetId, weaponIndex }
        }
        return slot
      })

      // 次の未設定スロットへ自動移動（巡回探索）
      let nextIndex = slotIndex
      for (let offset = 1; offset < updatedSlots.length; offset++) {
        const i = (slotIndex + offset) % updatedSlots.length
        if (!updatedSlots[i].command) {
          nextIndex = i
          break
        }
      }

      return {
        ...state,
        commandSlots: updatedSlots,
        activeExplorerIndex: nextIndex,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    case 'CHANGE_ACTIVE_EXPLORER': {
      return {
        ...state,
        activeExplorerIndex: action.index,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    case 'START_EXECUTION': {
      return {
        ...state,
        phase: 'partyAction',
        currentCommandIndex: 0,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    // ===== パーティー行動フェーズ =====

    case 'EXECUTE_COMMAND': {
      const currentSlot = state.commandSlots[state.currentCommandIndex]
      if (!currentSlot?.command || !currentSlot.targetId) return state

      const { command, targetId } = currentSlot

      // 味方対象（ヒール/精密/祈り/護りの壁など）: 効果適用はGameReducer側
      if ((isSpell(command) && (command.targetType === 'allySingle' || command.targetType === 'allyAll')) ||
          (isWeapon(command) && (command.targetType === 'allySingle' || command.targetType === 'allyAll'))) {
        return state
      }

      // 全体攻撃
      if (action.calculatedDamages && action.calculatedDamages.length > 0) {
        const updatedEnemies = state.enemies.map(enemy => {
          const dmgEntry = action.calculatedDamages!.find(d => d.targetId === enemy.instanceId)
          if (dmgEntry) {
            return { ...enemy, currentHp: Math.max(0, enemy.currentHp - dmgEntry.damage) }
          }
          return enemy
        })
        const newPopups = action.calculatedDamages.map(d => createDamagePopup(d.targetId, d.damage, action.contributors))
        return {
          ...state,
          enemies: updatedEnemies,
          damagePopups: [...state.damagePopups, ...newPopups],
        }
      }

      // 単体攻撃
      const damage = action.calculatedDamage
      if (damage === undefined) return state

      const targetEnemy = state.enemies.find(e => e.instanceId === targetId)
      if (!targetEnemy) return state

      const updatedEnemies = state.enemies.map(enemy => {
        if (enemy.instanceId === targetId) {
          return { ...enemy, currentHp: Math.max(0, enemy.currentHp - damage) }
        }
        return enemy
      })
      const newPopup = createDamagePopup(targetId, damage, action.contributors)

      return {
        ...state,
        enemies: updatedEnemies,
        damagePopups: [...state.damagePopups, newPopup],
      }
    }

    case 'ADVANCE_PARTY_ACTION': {
      const nextIndex = state.currentCommandIndex + 1
      if (nextIndex >= state.commandSlots.length) {
        // パーティー行動完了 → 敵行動フェーズへ
        return {
          ...state,
          phase: 'enemyAction',
          currentCommandIndex: nextIndex,
          currentEnemyIndex: 0,
        }
      }
      return {
        ...state,
        currentCommandIndex: nextIndex,
      }
    }

    // ===== 敵行動フェーズ =====

    case 'ENEMY_ACTION': {
      const actingEnemy = state.enemies.find(e => e.instanceId === action.enemyId)
      const enemyName = actingEnemy?.name ?? '敵'
      const hasEffect = action.damage > 0 || action.applyCharge || action.poisonStacks > 0 ||
        action.mpDrain > 0 || action.chargeAllAllies || action.applySelfDefense ||
        action.applyWeakness || action.summonEnemyId || action.healSelf || action.healAlly
      const battleMessage = hasEffect
        ? `${enemyName}の${action.actionName}`
        : `${enemyName}は${action.actionName}`

      // ポップアップ作成は BattleActionProcessor 側で行う（シールドバフ軽減後の値を使うため）
      return {
        ...state,
        battleMessage,
        battleMessageId: state.battleMessageId + 1,
      }
    }

    case 'ADVANCE_ENEMY_ACTION': {
      const nextIndex = state.currentEnemyIndex + 1
      const aliveEnemies = state.enemies.filter(e => e.currentHp > 0 && !e.justSummoned)
      if (nextIndex >= aliveEnemies.length) {
        // 敵行動完了 → ターン終了フェーズへ
        return {
          ...state,
          phase: 'turnEnd',
          currentEnemyIndex: nextIndex,
        }
      }
      return {
        ...state,
        currentEnemyIndex: nextIndex,
      }
    }

    // ===== ターン終了 =====

    case 'PROCESS_TURN_END': {
      return state  // 実際の処理はGameReducer側
    }

    case 'START_NEW_TURN': {
      return {
        ...state,
        phase: 'command',
        turn: state.turn + 1,
        commandSlots: action.commandSlots,
        enemyIntents: action.enemyIntents,
        enemies: state.enemies.map(e => e.justSummoned ? { ...e, justSummoned: undefined } : e),
        activeExplorerIndex: 0,
        currentCommandIndex: 0,
        currentEnemyIndex: 0,
        selectedCommand: null,
        selectedTargetId: null,
      }
    }

    // ===== ポップアップ管理 =====

    case 'REMOVE_POPUP': {
      return {
        ...state,
        damagePopups: state.damagePopups.filter(popup => popup.id !== action.popupId),
      }
    }

    case 'REMOVE_PLAYER_POPUP': {
      return {
        ...state,
        playerDamagePopups: state.playerDamagePopups.filter(popup => popup.id !== action.popupId),
      }
    }

    case 'ADD_LEVEL_UP_POPUP': {
      const newPopup = createLevelUpPopup(action.levelUpInfo)
      return {
        ...state,
        levelUpPopups: [...state.levelUpPopups, newPopup],
      }
    }

    case 'REMOVE_LEVEL_UP_POPUP': {
      return {
        ...state,
        levelUpPopups: state.levelUpPopups.filter(popup => popup.id !== action.popupId),
      }
    }

    case 'ADD_EXP_POPUPS': {
      return {
        ...state,
        expPopups: [...state.expPopups, ...action.expPopups],
      }
    }

    case 'REMOVE_EXP_POPUP': {
      return {
        ...state,
        expPopups: state.expPopups.filter(popup => popup.id !== action.popupId),
      }
    }

    // ===== 状態更新 =====

    case 'UPDATE_RELIC_STATE': {
      return {
        ...state,
        relicState: {
          ...state.relicState,
          ...action.relicState,
        },
      }
    }

    case 'UPDATE_ENEMIES': {
      return {
        ...state,
        enemies: action.enemies,
      }
    }

    // ===== 成長方向選択 =====

    case 'ADD_GROWTH_CHOICE': {
      return {
        ...state,
        pendingGrowthChoices: [...state.pendingGrowthChoices, action.choice],
      }
    }

    case 'REMOVE_GROWTH_CHOICE': {
      // 同キャラが複数回レベルアップした場合に備え、最初の1件のみ除去
      const removeIdx = state.pendingGrowthChoices.findIndex(
        c => c.explorerId === action.explorerId
      )
      if (removeIdx < 0) return state
      return {
        ...state,
        pendingGrowthChoices: [
          ...state.pendingGrowthChoices.slice(0, removeIdx),
          ...state.pendingGrowthChoices.slice(removeIdx + 1),
        ],
      }
    }

    // 後方互換
    case 'NEXT_ACTOR': {
      return state
    }

    default:
      return state
  }
}
