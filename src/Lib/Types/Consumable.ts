/** 使用回数制限 */
export interface IUseLimited {
  maxUses: number | null  // nullは無制限
}

/** MP消費あり（魔法） */
export interface IMpCost {
  mpCost: number
}

/** ゴールド消費あり（黄金の斧など） */
export interface IGoldCost {
  goldCost: number
}

/** HP消費あり（呪われた槍など） */
export interface IHpCost {
  hpCost: number
}

/** 使い切り（ポーション） */
export interface ISingleUse {}
