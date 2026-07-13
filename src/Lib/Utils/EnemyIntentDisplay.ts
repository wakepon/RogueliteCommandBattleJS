import { EnemyActionResult } from '../Core/EnemyAI'

/** インテントのマウスオーバーで表示する用語説明 */
export interface IntentTooltipTerm {
  term: string
  desc: string
}

/** 敵行動インテントの表示情報 */
export interface IntentDisplay {
  /** actionName の後ろに()で表示する詳細文字列。空文字なら括弧なし */
  detail: string
  /** マウスオーバーで表示する用語説明(重複なし) */
  tooltips: IntentTooltipTerm[]
}

const WEAKNESS_TIP: IntentTooltipTerm = {
  term: '攻撃ダウン',
  desc: '次のターン、与えるダメージが0.5倍に低下',
}
const VULNERABILITY_TIP: IntentTooltipTerm = {
  term: '被ダメアップ',
  desc: '次のターン、被ダメージが1.5倍に増加',
}
const WEAPON_SEAL_TIP: IntentTooltipTerm = {
  term: '武器消耗',
  desc: '対象の所持武器どれか1つの耐久値を-1する',
}
const GUARD_TIP: IntentTooltipTerm = {
  term: '庇う',
  desc: '他の敵への攻撃を全て肩代わりする',
}
const SHIELD_TIP: IntentTooltipTerm = {
  term: '盾',
  desc: '次に受けるダメージを1回だけ0.5倍にする',
}

/**
 * 敵行動インテントの詳細表示(括弧内テキスト)とツールチップ用語を生成する。
 * @param action 予告された敵行動(スケール済みダメージを含む storedAction)
 * @param maxHp 行動する敵の最大HP(自己回復量の%換算に使用)
 */
export function buildIntentDisplay(action: EnemyActionResult, maxHp: number): IntentDisplay {
  const parts: string[] = []
  const tooltips: IntentTooltipTerm[] = []

  // --- ダメージ表記(全体化・連続攻撃に対応し、攻撃に付随するデバフを内包) ---
  if (action.damage > 0) {
    let dmg = action.isAoe ? `全体${action.damage}` : `${action.damage}`
    if (action.hits && action.hits > 1) {
      dmg += ` x ${action.hits}`
    }
    if (action.applyWeakness) {
      dmg += `(攻撃ダウン${action.applyWeakness.duration}ターン)`
      tooltips.push(WEAKNESS_TIP)
    }
    if (action.applyVulnerability) {
      dmg += `(被ダメアップ${action.applyVulnerability.duration}ターン)`
      tooltips.push(VULNERABILITY_TIP)
    }
    if (action.applyShieldToSelf) {
      dmg += `(盾+${action.applyShieldToSelf})`
      tooltips.push(SHIELD_TIP)
    }
    if (action.applyShieldToAlly) {
      dmg += `(味方に盾+${action.applyShieldToAlly})`
      tooltips.push(SHIELD_TIP)
    }
    parts.push(dmg)
  } else {
    // --- 非ダメージ行動のデバフ ---
    if (action.applyWeakness) {
      parts.push(`攻撃ダウン${action.applyWeakness.duration}ターン`)
      tooltips.push(WEAKNESS_TIP)
    }
    if (action.applyVulnerability) {
      parts.push(`被ダメアップ${action.applyVulnerability.duration}ターン`)
      tooltips.push(VULNERABILITY_TIP)
    }
    if (action.applyShieldToSelf) {
      parts.push(`盾+${action.applyShieldToSelf}`)
      tooltips.push(SHIELD_TIP)
    }
    if (action.applyShieldToAlly) {
      parts.push(`味方に盾+${action.applyShieldToAlly}`)
      tooltips.push(SHIELD_TIP)
    }
  }

  // --- MP減少 ---
  if (action.mpDrain > 0) {
    parts.push(`MP-${action.mpDrain}`)
  }
  if (action.mpDrainAll && action.mpDrainAll > 0) {
    parts.push(`全体MP-${action.mpDrainAll}`)
  }

  // --- 武器耐久減少 ---
  if (action.weaponSeal) {
    parts.push('武器耐久値-1')
    tooltips.push(WEAPON_SEAL_TIP)
  }
  if (action.weaponSealAll) {
    parts.push('全員の武器耐久値-1')
    tooltips.push(WEAPON_SEAL_TIP)
  }

  // --- バフ(自身への力溜めは行動名で自明なため付記しない) ---
  if (action.chargeAllAllies) {
    parts.push('味方全体に力溜め')
  }

  // --- 回復 ---
  if (action.healSelf && action.healSelf > 0 && maxHp > 0) {
    const pct = Math.round((action.healSelf / maxHp) * 100)
    parts.push(`HP${pct}%回復`)
  }
  if (action.healAlly) {
    if (action.healAlly.percentOfMaxHp) {
      parts.push(`味方HP${Math.round(action.healAlly.percentOfMaxHp * 100)}%回復`)
    } else if (action.healAlly.amount) {
      parts.push(`味方HP+${action.healAlly.amount}`)
    }
  }

  // --- 庇う(表示は行動名のまま、説明のみツールチップで補足) ---
  if (action.applyGuard) {
    tooltips.push(GUARD_TIP)
  }

  // ツールチップの重複を除去
  const uniqueTooltips = tooltips.filter(
    (t, i) => tooltips.findIndex(o => o.term === t.term) === i
  )

  return { detail: parts.join('、'), tooltips: uniqueTooltips }
}
