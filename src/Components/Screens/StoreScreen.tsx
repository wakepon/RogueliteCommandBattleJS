import { useState } from 'react'
import { useGame } from '../../Hooks/UseGame'
import { Button } from '../Common/Button'
import { PlayerStatus } from '../Battle/PlayerStatus'
import { StoreShopPanel } from '../Store/StoreShopPanel'
import { StoreCommandPanel } from '../Store/StoreCommandPanel'
import { MapOverlay } from '../Store/MapOverlay'

export function StoreScreen() {
  const {
    state,
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
  } = useGame()

  const [showMap, setShowMap] = useState(false)
  const [selectedMemberIndex, setSelectedMemberIndex] = useState(0)

  const { run, storeState, mapState } = state

  if (!run || !storeState) {
    return null
  }

  const selectedMember = run.party[selectedMemberIndex]
  const gold = run.gold

  return (
    <div className="min-h-screen bg-gray-800 p-3 flex flex-col">
      {/* [1] 情報バー */}
      <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg mb-3">
        <div className="flex justify-between items-center text-white text-sm">
          <span className="font-bold">ストア</span>
          <span className="text-yellow-400 font-bold">{gold} G</span>
        </div>
      </div>

      {/* [2] キャラ選択タブ */}
      <div className="flex gap-1 mb-3">
        {run.party.map((member, index) => (
          <button
            key={member.id}
            onClick={() => setSelectedMemberIndex(index)}
            className={`flex-1 text-sm p-2 rounded-t-lg border transition-colors ${
              index === selectedMemberIndex
                ? 'bg-gray-900 border-gray-600 border-b-transparent text-white font-bold'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            <div>{member.name}</div>
            <div className="text-[10px] text-gray-400">
              武器{member.weapons.filter(w => w.maxUses !== null).length}/{member.weaponSlotCount}
              {' '}魔法{member.spells.length}/{member.magicSlotCount}
            </div>
          </button>
        ))}
      </div>

      {/* [3] メインエリア（商品+所持品） */}
      <div className="flex-1 bg-gray-900 border border-gray-600 p-3 rounded-lg mb-3 min-h-[160px] flex flex-col">
        <StoreShopPanel
          explorer={selectedMember}
          memberIndex={selectedMemberIndex}
          run={run}
          storeState={storeState}
          gold={gold}
          buyWeapon={(slotIndex, item) => buyWeapon(slotIndex, item, selectedMemberIndex)}
          buySpell={(slotIndex, item) => buySpell(slotIndex, item, selectedMemberIndex)}
          buyRelic={buyRelic}
          buyPotion={buyPotion}
          sellWeapon={(weaponIndex) => sellWeapon(weaponIndex, selectedMemberIndex)}
          sellSpell={(spellIndex) => sellSpell(spellIndex, selectedMemberIndex)}
          sellRelic={sellRelic}
          sellPotion={sellPotion}
        />
      </div>

      {/* [4] 統合パネル（マップ+リロール+出発） */}
      <div className="mb-3">
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="flex gap-2 justify-center">
            {mapState && (
              <Button variant="secondary" onClick={() => setShowMap(true)}>
                マップ
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={rerollStore}
              disabled={gold < storeState.rerollCost}
            >
              リロール ({storeState.rerollCost}G)
            </Button>
            <Button variant="primary" onClick={closeStore}>
              出発
            </Button>
          </div>
        </div>
      </div>

      {/* [5] コマンド | ステータス */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <StoreCommandPanel explorer={selectedMember} relics={run.relics} />
        </div>
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">{selectedMember.name} status</div>
          <PlayerStatus
            explorer={selectedMember}
            gold={gold}
            levelUpPopupCount={0}
          />
        </div>
      </div>

      {/* マップオーバーレイ */}
      {showMap && mapState && (
        <MapOverlay
          nodes={mapState.nodes}
          currentStage={mapState.currentStage}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  )
}
