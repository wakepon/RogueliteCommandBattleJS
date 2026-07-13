import { EnemyInstance } from '../../Lib/Types/Enemy'
import { EnemyIntent } from '../../Lib/Types/Battle'
import { BuffIcon, Tooltip } from '../Common'
import { KillLineBar } from './KillLineBar'
import { DetailedDamagePreview } from '../../Lib/Utils/DamagePredictor'
import { buildIntentDisplay } from '../../Lib/Utils/EnemyIntentDisplay'
import { getTuningValue } from '../../Lib/Tuning/TuningStore'
import { getTuningDefault } from '../../Lib/Tuning/TuningSchema'

interface EnemyDisplayProps {
  enemy: EnemyInstance
  isCurrentActor: boolean
  isActing?: boolean       // 行動中（上下アニメーション）
  isTargetSelected?: boolean
  isTargetHighlighted?: boolean
  isDragTarget?: boolean   // ドラッグ中に攻撃対象になりうる（全体強調）
  isHovered?: boolean      // ドラッグ中にホバーされている（個別強調）
  onSelect?: () => void
  damagePreview?: DetailedDamagePreview | null
  intent?: EnemyIntent | null
}

// 敵タイプに応じた色を返す
function getEnemyTypeColor(type: EnemyInstance['type']): string {
  switch (type) {
    case 'normal':
      return 'border-green-500'
    case 'elite':
      return 'border-purple-500'
    case 'boss':
      return 'border-red-500'
    default:
      return 'border-gray-500'
  }
}

// 敵タイプに応じた背景色を返す
function getEnemyTypeBgColor(type: EnemyInstance['type']): string {
  switch (type) {
    case 'normal':
      return 'bg-green-900/30'
    case 'elite':
      return 'bg-purple-900/30'
    case 'boss':
      return 'bg-red-900/30'
    default:
      return 'bg-gray-900/30'
  }
}

export function EnemyDisplay({
  enemy,
  isCurrentActor,
  isActing = false,
  isTargetSelected = false,
  isTargetHighlighted = false,
  isDragTarget = false,
  isHovered = false,
  onSelect,
  damagePreview,
  intent,
}: EnemyDisplayProps) {
  const borderColor = getEnemyTypeColor(enemy.type)
  const bgColor = getEnemyTypeBgColor(enemy.type)
  const isDead = enemy.currentHp <= 0

  // トドメEXP: デフォルト値と異なる場合のみ表示する
  const finishExpBonus = getTuningValue('finish_exp_bonus', 1)
  const finishExpDefault = getTuningDefault('finish_exp_bonus') as number
  const showFinishExp = finishExpBonus !== finishExpDefault

  // ターゲット選択時のスタイル
  const targetStyle = isTargetSelected || isTargetHighlighted
    ? 'border-yellow-400 bg-yellow-400/20'
    : isDragTarget
      ? 'border-yellow-400/60 bg-yellow-400/5'
      : `${borderColor} ${bgColor}`

  return (
    <div
      onClick={onSelect}
      className={`
        relative p-4 rounded-lg border-2 w-32 md:w-40
        ${targetStyle}
        ${isCurrentActor ? 'ring-2 ring-yellow-400' : ''}
        ${isActing ? 'animate-enemy-bob' : ''}
        ${isDead ? 'opacity-50' : ''}
        ${onSelect && !isDead ? 'cursor-pointer hover:border-yellow-300' : ''}
        transition-all duration-200
      `}
    >
      {/* 選択カーソルインジケーター（選択済み or ホバー中） */}
      {(isTargetSelected || isHovered) && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-yellow-400 text-xl font-bold">
          ▲
        </div>
      )}
      {/* 敵タイプバッジ */}
      {enemy.type !== 'normal' && (
        <div className={`
          absolute -top-2 -right-2 px-2 py-0.5 rounded text-xs font-bold text-white
          ${enemy.type === 'elite' ? 'bg-purple-500' : 'bg-red-500'}
        `}>
          {enemy.type === 'elite' ? 'ELITE' : 'BOSS'}
        </div>
      )}

      {/* 敵名 */}
      <div className="text-white font-bold mb-1 text-center">
        {enemy.name}
      </div>

      {/* 行動予告 */}
      {intent && !isDead && (() => {
        const display = buildIntentDisplay(intent.storedAction, enemy.hp)
        const hasDamage = intent.storedAction.damage > 0
        const tipContent = display.tooltips.length > 0 ? (
          <div className="space-y-1 text-left">
            {display.tooltips.map(t => (
              <div key={t.term}>
                <span className="font-bold text-yellow-300">{t.term}</span>：{t.desc}
              </div>
            ))}
          </div>
        ) : null
        return (
          <Tooltip content={tipContent} position="top">
            <div className="text-center mb-1 leading-tight">
              <span className="text-gray-400 text-[10px]">次: </span>
              <span className={`text-[10px] ${hasDamage ? 'text-red-300' : 'text-gray-300'}`}>
                {intent.actionName}
              </span>
              {display.detail && (
                <span className={`text-[11px] font-bold ml-0.5 ${hasDamage ? 'text-red-300' : 'text-gray-300'}`}>
                  ({display.detail})
                </span>
              )}
            </div>
          </Tooltip>
        )
      })()}

      {/* 統合HP + キルラインバー */}
      <div className="mb-2">
        <KillLineBar
          currentHp={enemy.currentHp}
          maxHp={enemy.hp}
          damagePreview={damagePreview ?? null}
          shieldValue={0}
        />
      </div>

      {/* とどめ報酬表示（デフォルト値と異なる場合のみ） */}
      {showFinishExp && (
        <div className="text-xs text-gray-400 text-center">
          とどめ時 EXP +{finishExpBonus}
        </div>
      )}

      {/* バフ/デバフ表示 */}
      {(enemy.battleBuffs.length > 0 || enemy.battleDebuffs.length > 0) && (
        <div className="flex gap-1 mt-2 justify-center flex-wrap">
          {enemy.battleBuffs.map((buff) => (
            <BuffIcon key={`buff-${buff.type}-${buff.value}`} buff={buff} />
          ))}
          {enemy.battleDebuffs.map((debuff, i) => (
            <BuffIcon key={`debuff-${debuff.type}-${i}`} debuff={debuff} />
          ))}
        </div>
      )}

      {/* 死亡表示 */}
      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <span className="text-gray-400 font-bold">DEFEATED</span>
        </div>
      )}
    </div>
  )
}
