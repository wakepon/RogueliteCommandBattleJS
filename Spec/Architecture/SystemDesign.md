# システム設計書

## 概要

本ドキュメントはMVP実装のためのアーキテクチャ設計をまとめたものです。

## 設計方針

| 項目 | 決定 | 理由 |
|------|------|------|
| データ管理 | JSONファイル（`src/Data/`に配置） | 型チェック可能、ビルド時バンドル |
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
│   │   └── RewardCalculator.ts   # 報酬・利子計算
│   ├── State/              # 状態遷移
│   │   ├── GameReducer.ts        # ゲーム全体の状態遷移
│   │   └── BattleReducer.ts      # 戦闘中の状態遷移
│   └── Storage/            # 永続化
│       └── SaveManager.ts        # localStorage操作
├── Hooks/                  # React Hooks（ロジックとUIの橋渡し）
│   ├── UseGame.ts          # ゲーム全体の状態管理
│   └── UseBattle.ts        # 戦闘画面用
├── Components/             # UIコンポーネント
│   ├── Screens/            # 画面単位
│   │   ├── TitleScreen.tsx
│   │   ├── BattleScreen.tsx
│   │   ├── StoreScreen.tsx
│   │   ├── EventScreen.tsx     # Stage 4の選択
│   │   └── ResultScreen.tsx
│   ├── Battle/             # 戦闘UI部品
│   └── Common/             # 共通UI部品
├── Data/                   # JSONマスターデータ
│   ├── Weapons.json
│   ├── Spells.json
│   ├── Relics.json
│   ├── Potions.json
│   ├── Enemies.json
│   └── StagePatterns.json
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
  | 'enemySingle'    // 敵優先1体（味方も選択可能）
  | 'allySingle'     // 味方優先1体（敵も選択可能）
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
  | { type: 'statBonus'; stat: 'str' | 'int' | 'agi'; value: number }
  | { type: 'weaponDamageBonus'; value: number }
  | { type: 'interestCap'; value: number }
  | { type: 'lowHpDamageMultiplier'; hpThreshold: number; multiplier: number }

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

/** 武器データ（マスターデータ、購入可能） */
export interface WeaponData extends IItem, IPurchasable, ICommandable, ITargetable, IUseLimited {
  commandCategory: 'weapon'
  power: number
  goldCost?: number   // ゴールド消費（黄金の斧など）
  hpCost?: number     // HP消費（呪われた槍など）
  effect?: WeaponEffect
}

/** 武器インスタンス（ゲーム中の状態、購入可能な武器） */
export interface WeaponInstance extends WeaponData {
  currentUses: number
}

/** パンチ（購入不可、無限使用の特殊武器） */
export interface PunchInstance extends ICommandable, ITargetable {
  id: 'punch'
  name: 'パンチ'
  commandCategory: 'weapon'
  targetType: 'enemySingle'
  power: 0
  maxUses: null      // 無限
  currentUses: null  // 無限
}

/** パンチの定数 */
export const PUNCH: PunchInstance = {
  id: 'punch',
  name: 'パンチ',
  commandCategory: 'weapon',
  targetType: 'enemySingle',
  power: 0,
  maxUses: null,
  currentUses: null
}

/** 探索者が持てる武器（購入した武器 + パンチ） */
export type ExplorerWeapon = WeaponInstance | PunchInstance
```

```typescript
// ===== Lib/Types/Spell.ts =====
/** 魔法効果 */
export type SpellEffect =
  | { type: 'heal'; value: number }           // HP回復
  | { type: 'steal' }                         // ゴールドを盗む
  | { type: 'buff'; stat: 'str'; value: number; duration: 'battle' }  // バフ

/** 魔法データ */
export interface SpellData extends IItem, IPurchasable, ICommandable, ITargetable, IMpCost {
  commandCategory: 'spell'
  targetType: TargetType  // ITargetableから継承
  power: number
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
}
```

### インターフェース継承図

```
IItem (id, name, rarity)
  │
  ├─ WeaponData ─┬─ IPurchasable (price)
  │              ├─ ICommandable (commandCategory: 'weapon')
  │              ├─ ITargetable (targetType, minTargetCount?, maxTargetCount?)
  │              ├─ IUseLimited (maxUses: number | null)
  │              ├─ goldCost?: number  ← オプショナル（黄金の斧など）
  │              └─ hpCost?: number    ← オプショナル（呪われた槍など）
  │
  ├─ SpellData ──┬─ IPurchasable
  │              ├─ ICommandable (commandCategory: 'spell')
  │              ├─ ITargetable
  │              └─ IMpCost (mpCost)
  │
  ├─ RelicData ──┬─ IPurchasable
  │              └─ IPassiveEffect (passiveEffect)
  │
  └─ PotionData ─┬─ IPurchasable
                 ├─ ICommandable (commandCategory: 'potion')
                 ├─ ITargetable (targetType: 'allySingle')
                 └─ ISingleUse

PunchInstance ──┬─ ICommandable (commandCategory: 'weapon')
                └─ ITargetable
                ※ IPurchasableを持たない → 売却不可

消費系インターフェース:
  IUseLimited (maxUses)     ... 武器の使用回数
  IMpCost (mpCost)          ... 魔法のMP消費
  IGoldCost (goldCost)      ... ゴールド消費
  IHpCost (hpCost)          ... HP消費
  ISingleUse                ... 使い切り（ポーション）
```

### 売却可否判定

```typescript
// Lib/Core/StoreLogic.ts

/** IPurchasableを持っているかどうかで売却可否を判定 */
export function isSellable(item: unknown): item is IPurchasable {
  return typeof item === 'object' && item !== null && 'price' in item
}

// 使用例
function getSellPrice(weapon: ExplorerWeapon): number | null {
  if (!isSellable(weapon)) {
    return null  // パンチなど売却不可
  }
  // 武器は使用回数に応じて売却価格が下がる
  const basePrice = Math.floor(weapon.price / 2)
  if (weapon.currentUses === null || weapon.maxUses === null) {
    return basePrice
  }
  return Math.floor((weapon.currentUses / weapon.maxUses) * basePrice)
}
```

### コマンド使用可能判定

`isAvailable`はインターフェースではなくロジック層で実装する。

```typescript
// Lib/Core/CommandValidator.ts
export function isCommandAvailable(
  command: ExplorerWeapon | SpellData | PotionData,
  explorer: ExplorerState
): boolean {
  switch (command.commandCategory) {
    case 'weapon':
      const weapon = command as ExplorerWeapon
      // 無限使用（null）でなければ残り回数をチェック
      if (weapon.currentUses !== null && weapon.currentUses <= 0) {
        return false
      }
      // ゴールド消費チェック（黄金の斧など）
      if ('goldCost' in weapon && weapon.goldCost !== undefined) {
        if (explorer.gold < weapon.goldCost) {
          return false
        }
      }
      // HP消費チェック（呪われた槍など）
      // 注: HP消費は使用可能判定には含めない（自傷ダメージで死亡可能）
      // または、HP不足で使用不可にする場合は以下を有効化:
      // if ('hpCost' in weapon && weapon.hpCost !== undefined) {
      //   if (explorer.hp <= weapon.hpCost) {
      //     return false
      //   }
      // }
      return true

    case 'spell':
      return explorer.mp >= (command as SpellData).mpCost

    case 'potion':
      return true  // ポーションは常に使用可能
  }
}
```

## 状態管理

### GameState（ゲーム全体の状態）

```typescript
// ===== Lib/Types/Game.ts =====
interface GameState {
  phase: 'title' | 'battle' | 'store' | 'event' | 'result'
  run: RunState | null        // タイトル画面ではnull
  battleState: BattleState | null
  storeState: StoreState | null
}
```

### RunState（1回のゲームプレイの状態）

```typescript
// ===== Lib/Types/Run.ts =====
interface RunState {
  // Run識別・再現性
  seed: number              // ランダムシード（リプレイ・デバッグ用）
  startedAt: number         // 開始時刻（timestamp）

  // 進行状況
  currentStage: number      // 現在のステージ (1-7)

  // パーティー共有リソース
  gold: number              // 所持ゴールド
  relics: RelicInstance[]   // 所持レリック（最大5枠）
  potions: PotionInstance[] // 所持ポーション（最大2枠）

  // パーティー
  party: ExplorerState[]    // MVPでは1人、将来は複数人

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

/** バフ */
interface Buff {
  type: string
  value: number
  duration: number | 'battle' | 'nextAction'  // ターン数 or 戦闘終了まで or 次の行動まで
}

/** デバフ */
interface Debuff {
  type: 'poison'    // 毒など
  stacks: number    // スタック数
}

/** 探索者の状態 */
interface ExplorerState {
  id: string
  name: string

  // 個人ステータス
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  str: number
  int: number
  agi: number

  // レベル・経験値
  level: number
  exp: number                 // 経験値（累計討伐数）

  // 個人装備
  weapons: ExplorerWeapon[]   // 最大4枠 + パンチ（パンチは常に最後）
  spells: SpellInstance[]     // 最大4枠

  // 戦闘中バフ/デバフ（戦闘終了時にクリア）
  battleBuffs: Buff[]
  battleDebuffs: Debuff[]
}
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

/** アクターID（行動順管理用） */
export type ActorId =
  | { type: 'explorer'; id: string }      // 探索者のid
  | { type: 'enemy'; instanceId: string } // 敵のinstanceId

interface BattleState {
  turn: number
  turnLimit: number
  enemies: EnemyInstance[]
  actionQueue: ActorId[]  // 行動順（Agi順）
  currentActorIndex: number
  stolenGold: number      // ゴールドラッシュで盗んだ金額
}
```

### StoreState（ストア画面の状態）

```typescript
interface StoreState {
  weaponSlots: (WeaponData | SpellData)[]  // 3枠
  relicSlots: (RelicData | PotionData)[]   // 3枠
  rerollCost: number  // MVP: 固定5G
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
  version: number      // 互換性チェック用
  run: RunState        // Run情報のみ保存（phase等は復元時に決定）
  savedAt: number      // timestamp
}
```

**注**: セーブデータにはRunStateのみを保存。phaseやbattleState等はロード時に適切な値を設定する。

### SaveManager

```typescript
// Lib/Storage/SaveManager.ts
export const SaveManager = {
  save(state: GameState): void
  load(): GameState | null
  clear(): void
  hasSave(): boolean
}
```

## 画面遷移

React Routerは使用せず、`phase`によるstate切り替えで実装。

```typescript
// App.tsx
function App() {
  const { state, dispatch } = useGame()

  switch (state.phase) {
    case 'title':
      return <TitleScreen />
    case 'battle':
      return <BattleScreen />
    case 'store':
      return <StoreScreen />
    case 'event':
      return <EventScreen />
    case 'result':
      return <ResultScreen />
  }
}
```

### 画面遷移フロー

```
[title]
   ↓ START_GAME（新規） or CONTINUE_GAME（ロード）
[battle] ←──────────────────────┐
   ↓ 勝利                        │
[store] ─────────→ 次のStageへ ──┘
   ↓ Stage 4の場合
[event] ─────────→ 次のStageへ ──┘
   ↓ ボス撃破 or 敗北
[result]
   ↓ RETURN_TITLE
[title]
```

## JSONデータ形式

### Weapons.json

```json
[
  {
    "id": "rusty_knife",
    "name": "錆びたナイフ",
    "rarity": "Common",
    "price": 3,
    "commandCategory": "weapon",
    "targetType": "enemySingle",
    "power": 3,
    "maxUses": 5
  },
  {
    "id": "iron_sword",
    "name": "鉄の剣",
    "rarity": "Common",
    "price": 8,
    "commandCategory": "weapon",
    "targetType": "enemySingle",
    "power": 6,
    "maxUses": 8
  },
  {
    "id": "vampire_dagger",
    "name": "吸血の短剣",
    "rarity": "Uncommon",
    "price": 12,
    "commandCategory": "weapon",
    "targetType": "enemySingle",
    "power": 4,
    "maxUses": 5,
    "effect": {
      "type": "lifesteal",
      "value": 0.5
    }
  },
  {
    "id": "golden_axe",
    "name": "黄金の斧",
    "rarity": "Uncommon",
    "price": 10,
    "commandCategory": "weapon",
    "targetType": "enemySingle",
    "power": 10,
    "maxUses": 3,
    "goldCost": 1
  },
  {
    "id": "cursed_spear",
    "name": "呪われた槍",
    "rarity": "Rare",
    "price": 5,
    "commandCategory": "weapon",
    "targetType": "enemySingle",
    "power": 15,
    "maxUses": 10,
    "hpCost": 2
  },
  {
    "id": "scythe",
    "name": "大鎌",
    "rarity": "Uncommon",
    "price": 12,
    "commandCategory": "weapon",
    "targetType": "enemyAll",
    "power": 4,
    "maxUses": 5
  },
  {
    "id": "crossbow",
    "name": "連弩",
    "rarity": "Rare",
    "price": 15,
    "commandCategory": "weapon",
    "targetType": "enemyRandom",
    "minTargetCount": 4,
    "maxTargetCount": 4,
    "power": 3,
    "maxUses": 4
  }
]
```

### Spells.json

```json
[
  {
    "id": "fire",
    "name": "ファイア",
    "rarity": "Common",
    "price": 6,
    "commandCategory": "spell",
    "targetType": "enemySingle",
    "mpCost": 3,
    "power": 8,
    "effect": null
  },
  {
    "id": "heal",
    "name": "ヒール",
    "rarity": "Common",
    "price": 8,
    "commandCategory": "spell",
    "targetType": "allySingle",
    "mpCost": 5,
    "power": 0,
    "effect": {
      "type": "heal",
      "value": 15
    }
  },
  {
    "id": "firestorm",
    "name": "ファイアストーム",
    "rarity": "Uncommon",
    "price": 10,
    "commandCategory": "spell",
    "targetType": "enemyAll",
    "mpCost": 5,
    "power": 5,
    "effect": null
  }
]
```

### Relics.json

```json
[
  {
    "id": "warrior_bracelet",
    "name": "戦士の腕輪",
    "rarity": "Common",
    "price": 15,
    "passiveEffect": {
      "type": "statBonus",
      "stat": "str",
      "value": 2
    }
  },
  {
    "id": "sharp_whetstone",
    "name": "鋭い砥石",
    "rarity": "Uncommon",
    "price": 20,
    "passiveEffect": {
      "type": "weaponDamageBonus",
      "value": 3
    }
  },
  {
    "id": "piggy_bank",
    "name": "貯金箱",
    "rarity": "Rare",
    "price": 25,
    "passiveEffect": {
      "type": "interestCap",
      "value": 10
    }
  }
]
```

### Potions.json

```json
[
  {
    "id": "hp_potion",
    "name": "HPポーション",
    "rarity": "Common",
    "price": 5,
    "commandCategory": "potion",
    "effect": {
      "type": "healHp",
      "value": 20
    }
  },
  {
    "id": "mp_potion",
    "name": "MPポーション",
    "rarity": "Common",
    "price": 5,
    "commandCategory": "potion",
    "effect": {
      "type": "healMp",
      "value": 10
    }
  }
]
```

### Enemies.json

```json
[
  {
    "id": "slime",
    "name": "スライム",
    "type": "normal",
    "hp": 20,
    "attack": 3,
    "agi": 2,
    "gold": 1,
    "behavior": "basic_attack"
  },
  {
    "id": "ghost",
    "name": "ゴースト",
    "type": "normal",
    "hp": 15,
    "attack": 2,
    "agi": 6,
    "gold": 1,
    "behavior": "mp_drain"
  },
  {
    "id": "orc",
    "name": "オーク",
    "type": "elite",
    "hp": 50,
    "attack": 8,
    "agi": 3,
    "gold": 2,
    "behavior": "charge_attack"
  },
  {
    "id": "chimera",
    "name": "キメラ",
    "type": "boss",
    "hp": 150,
    "attack": 5,
    "agi": 4,
    "gold": 3,
    "behavior": "boss_pattern"
  }
]
```

### StagePatterns.json

```json
{
  "stage_1_2": [
    { "pattern": "A", "enemies": ["slime"] },
    { "pattern": "B", "enemies": ["slime", "slime"] },
    { "pattern": "C", "enemies": ["slime", "slime", "slime"] },
    { "pattern": "D", "enemies": ["slime", "ghost"] }
  ],
  "stage_3": [
    { "pattern": "A", "enemies": ["orc"] },
    { "pattern": "B", "enemies": ["orc", "slime"] }
  ],
  "stage_5_6": [
    { "pattern": "A", "enemies": ["slime", "slime", "ghost", "ghost"] },
    { "pattern": "B", "enemies": ["ghost", "ghost", "ghost"] }
  ],
  "stage_7": [
    { "pattern": "A", "enemies": ["chimera"] },
    { "pattern": "B", "enemies": ["chimera", "slime", "slime"] }
  ]
}
```

## 開発フェーズとの対応

| フェーズ | 実装対象 |
|---------|---------|
| **Phase 1: 戦闘ロジック** | `Lib/Types/`、`Lib/Core/DamageCalculator.ts`、`Lib/Core/CommandValidator.ts`、`Lib/State/BattleReducer.ts` |
| **Phase 2: ゲームループ** | `Lib/State/GameReducer.ts`、`Lib/Core/RewardCalculator.ts`、`Lib/Core/StoreLogic.ts`、`Lib/Storage/SaveManager.ts` |
| **Phase 3: データとUI** | `Data/*.json`、`Components/`、`Hooks/` |
| **Phase 4: バランス調整** | `Data/*.json`の数値調整 |

## 設計原則

本プロジェクトでは以下の原則に従う（[coding-style.md](../../.claude/rules/coding-style.md) 参照）。

1. **Immutability**: 状態は常に新しいオブジェクトを作成し、mutateしない
2. **単一責任の原則**: 各モジュール/関数は1つの責任のみを持つ
3. **ゲームロジックとUIの分離**: `Lib/`はReactに依存しない純粋な関数
4. **依存性逆転の原則**: 具象ではなくinterfaceに依存する
