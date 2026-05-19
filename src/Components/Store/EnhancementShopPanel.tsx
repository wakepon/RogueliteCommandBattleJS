import { useState, useEffect } from 'react'
import { Button } from '../Common/Button'
import { Tooltip, TooltipCard } from '../Common'
import { MapOverlay } from './MapOverlay'
import { StoreLeftPanel } from '../Screens/StoreScreen'
import { ExplorerWeapon, WeaponInstance } from '../../Lib/Types/Weapon'
import { SpellInstance } from '../../Lib/Types/Spell'
import { RelicInstance } from '../../Lib/Types/Relic'
import { PotionData } from '../../Lib/Types/Potion'
import { MapState, StoreState } from '../../Lib/Types/Game'
import { RunState } from '../../Lib/Types/Run'
import { ExplorerState } from '../../Lib/Types/Explorer'
import {
  EnhancementOption, WeaponEnhancementOption,
  ENHANCEMENT_COST,
  MAX_ENHANCEMENTS_PER_SHOP,
} from '../../Lib/Types/Enhancement'

function isWeaponOption(option: EnhancementOption): option is WeaponEnhancementOption {
  return option.merit.category === 'weaponMerit'
}
import {
  getWeaponMeritText, getWeaponDemeritText,
  getSpellMeritText, getSpellDemeritTextFull,
  getRemainingEnhancements,
  getWeaponEnhancementSummary, getSpellEnhancementSummary,
  applyWeaponEnhancement, applySpellEnhancement,
  canEnhanceWeapon, canEnhanceSpell,
} from '../../Lib/Core/EnhancementLogic'
import { predictWeaponDamage, predictSpellDamage, formatDamageRange } from '../../Lib/Utils/DamagePredictor'
import { CLASS_ICONS } from '../Battle/PartyAvatars'
import { GameAction } from '../../Lib/State/GameReducer'

interface EnhancementShopPanelProps {
  run: RunState
  storeState: StoreState
  dispatch: React.Dispatch<GameAction>
  gold: number
  initialGold: number
  movedKeys: Set<string>
  newPurchaseKeys: Set<string>
  mapState: MapState | null
  showMap: boolean
  setShowMap: (v: boolean) => void
  closeStore: () => void
}

function EnhancementComparisonTooltip({
  beforeItem, afterItem, beforeDmg, afterDmg,
}: {
  beforeItem: ExplorerWeapon | SpellInstance
  afterItem: ExplorerWeapon | SpellInstance
  beforeDmg?: string
  afterDmg?: string
}) {
  return (
    <div className="flex gap-2">
      <div>
        <div className="text-[9px] text-gray-400 mb-0.5">現在</div>
        <TooltipCard item={beforeItem} damageText={beforeDmg} />
      </div>
      <div className="text-gray-500 flex items-center text-lg">→</div>
      <div>
        <div className="text-[9px] text-yellow-400 mb-0.5">強化後</div>
        <TooltipCard item={afterItem} damageText={afterDmg} />
      </div>
    </div>
  )
}

export function EnhancementShopPanel({
  run, storeState, dispatch, gold, initialGold,
  movedKeys, newPurchaseKeys, mapState, showMap, setShowMap, closeStore,
}: EnhancementShopPanelProps) {
  const enhState = storeState.enhancementState!
  const remainingSlots = MAX_ENHANCEMENTS_PER_SHOP - enhState.enhancementsUsed
  const isMaxed = enhState.enhancementsUsed >= MAX_ENHANCEMENTS_PER_SHOP
  const insufficientGold = gold < ENHANCEMENT_COST

  const [selectedOptionIndex, setSelectedOptionIndex] = useState<0 | 1 | null>(null)

  useEffect(() => {
    setSelectedOptionIndex(null)
  }, [enhState.options])

  const getSelectedItemName = (): string => {
    if (!enhState.selectedTarget) return ''
    const target = enhState.selectedTarget
    const member = run.party[target.memberIndex]
    if (!member) return ''
    if (target.itemType === 'weapon') {
      return member.weapons[target.itemIndex]?.name ?? ''
    }
    return member.spells[target.itemIndex]?.name ?? ''
  }

  const getMeritText = (option: EnhancementOption): string => {
    if (option.merit.category === 'weaponMerit') return getWeaponMeritText(option.merit)
    return getSpellMeritText(option.merit)
  }

  const getDemeritText = (option: EnhancementOption): string => {
    if (isWeaponOption(option)) return getWeaponDemeritText(option.demerit)
    return getSpellDemeritTextFull(option.demerit)
  }

  const dmgOpts = { relics: run.relics }

  const computeBeforeAfter = (option: EnhancementOption) => {
    const target = enhState.selectedTarget
    if (!target) return null
    const member = run.party[target.memberIndex]
    if (!member) return null

    if (target.itemType === 'weapon') {
      const weapon = member.weapons[target.itemIndex]
      if (!weapon || !('enhancements' in weapon) || !isWeaponOption(option)) return null
      const wi = weapon as WeaponInstance
      const after = applyWeaponEnhancement(wi, option)
      return {
        before: weapon,
        after: after as ExplorerWeapon,
        beforeDmg: formatDamageRange(predictWeaponDamage(member, weapon, dmgOpts)),
        afterDmg: formatDamageRange(predictWeaponDamage(member, after, dmgOpts)),
      }
    }
    const spell = member.spells[target.itemIndex]
    if (!spell || isWeaponOption(option)) return null
    const after = applySpellEnhancement(spell, option)
    return {
      before: spell,
      after,
      beforeDmg: spell.power > 0 ? formatDamageRange(predictSpellDamage(member, spell, dmgOpts)) : undefined,
      afterDmg: after.power > 0 ? formatDamageRange(predictSpellDamage(member, after, dmgOpts)) : undefined,
    }
  }

  return (
    <div className="min-h-screen bg-gray-800 p-2 flex gap-2">
      {/* ===== 左サイドパネル ===== */}
      <div className="w-1/4 flex-shrink-0 flex flex-col">
        <StoreLeftPanel
          gold={gold}
          initialGold={initialGold}
          shopTitle="武器・魔法強化"
          currentStage={run.currentStage}
          seed={run.seed}
          potions={run.potions as PotionData[]}
          relics={run.relics}
          movedKeys={movedKeys}
          newPurchaseKeys={newPurchaseKeys}
          party={run.party}
          dragData={null}
        />
      </div>

      {/* ===== 右側メイン領域 ===== */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">

        {/* ===== 強化ショップエリア ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          {enhState.phase === 'selectItem' && (
            <div>
              <div className="text-white font-bold text-sm mb-2">強化する武器・魔法を選択してください</div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${remainingSlots > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                  残り強化枠: {remainingSlots}
                </span>
                {isMaxed && (
                  <span className="text-red-400 text-[10px]">この訪問での強化上限に達しました</span>
                )}
              </div>
            </div>
          )}

          {enhState.phase === 'confirmEnhance' && (
            <div>
              <div className="text-white font-bold text-sm mb-2">
                「{getSelectedItemName()}」を強化しますか？
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  className={`px-4 py-2 rounded font-bold text-sm transition-colors ${
                    insufficientGold
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-500 text-white cursor-pointer'
                  }`}
                  onClick={() => dispatch({ type: 'CONFIRM_ENHANCEMENT' })}
                  disabled={insufficientGold}
                >
                  強化する（{ENHANCEMENT_COST}G）
                </button>
                <button
                  className="px-4 py-2 rounded font-bold text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer transition-colors"
                  onClick={() => dispatch({ type: 'CANCEL_ENHANCEMENT_TARGET' })}
                >
                  キャンセル
                </button>
              </div>
              {insufficientGold && (
                <div className="text-red-400 text-[10px] mt-1">ゴールドが足りません</div>
              )}
            </div>
          )}

          {enhState.phase === 'chooseOption' && enhState.options && (
            <div>
              <div className="text-white font-bold text-sm mb-2">強化効果を選択してください</div>
              <div className="grid grid-cols-2 gap-2">
                {enhState.options.map((option, optIdx) => {
                  const ba = computeBeforeAfter(option)
                  const demeritText = getDemeritText(option)
                  const optionButton = (
                    <button
                      key={optIdx}
                      className={`bg-gray-800 border-2 rounded-lg p-3 flex flex-col gap-1 transition-colors cursor-pointer text-left w-full ${
                        selectedOptionIndex === optIdx
                          ? 'border-yellow-400 bg-yellow-900/20'
                          : 'border-gray-600 hover:border-yellow-400'
                      }`}
                      onClick={() => setSelectedOptionIndex(optIdx as 0 | 1)}
                    >
                      <div className="text-green-400 font-bold text-sm">{getMeritText(option)}</div>
                      {demeritText && (
                        <div className="text-red-400 text-[10px]">{demeritText}</div>
                      )}
                    </button>
                  )
                  if (ba) {
                    return (
                      <Tooltip
                        key={optIdx}
                        content={
                          <EnhancementComparisonTooltip
                            beforeItem={ba.before}
                            afterItem={ba.after}
                            beforeDmg={ba.beforeDmg}
                            afterDmg={ba.afterDmg}
                          />
                        }
                        position="bottom"
                      >
                        {optionButton}
                      </Tooltip>
                    )
                  }
                  return optionButton
                })}
              </div>
              <div className="flex justify-center mt-2">
                <button
                  className={`px-6 py-2 rounded font-bold text-sm transition-colors ${
                    selectedOptionIndex !== null
                      ? 'bg-yellow-600 hover:bg-yellow-500 text-white cursor-pointer'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={selectedOptionIndex === null}
                  onClick={() => {
                    if (selectedOptionIndex !== null) {
                      dispatch({ type: 'CHOOSE_ENHANCEMENT', optionIndex: selectedOptionIndex })
                      setSelectedOptionIndex(null)
                    }
                  }}
                >
                  適用
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== キャラ欄（強化対象選択用） ===== */}
        <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
          {run.party.map((member, memberIndex) => (
            <EnhancementCharacterPanel
              key={member.id}
              member={member}
              memberIndex={memberIndex}
              enhState={enhState}
              isMaxed={isMaxed}
              insufficientGold={insufficientGold}
              relics={run.relics}
              dispatch={dispatch}
            />
          ))}
        </div>

        {/* ===== フッター ===== */}
        <div className="bg-gray-900 border border-gray-600 p-2 rounded-lg">
          <div className="flex gap-2 justify-center">
            {mapState && (
              <Button variant="secondary" onClick={() => setShowMap(true)}>マップ</Button>
            )}
            <Button
              variant="primary"
              onClick={closeStore}
              disabled={enhState.phase === 'chooseOption'}
              className="flex-1 max-w-md"
            >
              ショップを出る
            </Button>
          </div>
        </div>

      </div>

      {showMap && mapState && (
        <MapOverlay nodes={mapState.nodes} currentStage={mapState.currentStage} onClose={() => setShowMap(false)} />
      )}
    </div>
  )
}

function EnhancementCharacterPanel({
  member, memberIndex, enhState, isMaxed, insufficientGold, relics, dispatch,
}: {
  member: ExplorerState
  memberIndex: number
  enhState: NonNullable<StoreState['enhancementState']>
  isMaxed: boolean
  insufficientGold: boolean
  relics: RelicInstance[]
  dispatch: React.Dispatch<GameAction>
}) {
  const dmgOpts = { relics }

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg border border-gray-500 p-1.5">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-2xl leading-none shrink-0">{CLASS_ICONS[member.characterClass]}</span>
          <span className="text-white font-bold text-2xl truncate">{member.name}</span>
        </div>
        <span className="text-yellow-400 text-xl font-bold shrink-0">Lv.{member.level}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {/* 武器 */}
        {member.weapons.map((w, wIdx) => {
          const isEnhanceable = canEnhanceWeapon(w)
          const remaining = isEnhanceable ? getRemainingEnhancements((w as WeaponInstance).enhancements) : 0
          const canClick = isEnhanceable
            && !isMaxed
            && !insufficientGold
            && remaining > 0
            && enhState.phase === 'selectItem'
          const isSelected = enhState.selectedTarget?.memberIndex === memberIndex
            && enhState.selectedTarget?.itemType === 'weapon'
            && enhState.selectedTarget?.itemIndex === wIdx

          const enhSummary = isEnhanceable
            ? getWeaponEnhancementSummary((w as WeaponInstance).enhancements)
            : []

          const range = predictWeaponDamage(member, w, dmgOpts)
          const dmg = formatDamageRange(range)

          const card = (
            <div
              className={`border rounded p-1.5 text-base transition-colors ${
                !isEnhanceable
                  ? 'border-gray-600/50 bg-gray-800/30 opacity-40'
                  : isSelected
                    ? 'border-yellow-400 bg-yellow-900/20'
                    : canClick
                      ? 'border-orange-500/50 bg-orange-900/10 hover:border-yellow-400 cursor-pointer'
                      : 'border-orange-500/50 bg-orange-900/10 opacity-40'
              }`}
              onClick={() => {
                if (canClick) {
                  dispatch({
                    type: 'SELECT_ENHANCEMENT_TARGET',
                    target: { memberIndex, itemType: 'weapon', itemIndex: wIdx },
                  })
                }
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-white flex-1 truncate font-bold">{w.name}</span>
                {w.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                <span className="text-gray-400 text-sm flex-shrink-0">{dmg}</span>
              </div>
              {isEnhanceable && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] ${remaining > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    残り強化回数 {remaining}
                  </span>
                  {insufficientGold && remaining > 0 && (
                    <span className="text-red-400 text-[10px]">G不足</span>
                  )}
                </div>
              )}
              {enhSummary.length > 0 && (
                <div className="flex flex-wrap gap-x-1 mt-0.5">
                  {enhSummary.map((s, si) => (
                    <span key={si} className={`text-[9px] ${s.isMerit ? 'text-green-400' : 'text-red-400'}`}>
                      {s.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )

          if (!isEnhanceable) return <div key={`w-${wIdx}`}>{card}</div>

          return (
            <Tooltip key={`w-${wIdx}`} content={<TooltipCard item={w} damageText={dmg} />} position="bottom">
              {card}
            </Tooltip>
          )
        })}

        {/* 魔法 */}
        {member.spells.map((s, sIdx) => {
          const isEnhanceable = canEnhanceSpell(s)
          const remaining = isEnhanceable ? getRemainingEnhancements(s.enhancements) : 0
          const canClick = isEnhanceable
            && !isMaxed
            && !insufficientGold
            && remaining > 0
            && enhState.phase === 'selectItem'
          const isSelected = enhState.selectedTarget?.memberIndex === memberIndex
            && enhState.selectedTarget?.itemType === 'spell'
            && enhState.selectedTarget?.itemIndex === sIdx

          const enhSummary = isEnhanceable
            ? getSpellEnhancementSummary(s.enhancements)
            : []

          const range = predictSpellDamage(member, s, dmgOpts)
          const dmg = s.power > 0 ? formatDamageRange(range) : null

          const card = (
            <div
              className={`border rounded p-1.5 text-base transition-colors ${
                !isEnhanceable
                  ? 'border-gray-600/50 bg-gray-800/30 opacity-40'
                  : isSelected
                    ? 'border-yellow-400 bg-yellow-900/20'
                    : canClick
                      ? 'border-purple-500/50 bg-purple-900/10 hover:border-yellow-400 cursor-pointer'
                      : 'border-purple-500/50 bg-purple-900/10 opacity-40'
              }`}
              onClick={() => {
                if (canClick) {
                  dispatch({
                    type: 'SELECT_ENHANCEMENT_TARGET',
                    target: { memberIndex, itemType: 'spell', itemIndex: sIdx },
                  })
                }
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-white flex-1 truncate font-bold">{s.name}</span>
                {s.targetType === 'enemyAll' && <span className="text-[10px] bg-red-700 text-white px-1 rounded flex-shrink-0">全体</span>}
                <span className="text-gray-400 text-sm">{s.mpCost}MP</span>
                {dmg && <span className="text-gray-400 text-sm">{dmg}</span>}
              </div>
              {isEnhanceable && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] ${remaining > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    残り強化回数 {remaining}
                  </span>
                  {insufficientGold && remaining > 0 && (
                    <span className="text-red-400 text-[10px]">G不足</span>
                  )}
                </div>
              )}
              {enhSummary.length > 0 && (
                <div className="flex flex-wrap gap-x-1 mt-0.5">
                  {enhSummary.map((es, si) => (
                    <span key={si} className={`text-[9px] ${es.isMerit ? 'text-green-400' : 'text-red-400'}`}>
                      {es.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )

          if (!isEnhanceable) return <div key={`s-${sIdx}`}>{card}</div>

          return (
            <Tooltip key={`s-${sIdx}`} content={<TooltipCard item={s} damageText={dmg ?? undefined} />} position="bottom">
              {card}
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
