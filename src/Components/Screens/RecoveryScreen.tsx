import { useState } from 'react'
import { Button } from '../Common/Button'
import { useGame } from '../../Hooks/UseGame'
import { RecoveryMenuId } from '../../Lib/Types/Game'
import { RECOVERY_MENUS, getRecoveryCost, canExecuteRecovery } from '../../Lib/Core/RecoveryLogic'
import { ExplorerState } from '../../Lib/Types/Explorer'
import { WeaponInstance } from '../../Lib/Types/Weapon'

function MemberSelector({
  party,
  onSelect,
  onCancel,
  menuId,
}: {
  party: ExplorerState[]
  onSelect: (id: string) => void
  onCancel: () => void
  menuId: RecoveryMenuId
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm">
        <h3 className="text-white text-lg font-bold mb-3 text-center">対象を選択</h3>
        <div className="flex flex-col gap-2">
          {party.map(member => {
            const isHealHp = menuId === 'healHp' || menuId === 'convertMpToHp'
            const isHealMp = menuId === 'healMp' || menuId === 'convertHpToMp'
            const hpFull = member.hp >= member.maxHp
            const mpFull = member.mp >= member.maxMp
            const hpTooLow = menuId === 'convertHpToMp' && member.hp <= 15
            const mpTooLow = menuId === 'convertMpToHp' && member.mp < 10
            const disabled =
              (isHealHp && hpFull) ||
              (isHealMp && mpFull) ||
              hpTooLow || mpTooLow

            return (
              <button
                key={member.id}
                onClick={() => onSelect(member.id)}
                disabled={disabled}
                className={`p-3 rounded-lg text-left transition-colors ${
                  disabled
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer'
                }`}
              >
                <div className="font-bold">{member.name}</div>
                <div className="text-sm flex gap-3">
                  <span className="text-red-400">HP {member.hp}/{member.maxHp}</span>
                  <span className="text-blue-400">MP {member.mp}/{member.maxMp}</span>
                </div>
              </button>
            )
          })}
        </div>
        <Button variant="secondary" size="sm" onClick={onCancel} className="w-full mt-3">
          キャンセル
        </Button>
      </div>
    </div>
  )
}

function WeaponStatusList({ party }: { party: ExplorerState[] }) {
  return (
    <div className="text-xs text-gray-300 mt-1">
      {party.map(member => {
        const repairableWeapons = member.weapons.filter(w => {
          if (w.id === 'punch') return false
          const wi = w as WeaponInstance
          if (wi.noRepair || wi.maxUses === null) return false
          return true
        })
        if (repairableWeapons.length === 0) return null
        return (
          <div key={member.id} className="flex gap-1 flex-wrap">
            <span className="text-gray-400">{member.name}:</span>
            {repairableWeapons.map(w => {
              const wi = w as WeaponInstance
              return (
                <span key={wi.id} className={wi.currentUses === 0 ? 'text-red-400' : ''}>
                  {wi.name} {wi.currentUses}/{wi.maxUses}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function RecoveryScreen() {
  const { state, executeRecoveryAction, closeRecovery } = useGame()
  const { run, recoveryState } = state
  const [selectingMenu, setSelectingMenu] = useState<RecoveryMenuId | null>(null)

  if (!run || !recoveryState) return null

  const handleMenuClick = (menuId: RecoveryMenuId, needsTarget: boolean) => {
    if (needsTarget) {
      setSelectingMenu(menuId)
    } else {
      executeRecoveryAction(menuId)
    }
  }

  const handleSelectTarget = (targetId: string) => {
    if (selectingMenu) {
      executeRecoveryAction(selectingMenu, targetId)
    }
    setSelectingMenu(null)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
      <h1 className="text-3xl font-bold text-white mb-2">回復メニュー</h1>
      <p className="text-xl font-bold text-yellow-300 mb-6">所持G: {run.gold}</p>

      {/* パーティステータス */}
      <div className="w-full max-w-md mb-6">
        <div className="grid grid-cols-1 gap-2">
          {run.party.map(member => (
            <div key={member.id} className="bg-gray-800 rounded-lg p-3">
              <div className="font-bold text-white">{member.name}</div>
              <div className="flex gap-4 text-sm">
                <span className="text-red-400">HP {member.hp}/{member.maxHp}</span>
                <span className="text-blue-400">MP {member.mp}/{member.maxMp}</span>
              </div>
            </div>
          ))}
        </div>
        <WeaponStatusList party={run.party} />
      </div>

      {/* 回復ボタン */}
      <div className="w-full max-w-md flex flex-col gap-3 mb-6">
        {RECOVERY_MENUS.map(menu => {
          const useCount = recoveryState.useCounts[menu.id]
          const cost = getRecoveryCost(menu.id, useCount, run)
          const canUse = menu.needsTarget
            ? run.party.some(m => canExecuteRecovery(menu.id, useCount, run, m.id))
            : canExecuteRecovery(menu.id, useCount, run)

          return (
            <button
              key={menu.id}
              onClick={() => handleMenuClick(menu.id, menu.needsTarget)}
              disabled={!canUse}
              className={`p-4 rounded-lg text-left transition-colors ${
                canUse
                  ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                  : 'bg-gray-800 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-white text-lg">{menu.label}</span>
                  <span className="text-gray-400 text-sm ml-2">{menu.description}</span>
                </div>
                <div className="text-right">
                  <span className="text-yellow-300 font-bold text-lg">{cost}G</span>
                  {useCount > 0 && (
                    <span className="text-gray-400 text-xs block">使用{useCount}回</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <Button variant="primary" size="lg" onClick={closeRecovery}>
        報酬を選ぶ
      </Button>

      {selectingMenu && (
        <MemberSelector
          party={run.party}
          onSelect={handleSelectTarget}
          onCancel={() => setSelectingMenu(null)}
          menuId={selectingMenu}
        />
      )}
    </div>
  )
}
