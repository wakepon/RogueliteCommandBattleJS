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

## フォルダ構造

```
src/
├── Lib/                    # Pure なゲームロジック（React非依存）
│   ├── Types/              # 型定義
│   │   ├── Item.ts         # IItem, Rarity
│   │   ├── Purchasable.ts  # IPurchasable
│   │   ├── Command.ts      # ICommandable, ITargetable, TargetType
│   │   ├── Consumable.ts   # IUseLimited, IMpCost, IGoldCost, IHpCost, ISingleUse
│   │   ├── Passive.ts      # IPassiveEffect, PassiveEffectType
│   │   ├── Weapon.ts       # WeaponData, WeaponInstance, PunchInstance, ExplorerWeapon
│   │   ├── Spell.ts        # SpellData, SpellInstance, SpellEffect
│   │   ├── Relic.ts        # RelicData, RelicInstance
│   │   ├── Potion.ts       # PotionData, PotionInstance, PotionEffect
│   │   ├── Explorer.ts     # ExplorerState, Buff, Debuff
│   │   ├── Enemy.ts        # EnemyData, EnemyInstance
│   │   ├── Battle.ts       # BattleState
│   │   ├── Run.ts          # RunState, RunStats
│   │   ├── Game.ts         # GameState
│   │   └── index.ts        # 再エクスポート
│   ├── Core/               # コアロジック
│   │   ├── DamageCalculator.ts   # ダメージ計算式
│   │   ├── CommandValidator.ts   # コマンド使用可能判定
│   │   ├── BattleEngine.ts       # 戦闘進行ロジック
│   │   ├── StoreLogic.ts         # ストアの売買・抽選・売却可否判定
│   │   ├── RewardCalculator.ts   # 報酬・利子計算
│   │   ├── StageManager.ts       # ステージ管理
│   │   ├── LevelUpCalculator.ts  # レベルアップ計算
│   │   ├── EnemyAI.ts            # 敵行動決定
│   │   ├── BuffProcessor.ts      # バフ処理
│   │   ├── EventLogic.ts         # イベント画面ロジック
│   │   ├── MapGenerator.ts       # マップ生成
│   │   ├── RelicProcessor.ts     # レリック効果処理
│   │   └── index.ts
│   ├── State/              # 状態遷移
│   │   ├── GameReducer.ts        # ゲーム全体の状態遷移
│   │   ├── BattleReducer.ts      # 戦闘中の状態遷移
│   │   ├── BattleActionProcessor.ts  # 戦闘アクション処理
│   │   ├── BattleStateFactory.ts     # 戦闘状態生成
│   │   ├── EnemyEffectProcessor.ts   # 敵エフェクト処理（防御バフ軽減、力溜め付与/消費、全体力溜め、自己防御バフ、自己回復、味方回復、召喚）
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
│   │   └── StagePatterns.json
│   └── Storage/            # 永続化
│       ├── SaveManager.ts        # localStorage操作
│       └── index.ts
├── Hooks/                  # React Hooks（ロジックとUIの橋渡し）
│   ├── UseGame.tsx         # ゲーム全体の状態管理
│   └── UseBattle.tsx       # 戦闘画面用
├── Components/             # UIコンポーネント
│   ├── Screens/            # 画面単位
│   │   ├── TitleScreen.tsx
│   │   ├── StoreScreen.tsx
│   │   ├── EventScreen.tsx     # Stage 4の選択
│   │   ├── ResultScreen.tsx
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
```

## インターフェース設計

### 基本インターフェース

```typescript
// ===== Lib/Types/Item.ts =====
/** レアリティ */
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Unique'

/** アイテム基本情報 */
export interface IItem {
  id: string
  name: string
  rarity: Rarity
}
```

```typescript
// ===== Lib/Types/Purchasable.ts =====
/** 購入・売却可能 */
export interface IPurchasable {
  price: number
}

/**
 * 売却可否判定
 * - IPurchasableを持つ → 売却可能
 * - IPurchasableを持たない → 売却不可
 */
```

### コマンド系インターフェース

```typescript
// ===== Lib/Types/Command.ts =====
/** コマンドカテゴリ */
export type CommandCategory = 'weapon' | 'spell' | 'potion'

/** 戦闘コマンドとして選択可能 */
export interface ICommandable {
  commandCategory: CommandCategory
}

/** ターゲットタイプ */
export type TargetType =
  | 'enemySingle'    // 敵単体
  | 'allySingle'     // 味方単体
  | 'enemyAll'       // 敵全体
  | 'allyAll'        // 味方全体
  | 'enemyRandom'    // 敵にランダム回数

/** ターゲット選択 */
export interface ITargetable {
  targetType: TargetType
  /** enemyRandomの場合の最小回数 */
  minTargetCount?: number
  /** enemyRandomの場合の最大回数 */
  maxTargetCount?: number
}
```

### 消耗系インターフェース

```typescript
// ===== Lib/Types/Consumable.ts =====
/** 使用回数制限あり（武器） */
export interface IUseLimited {
  maxUses: number | null  // nullは無限使用
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
```

### パッシブ系インターフェース

```typescript
// ===== Lib/Types/Passive.ts =====
/** パッシブ効果の種類 */
export type PassiveEffectType =
  | { type: 'statBonus'; stat: 'str' | 'int'; value: number }
  | { type: 'weaponDamageBonus'; value: number }
  | { type: 'interestCap'; value: number }
  | { type: 'lowHpDamageMultiplier'; hpThreshold: number; multiplier: number }
  | { type: 'firstHitShield' }
  | { type: 'weaponDurabilitySave'; chance: number }
  | { type: 'weaponAttackMpRecover'; value: number; excludeWeaponId?: string }
  | { type: 'killStreakBonus'; multiplier: number }
  | { type: 'lastStrikeDamageMultiplier'; multiplier: number }
  | { type: 'lowMpDamageBonus'; mpThreshold: number; multiplier: number }
  | { type: 'thornsDamage'; value: number }
  | { type: 'regenPerTurn'; value: number }
  | { type: 'potionEffectMultiplier'; multiplier: number }

/** パッシブ効果を持つ */
export interface IPassiveEffect {
  passiveEffect: PassiveEffectType
}
```

### アイテム型定義

```typescript
// ===== Lib/Types/Weapon.ts =====
/** 武器効果（消費ではなく純粋な効果のみ） */
export type WeaponEffect =
  | { type: 'lifesteal'; value: number }      // ダメージの一定割合HP回復
  | { type: 'targetRateUp'; value: number }   // 被弾率アップ効果

/** 武器データ（マスターデータ、購入可能） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  power: number
  variance: number    // ダメージブレ幅（±variance の加算ブレ）
  scaleStat?: 'str' | 'int'  // ダメージ計算に使うステータス
  goldCost?: number   // ゴールド消費（黄金の斧など）
  hpCost?: number     // HP消費（呪われた槍など）
  effect?: WeaponEffect
}

/** 武器インスタンス（ゲーム中の状態、購入可能な武器） */
export interface WeaponInstance extends WeaponData {
  currentUses: number | null  // nullは無制限使用
}

/** パンチ（購入不可、無限使用の特殊武器） */
export interface PunchInstance extends ICommandable, ITargetable {
  id: 'punch'
  commandCategory: 'weapon'
  targetType: 'enemySingle'
  maxUses: null      // 無限
  currentUses: null  // 無限
}

// PUNCH定数として実装済み（IPurchasableを持たないため売却不可）

/** 探索者が持てる武器（購入した武器 + パンチ） */
export type ExplorerWeapon = WeaponInstance | PunchInstance
```

```typescript
// ===== Lib/Types/Spell.ts =====
/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }           // HP回復
  | { type: 'steal' }                         // ゴールドを盗む
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' }  // バフ

/** 魔法データ */
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost {
  commandCategory: 'spell'
  targetType: TargetType  // ITargetableから継承
  power: number
  variance: number    // ダメージブレ幅（±variance の加算ブレ）
  effect?: SpellEffect
}

/** 魔法インスタンス（状態を持たないためデータと同一） */
export type SpellInstance = SpellData
```

```typescript
// ===== Lib/Types/Relic.ts =====
/** レリックデータ */
export interface RelicData extends IItem, IPurchasable, IPassiveEffect {}

/** レリックインスタンス（状態を持たないためデータと同一） */
export type RelicInstance = RelicData
```

```typescript
// ===== Lib/Types/Potion.ts =====
/** ポーション効果 */
export type PotionEffect =
  | { type: 'healHp'; value: number }
  | { type: 'healMp'; value: number }

/** ポーションデータ */
export interface PotionData extends IItem, IPurchasable, ICommandable, ITargetable, ISingleUse {
  commandCategory: 'potion'
  targetType: 'allySingle'  // ポーションは味方単体対象
  effect: PotionEffect
}

/** ポーションインスタンス（状態を持たないためデータと同一） */
export type PotionInstance = PotionData
```

```typescript
// ===== Lib/Types/Enemy.ts =====
/** 敵タイプ */
export type EnemyType = 'normal' | 'elite' | 'boss'

/** 敵データ（マスターデータ） */
export interface EnemyData {
  id: string
  name: string
  type: EnemyType
  hp: number
  attack: number
  agi: number
  gold: number
  behavior: string
}

/** 敵インスタンス（戦闘中の状態） */
export interface EnemyInstance extends EnemyData {
  instanceId: string        // 同じ敵が複数いる場合の識別用
  currentHp: number
  battleBuffs: Buff[]
  battleDebuffs: Debuff[]
  hasSummoned?: boolean     // 召喚済みフラグ
}
```

### インターフェース継承図

| 型 | 継承インターフェース |
|---|------------------|
| WeaponData | IItem, IPurchasable, ICommandable('weapon'), ITargetable, IUseLimited |
| SpellData | IItem, IPurchasable, ICommandable('spell'), ITargetable, IMpCost |
| RelicData | IItem, IPurchasable, IPassiveEffect |
| PotionData | IItem, IPurchasable, ICommandable('potion'), ITargetable('allySingle'), ISingleUse |
| PunchInstance | ICommandable('weapon'), ITargetable ※IPurchasableなし→売却不可 |

### 売却可否判定

`isSellable`（`Lib/Core/StoreLogic.ts`）は `IPurchasable` を持つかどうかで売却可否を判定する。

- IPurchasableを持つ → 売却可能（価格は使用回数に応じて按分）
- IPurchasableを持たない（パンチなど） → 売却不可

### コマンド使用可能判定

`isCommandAvailable` はインターフェースではなくロジック層（`Lib/Core/CommandValidator.ts`）で実装する。

| コマンドカテゴリ | 判定条件 |
|----------------|---------|
| weapon | currentUses が null でなければ残り回数 > 0 かつ goldCost がある場合は所持金チェック |
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
  // その他イベント固有の状態
}

interface GameState {
  phase: 'title' | 'battle' | 'store' | 'event' | 'result' | 'map'
  run: RunState | null        // タイトル画面ではnull
  battleState: BattleState | null
  storeState: StoreState | null
  resultState: ResultState | null
  eventState: EventState | null
  mapState: MapState | null
}
```

### RunState（1回のゲームプレイの状態）

```typescript
// ===== Lib/Types/Run.ts =====
interface RunState {
  // セーブデータバージョン
  saveVersion: number       // SAVE_VERSION = 2（パーティー制導入）

  // Run識別・再現性
  seed: number              // ランダムシード（リプレイ・デバッグ用）
  startedAt: number         // 開始時刻（timestamp）

  // 進行状況
  currentStage: number      // 現在のステージ (1-7)

  // パーティー共有リソース
  gold: number              // 所持ゴールド
  relics: RelicInstance[]   // 所持レリック
  potions: PotionInstance[] // 所持ポーション（最大2枠）

  // パーティー（3人: warrior, mage, cleric）
  party: ExplorerState[]

  // 戦闘中のレベルアップ情報
  battleLevelUps: LevelUpInfo[]

  // 統計（結果画面表示用）
  stats: RunStats
}

interface RunStats {
  totalKillCount: number    // パーティー全体の累計討伐数
  totalGoldEarned: number   // 累計獲得ゴールド
  maxStageReached: number   // 最高到達ステージ
}
```

### ExplorerState（探索者の状態）

各キャラクターの個人状態。将来的にパーティー対応する場合、各キャラクターがこの状態を持つ。

```typescript
// ===== Lib/Types/Explorer.ts =====

/** キャラクタークラス */
export type CharacterClass = 'warrior' | 'mage' | 'cleric'

/** パーティー内ポジション */
export type Position = 'front' | 'back'

/** バフ */
interface Buff {
  type: string
  value: number
  duration: number | 'battle' | 'nextAction'  // ターン数 or 戦闘終了まで or 次の行動まで
}

/** デバフ（union型） */
type Debuff =
  | { type: 'poison'; stacks: number }
  | { type: 'weakness'; value: number; duration: number }

/** 探索者の状態 */
interface ExplorerState {
  id: string
  name: string

  // キャラクター属性
  characterClass: CharacterClass
  position: Position

  // 個人ステータス
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  str: number
  int: number

  // 装備スロット数（クラスごとに異なる）
  weaponSlotCount: number
  magicSlotCount: number

  // レベル・経験値
  level: number
  exp: number                 // 経験値（累計討伐数）
  killCount: number           // 個人の討伐数

  // 個人装備
  weapons: ExplorerWeapon[]   // weaponSlotCount枠 + パンチ（パンチは常に最後）
  spells: SpellInstance[]     // magicSlotCount枠

  // 戦闘中バフ/デバフ（戦闘終了時にクリア）
  battleBuffs: Buff[]
  battleDebuffs: Debuff[]
}

/**
 * createInitialParty() で3人パーティーを生成する。
 * - warrior（front）、mage（back）、cleric（back）の構成
 */
```

### 共有リソース vs 個人リソースの整理

| リソース | 所属 | 理由 |
|---------|------|------|
| gold | RunState（共有） | パーティーで共有 |
| relics | RunState（共有） | パーティー全体に効果 |
| potions | RunState（共有） | 誰でも使える |
| weapons | ExplorerState（個人） | 個人装備 |
| spells | ExplorerState（個人） | 個人が習得 |
| hp/mp/exp | ExplorerState（個人） | 個人の状態 |

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
  command: ExplorerWeapon | SpellData | PotionData | null
  targetId: string | null
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
  targetExplorerId: string
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
  // 基本攻撃・ダメージ
  damage?: number
  isAoe?: boolean               // 全体攻撃フラグ
  // 力溜め系
  chargeAllAllies?: boolean     // 全味方に力溜め付与
  // 召喚
  summonEnemyId?: string        // 召喚する敵ID
  // 回復
  healSelf?: number             // 自己回復量
  healAlly?: number             // 味方回復量
  // デバフ付与
  applyWeakness?: boolean       // 弱体デバフ付与
  // バフ付与
  applySelfDefense?: boolean    // 自己防御バフ付与
}

interface BattleState {
  phase: BattlePhase
  turn: number
  turnLimit: number           // ステージごとに異なる
  enemies: EnemyInstance[]
  commandSlots: CommandSlot[]         // 各探索者のコマンドスロット（行動順）
  activeExplorerIndex: number         // 現在コマンド入力中の探索者インデックス
  currentCommandIndex: number         // 実行中のコマンドスロットインデックス
  currentEnemyIndex: number           // 実行中の敵インデックス
  enemyIntents: EnemyIntent[]         // 敵の行動予告
  stolenGold: number          // ゴールドラッシュで盗んだ金額
  selectedCommand: BattleCommand | null   // 選択中のコマンド
  selectedTargetId: string | null         // 選択中のターゲットID
  damagePopups: DamagePopup[]
  playerDamagePopups: PlayerDamagePopup[]
  levelUpPopups: LevelUpPopup[]
  battleMessage: string | null
  battleMessageId: number
  relicState: RelicBattleState
}

/** バトルコマンド（ExplorerWeapon | SpellInstance | PotionInstance の union type alias） */
export type BattleCommand = ExplorerWeapon | SpellInstance | PotionInstance
```

### StoreState（ストア画面の状態）

```typescript
interface StoreState {
  weaponSlots: (WeaponData | SpellData | null)[]  // 4枠。購入済みスロットはnull
  relicSlots: (RelicData | null)[]                // 2枠。購入済みスロットはnull
  potionSlots: (PotionData | null)[]              // 2枠。購入済みスロットはnull
  rerollCost: number  // 初期値3G、リロールするごとに1G増加
}
```

## セーブ/ロード

### セーブタイミング

**戦闘終了後のみ**保存する。

```
戦闘勝利
  ↓
報酬計算（Gold + 利子）
  ↓
GameState更新
  ↓
localStorage保存  ← ここでセーブ
  ↓
ストア画面へ
```

### 中断時の挙動

| 中断タイミング | 再開時 |
|---------------|--------|
| 戦闘中 | その戦闘の最初から |
| ストア画面 | ストア画面から（戦闘終了後に保存済み） |
| イベント画面 | 直前の戦闘終了後から |

### SaveData構造

```typescript
interface SaveData {
  version: number      // 互換性チェック用（現在 SAVE_VERSION = 2）
  run: RunState        // Run情報のみ保存（phase等は復元時に決定）
  savedAt: number      // timestamp
}
```

**注**: セーブデータにはRunStateのみを保存。phaseやbattleState等はロード時に適切な値を設定する。VERSION 2からパーティー制に対応し、party配列の検証を行う。

### SaveManager

```typescript
// Lib/Storage/SaveManager.ts
export const SaveManager = {
  save(run: RunState): boolean
  load(): RunState | null
  clear(): void
  hasSave(): boolean
}
```

## 画面遷移

React Routerは使用せず、`phase`によるstate切り替えで実装。`App.tsx` が `GameState.phase`（'title' | 'battle' | 'store' | 'event' | 'result' | 'map'）を参照して各画面コンポーネントを切り替える。

### 画面遷移フロー

```
[title]
   ↓ START_GAME（新規） → 直接 [battle] に遷移（初回マップスキップ）
   ↓ CONTINUE_GAME（ロード） → [store] に遷移
[battle] ←──────────────────────┐
   ↓ 勝利                        │
[store] ─────────→ [map] ────────┘
   ↓ ADVANCE_FROM_MAP（ステージ選択）
   ↓ Stage 4の場合
[event] ─────────→ [map] ────────┘
   ↓ ボス撃破 or 敗北
[result]
   ↓ RETURN_TITLE
[title]
```

## JSONデータ形式

### Weapons.json

10種の武器データ（オブジェクト辞書形式）。全武器に `variance` フィールドあり。`magic_bullet`、`prayer` が追加済み。投げナイフは `enemyAll` ターゲット。

```json
{
  "rusty_knife":     { "targetType": "enemySingle", ... },
  "short_sword":     { "targetType": "enemySingle", ... },
  "iron_sword":      { "targetType": "enemySingle", ... },
  "great_axe":       { "targetType": "enemySingle", ... },
  "greatsword":      { "targetType": "enemyAll",    ... },
  "throwing_knife":  { "targetType": "enemyAll",    ... },
  "whirlwind_blade": { "targetType": "enemyAll",    ... },
  "vampiric_blade":  { "targetType": "enemySingle", "effect": { "type": "lifesteal" }, ... },
  "magic_bullet":    { "targetType": "enemySingle", "scaleStat": "int", ... },
  "prayer":          { "targetType": "allySingle",  "effect": { "type": "targetRateUp" }, ... }
}
```

（各武器の具体的な数値はバランス調整対象のため概要記載）

### Spells.json

7種の魔法データ（オブジェクト辞書形式）。全魔法に `variance` フィールドあり。`precision` が追加済み。

```json
{
  "fire":      { "targetType": "enemySingle", ... },
  "firestorm": { "targetType": "enemyAll",    ... },
  "heal":      { "targetType": "allySingle",  "effect": { "type": "heal" }, ... },
  "ice_bolt":  { "targetType": "enemySingle", ... },
  "thunder":   { "targetType": "enemySingle", ... },
  "blizzard":  { "targetType": "enemyAll",    ... },
  "precision": { "targetType": "allySingle",  "effect": { "type": "buff", "stat": "precision", "duration": "nextAction" }, ... }
}
```

（各魔法の具体的な数値はバランス調整対象のため概要記載）

### Relics.json

15種のレリックデータ（オブジェクト辞書形式）。各レリックは `PassiveEffectType` に対応した `passiveEffect` を持つ。効果の詳細値はバランス調整対象のため概要記載。

### Potions.json

2種のポーションデータ（`hp_potion`、`mp_potion`）。`targetType: 'allySingle'`。効果値はバランス調整対象のため概要記載。

### Enemies.json

12種の敵データ（オブジェクト辞書形式）。全敵の `behavior` は `"attack"` に統一。行動の分岐は `EnemyAI.ts` で `enemy.id` ベースに実装される。

- normal（6種）: slime, goblin, sewer_rat, hedro_slime, shaman, fairy
- elite（5種）: orc, assassin, sleep_tiger, dark_mage, orc_lord
- boss（1種）: dragon

```json
{
  "slime":       { "id": "slime",       "name": "スライム",     "type": "normal", "behavior": "attack", ... },
  "goblin":      { "id": "goblin",      "name": "ゴブリン",     "type": "normal", "behavior": "attack", ... },
  "sewer_rat":   { "id": "sewer_rat",   "name": "ドブネズミ",   "type": "normal", "behavior": "attack", ... },
  "hedro_slime": { "id": "hedro_slime", "name": "ヘドロスライム","type": "normal", "behavior": "attack", ... },
  "shaman":      { "id": "shaman",      "name": "シャーマン",   "type": "normal", "behavior": "attack", ... },
  "fairy":       { "id": "fairy",       "name": "フェアリー",   "type": "normal", "behavior": "attack", ... },
  "orc":         { "id": "orc",         "name": "オーク",       "type": "elite",  "behavior": "attack", ... },
  "assassin":    { "id": "assassin",    "name": "アサシン",     "type": "elite",  "behavior": "attack", ... },
  "sleep_tiger": { "id": "sleep_tiger", "name": "眠り虎",       "type": "elite",  "behavior": "attack", ... },
  "dark_mage":   { "id": "dark_mage",   "name": "ダークメイジ", "type": "elite",  "behavior": "attack", ... },
  "orc_lord":    { "id": "orc_lord",    "name": "オークロード", "type": "elite",  "behavior": "attack", ... },
  "dragon":      { "id": "dragon",      "name": "ドラゴン",     "type": "boss",   "behavior": "attack", ... }
}
```

（各敵の具体的なステータス値はバランス調整対象のため概要記載）

### StagePatterns.json

`stage_1` 〜 `stage_7` の個別形式。各ステージに `turnLimit` と `patterns` フィールドあり。`pattern` キーはなし。`stage_4` はイベントステージ（`turnLimit: 0`、`patterns: []`）。turnLimit の具体的な値はバランス調整対象。新敵12種を含む拡張パターンに全面更新済み。

```json
{
  "stage_1": { "turnLimit": ..., "patterns": [{ "enemies": ["slime"] }, { "enemies": ["slime", "slime"] }, { "enemies": ["sewer_rat"] }, ...] },
  "stage_2": { "turnLimit": ..., "patterns": [{ "enemies": ["slime", "goblin"] }, { "enemies": ["hedro_slime"] }, ...] },
  "stage_3": { "turnLimit": ..., "patterns": [{ "enemies": ["orc"] }, { "enemies": ["shaman", "goblin"] }, { "enemies": ["assassin"] }, ...] },
  "stage_4": { "turnLimit": 0,  "patterns": [] },
  "stage_5": { "turnLimit": ..., "patterns": [{ "enemies": ["orc", "fairy"] }, { "enemies": ["sleep_tiger"] }, ...] },
  "stage_6": { "turnLimit": ..., "patterns": [{ "enemies": ["dark_mage", "orc"] }, { "enemies": ["orc_lord"] }, ...] },
  "stage_7": { "turnLimit": ..., "patterns": [{ "enemies": ["dragon"] }] }
}
```

## Reducerアクション概要

### GameReducer 主要アクション

| カテゴリ | アクション |
|---------|-----------|
| ゲーム制御 | START_GAME, CONTINUE_GAME, RETURN_TITLE, END_BATTLE |
| ストア | OPEN_STORE, CLOSE_STORE, BUY_WEAPON, BUY_SPELL, BUY_RELIC, BUY_POTION, SELL_WEAPON, SELL_SPELL, SELL_RELIC, REROLL_STORE |
| 購入取り消し | UNDO_BUY_WEAPON, UNDO_BUY_SPELL, UNDO_BUY_RELIC, UNDO_BUY_POTION |
| 売却取り消し | UNDO_SELL_WEAPON, UNDO_SELL_SPELL, UNDO_SELL_RELIC |
| ポーション売却 | SELL_POTION, UNDO_SELL_POTION |
| 装備移動 | TRANSFER_WEAPON, TRANSFER_SPELL（メンバー間装備移動） |
| パーティー管理 | REORDER_PARTY（パーティー並び替え。commandSlotsも連動） |
| イベント | OPEN_EVENT, SELECT_REST, SELECT_REPAIR, SELECT_TREASURE |
| マップ | ADVANCE_FROM_MAP（ステージ選択） |

### BattleReducer 主要アクション

| カテゴリ | アクション |
|---------|-----------|
| コマンド選択 | SELECT_COMMAND, CANCEL_COMMAND, SELECT_TARGET |
| コマンド設定 | SET_COMMAND_SLOT, SET_COMMAND_SLOT_DIRECT |
| 探索者切替 | CHANGE_ACTIVE_EXPLORER |
| 実行制御 | START_EXECUTION, ADVANCE_PARTY_ACTION, ADVANCE_ENEMY_ACTION, EXECUTE_COMMAND, ENEMY_ACTION |
| ターン管理 | PROCESS_TURN_END, START_NEW_TURN |
| 表示更新 | REMOVE_POPUP, REMOVE_PLAYER_POPUP, ADD_LEVEL_UP_POPUP, REMOVE_LEVEL_UP_POPUP |
| レリック・敵 | UPDATE_RELIC_STATE, UPDATE_ENEMIES |

### BattleStateFactory

`createBattleState` と `generateEnemyIntents` の2つの主要関数を含む。AGI順ソート（`sortActorsByAgi`）は廃止済みで、`commandSlots` 配列順により行動順を管理する。

### BattleActionProcessor

`processExecuteCommand`（コマンド実行処理）、`processEnemyAction`（敵行動処理）、`processTurnEndAction`（ターン終了処理）の3主要処理関数を持つ。

## 開発フェーズとの対応

| フェーズ | 実装対象 |
|---------|---------|
| **Phase 1: 戦闘ロジック** | `Lib/Types/`、`Lib/Core/DamageCalculator.ts`、`Lib/Core/CommandValidator.ts`、`Lib/State/BattleReducer.ts` |
| **Phase 2: ゲームループ** | `Lib/State/GameReducer.ts`、`Lib/Core/RewardCalculator.ts`、`Lib/Core/StoreLogic.ts`、`Lib/Storage/SaveManager.ts` |
| **Phase 3: データとUI** | `Lib/Data/*.json`、`Components/`、`Hooks/` |
| **Phase 4: バランス調整** | `Lib/Data/*.json`の数値調整 |

## 設計原則

本プロジェクトでは以下の原則に従う（[coding-style.md](../../.claude/rules/coding-style.md) 参照）。

1. **Immutability**: 状態は常に新しいオブジェクトを作成し、mutateしない
2. **単一責任の原則**: 各モジュール/関数は1つの責任のみを持つ
3. **ゲームロジックとUIの分離**: `Lib/`はReactに依存しない純粋な関数
4. **依存性逆転の原則**: 具象ではなくinterfaceに依存する
