import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import {
  calculateRestHeal,
  getRepairableWeapons,
  canRepairWeapons,
} from '../../Lib/Core/EventLogic'
import { Rarity } from '../../Lib/Types/Item'

/** レアリティに応じた色を取得 */
function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return 'border-gray-500 bg-gray-800'
    case 'Uncommon':
      return 'border-green-500 bg-green-900/30'
    case 'Rare':
      return 'border-blue-500 bg-blue-900/30'
    case 'Unique':
      return 'border-purple-500 bg-purple-900/30'
  }
}

/** レアリティのテキスト色 */
function getRarityTextColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return 'text-gray-400'
    case 'Uncommon':
      return 'text-green-400'
    case 'Rare':
      return 'text-blue-400'
    case 'Unique':
      return 'text-purple-400'
  }
}

export function EventScreen() {
  const {
    state,
    selectRest,
    selectTreasure,
    confirmTreasure,
    cancelTreasure,
    replaceRelic,
    selectRepair,
    toggleRepairWeapon,
    confirmRepair,
    closeEvent,
  } = useGame()

  const { run, eventState } = state

  if (!run || !eventState) {
    return null
  }

  const canRepair = canRepairWeapons(run.party)

  // 選択画面
  const renderSelecting = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white text-center mb-8">
        イベント
      </h1>
      <p className="text-gray-300 text-center mb-6">
        次の行動を選んでください
      </p>

      <div className="flex flex-col gap-4 max-w-md mx-auto">
        {/* 休憩 */}
        <button
          onClick={selectRest}
          className="p-4 rounded-lg border-2 border-green-500 bg-green-900/30 hover:bg-green-800/50 transition-colors text-left"
        >
          <div className="text-lg text-white font-semibold">休憩</div>
          <div className="text-sm text-gray-300">
            全員のHPを最大HPの50%回復
          </div>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            {run.party.map(m => (
              <div key={m.id}>{m.name}: HP {m.hp}/{m.maxHp} (+{calculateRestHeal(m.maxHp)})</div>
            ))}
          </div>
        </button>

        {/* 宝箱 */}
        <button
          onClick={selectTreasure}
          className="p-4 rounded-lg border-2 border-yellow-500 bg-yellow-900/30 hover:bg-yellow-800/50 transition-colors text-left"
        >
          <div className="text-lg text-white font-semibold">宝箱を開ける</div>
          <div className="text-sm text-gray-300">
            ランダムなレリックを獲得
          </div>
          <div className="text-xs text-gray-400 mt-1">
            所持レリック: {run.relics.length}/5
          </div>
        </button>

        {/* 武器修理 */}
        <button
          onClick={selectRepair}
          disabled={!canRepair}
          className={`p-4 rounded-lg border-2 transition-colors text-left ${
            canRepair
              ? 'border-blue-500 bg-blue-900/30 hover:bg-blue-800/50'
              : 'border-gray-600 bg-gray-800/30 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className={`text-lg font-semibold ${canRepair ? 'text-white' : 'text-gray-500'}`}>
            武器修理
          </div>
          <div className={`text-sm ${canRepair ? 'text-gray-300' : 'text-gray-500'}`}>
            1人を選択 → その人の全武器の使用回数を全回復
          </div>
          {!canRepair && (
            <div className="text-xs text-gray-500 mt-1">
              修理可能な武器がありません
            </div>
          )}
        </button>
      </div>
    </div>
  )

  // 武器修理選択画面（キャラ選択方式: 1人を選んで全武器修理）
  const renderRepairSelection = () => {
    // selectedWeaponIdsの最初の要素をキャラIDとして流用
    const selectedCharId = eventState.selectedWeaponIds[0] ?? null

    const handleSelectCharacter = (charId: string) => {
      // 既に選択中なら解除、そうでなければ選択（toggleで実現）
      if (selectedCharId === charId) {
        toggleRepairWeapon(charId)
      } else {
        // まず既存の選択をクリア（最大2の制限に引っかからないよう）
        if (selectedCharId) {
          toggleRepairWeapon(selectedCharId)
        }
        toggleRepairWeapon(charId)
      }
    }

    const handleConfirm = () => {
      if (!selectedCharId) return
      // selectedWeaponIdsにキャラIDが入っているが、confirmRepairはweaponIdsとして処理する
      // GameReducerのCONFIRM_REPAIRでparty全員に適用されるので、対象キャラの全武器IDを渡す
      const targetMember = run.party.find(m => m.id === selectedCharId)
      if (!targetMember) return
      const allWeaponIds = targetMember.weapons.map(w => w.id)
      // 一旦全クリアしてから全武器IDを設定
      if (selectedCharId) toggleRepairWeapon(selectedCharId)
      allWeaponIds.forEach(id => toggleRepairWeapon(id))
      confirmRepair()
    }

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white text-center mb-4">
          武器修理
        </h1>
        <p className="text-gray-300 text-center mb-6">
          修理するキャラクターを選んでください
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-8">
          {run.party.map((member) => {
            const repairables = getRepairableWeapons(member.weapons)
            const hasRepairableWeapons = repairables.length > 0
            const isSelected = selectedCharId === member.id

            return (
              <button
                key={member.id}
                onClick={() => hasRepairableWeapons && handleSelectCharacter(member.id)}
                disabled={!hasRepairableWeapons}
                className={`p-4 rounded-lg border-2 transition-colors min-w-44 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-800/50 ring-2 ring-blue-400'
                    : hasRepairableWeapons
                    ? 'border-gray-500 bg-gray-800 hover:bg-gray-700'
                    : 'border-gray-700 bg-gray-900 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="text-white font-semibold text-lg">{member.name}</div>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  {member.weapons.map(w => {
                    if (w.currentUses === null) return null
                    return (
                      <div key={w.id} className={w.currentUses < (w.maxUses ?? 0) ? 'text-yellow-300' : 'text-gray-500'}>
                        {w.name}: {w.currentUses}/{w.maxUses}
                      </div>
                    )
                  })}
                  {!hasRepairableWeapons && (
                    <div className="text-gray-500">修理不要</div>
                  )}
                </div>
                {isSelected && (
                  <div className="text-xs text-blue-300 mt-2 font-bold">選択中</div>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={closeEvent}>
            戻る
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!selectedCharId}
          >
            修理する
          </Button>
        </div>
      </div>
    )
  }

  // 宝箱表示画面（レリック枠に空きがある場合のみ表示される）
  const renderTreasureReveal = () => {
    const relic = eventState.revealedRelic

    if (!relic) {
      return null
    }

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white text-center mb-4">
          宝箱
        </h1>
        <p className="text-gray-300 text-center mb-6">
          レリックを発見しました!
        </p>

        {/* レリック表示 */}
        <div className="flex justify-center mb-8">
          <div
            className={`p-6 rounded-lg border-2 min-w-48 ${getRarityColor(relic.rarity)}`}
          >
            <div className="text-lg text-white font-bold">{relic.name}</div>
            <div className={`text-sm mt-1 ${getRarityTextColor(relic.rarity)}`}>
              {relic.rarity}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={cancelTreasure}>
            諦める
          </Button>
          <Button variant="primary" onClick={confirmTreasure}>
            獲得する
          </Button>
        </div>
      </div>
    )
  }

  // 宝箱入れ替え画面
  const renderTreasureReplace = () => {
    const relic = eventState.revealedRelic

    if (!relic) {
      return null
    }

    // レリックの売却価格を計算
    const getSellPrice = (price: number) => Math.floor(price / 2)

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white text-center mb-4">
          レリック入れ替え
        </h1>
        <p className="text-gray-300 text-center mb-2">
          売却するレリックを選んでください
        </p>

        {/* 獲得するレリック */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 text-center mb-2">獲得するレリック:</p>
          <div className="flex justify-center">
            <div
              className={`p-4 rounded-lg border-2 min-w-40 ${getRarityColor(relic.rarity)}`}
            >
              <div className="text-white font-bold">{relic.name}</div>
              <div className={`text-sm ${getRarityTextColor(relic.rarity)}`}>
                {relic.rarity}
              </div>
            </div>
          </div>
        </div>

        {/* 既存レリック一覧 */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 text-center mb-3">所持中のレリック:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {run.relics.map((existingRelic) => (
              <button
                key={existingRelic.id}
                onClick={() => replaceRelic(existingRelic.id)}
                className={`p-3 rounded-lg border-2 hover:opacity-80 transition-colors min-w-36 ${getRarityColor(existingRelic.rarity)}`}
              >
                <div className="text-white font-semibold">{existingRelic.name}</div>
                <div className={`text-xs ${getRarityTextColor(existingRelic.rarity)}`}>
                  {existingRelic.rarity}
                </div>
                <div className="text-xs text-green-400 mt-1">
                  売却: {getSellPrice(existingRelic.price)}G
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <Button variant="secondary" onClick={cancelTreasure}>
            諦める
          </Button>
        </div>
      </div>
    )
  }

  // サブフェーズに応じて表示を切り替え
  const renderContent = () => {
    switch (eventState.subPhase) {
      case 'selecting':
        return renderSelecting()
      case 'repairSelection':
        return renderRepairSelection()
      case 'treasureReveal':
        return renderTreasureReveal()
      case 'treasureReplace':
        return renderTreasureReplace()
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 flex flex-col justify-center">
      {renderContent()}
    </div>
  )
}
