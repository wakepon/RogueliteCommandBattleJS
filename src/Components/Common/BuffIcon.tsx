import { Buff, Debuff } from '../../Lib/Types/Explorer'

interface BuffIconProps {
  buff?: Buff
  debuff?: Debuff
}

export function BuffIcon({ buff, debuff }: BuffIconProps) {
  if (buff) {
    const label = buff.type === 'charge' ? '力' : buff.type.charAt(0).toUpperCase()
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-green-600 rounded text-xs text-white" title={`${buff.type}: +${buff.value}`}>
        {label}
      </div>
    )
  }

  if (debuff) {
    if (debuff.type === 'poison') {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 rounded text-xs text-white" title={`毒: ${debuff.stacks}stacks`}>
          P
        </div>
      )
    }
    if (debuff.type === 'weakness') {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 bg-yellow-700 rounded text-xs text-white" title={`弱体: ${Math.round(debuff.value * 100)}%低下 残${debuff.duration}T`}>
          W
        </div>
      )
    }
  }

  return null
}
