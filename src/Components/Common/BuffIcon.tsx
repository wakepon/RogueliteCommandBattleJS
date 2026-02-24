import { Buff, Debuff } from '../../Lib/Types/Explorer'

interface BuffIconProps {
  buff?: Buff
  debuff?: Debuff
}

export function BuffIcon({ buff, debuff }: BuffIconProps) {
  if (buff) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-green-600 rounded text-xs text-white" title={`${buff.type}: +${buff.value}`}>
        {buff.type.charAt(0).toUpperCase()}
      </div>
    )
  }

  if (debuff) {
    // 現在はpoisonのみだが、将来の拡張性を考慮
    const debuffLabel = debuff.type === 'poison' ? 'P' : String(debuff.type).charAt(0).toUpperCase()
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 rounded text-xs text-white" title={`${debuff.type}: ${debuff.stacks}stacks`}>
        {debuffLabel}
      </div>
    )
  }

  return null
}
