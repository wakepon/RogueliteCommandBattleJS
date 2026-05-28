import { Buff, Debuff } from '../../Lib/Types/Explorer'

interface BuffIconProps {
  buff?: Buff
  debuff?: Debuff
}

/** バフタイプごとの表示設定 */
const BUFF_DISPLAY: Record<string, { label: string; color: string; title: (b: Buff) => string }> = {
  charge: { label: '力', color: 'bg-red-600', title: b => `力溜め: 次攻撃×${b.value}` },
  shield: { label: '盾', color: 'bg-blue-500', title: b => `シールド: ${b.value}` },
  thorns: { label: '棘', color: 'bg-orange-600', title: b => `棘: ${b.value}（被弾時反撃）` },
  taunt: { label: '挑', color: 'bg-red-500', title: () => '挑発: 被弾率100%' },
  damageReduction: { label: '防', color: 'bg-sky-600', title: b => `被ダメ軽減: ${Math.round(b.value * 100)}%` },
  aoeConvert: { label: '全', color: 'bg-purple-500', title: () => '全体化: 次の攻撃を全体化' },
  str: { label: 'S', color: 'bg-red-500', title: b => `STR+${b.value}` },
  int: { label: 'I', color: 'bg-blue-500', title: b => `INT+${b.value}` },
  targetRateUp: { label: '祈', color: 'bg-yellow-500', title: b => `祈り: 被弾率+${b.value}%` },
  precision: { label: '精', color: 'bg-cyan-500', title: () => '精密: ブレ幅0' },
  guidance: { label: '導', color: 'bg-teal-500', title: b => `導き: ボーナスEXP+${b.value}` },
  weaponPowerBonus: { label: '鍛', color: 'bg-orange-500', title: b => `武器強化: +${b.value}` },
  levelUpDamageBoost: { label: '闘', color: 'bg-amber-500', title: b => `闘気: ×${b.value}` },
}

export function BuffIcon({ buff, debuff }: BuffIconProps) {
  if (buff) {
    const display = BUFF_DISPLAY[buff.type]
    const label = display?.label ?? buff.type.charAt(0).toUpperCase()
    const color = display?.color ?? 'bg-green-600'
    const title = display?.title ? display.title(buff) : `${buff.type}: +${buff.value}`
    return (
      <div className={`inline-flex items-center justify-center w-6 h-6 ${color} rounded text-xs text-white`} title={title}>
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
        <div className="inline-flex items-center justify-center w-6 h-6 bg-yellow-700 rounded text-xs text-white" title={`攻撃ダウン: ${Math.round(debuff.value * 100)}%低下 残${debuff.duration}T`}>
          W
        </div>
      )
    }
    if (debuff.type === 'vulnerability') {
      return (
        <div className="inline-flex items-center justify-center w-6 h-6 bg-red-700 rounded text-xs text-white" title={`被ダメ増加: ×${debuff.multiplier} 残${debuff.duration}T`}>
          V
        </div>
      )
    }
  }

  return null
}
