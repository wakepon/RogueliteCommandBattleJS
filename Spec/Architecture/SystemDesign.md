# システム設計書

## 概要

本ドキュメントはMVP実装のためのアーキテクチャ設計をまとめたものです。

## 設計方針

| 項目 | 決定 | 理由 |
|------|------|------|
| データ管理 | JSONファイル（`src/Lib/Data/`に配置） | 型チェック可能、ビルド時バンドル |
| セーブ/ロード | localStorage、戦闘終了後のみ | シンプル、中断再開は戦闘後から |
| 画面遷移 | state切り替え | React Router不要、シンプル |
| 状態管理 | useReducer + Context | MVPの規模に十分、外部依存なし |
| バランス調整 | Tuning Editor（DEV専用） | BroadcastChannelでリアルタイム反映 |

## フォルダ構造

```
src/
├── Lib/                    # Pure なゲームロジック（React非依存）
│   ├── Types/              # 型定義
│   │   ├── Item.ts         # IItem, Rarity
│   │   ├── Purchasable.ts  # IPurchasable
│   │   ├── Command.ts      # ICommandable, ITargetable, TargetType
│   │   ├── Consumable.ts   # IUseLimited, IMpCost, IHpCost, ISingleUse
│   │   ├── Passive.ts      # IPassiveEffect, PassiveEffectType
│   │   ├── Weapon.ts       # WeaponData, WeaponInstance, PunchInstance, ExplorerWeapon
│   │   ├── Spell.ts        # SpellData, SpellInstance, SpellEffect
│   │   ├── Relic.ts        # RelicData, RelicInstance
│   │   ├── Potion.ts       # PotionData, PotionInstance, PotionEffect
│   │   ├── Explorer.ts     # ExplorerState, Buff, Debuff
│   │   ├── Enemy.ts        # EnemyData, EnemyInstance
│   │   ├── Battle.ts       # BattleState
│   │   ├── Run.ts          # RunState, RunStats
│   │   ├── Game.ts         # GameState, RecoveryState, StoreState
│   │   ├── Enhancement.ts  # WeaponEnhancement, SpellEnhancement
│   │   ├── GrowthType.ts   # GrowthTypeName, GrowthStats, GrowthTypeOption, GrowthChoice
│   │   └── index.ts        # 再エクスポート
│   ├── Core/               # コアロジック
│   │   ├── DamageCalculator.ts   # ダメージ計算式
│   │   ├── CommandValidator.ts   # コマンド使用可能判定
│   │   ├── BattleEngine.ts       # 戦闘進行ロジック
│   │   ├── StoreLogic.ts         # ストアの売買・抽選判定
│   │   ├── StageManager.ts       # ステージ管理
│   │   ├── LevelUpCalculator.ts  # レベルアップ計算
│   │   ├── EnemyAI.ts            # 敵行動決定
│   │   ├── BuffProcessor.ts      # バフ処理
│   │   ├── EventLogic.ts         # イベント画面ロジック
│   │   ├── MapGenerator.ts       # マップ生成
│   │   ├── RelicProcessor.ts     # レリック効果処理
│   │   ├── TargetingSystem.ts    # 前衛/後衛ターゲット率計算
│   │   ├── PositionUtils.ts      # getFrontMemberId / isFrontMember（前衛判定ユーティリティ）
│   │   ├── BattleResultDiff.ts   # 戦闘結果差分計算
│   │   ├── RecoveryLogic.ts      # 回復メニューロジック
│   │   ├── GrowthTypeCalculator.ts  # 成長方向選択ロジック
│   │   └── index.ts
│   ├── State/              # 状態遷移
│   │   ├── GameReducer.ts        # ゲーム全体の状態遷移
│   │   ├── BattleReducer.ts      # 戦闘中の状態遷移
│   │   ├── BattleActionProcessor.ts  # 戦闘アクション処理
│   │   ├── BattleStateFactory.ts     # 戦闘状態生成
│   │   ├── EnemyEffectProcessor.ts   # 敵エフェクト処理（防御バフ軽減、力溜め付与/消費、全体力溜め、自己防御バフ、自己回復、味方回復、召喚。applySummonEnemy は battleState.enemyHpMultiplier を参照してHP倍率適用。applyHealAlly の引数は { amount?: number; percentOfMaxHp?: number } オブジェクト型）
│   │   └── index.ts
│   ├── Utils/              # ユーティリティ
│   │   ├── ItemDescription.ts    # アイテム説明文生成
│   │   └── DamagePredictor.ts    # ダメージ予測計算
│   ├── Data/               # JSONマスターデータ
│   │   ├── Weapons.json
│   │   ├── Spells.json
│   │   ├── Relics.json
│   │   ├── Potions.json
│   │   ├── Enemies.json
│   │   ├── StagePatterns.json
│   │   └── TuningData.json       # Tuning Editorが書き出すパラメータ調整値
│   ├── Tuning/             # バランス調整システム（DEV専用）
│   │   ├── TuningConfig.ts       # TuningConfig型定義（7カテゴリ）
│   │   ├── TuningSchema.ts       # デフォルト値・バリデーション
│   │   ├── TuningStore.ts        # 現在のTuningConfigを保持・参照
│   │   ├── TuningReceiver.ts     # BroadcastChannel受信・TuningStore更新
│   │   ├── TuningSerializer.ts   # TuningConfig ↔ JSON変換
│   │   └── index.ts
│   └── Storage/            # 永続化
│       ├── SaveManager.ts        # localStorage操作
│       └── index.ts
├── Hooks/                  # React Hooks（ロジックとUIの橋渡し）
│   ├── UseGame.tsx         # ゲーム全体の状態管理。initTuningReceiver を呼び出し
│   └── UseBattle.tsx       # 戦闘画面用
├── Components/             # UIコンポーネント
│   ├── Screens/            # 画面単位
│   │   ├── TitleScreen.tsx
│   │   ├── StoreScreen.tsx
│   │   ├── EventScreen.tsx     # Stage 4の選択
│   │   ├── ResultScreen.tsx
│   │   ├── RecoveryScreen.tsx  # 回復メニュー画面
│   │   └── MapScreen.tsx       # マップ画面
│   ├── Battle/             # 戦闘UI部品
│   │   ├── BattleScreen.tsx
│   │   ├── LevelUpModal.tsx
│   │   └── ExpGauge.tsx
│   ├── Store/              # ストアUI部品
│   │   ├── MapOverlay.tsx
│   │   ├── StoreCommandPanel.tsx
│   │   └── StoreShopPanel.tsx
│   └── Common/             # 共通UI部品
│       └── MapContent.tsx
└── App.tsx                 # エントリーポイント、画面切り替え

editor/                     # Tuning Editor（プロジェクトルート、React非依存）
├── index.html
├── style.css
├── main.ts
└── EditorUI.ts

vite-plugins/               # Viteカスタムプラグイン
└── tuning-save-plugin.ts   # Tuning Editorの保存リクエストをTuningData.jsonに書き出す
```

## インターフェース設計

### 基本・コマンド・消耗系インターフェース

```typescript
// Item.ts
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Unique'
export interface IItem { id: string; name: string; rarity: Rarity }

// Purchasable.ts  （IPurchasableを持つ→売却可能、持たない→売却不可）
export interface IPurchasable { price: number }

// Command.ts
export type CommandCategory = 'weapon' | 'spell' | 'potion'
export interface ICommandable { commandCategory: CommandCategory }
export type TargetType = 'enemySingle' | 'allySingle' | 'enemyAll' | 'allyAll' | 'enemyRandom'
export interface ITargetable { targetType: TargetType; minTargetCount?: number; maxTargetCount?: number }

// Consumable.ts
export interface IUseLimited { maxUses: number | null }  // null=無限使用
export interface IMpCost { mpCost: number }
export interface IHpCost { hpCost: number }
export interface ISingleUse {}
```

### パッシブ系インターフェース

```typescript
// ===== Lib/Types/Passive.ts =====
/** パッシブ効果の種類 */
export type PassiveEffectType =
  // デメリット変換
  | { type: 'hpCostPowerBoost'; powerBonus: number; duration: number }       // 修羅の血脈: HP消費武器使用時Power+N
  | { type: 'vulnerabilityPowerBoost'; powerBonus: number }                  // 逆境の鎧: 被ダメ増加中Power+N
  | { type: 'mpSpendShield'; mpThreshold: number; shieldValue: number }      // 魔力の残滓: MP累計消費≥threshold時シールド付与
  // 条件付きバフ
  | { type: 'knifeUseDurabilityRestore'; usesRequired: number; restoreAmount: number }  // 研ぎ師の名刺
  | { type: 'killMpRecover'; value: number }                                 // 討伐の対価: トドメ時MP回復
  | { type: 'frontRowIntBonus'; value: number }                              // 前衛の矜持: 前衛時INT+N
  | { type: 'backRowStrBonus'; value: number }                               // 後衛の叡智: 後衛時STR+N
  | { type: 'shieldTaunt'; value: number }                                   // 挑発式防御: シールド付与時被ターゲット率+N
  | { type: 'comboAttackBonus'; requiredCount: number; powerBonus: number }  // 連携の紋章
  | { type: 'levelUpStatBoost'; strBonus: number; intBonus: number }         // 闘気の腕輪: レベルアップ時STR/INT追加上昇
  | { type: 'brokenWeaponStatBonus'; strPerWeapon: number }                  // 努力の証: 壊れた武器1本につきSTR+N
  // リソース変換
  | { type: 'damageTakenToMp'; value: number }                              // 苦痛のリング: 被弾時固定MP回復
  | { type: 'battleStartHpReduction'; rate: number; strBonus: number }      // 血の契約: 戦闘開始時HP削減+STR
  | { type: 'deathProtection' }                                             // 身代わりの人形: 致死ダメージでHP1耐え（1ラン1回消滅）
  // シンプルバフ
  | { type: 'regenPerTurn'; value: number }                                 // 再生のコケ: 毎ターンHP回復
  | { type: 'weaponDurabilitySave'; chance: number }                        // 武器お手入れ用油: 耐久消費をchance%で回避
  | { type: 'battleEndBonusExp'; expValue: number }                         // 修羅の証: 戦闘後全員+EXP
  | { type: 'thornsDurationBonus'; value: number }                          // 棘の書: 反撃持続+Nターン
  | { type: 'potionEffectMultiplier'; multiplier: number }                  // 錬金術の触媒: ポーション効果倍化
  | { type: 'potionSlotBonus'; value: number }                              // 薬師の鞄: ポーション所持上限+N

/** パッシブ効果を持つ */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
```

### Enhancement型定義

```typescript
// ===== Lib/Types/Enhancement.ts =====
// 武器強化
export type WeaponMeritType = 'powerUp' | 'lifesteal' | 'maxUsesUp' | 'mpRecovery'
export type WeaponDemeritType = 'hpCost' | 'attackDown' | 'maxUsesUpNoRepair' | 'goldCost' | 'mpCost'
export interface WeaponEnhancement { merit: WeaponMerit; demerit: WeaponDemerit }

// 魔法強化
export type SpellMeritType = 'powerUp' | 'goldOnUse' | 'healOnUse' | 'killBonusExp' | 'becomeAoe'
export type SpellDemeritType = 'hpCostMpUp' | 'attackDownMpUp' | 'goldCostMpUp' | 'mpUp'
export interface SpellEnhancement { merit: SpellMerit; demerit: SpellDemerit }
```

merit/demerit のペアで構成される強化システム。1アイテムあたり最大3つまで付与可能。

### GrowthType型定義

```typescript
// ===== Lib/Types/GrowthType.ts =====
export type GrowthTypeName = 'attack' | 'hp' | 'mp' | 'balance' | 'allBonus'
export interface GrowthStats { str: number; int: number; maxHp: number; maxMp: number }
export interface GrowthTypeOption { type: GrowthTypeName; label: string; stats: GrowthStats; weight: number }
export interface GrowthChoice { options: [GrowthTypeOption, GrowthTypeOption]; explorerId: string; explorerName: string; characterClass: CharacterClass }
```

レベルアップ時に2択の成長方向を選択するシステム。`BattleState.pendingGrowthChoices` にキューイングされる。

### アイテム型定義

```typescript
// ===== Lib/Types/Weapon.ts =====
/** 武器効果 */
export type WeaponEffect =
  | { type: 'lifesteal'; value: number }
  | { type: 'shield'; value: number }                                       // 守護の盾: 対象に被ダメ軽減シールド付与
  | { type: 'hpPercentDamage'; rate: number }                               // 生命の拳: 最大HP×rateのダメージ
  | { type: 'currentHpDamage' }                                             // 捨て身の一撃: 現在HP-1のダメージ、HPが1になる
  | { type: 'shieldBash' }                                                  // 盾殴り: 攻撃者のシールド値をダメージに加算
  | { type: 'selfVulnerability'; multiplier: number; duration: number }     // 後隙: 使用後被ダメ倍率デバフ
  | { type: 'killBonusExpToAll'; expAmount: number }                        // 稽古: トドメ時全員EXP付与
  | { type: 'followUp'; bonusPower: number }                                // 追撃のナイフ: 味方が同ターン攻撃済みなら+bonusPower
  | { type: 'levelScale'; basePower: number }                               // 成長のナイフ: Power = basePower + level
  | { type: 'combatStrGain'; value: number }                                // 鍛錬のナイフ: 使用後STR+value（戦闘中永続）
  | { type: 'targetHpConditional'; hpThreshold: number; bonusPower: number } // 処刑の大剣: 対象HP≤threshold%で+bonusPower
  | { type: 'selfHpConditional'; hpThreshold: number; bonusPower: number }  // 怒りの大剣: 自身HP≤threshold%で+bonusPower
  | { type: 'lifestealPercent'; rate: number }                              // 吸血の杖: ダメージのrate%をHP回復
  | { type: 'manaSteal'; rate: number }                                     // 吸魔の杖: ダメージのrate%をMP回復
  | { type: 'thornsShield'; shieldValue: number; thornsDuration: number }   // 棘の盾: シールド+反撃1T
  | { type: 'aoe' }                                                         // 旋風剣: 全体攻撃

/** 武器データ（マスターデータ、購入可能） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  category?: 'knife' | 'greatsword' | 'staff' | 'shield' | 'other'  // 武器カテゴリ
  power: number
  variance: number    // ダメージブレ幅（±variance の加算ブレ）
  scaleStat?: 'str' | 'int'  // ダメージ計算に使うステータス
  hpCost?: number     // HP消費
  hits?: number       // 複数ヒット数
  effect?: WeaponEffect
}

/** 武器インスタンス（ゲーム中の状態、購入可能な武器） */
export interface WeaponInstance extends WeaponData {
  currentUses: number | null  // nullは無制限使用
  enhancements: WeaponEnhancement[]
  noRepair?: boolean  // 強化デメリット: 耐久値回復不可
}

/** パンチ（購入不可、無限使用の特殊武器） */
export interface PunchInstance {
  id: 'punch'
  name: 'パンチ'
  commandCategory: 'weapon'
  targetType: 'enemySingle'
  maxUses: null      // 無限
  currentUses: null  // 無限
  power: number      // Tuning対応
  variance: number   // Tuning対応
}

// createPunch() 関数で生成（TuningStoreからpower/varianceを参照）。IPurchasableを持たないため売却不可

/** 探索者が持てる武器（購入した武器 + パンチ） */
export type ExplorerWeapon = WeaponInstance | PunchInstance
```

```typescript
// ===== Lib/Types/Spell.ts =====
/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }                                                               // HP回復
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' } // バフ
  | { type: 'shield'; value: number }                                                             // シールド付与（被ダメージ軽減）
  | { type: 'repairWeapons'; value: number }                                                      // 戦場の鍛冶: 武器耐久回復
  | { type: 'weaponPowerBuff'; value: number }                                                    // 武器強化: 次の武器攻撃Power+N
  | { type: 'killBonusExpToAll'; expAmount: number }                                              // お手本ファイア: トドメで全員にボーナスEXP
  | { type: 'targetRateUp'; value: number }                                                       // 祈り: 被ターゲット率UP
  | { type: 'mpPercentShield'; rate: number }                                                     // 魔力の盾: 最大MP×rateのシールド付与
  | { type: 'mpAllDamage' }                                                                       // 魔力放出: 現在MP全消費→MPぶんのダメージ
  | { type: 'thorns'; value: number }                                                             // 棘付与: 味方に棘バフ付与
  | { type: 'followUp'; bonusPower: number }                                                      // 追撃の炎: 味方が同ターン攻撃済みなら+bonusPower
  | { type: 'targetHpConditional'; hpThreshold: number; bonusPower: number }                     // 処刑の雷: 対象HP≤threshold%で+bonusPower
  | { type: 'lowMpConditional'; mpThreshold: number; bonusPower: number }                        // 渇きの火: MP≤threshold%で+bonusPower

/** 魔法データ */
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost {
  commandCategory: 'spell'
  targetType: TargetType
  power: number
  variance: number    // ダメージブレ幅（±variance の加算ブレ）
  effect?: SpellEffect | null
  mpCostRate?: number  // 最大MP割合コスト（例: 1.0 = 全消費）
  hpCost?: number      // HP消費（反動魔法用）
  slotFree?: boolean   // trueなら魔法枠を消費しない（魔力弾・祈り等）
}

/** 魔法インスタンス */
export interface SpellInstance extends SpellData {
  enhancements: SpellEnhancement[]
}
```

```typescript
// Relic.ts
export interface RelicData extends IItem, IPurchasable, IPassiveEffect {}
export type RelicInstance = RelicData

// Potion.ts
export type PotionEffect =
  | { type: 'healHp'; value: number }
  | { type: 'healMp'; value: number }
  | { type: 'repairWeapons'; value: number }   // 修復ポーション：装備武器の耐久回復
  | { type: 'taunt' }                          // 挑発: 被弾率100%（1ターン）
  | { type: 'statBoost'; strValue: number; intValue: number }  // 興奮: STR+N, INT+N（1ターン）
  | { type: 'damageReduction'; rate: number }  // 防御: 被ダメ×rate軽減（1ターン）
  | { type: 'aoeConvert' }                     // 全体化: 次の1回の単体攻撃を全体化
export interface PotionData extends IItem, IPurchasable, ICommandable, ITargetable, ISingleUse {
  commandCategory: 'potion'; targetType: 'allySingle'; effect: PotionEffect
}
export type PotionInstance = PotionData

// Enemy.ts
export type EnemyType = 'normal' | 'elite' | 'boss'
export interface EnemyData { id: string; name: string; type: EnemyType; hp: number; attack: number; agi: number; goldReward: number; behavior: string }
export interface EnemyInstance extends EnemyData {
  instanceId: string; currentHp: number; battleBuffs: Buff[]; battleDebuffs: Debuff[]; hasSummoned?: boolean; justSummoned?: boolean
}
```

### インターフェース継承図

| 型 | 継承インターフェース |
|---|------------------|
| WeaponData | IItem, IPurchasable, ICommandable('weapon'), ITargetable, IUseLimited |
| SpellData | IItem, IPurchasable, ICommandable('spell'), ITargetable, IMpCost |
| RelicData | IItem, IPurchasable, IPassiveEffect |
| PotionData | IItem, IPurchasable, ICommandable('potion'), ITargetable('allySingle'), ISingleUse |
| PunchInstance | ICommandable('weapon'), ITargetable ※IPurchasableなし→破棄不可 |

### 破棄システム

ゴールドシステムは削除済み。アイテムは「売却」ではなく「破棄（DISCARD）」する。`createStoreState(stage: number)` はステージ番号を引数にとり、第二階層では `rareRate` を上昇させる。`pickWithRarity(items, rareRate)` はRare率を考慮したアイテム抽選を行う。

### コマンド使用可能判定

`isCommandAvailable` はインターフェースではなくロジック層（`Lib/Core/CommandValidator.ts`）で実装する。

| コマンドカテゴリ | 判定条件 |
|----------------|---------|
| weapon | currentUses が null でなければ残り回数 > 0 |
| spell | 所持MP >= mpCost |
| potion | 常に使用可能 |

## 状態管理

### GameState（ゲーム全体の状態）

```typescript
// ===== Lib/Types/Game.ts =====

/** マップノードタイプ */
export type MapNodeType = 'battle' | 'event' | 'boss'

/** マップノード */
export interface MapNode {
  stage: number
  nodeType: MapNodeType
  enemies: EnemyPreview[]
}

/** マップ状態 */
export interface MapState {
  nodes: MapNode[]
  currentStage: number
}

/** 敵プレビュー（マップ上での敵情報表示用） */
export interface EnemyPreview {
  enemyId: string
  type: EnemyType
}

/** イベントサブフェーズ */
export type EventSubPhase = 'selecting' | 'repairSelection' | 'treasureReveal' | 'treasureReplace'

/** イベント状態 */
export interface EventState {
  subPhase: EventSubPhase
  revealedRelic: RelicData | null
  selectedWeaponIds: string[]
}

interface GameState {
  phase: 'title' | 'battle' | 'store' | 'event' | 'result' | 'recovery' | 'map'
  run: RunState | null        // タイトル画面ではnull
  battleState: BattleState | null
  storeState: StoreState | null
  resultState: ResultState | null
  recoveryState: RecoveryState | null
  eventState: EventState | null
  mapState: MapState | null
}

/** 回復メニューのID */
export type RecoveryMenuId = 'healHp' | 'healMp' | 'repairWeapons' | 'convertHpToMp' | 'convertMpToHp'

/** 回復メニュー状態 */
export interface RecoveryState {
  useCounts: Record<RecoveryMenuId, number>
}

/** 武器使用回数差分（リザルト画面表示用） */
export interface WeaponUsesDiff {
  weaponId: string
  weaponName: string
  currentUses: number | null
  maxUses: number | null
  usesBefore: number | null    // 戦闘開始時のcurrentUses
  usesDiff: number
  broken: boolean
}

/** メンバー戦闘前後差分（リザルト画面の逐次アニメ用） */
export interface MemberBattleDiff {
  explorerId: string
  name: string
  characterClass: CharacterClass
  // 現在値
  hp: number; maxHp: number; mp: number; maxMp: number
  level: number; exp: number; expRequired: number
  weapons: WeaponUsesDiff[]
  // 差分値
  hpDiff: number; maxHpDiff: number; mpDiff: number; maxMpDiff: number; levelDiff: number
  // 戦闘前値
  hpBefore: number; maxHpBefore: number; mpBefore: number; maxMpBefore: number
  levelBefore: number; expBefore: number; expRequiredBefore: number
}

/** メンバーカードのアニメーションフェーズ */
export type MemberAnimationPhase =
  'pending' | 'enter' | 'resourcesAnimate' | 'shaking' | 'levelUpdated' | 'maxStatsRevealed' | 'done'

/** リザルト状態 */
export interface ResultState {
  result: 'victory' | 'defeat'
  killCount: number
  goldEarned: number
  memberDiffs: MemberBattleDiff[]
}
```

### RunState（1回のゲームプレイの状態）

```typescript
// ===== Lib/Types/Run.ts =====
export const SAVE_VERSION = 6

interface RunState {
  saveVersion: number       // SAVE_VERSION = 6
  seed: number; startedAt: number
  currentStage: number      // 現在のステージ (1-11)
  gold: number; relics: RelicInstance[]; potions: PotionInstance[]
  party: ExplorerState[]    // 3人: warrior, mage, cleric
  battleLevelUps: LevelUpInfo[]
  brokenWeaponCount: number        // 努力の証: 壊れた武器の累計本数
  battleStartSnapshot: BattleStartSnapshot | null  // 戦闘中のみ有効。END_BATTLE で null
  stats: RunStats
}

/** 戦闘前スナップショット（リザルト画面の差分表示に使用） */
interface BattleStartSnapshot { party: ExplorerState[] }
interface RunStats { totalKillCount: number; maxStageReached: number }
```

### ExplorerState（探索者の状態）

各キャラクターの個人状態。将来的にパーティー対応する場合、各キャラクターがこの状態を持つ。

```typescript
// ===== Lib/Types/Explorer.ts =====

/** キャラクタークラス */
export type CharacterClass = 'warrior' | 'mage' | 'cleric'

// Position 型は削除済み。前衛/後衛は getFrontMemberId(party) で派生計算する（PositionUtils.ts）

/** バフ */
interface Buff {
  type: string
  value: number
  duration: number | 'battle' | 'nextAction'  // ターン数 or 戦闘終了まで or 次の行動まで
}

/** デバフ（union型） */
type Debuff =
  | { type: 'poison'; stacks: number }
  | { type: 'weakness'; value: number; duration: number; justApplied?: boolean }
  | { type: 'vulnerability'; multiplier: number; duration: number; justApplied?: boolean }

/** 探索者の状態 */
interface ExplorerState {
  id: string; name: string; characterClass: CharacterClass
  // position フィールドは削除済み。前衛/後衛は party 配列順から getFrontMemberId(party) で動的決定する
  hp: number; maxHp: number; mp: number; maxMp: number; str: number; int: number
  weaponSlotCount: number; magicSlotCount: number
  level: number; exp: number; killCount: number
  weapons: ExplorerWeapon[]   // weaponSlotCount枠 + パンチ（パンチは常に最後）
  spells: SpellInstance[]     // magicSlotCount枠
  battleBuffs: Buff[]; battleDebuffs: Debuff[]
}

/**
 * createInitialParty() で3人パーティーを生成する（warrior, mage, cleric の構成）。
 * - 戦士の初期武器: [createPunch(), createWeaponInstance('knife')]
 * - 戦士の magicSlotCount: 0、魔法使いの weaponSlotCount: 0
 * - 前衛/後衛は party 配列の先頭を前衛として PositionUtils.ts が提供する
 */
```

### BattleState（戦闘中のみの状態）

戦闘開始時に生成、終了時に破棄。
探索者のbuff/debuffはExplorerState側で管理する。

```typescript
// ===== Lib/Types/Battle.ts =====

/** バトルフェーズ */
export type BattlePhase = 'command' | 'partyAction' | 'enemyAction' | 'turnEnd'

/** アクターID（行動順管理用） */
export type ActorId =
  | { type: 'explorer'; id: string }      // 探索者のid
  | { type: 'enemy'; instanceId: string } // 敵のinstanceId

/** コマンドスロット（行動順を管理するスロット） */
export interface CommandSlot {
  explorerId: string
  command: BattleCommand | null
  targetId: string | null
  weaponIndex?: number    // 同一IDの武器を区別するためのインデックス
}

/** ダメージ寄与者 */
export interface DamageContributor {
  name: string
  label: string
}

/** レベルアップポップアップ */
export interface LevelUpPopup {
  id: string
  levelUpInfo: LevelUpInfo
  timestamp: number
}

/** プレイヤーダメージポップアップ */
export interface PlayerDamagePopup {
  id: string
  damage: number
  targetExplorerId?: string   // オプショナル
  label?: string              // 武器名表示用
  shielded?: boolean          // シールド軽減時の表示フラグ
  timestamp: number
}

/** 経験値獲得ポップアップ（戦闘中アニメ用） */
export interface ExpPopup {
  enemyInstanceId: string
  targetExplorerId: string
  amount: number
  bonusLabel?: string
  delayMs: number
  timestamp: number
}

/** 敵行動予告 */
export interface EnemyIntent {
  enemyInstanceId: string
  actionName: string
  damage: number
  storedAction: EnemyActionResult   // インテント生成時に行動結果を格納し実行時に再利用
}

/** 敵行動結果（拡張フィールド） */
export interface EnemyActionResult {
  damage?: number; isAoe?: boolean; isRandomTarget?: boolean
  chargeAllAllies?: boolean; summonEnemyId?: string
  healSelf?: number; healAlly?: { amount?: number; percentOfMaxHp?: number }
  applyWeakness?: { value: number; duration: number }
  applySelfDefense?: { value: number; duration: number }
  transformName?: string; weaponSeal?: boolean; weaponSealAll?: boolean
  applyShieldToSelf?: number; applyShieldToAlly?: number
  applyGuard?: boolean; mpDrainAll?: number
  applyVulnerability?: { multiplier: number; duration: number }
  unlimitedSummon?: boolean
}

interface BattleState {
  phase: BattlePhase; turn: number; turnLimit: number
  enemies: EnemyInstance[]
  commandSlots: CommandSlot[]       // 各探索者のコマンドスロット（行動順）
  activeExplorerIndex: number       // 現在コマンド入力中の探索者インデックス
  currentActorIndex: number         // 現在行動中のアクターインデックス
  currentCommandIndex: number; currentEnemyIndex: number
  actionQueue: ActorId[]            // 後方互換として残置
  enemyIntents: EnemyIntent[]
  enemyHpMultiplier: number         // 第二階層の敵HP倍率
  enemyDamageMultiplier: number     // 第二階層の敵ダメージ倍率
  selectedCommand: BattleCommand | null; selectedTargetId: string | null
  damagePopups: DamagePopup[]; playerDamagePopups: PlayerDamagePopup[]
  levelUpPopups: LevelUpPopup[]; expPopups: ExpPopup[]  // expPopups: EXP獲得アニメ用
  pendingGrowthChoices: GrowthChoice[]  // レベルアップ時の成長方向選択キュー
  isGameOver?: boolean              // 敗北時オーバーレイ表示用
  battleMessage: string | null; battleMessageId: number
  relicState: RelicBattleState
}

/** バトルコマンド（ExplorerWeapon | SpellInstance | PotionInstance の union type alias） */
export type BattleCommand = ExplorerWeapon | SpellInstance | PotionInstance
```

### StoreState（ストア画面の状態）

```typescript
export type StoreCategory = 'weapon' | 'spell' | 'relic' | 'potion'

// ShopSlot はタグ付きユニオン型で単一の item を持つ
export type ShopSlot =
  | { category: 'weapon'; item: WeaponData | null }
  | { category: 'spell'; item: SpellData | null }
  | { category: 'relic'; item: RelicData | null }
  | { category: 'potion'; item: PotionData | null }

interface StoreState {
  slots: ShopSlot[]        // 5枠（武器1/魔法1/ランダム1/レリック1/ポーション1）
  maxSelections: number    // 選択可能数（2）
  rerollCount: number      // リロール回数
  rareRate: number         // Rareアイテム出現率（第二階層で上昇）
  floor: number            // 階層（レアリティフィルタに使用）
}
```

## セーブ/ロード

**戦闘終了後のみ**保存。`SaveData = { version: number（SAVE_VERSION=6）; run: RunState; savedAt: number }`。戦闘中断時は次回起動でその戦闘の最初から。`battleStartSnapshot` は非永続化。`Lib/Storage/SaveManager.ts` が `save` / `load` / `clear` / `hasSave` を提供。

## 画面遷移

React Routerは使用せず、`phase`によるstate切り替えで実装。`App.tsx` が `GameState.phase`（'title' | 'battle' | 'store' | 'event' | 'result' | 'recovery' | 'map'）を参照して各画面コンポーネントを切り替える。

### 画面遷移フロー

```
[title]
   ↓ START_GAME（新規） → 直接 [battle] に遷移（初回マップスキップ）
   ↓ CONTINUE_GAME（ロード） → [store] に遷移
[battle] ←──────────────────────────┐
   ↓ 勝利                            │
[result]                             │
   ↓ OPEN_RECOVERY                  │
[recovery] ── 回復メニュー選択 ──────│
   ↓ CLOSE_RECOVERY                 │
[store] ─────────→ [map] ───────────┘
   ↓ ADVANCE_FROM_MAP（ステージ選択）
   ↓ Stage 4 または Stage 9 の場合
[event] ─────────→ [map] ───────────┘
   ↓ ボス撃破 or 敗北
[result]
   ↓ RETURN_TITLE
[title]
```

## JSONデータ形式

### Weapons.json

18種の武器データ（オブジェクト辞書形式）。全武器に `variance` フィールドあり。武器カテゴリ（`category`）付き。

```
knife, followup_knife, growth_knife, training_knife,
recoil_greatsword, opening_greatsword, fickle_greatsword, rage_greatsword, execution_greatsword,
training_staff, vampire_staff, mana_drain_staff,
guardian_shield, thorns_shield,
whirlwind_sword, shield_bash, life_fist, desperate_strike
```

（各武器の具体的な数値はバランス調整対象のため概要記載）

### Spells.json

22種の魔法データ（オブジェクト辞書形式）。全魔法に `variance` フィールドあり。slotFree魔法は魔法枠を消費しない。

```
magic_bullet, prayer, fire, ice, heal, barrier, volcano, recoil_flame, chaos_magic,
thirst_fire, followup_flame, execution_thunder, training_fire, greater_heal, healing_wind,
weapon_enchant, precision, thorns_grant, field_repair, flame_storm, mana_release, mana_shield
```

（各魔法の具体的な数値はバランス調整対象のため概要記載）

### Relics.json

20種のレリックデータ（オブジェクト辞書形式）。各レリックは `PassiveEffectType` に対応した `passiveEffect` を持つ。効果の詳細値はバランス調整対象のため概要記載。

### Potions.json

7種のポーションデータ。`targetType: 'allySingle'`。コマンド選択フェーズ中に `USE_POTION_INSTANT` で即時発動可能。

- healHp（HP回復）、healMp（MP回復）、repairWeapons（武器修理）
- taunt（挑発：被弾率100%・1ターン）、statBoost（興奮：STR/INT上昇・1ターン）
- damageReduction（防御：被ダメ軽減・1ターン）、aoeConvert（全体化：次の単体攻撃を全体化）

### Enemies.json

14種の敵データ（オブジェクト辞書形式）。全敵の `behavior` は `"attack"` に統一。行動の分岐は `EnemyAI.ts` で `enemy.id` ベースに実装される。`goldReward` フィールドで報酬金額を管理。

- normal（7種）: slime, goblin, sewer_rat, hedro_slime, shaman, fairy, + 1種
- elite（5種）: orc, assassin, sleep_tiger, dark_mage, orc_lord
- boss（2種）: dragon + 1種

（各敵の具体的なステータス値はバランス調整対象のため概要記載）

### StagePatterns.json

`stage_1` 〜 `stage_11` の個別形式。各ステージに `turnLimit` と `patterns` フィールドあり。`stage_4` と `stage_9` はイベントステージ（`turnLimit: 0`、`patterns: []`）。turnLimit の具体的な値はバランス調整対象。14種の敵を含む拡張パターンに全面更新済み。stage 8〜11 は第二階層。

## Reducerアクション概要

### GameReducer 主要アクション

| カテゴリ | アクション |
|---------|-----------|
| ゲーム制御 | START_GAME, CONTINUE_GAME, RETURN_TITLE, END_BATTLE |
| ストア | OPEN_STORE, CLOSE_STORE, BUY_WEAPON, BUY_SPELL, BUY_RELIC, BUY_POTION, REROLL_STORE |
| 購入取り消し | UNDO_BUY_WEAPON, UNDO_BUY_SPELL, UNDO_BUY_RELIC, UNDO_BUY_POTION |
| 破棄 | DISCARD_WEAPON, DISCARD_SPELL, DISCARD_RELIC, DISCARD_POTION |
| 破棄取り消し | UNDO_DISCARD_WEAPON, UNDO_DISCARD_SPELL, UNDO_DISCARD_RELIC, UNDO_DISCARD_POTION |
| 装備移動 | TRANSFER_WEAPON, TRANSFER_SPELL（メンバー間装備移動） |
| パーティー管理 | REORDER_PARTY（パーティー並び替え。commandSlotsも連動） |
| ポーション即時発動 | USE_POTION_INSTANT（コマンド選択フェーズ中にポーションを即時発動） |
| 成長方向選択 | SUBMIT_GROWTH_CHOICE（レベルアップ時の成長方向を選択） |
| 回復メニュー | OPEN_RECOVERY, EXECUTE_RECOVERY, CLOSE_RECOVERY |
| イベント | OPEN_EVENT, SELECT_REST, SELECT_REPAIR, SELECT_TREASURE, CONFIRM_TREASURE, CANCEL_TREASURE, REPLACE_RELIC, TOGGLE_REPAIR_WEAPON, CONFIRM_REPAIR, CLOSE_EVENT |
| マップ | ADVANCE_FROM_MAP（ステージ選択） |

### BattleReducer 主要アクション

| カテゴリ | アクション |
|---------|-----------|
| コマンド選択 | SELECT_COMMAND, CANCEL_COMMAND, SELECT_TARGET |
| コマンド設定 | SET_COMMAND_SLOT, SET_COMMAND_SLOT_DIRECT |
| 探索者切替 | CHANGE_ACTIVE_EXPLORER |
| 実行制御 | START_EXECUTION, ADVANCE_PARTY_ACTION, ADVANCE_ENEMY_ACTION, EXECUTE_COMMAND, ENEMY_ACTION |
| ターン管理 | PROCESS_TURN_END, START_NEW_TURN |
| 表示更新 | REMOVE_POPUP, REMOVE_PLAYER_POPUP, ADD_LEVEL_UP_POPUP, REMOVE_LEVEL_UP_POPUP, ADD_EXP_POPUPS, REMOVE_EXP_POPUP |
| レリック・敵 | UPDATE_RELIC_STATE, UPDATE_ENEMIES |
| 成長方向選択 | ADD_GROWTH_CHOICE, REMOVE_GROWTH_CHOICE |

### StageManager

`TOTAL_STAGES = 11`（全11ステージ）。主要関数:

- `getFloor(stage: number)`: ステージ番号から階層を判定（stage 1-7 = 第一階層, stage 8-11 = 第二階層）
- `isBossStage(stage: number)`: ボスステージかどうかを判定
- `isEventStage(stage: number)`: stage 4 と stage 9 の両方をイベントステージと判定

### BattleStateFactory / BattleActionProcessor

`BattleStateFactory` は `createBattleState` / `generateEnemyIntents` / `applyBloodPact` / `createActionQueue` / `createEnemyInstance` を提供。AGI順ソートは廃止、`commandSlots` 配列順で行動順管理。

`BattleActionProcessor` は `processExecuteCommand` / `processEnemyAction` / `processTurnEndAction` の3関数を提供。全WeaponEffect / SpellEffect / PassiveEffectType（型定義セクション参照）の処理を担当。

## バランス調整システム（Tuning Editor）

DEV専用のパラメータ調整ツール。`editor/` に配置（React非依存）。ゲーム本体とはBroadcastChannelで通信し、TuningStore経由でリアルタイムにパラメータを反映する。7カテゴリ（character / levelup / weapon / battle / economy / event / floor）の調整値を `TuningData.json` に書き出し、次回起動時に初期値として読み込む。本番ビルドには含まれない。

## 開発フェーズとの対応

| フェーズ | 実装対象 |
|---------|---------|
| **Phase 1: 戦闘ロジック** | `Lib/Types/`、`Lib/Core/DamageCalculator.ts`、`Lib/Core/CommandValidator.ts`、`Lib/State/BattleReducer.ts` |
| **Phase 2: ゲームループ** | `Lib/State/GameReducer.ts`、`Lib/Core/StoreLogic.ts`、`Lib/Storage/SaveManager.ts` |
| **Phase 3: データとUI** | `Lib/Data/*.json`、`Components/`、`Hooks/` |
| **Phase 4: バランス調整** | `Lib/Data/*.json`の数値調整 |
| **Phase 5: Tuning Editor** | `Lib/Tuning/`、`editor/`、`vite-plugins/`、各Core/Typesの`getTuningValue`統合 |

## 設計原則

本プロジェクトでは以下の原則に従う（[coding-style.md](../../.claude/rules/coding-style.md) 参照）。

1. **Immutability**: 状態は常に新しいオブジェクトを作成し、mutateしない
2. **単一責任の原則**: 各モジュール/関数は1つの責任のみを持つ
3. **ゲームロジックとUIの分離**: `Lib/`はReactに依存しない純粋な関数
4. **依存性逆転の原則**: 具象ではなくinterfaceに依存する
