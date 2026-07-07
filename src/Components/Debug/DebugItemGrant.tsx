import { useGame } from '../../Hooks/UseGame'
import { WeaponData } from '../../Lib/Types/Weapon'
import { SpellData } from '../../Lib/Types/Spell'
import { RelicData } from '../../Lib/Types/Relic'
import { canBuyWeapon, canBuySpell, canBuyRelic } from '../../Lib/Core/StoreLogic'
import WeaponsData from '../../Lib/Data/Weapons.json'
import SpellsData from '../../Lib/Data/Spells.json'
import RelicsData from '../../Lib/Data/Relics.json'

const weaponsData = WeaponsData as Record<string, WeaponData>
const spellsData = SpellsData as Record<string, SpellData>
const relicsData = RelicsData as Record<string, RelicData>

/** アイテム入手ボタンのグリッド */
function GrantGrid<T extends { id: string; name: string }>({ title, items, disabled, onGrant }: {
  title: string
  items: T[]
  disabled: boolean
  onGrant: (item: T) => void
}) {
  return (
    <div>
      <div className="text-sm text-gray-400 font-bold mb-1">
        {title}
        {disabled && <span className="text-red-400 ml-2">（空き枠なし）</span>}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {items.map(item => (
          <button
            key={item.id}
            disabled={disabled}
            onClick={() => onGrant(item)}
            className={`text-left text-xs px-2 py-1 rounded border truncate ${
              disabled
                ? 'border-gray-700 bg-gray-800/30 text-gray-600 cursor-not-allowed'
                : 'border-gray-600 bg-gray-700/40 text-gray-200 hover:bg-gray-600 hover:border-gray-400'
            }`}
            title={item.name}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * デバッグ: 武器/魔法/レリックの即時入手セクション。
 * クリックで空き枠のある最初のメンバー（レリックは共有枠）に追加。
 * 所持レリックの破棄ボタンも提供する。
 */
export function DebugItemGrant() {
  const { state, debugGrantWeapon, debugGrantSpell, debugGrantRelic, discardRelic } = useGame()
  const run = state.run
  if (!run) return null

  const canGrantWeapon = run.party.some(canBuyWeapon)
  const canGrantSpell = run.party.some(canBuySpell)
  const canGrantRelic = canBuyRelic(run.relics)

  return (
    <div className="space-y-3">
      <GrantGrid title="武器" items={Object.values(weaponsData)} disabled={!canGrantWeapon} onGrant={debugGrantWeapon} />
      <GrantGrid title="魔法" items={Object.values(spellsData)} disabled={!canGrantSpell} onGrant={debugGrantSpell} />
      <GrantGrid title="レリック" items={Object.values(relicsData)} disabled={!canGrantRelic} onGrant={debugGrantRelic} />

      {/* 所持レリック（破棄用） */}
      <div>
        <div className="text-sm text-gray-400 font-bold mb-1">所持レリック（破棄）</div>
        {run.relics.length === 0 ? (
          <div className="text-xs text-gray-600">なし</div>
        ) : (
          <div className="space-y-1">
            {run.relics.map((relic, idx) => (
              <div key={`${relic.id}-${idx}`} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-gray-200 truncate">{relic.name}</span>
                <button
                  onClick={() => discardRelic(idx)}
                  className="text-xs px-2 py-0.5 rounded border border-red-600 text-red-400 hover:bg-red-900/50"
                >
                  破棄
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
