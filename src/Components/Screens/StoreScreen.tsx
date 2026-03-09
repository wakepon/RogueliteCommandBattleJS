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

  const { run, storeState, mapState } = state

  if (!run || !storeState) {
    return null
  }

  const explorer = run.party[0]
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

      {/* [2] メインエリア（商品+所持品） */}
      <div className="flex-1 bg-gray-900 border border-gray-600 p-3 rounded-lg mb-3 min-h-[160px] flex flex-col">
        <StoreShopPanel
          explorer={explorer}
          run={run}
          storeState={storeState}
          gold={gold}
          buyWeapon={buyWeapon}
          buySpell={buySpell}
          buyRelic={buyRelic}
          buyPotion={buyPotion}
          sellWeapon={sellWeapon}
          sellSpell={sellSpell}
          sellRelic={sellRelic}
          sellPotion={sellPotion}
        />
      </div>

      {/* [3] 統合パネル（マップ+リロール+出発） */}
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

      {/* [4] コマンド | ステータス */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <StoreCommandPanel explorer={explorer} />
        </div>
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">explorer status</div>
          <PlayerStatus
            explorer={explorer}
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
