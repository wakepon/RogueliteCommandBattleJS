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
│   │   ├── TargetingSystem.ts    # 前衛/後衛ターゲット率計算
│   │   ├── PositionUtils.ts      # getFrontMemberId / isFrontMember（前衛判定ユーティリティ）
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
│   │   ├── StagePatterns.json
│   │   └── TuningData.json       # Tuning Editorが書き出すパラメータ調整値
│   ├── Tuning/             # バランス調整システム（DEV専用）
│   │   ├── TuningConfig.ts       # TuningConfig型定義（6カテゴリ）
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

**ビルド設定の変更点:**
- `vite.config.ts`: `appType: 'mpa'` に設定（メインアプリとeditorを別エントリーポイントとして扱う）
- `tsconfig.json`: `include` に `"editor"` を追加

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
export interface IGoldCost { goldCost: number }
export interface IHpCost { hpCost: number }
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
  | { type: 'battleStartHpReduction'; rate: number; strBonus: number }      // 戦闘開始時にHP減少＋STRボーナス
  | { type: 'damageTakenToMp'; rate: number }                               // 被ダメージの一部をMP変換
  | { type: 'goldPerKill'; value: number }                                  // 敵撃破時にゴールド獲得
  | { type: 'weaponBreakDamageMultiplier'; increment: number }              // 武器破壊時のダメージ倍率
  | { type: 'weaponBreakNextAttackBonus'; value: number }                   // 武器破壊後の次攻撃ボーナス
  | { type: 'levelUpDamageBoost' }                                          // レベルアップ時の次攻撃ダメージ倍率
  | { type: 'battleEndBonusExp' }                                           // 戦闘後全員ボーナスEXP＋ゴールドペナルティ（修羅の証）
  | { type: 'lowestLevelDamageMultiplier' }                                 // 最低レベル者のダメージ倍率
  | { type: 'highHpTargetRateBonus' }                                       // HP最大者の被弾率上昇
  | { type: 'deathProtection' }                                             // 致死ダメージでHP1耐え（1ラン1回消滅）

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
  | { type: 'lifesteal'; value: number }                                       // ダメージの一定割合HP回復
  | { type: 'targetRateUp'; value: number }                                    // 被弾率アップ効果
  | { type: 'conditionalPower'; hpThreshold: number; bonusPower: number }      // 条件付き追加ダメージ
  | { type: 'shield'; value: number }                                          // 守護の盾：被ダメ軽減シールド
  | { type: 'killPreserveDurability' }                                         // 魂喰いの剣：トドメで耐久消費なし

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
  name: string
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
  | { type: 'steal' }                                                                             // ゴールドを盗む
  | { type: 'buff'; stat: 'str' | 'precision'; value: number; duration: 'battle' | 'nextAction' } // バフ（'int'は対象外）
  | { type: 'shield'; value: number }                                                             // シールド付与（被ダメージ軽減）
  | { type: 'hpToMp'; hpCost: number; mpGain: number }                                           // HPをMPに変換
  | { type: 'goldOnHit'; value: number }                                                          // 攻撃ヒット時にゴールド獲得
  | { type: 'goldDamage'; rate: number; multiplier: number }                                      // 所持ゴールドに応じてダメージ増加
  | { type: 'repairWeapons'; value: number }                                                      // 装備中の武器を修理
  | { type: 'weaponPowerBuff'; value: number }                                                    // 武器ダメージバフ（durationなし）
  | { type: 'guidanceBuff' }                                                                      // 次のトドメで+1ボーナスEXP
  | { type: 'killBonusExpToAll' }                                                                 // トドメ時に全員へボーナスEXP

/** SpellData.effect は null 許容 */

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
// Relic.ts
export interface RelicData extends IItem, IPurchasable, IPassiveEffect {}
export type RelicInstance = RelicData

// Potion.ts
export type PotionEffect =
  | { type: 'healHp'; value: number }
  | { type: 'healMp'; value: number }
  | { type: 'repairWeapons'; value: number }   // 修復ポーション：装備武器の耐久回復
export interface PotionData extends IItem, IPurchasable, ICommandable, ITargetable, ISingleUse {
  commandCategory: 'potion'; targetType: 'allySingle'; effect: PotionEffect
}
export type PotionInstance = PotionData

// Enemy.ts
export type EnemyType = 'normal' | 'elite' | 'boss'
export interface EnemyData { id: string; name: string; type: EnemyType; hp: number; attack: number; agi: number; gold: number; behavior: string }
export interface EnemyInstance extends EnemyData {
  instanceId: string; currentHp: number; battleBuffs: Buff[]; battleDebuffs: Debuff[]; hasSummoned?: boolean
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

/** 武器使用回数差分（リザルト画面表示用） */
export interface WeaponUsesDiff { weaponId: string; usesBefore: number | null; usesAfter: number | null }

/** メンバー戦闘前後差分（リザルト画面の逐次アニメ用） */
export interface MemberBattleDiff {
  explorerId: string
  hpBefore: number; maxHpBefore: number; mpBefore: number; maxMpBefore: number
  levelBefore: number; expBefore: number; expRequiredBefore: number
  hpAfter: number; maxHpAfter: number; mpAfter: number; maxMpAfter: number
  levelAfter: number; expAfter: number; expRequiredAfter: number
  weaponUsesDiff: WeaponUsesDiff[]
}

/** リザルト画面の追加報酬エントリ */
export interface ResultBonusEntry { source: string; value: number }

/** メンバーカードのアニメーションフェーズ */
export type MemberAnimationPhase =
  'pending' | 'enter' | 'resourcesAnimate' | 'shaking' | 'levelUpdated' | 'maxStatsRevealed' | 'done'

/** リザルト状態 */
export interface ResultState { bonusEntries: ResultBonusEntry[] }  // 現状は空配列
```

### RunState（1回のゲームプレイの状態）

```typescript
// ===== Lib/Types/Run.ts =====
interface RunState {
  saveVersion: number       // SAVE_VERSION = 2（パーティー制導入）
  seed: number; startedAt: number
  currentStage: number      // 現在のステージ (1-7)
  gold: number; relics: RelicInstance[]; potions: PotionInstance[]  // 最大2枠
  party: ExplorerState[]    // 3人: warrior, mage, cleric
  battleLevelUps: LevelUpInfo[]
  weaponBreakMultiplier: number   // 武器破壊時のダメージ倍率（必須）
  battleStartSnapshot: BattleStartSnapshot | null  // 戦闘中のみ有効。END_BATTLE で null
  stats: RunStats
}

/** 戦闘前スナップショット（リザルト画面の差分表示に使用。SaveManager では非永続化） */
interface BattleStartSnapshot { party: ExplorerState[]; gold: number }
interface RunStats { totalKillCount: number; totalGoldEarned: number; maxStageReached: number }
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
  | { type: 'weakness'; value: number; duration: number }

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
 * - 戦士の初期武器順序: [createPunch(), createWeaponInstance('rusty_knife')]
 * - 前衛/後衛は party 配列の先頭を前衛として PositionUtils.ts が提供する
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
  damage?: number; isAoe?: boolean
  chargeAllAllies?: boolean     // 全味方に力溜め付与
  summonEnemyId?: string        // 召喚する敵ID
  healSelf?: number; healAlly?: number
  applyWeakness?: boolean       // 弱体デバフ付与
  applySelfDefense?: boolean    // 自己防御バフ付与
}

interface BattleState {
  phase: BattlePhase; turn: number; turnLimit: number
  enemies: EnemyInstance[]
  commandSlots: CommandSlot[]       // 各探索者のコマンドスロット（行動順）
  activeExplorerIndex: number       // 現在コマンド入力中の探索者インデックス
  currentCommandIndex: number; currentEnemyIndex: number
  actionQueue: ActorId[]            // 後方互換として残置
  enemyIntents: EnemyIntent[]
  stolenGold: number
  selectedCommand: BattleCommand | null; selectedTargetId: string | null
  damagePopups: DamagePopup[]; playerDamagePopups: PlayerDamagePopup[]
  levelUpPopups: LevelUpPopup[]; expPopups: ExpPopup[]  // expPopups: EXP獲得アニメ用
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
export interface ShopSlot { category: StoreCategory; items: (WeaponData | SpellData | RelicData | PotionData | null)[] }
export interface ShopOption { slots: ShopSlot[] }
interface StoreState {
  shopOptions: [ShopOption, ShopOption]  // 2択の選択肢
  selectedShopIndex: number | null       // nullは未選択
  rerollCost: number                     // 初期値3G、リロールごとに1G増加
}
```

## セーブ/ロード

### セーブタイミング

**戦闘終了後のみ**保存する（戦闘勝利 → 報酬計算 → GameState更新 → localStorage保存 → ストア画面へ）。

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
  save(run: RunState): boolean   // battleStartSnapshot は非永続化（保存対象外）
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

19種の武器データ（オブジェクト辞書形式）。全武器に `variance` フィールドあり。

```
rusty_knife, short_sword, iron_sword, great_axe, greatsword, throwing_knife, whirlwind_blade,
vampiric_blade（lifesteal）, magic_bullet（scaleStat: int）, cursed_spear（hpCost）,
berserker_axe（goldCost）, golden_sword, jewel_staff（scaleStat: int）, disposable_blade,
glass_sword, rusty_greatsword（targetType: enemyAll）, soul_eater_sword（killPreserveDurability）,
guardian_shield（shield効果、targetType: allySingle）, prayer（targetRateUp）
```

（各武器の具体的な数値はバランス調整対象のため概要記載）

### Spells.json

16種の魔法データ（オブジェクト辞書形式）。全魔法に `variance` フィールドあり。

```
fire, firestorm, heal, ice_bolt, thunder, blizzard, barrier（shield）,
life_tap（hpToMp）, gold_hex（goldOnHit）, gold_burst（goldDamage）,
field_repair（repairWeapons）, weapon_enchant（weaponPowerBuff）, precision（buff: precision）,
master_bond（guidanceBuff）, education_bullet（killBonusExpToAll）, healing_wind（allyAll heal）
```

（各魔法の具体的な数値はバランス調整対象のため概要記載）

### Relics.json

24種のレリックデータ（オブジェクト辞書形式）。各レリックは `PassiveEffectType` に対応した `passiveEffect` を持つ。効果の詳細値はバランス調整対象のため概要記載。

スライス12追加分: battleStartHpReduction, damageTakenToMp, goldPerKill, weaponBreakDamageMultiplier, weaponBreakNextAttackBonus, fury_flame に対応するレリック群。

スライス13追加分: fighting_spirit_bracelet（levelUpDamageBoost）, shura_mark（battleEndBonusExp）, upset_strike（lowestLevelDamageMultiplier）, bully_strong（highHpTargetRateBonus）, substitute_doll（deathProtection）。

### Potions.json

3種のポーションデータ（`hp_potion`、`mp_potion`、`repair_potion`）。`targetType: 'allySingle'`。コマンド選択フェーズ中に `USE_POTION_INSTANT` で即時発動可能。効果値はバランス調整対象のため概要記載。

### Enemies.json

12種の敵データ（オブジェクト辞書形式）。全敵の `behavior` は `"attack"` に統一。行動の分岐は `EnemyAI.ts` で `enemy.id` ベースに実装される。

- normal（6種）: slime, goblin, sewer_rat, hedro_slime, shaman, fairy
- elite（5種）: orc, assassin, sleep_tiger, dark_mage, orc_lord
- boss（1種）: dragon

（各敵の具体的なステータス値はバランス調整対象のため概要記載）

### StagePatterns.json

`stage_1` 〜 `stage_7` の個別形式。各ステージに `turnLimit` と `patterns` フィールドあり。`pattern` キーはなし。`stage_4` はイベントステージ（`turnLimit: 0`、`patterns: []`）。turnLimit の具体的な値はバランス調整対象。新敵12種を含む拡張パターンに全面更新済み。

各 stage の pattern 数: stage 1=3, stage 2=4, stage 3=3, stage 4=0（イベント）, stage 5=4, stage 6=4, stage 7=1。

```json
{
  "stage_1": { "turnLimit": ..., "patterns": [ /* 3パターン */ ] },
  "stage_2": { "turnLimit": ..., "patterns": [ /* 4パターン */ ] },
  "stage_3": { "turnLimit": ..., "patterns": [ /* 3パターン */ ] },
  "stage_4": { "turnLimit": 0,  "patterns": [] },
  "stage_5": { "turnLimit": ..., "patterns": [ /* 4パターン */ ] },
  "stage_6": { "turnLimit": ..., "patterns": [ /* 4パターン */ ] },
  "stage_7": { "turnLimit": ..., "patterns": [ /* 1パターン: dragon */ ] }
}
```

## Reducerアクション概要

### GameReducer 主要アクション

| カテゴリ | アクション |
|---------|-----------|
| ゲーム制御 | START_GAME, CONTINUE_GAME, RETURN_TITLE, END_BATTLE |
| ストア | OPEN_STORE, CLOSE_STORE, SELECT_SHOP, BUY_WEAPON, BUY_SPELL, BUY_RELIC, BUY_POTION, SELL_WEAPON, SELL_SPELL, SELL_RELIC, REROLL_STORE |
| 購入取り消し | UNDO_BUY_WEAPON, UNDO_BUY_SPELL, UNDO_BUY_RELIC, UNDO_BUY_POTION |
| 売却取り消し | UNDO_SELL_WEAPON, UNDO_SELL_SPELL, UNDO_SELL_RELIC |
| ポーション売却 | SELL_POTION, UNDO_SELL_POTION |
| 装備移動 | TRANSFER_WEAPON, TRANSFER_SPELL（メンバー間装備移動） |
| パーティー管理 | REORDER_PARTY（パーティー並び替え。commandSlotsも連動） |
| ポーション即時発動 | USE_POTION_INSTANT（コマンド選択フェーズ中にポーションを即時発動。HP/MP回復・武器修理に対応） |
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

`createBattleState` と `generateEnemyIntents` の2つの主要関数を含む。AGI順ソート（`sortActorsByAgi`）は廃止済みで、`commandSlots` 配列順により行動順を管理する。`applyBloodPact` は血の契約レリック効果として戦闘開始時に探索者のHPを一定量減少させる処理を担う。

`createActionQueue` は生存メンバー全員と敵全員を対象とした Phase 2 拡張済み関数（export 化）。`REORDER_PARTY` 実行時は `actionQueue` も `createActionQueue` で再生成される。`createEnemyInstance` は仲間呼び用に export 済み。

### BattleActionProcessor

`processExecuteCommand`（コマンド実行処理）、`processEnemyAction`（敵行動処理）、`processTurnEndAction`（ターン終了処理）の3主要処理関数を持つ。

対応する SpellEffect: shield, hpToMp, goldOnHit, goldDamage, repairWeapons, weaponPowerBuff, **guidanceBuff**（次のトドメで+1ボーナスEXP）, **killBonusExpToAll**（トドメ時に全員へボーナスEXP）。

対応する PassiveEffectType: battleStartHpReduction, damageTakenToMp, goldPerKill, weaponBreakDamageMultiplier, weaponBreakNextAttackBonus, **levelUpDamageBoost**（レベルアップ時の次攻撃ダメージ倍率）, **battleEndBonusExp**（戦闘後全員ボーナスEXP＋ゴールドペナルティ）, **lowestLevelDamageMultiplier**（最低レベル者のダメージ倍率）, **highHpTargetRateBonus**（HP最大者の被弾率上昇）, **deathProtection**（致死ダメージでHP1耐え、1ラン1回消滅）。

対応する WeaponEffect: lifesteal, targetRateUp, conditionalPower, **shield**（守護の盾：被ダメ軽減シールド）, **killPreserveDurability**（魂喰いの剣：トドメで耐久消費なし）。

## バランス調整システム（Tuning Editor）

DEV専用のパラメータ調整ツール。React非依存の独立したHTMLページとして実装されており、ゲーム本体とはBroadcastChannelで通信する。

### アーキテクチャ概要

```
editor/                    ←  Tuning Editor UI（ブラウザの別タブで起動）
    EditorUI.ts            ←  スライダー/入力UIの描画、BroadcastChannel送信
    main.ts                ←  エントリーポイント

src/Lib/Tuning/            ←  ゲーム本体側の受信・参照レイヤー
    TuningReceiver.ts      ←  BroadcastChannel受信 → TuningStore更新
    TuningStore.ts         ←  現在のTuningConfigを保持
    TuningConfig.ts        ←  型定義
    TuningSchema.ts        ←  デフォルト値・バリデーション
    TuningSerializer.ts    ←  JSON変換

vite-plugins/
    tuning-save-plugin.ts  ←  保存リクエストをTuningData.jsonに書き出す
```

### データフロー

Tuning Editor UI → BroadcastChannel → TuningReceiver → TuningStore 更新 → ゲームロジックが `getTuningValue()` で参照。保存操作時は `tuning-save-plugin` が `TuningData.json` に書き出し、次回起動時に初期値として読み込む。

### TuningConfig型（6カテゴリ）

| カテゴリ | 概要 |
|---------|------|
| enemy | 敵HP・攻撃力などの倍率 |
| player | パーティーの基礎ステータス倍率 |
| reward | 報酬金額・利子率の調整値 |
| store | ストア価格・リロールコストの調整値 |
| levelup | レベルアップ時のHP/MP回復率など |
| battle | ターン制限・ダメージ計算の調整値 |

各カテゴリの具体的な数値はバランス調整対象のため概要記載。

### DEV専用について

Tuning Editor は開発時のみ使用するツールであり、本番ビルドには含まれない。`TuningData.json` のみが本番環境に反映される。

## 開発フェーズとの対応

| フェーズ | 実装対象 |
|---------|---------|
| **Phase 1: 戦闘ロジック** | `Lib/Types/`、`Lib/Core/DamageCalculator.ts`、`Lib/Core/CommandValidator.ts`、`Lib/State/BattleReducer.ts` |
| **Phase 2: ゲームループ** | `Lib/State/GameReducer.ts`、`Lib/Core/RewardCalculator.ts`、`Lib/Core/StoreLogic.ts`、`Lib/Storage/SaveManager.ts` |
| **Phase 3: データとUI** | `Lib/Data/*.json`、`Components/`、`Hooks/` |
| **Phase 4: バランス調整** | `Lib/Data/*.json`の数値調整 |
| **Phase 5: Tuning Editor** | `Lib/Tuning/`、`editor/`、`vite-plugins/`、各Core/Typesの`getTuningValue`統合 |

## 設計原則

本プロジェクトでは以下の原則に従う（[coding-style.md](../../.claude/rules/coding-style.md) 参照）。

1. **Immutability**: 状態は常に新しいオブジェクトを作成し、mutateしない
2. **単一責任の原則**: 各モジュール/関数は1つの責任のみを持つ
3. **ゲームロジックとUIの分離**: `Lib/`はReactに依存しない純粋な関数
4. **依存性逆転の原則**: 具象ではなくinterfaceに依存する
