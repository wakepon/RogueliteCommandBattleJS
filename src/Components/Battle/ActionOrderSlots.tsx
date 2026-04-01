import { CommandSlot } from '../../Lib/Types/Battle'
import { ExplorerState } from '../../Lib/Types/Explorer'

interface ActionOrderSlotsProps {
  commandSlots: CommandSlot[]
  party: ExplorerState[]
}

/**
 * 行動順スロット表示
 * コマンドがセットされた順にキャラアイコンを表示
 */
export function ActionOrderSlots({ commandSlots, party }: ActionOrderSlotsProps) {
  // コマンドがセットされたスロットのみ表示
  const setSlots = commandSlots.filter(s => s.command !== null)

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-gray-500 mr-1">行動順:</span>
      {setSlots.length === 0 ? (
        <span className="text-[10px] text-gray-600">コマンドをセットしてください</span>
      ) : (
        setSlots.map((slot, index) => {
          const member = party.find(m => m.id === slot.explorerId)
          if (!member) return null
          return (
            <div key={slot.explorerId} className="flex items-center">
              {index > 0 && <span className="text-gray-600 text-xs mx-0.5">→</span>}
              <div className="bg-gray-700 rounded px-1.5 py-0.5 text-[10px] text-white">
                {member.name}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
