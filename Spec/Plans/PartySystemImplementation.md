# パーティー制バトルシステム 実装計画

**対象デザインノート:** Spec/DesignNotes/PartySystemDesign.md
**作成日:** 2026-04-01
**方針:** 各フェーズ完了時にゲーム全体が動作し、プレイテスト可能な状態を維持する

---

## 現状のアーキテクチャ概要

```
現在: 1人のExplorer × クリックベースUI × AGI順行動
目標: 3人パーティー × ドラッグ&ドロップUI × プレイヤー決定順行動
```

### 主要な変更箇所

| レイヤー | 現状 | 目標 |
|---------|------|------|
| Types/Explorer.ts | 汎用ExplorerState, AGIあり | クラス別ステータス, 武器枠/魔法枠分離, AGI廃止 |
| Types/Battle.ts | ActorId（explorer+enemy混在）| パーティーフェーズ→敵フェーズの2フェーズ制 |
| State/BattleStateFactory.ts | AGI順でactionQueue生成 | プレイヤー決定順 |
| State/BattleActionProcessor.ts | party[0]前提の処理 | 任意のpartyメンバー対応 |
| Core/EnemyAI.ts | 単一プレイヤーへの攻撃 | 前衛/後衛の確率ターゲティング |
| Core/LevelUpCalculator.ts | 共通成長値 | クラス別成長値, 個別EXP管理 |
| Components/Battle/ | クリック選択UI | ドラッグ&ドロップUI |
| Components/Screens/StoreScreen.tsx | 1人分の装備管理 | 3人分の個別装備枠 |

---

## Phase 1: データモデル拡張 & パーティー初期化

**目標:** 型定義を拡張し、3人パーティーでゲームが起動する。バトルはまだ既存UIで party[0] のみ操作可能。

### 1-1. 型定義の拡張

**対象ファイル:** `src/Lib/Types/Explorer.ts`

```typescript
// 新規追加
export type CharacterClass = 'warrior' | 'mage' | 'cleric'
export type Position = 'front' | 'back'

// ExplorerState に追加するフィールド
interface ExplorerState {
  // 既存フィールドはすべて維持
  characterClass: CharacterClass    // 新規
  position: Position                // 新規
  weaponSlotCount: number           // 新規: 武器枠の上限
  magicSlotCount: number            // 新規: 魔法枠の上限
  killCount: number                 // 新規: 個別討伐数（EXP用）
  // agi は削除（行動順はプレイヤーが決定するため）
}
```

**AGI廃止の影響範囲:**
- `BattleStateFactory.ts`: `sortActorsByAgi()` → 不要になる（Phase 2で置換）
- `RelicProcessor.ts`: AGIボーナスレリック → 効果変更 or 削除
- `Types/Explorer.ts`: agi フィールド削除

### 1-2. パーティー初期化ファクトリ

**対象ファイル:** `src/Lib/Types/Explorer.ts`（`createInitialExplorer` を置換）

```
戦士: HP60, MP5,  STR7, INT3, 武器枠4(+パンチ), 魔法枠0
       初期装備: 錆びた剣(耐久3) + パンチ
魔法使い: HP30, MP25, STR3, INT7, 武器枠0(+魔力弾), 魔法枠4
       初期装備: ファイア(MP3) + 魔力弾
僧侶: HP40, MP15, STR4, INT5, 武器枠1(+祈り), 魔法枠3
       初期装備: ヒール + 精密 + 祈り
```

**新規ファイル:** `src/Lib/Data/Characters.json` — クラス別初期ステータスのマスターデータ

### 1-3. RunState の更新

**対象ファイル:** `src/Lib/Types/Run.ts`

`createInitialRun()` で `party: [warrior, mage, cleric]` の3人を生成。

### 1-4. 新規コマンドデータ

**対象ファイル:** `src/Lib/Data/Spells.json`, `src/Lib/Data/Weapons.json`

新規追加:
- **魔力弾** (武器): INT依存, Power1, ±2, 無制限使用 — 魔法使いの無限行動
- **祈り** (魔法): 味方対象, 被ターゲット率+25%, MP0, 無制限 — 僧侶の無限行動
- **精密** (魔法): 味方対象, 次の1攻撃のブレ幅→0, MP3

### 1-5. 後方互換の確保

Phase 1完了時点で既存のバトル/ショップが壊れないようにする:
- バトル: `party[0]`（戦士）のみが行動する既存フローを維持
- ショップ: `party[0]` の装備のみ表示
- PlayerStatus に3人分の簡易表示を追加（HP/MPバー）

### プレイテストポイント

- [x] ゲーム起動 → タイトル画面表示
- [x] ニューゲーム → バトル画面に3キャラのHP/MPが表示される
- [x] 戦士（party[0]）でバトルが通常通り進行する
- [x] ショップが正常に動作する
- [x] ビルドエラー・型エラーがない

---

## Phase 2: マルチキャラクターバトル（クリックベース）

**目標:** 3人全員がバトルに参加する。ターン構造を「コマンド選択→パーティー行動→敵行動」に変更。まだクリックベースUIで順番にコマンド入力。

### 2-1. ターン構造の変更

**対象ファイル:** `src/Lib/Types/Battle.ts`

```typescript
// BattleState の変更
interface BattleState {
  // 既存フィールドの変更
  phase: 'command' | 'partyAction' | 'enemyAction' | 'turnEnd'  // 新規
  commandSlots: CommandSlot[]    // 新規: 3人分のコマンドセット
  currentCommandIndex: number    // 新規: 現在実行中のスロット番号
  currentEnemyIndex: number      // 新規: 現在行動中の敵番号

  // actionQueue, currentActorIndex → 削除（AGI順不要）
}

interface CommandSlot {
  explorerId: string
  command: BattleCommand | null
  targetId: string | null
}
```

### 2-2. コマンド選択フェーズ

**対象ファイル:** `src/Lib/State/BattleReducer.ts`, `src/Hooks/UseBattle.tsx`

新しいフロー:
1. `phase: 'command'` — 1人ずつ順にコマンド+ターゲットを選択
2. 3人分セットしたら「実行」ボタン有効化
3. 「実行」押下 → `phase: 'partyAction'`

### 2-3. パーティー行動フェーズ

**対象ファイル:** `src/Lib/State/BattleActionProcessor.ts`

1. `commandSlots[0]` から順に実行
2. 各キャラのコマンドに対してダメージ計算・コスト消費
3. `currentCommandIndex` をインクリメント
4. 全員実行完了 → `phase: 'enemyAction'`

**重要:** `processExecuteCommand` の `party[0]` 前提を排除し、`explorerId` でパーティーメンバーを特定する。

### 2-4. 敵行動フェーズ

**対象ファイル:** `src/Lib/Core/EnemyAI.ts`, `src/Lib/State/BattleActionProcessor.ts`

1. 生存中の敵が順に行動
2. ターゲット: この時点ではランダム（Phase 3で前衛/後衛に拡張）
3. 全敵行動完了 → `phase: 'turnEnd'` → ターンインクリメント → `phase: 'command'`

### 2-5. 戦闘不能 & 全滅

**対象ファイル:** `src/Lib/Core/BattleEngine.ts`

```
HP0 → 戦闘不能（そのバトル中は行動不可）
  - コマンドスロットはグレーアウト
  - 行動済みコマンドもスキップ
バトル終了 → HP1で復活
全員HP0 → 全滅（ラン終了）
```

### 2-6. バトルUI更新

**対象ファイル:** `src/Components/Battle/BattleScreen.tsx` 他

- 3キャラのステータス表示（横並び）
- 「現在コマンド選択中のキャラ」をハイライト
- コマンドリストは選択中キャラの武器/魔法を表示
- 戦闘不能キャラはグレーアウト
- 「実行」ボタン追加（3人分セット完了で有効化）

### プレイテストポイント

- [x] 3人順番にコマンドを選択できる
- [x] 「実行」ボタンで3人が順に行動する
- [x] 敵が3人のうち誰かを攻撃する
- [x] HP0のキャラはスキップされる
- [x] 全滅でゲームオーバーになる
- [x] 勝利後、HP0キャラがHP1で復活している
- [x] ショップ→次バトルの遷移が正常

---

## Phase 3: 前衛/後衛 & ターゲティング

**目標:** 前衛/後衛の概念が機能し、ターゲティング確率が可視化される。

### 3-1. 前衛/後衛の被ターゲット率

**対象ファイル:** `src/Lib/Core/EnemyAI.ts`（新規関数追加）

```
基本: 前衛50%, 後衛A 25%, 後衛B 25%
祈り適用: 対象+25%, 残りを按分減少
  例: 戦士に祈り → 前衛75%, 後衛各12.5%
```

### 3-2. 祈りコマンドの実装

**対象ファイル:** `src/Lib/State/BattleActionProcessor.ts`

- 僧侶の無限行動: 味方1人を対象
- 対象の `被ターゲット率+25%` を次の敵フェーズに適用
- バフとして `BattleState` に保持（敵フェーズ終了時にクリア）

### 3-3. UI表示

**対象ファイル:** `src/Components/Battle/PlayerStatus.tsx`

- 各キャラの下に `被弾: 50%` / `被弾: 25%` の表示
- 祈りセット時にリアルタイム更新

### プレイテストポイント

- [x] 前衛（戦士）が後衛より多く攻撃される
- [x] 被ターゲット率がUI上で確認できる
- [x] 僧侶の祈りで被ターゲット率が変動する
- [x] 前衛が倒れた場合、残りのメンバーで確率が再分配される

---

## Phase 4: キャラ個別レベルアップ

**目標:** 敵撃破でキャラごとにEXPが蓄積し、クラス別の成長率でレベルアップする。

### 4-1. EXP配分ロジック

**対象ファイル:** `src/Lib/Core/LevelUpCalculator.ts`

```
敵討伐時:
  全員 → killCount+1
  止めを刺したキャラ → 追加で+1（合計+2）
レベルアップ判定: キャラごとの killCount >= 必要数
```

### 4-2. クラス別成長値

**対象ファイル:** `src/Lib/Core/LevelUpCalculator.ts`（`applyLevelUp` を修正）

```
         HP   MP   STR  INT
戦士:    +7   +1   +2   +0
魔法使い: +3   +4   +0   +2
僧侶:   +5   +3   +1   +1
```

レベルアップ効果: そのキャラのHP/MPを**全回復**。

### 4-3. UI: レベルアップ表示の更新

**対象ファイル:** `src/Components/Battle/LevelUpModal.tsx`, `ExpGauge.tsx`

- キャラ名と成長内容を表示
- 3人分のExpGaugeをそれぞれ表示

### プレイテストポイント

- [x] 敵を倒すと全員にEXP+1、止めキャラに追加+1
- [x] 戦士がレベルアップするとHP+7, STR+2
- [x] 魔法使いがレベルアップするとMP+4, INT+2
- [x] レベルアップでHP/MPが全回復する
- [x] 「誰に止めを刺させるか」が戦略的に機能する

---

## Phase 5: キルラインバー & ダメージプレビュー

**目標:** 敵HPバーに「確定ダメージ」「ブレ幅」が視覚的に表示され、コマンドセット後も常時プレビュー。

### 5-1. ダメージ予測計算

**対象ファイル:** `src/Lib/Utils/DamagePredictor.ts`（拡張）

```typescript
interface DamagePreview {
  minDamage: number    // 最低ダメージ（ブレ幅下限）
  maxDamage: number    // 最大ダメージ（ブレ幅上限）
}

// 全コマンドスロットの合計を返す
function calculateCumulativePreview(
  commandSlots: CommandSlot[],
  targetEnemyId: string,
  party: ExplorerState[],
  relics: RelicInstance[]
): DamagePreview
```

### 5-2. キルラインバーコンポーネント

**新規ファイル:** `src/Components/Battle/KillLineBar.tsx`

```
[■■■■■■■□□□□□░░░░░░░░]
 ←確定ダメ→←ブレ幅→←残HP→

■ = 最低ダメージで確実に削れる範囲
□ = 最大ダメージなら削れる範囲（運次第）
░ = 残りHP
```

常にそのEnemyの現在HPを100%幅として割合表示。

### 5-3. 精密スペルとの連携

精密バフ適用時: そのキャラの攻撃の `variance → 0`（最大ダメージ固定）
→ キルラインバーの ■ 部分が拡大し、□ 部分が消える（確殺可視化）

### 5-4. EnemyDisplay への統合

**対象ファイル:** `src/Components/Battle/EnemyDisplay.tsx`

- 既存のHPバーをKillLineBarで置換
- コマンドセットのたびにリアルタイム更新

### プレイテストポイント

- [x] 敵HPバーに確定ダメージ範囲とブレ幅が表示される
- [x] コマンドセットすると即座にプレビューが更新される
- [x] 複数キャラの攻撃が同一敵に集中すると累計ダメージが表示される
- [x] 精密バフでブレ幅が0になり、確殺判断がしやすい
- [x] HPの割合表示で直感的に「倒せるか」がわかる

---

## Phase 6: 敵リバランス & 行動予告

**目標:** 3人パーティー前提で敵のHP/攻撃力を調整。敵の次行動を事前表示。

### 6-1. 敵ステータス調整

**対象ファイル:** `src/Lib/Data/Enemies.json`

- 3人分の火力を受けるためHP上方調整
- 1人しか殴れないので攻撃力はやや下方調整（集中砲火のリスクを維持）
- 具体値はプレイテストで調整

### 6-2. 敵行動予告

**対象ファイル:** `src/Lib/Core/EnemyAI.ts`

ターン開始時に各敵の次の行動を決定し表示:
```
ゴブリン: 斬りつける(5)
オーク: 力溜め
```

**実装方法:** `BattleState` に `enemyIntents: EnemyIntent[]` を追加。コマンドフェーズ開始時に全敵のintentを決定。

### 6-3. 空振りメカニクス

**対象ファイル:** `src/Lib/State/BattleActionProcessor.ts`

攻撃対象が既に倒されている場合:
- 攻撃は空振り（ダメージなし）
- **武器耐久・MPは消費しない**（リソース管理として罰が重すぎるため）
- 失うのは「そのターンの1行動分のテンポ」のみ

### プレイテストポイント

- [x] 敵のHP/攻撃力が3人パーティーに適切
- [x] ターン開始時に敵の次行動が表示される
- [x] 敵行動予告を見て「誰を先に倒すか」「ヒールが必要か」を判断できる
- [x] 攻撃対象が先に倒された場合、空振りになり武器耐久/MPは消費されない
- [x] Stage 1のスライムが適度に手応えがある

---

## Phase 7: ドラッグ&ドロップ バトルUI

**目標:** クリックベースUIをD&Dに置換。3人同時コマンドセット + 行動順スロット。

### 7-1. D&Dフレームワーク

**新規依存:** `@dnd-kit/core` or React DnD（軽量な方を選定）

### 7-2. バトル画面レイアウト変更

**対象ファイル:** `src/Components/Battle/BattleScreen.tsx`（大幅リファクタ）

```
┌──────────────────────────────────────────────┐
│  [敵1]              [敵2]                     │  ← ドロップゾーン
│  [キルラインバー]    [キルラインバー]           │
├──────────────────────────────────────────────┤
│  行動順: [①] → [②] → [③]                    │  ← ドラッグで入れ替え
├──────────┬──────────┬──────────┬────────────┤
│  戦士     │  魔法使い │  僧侶    │ ポーション  │
│  HP/MP   │  HP/MP   │  HP/MP   │ レリック    │
│  武器リスト│  魔法リスト│  魔法リスト│            │  ← ドラッグ元
├──────────┴──────────┴──────────┴────────────┤
│                  [ 実行 ]                     │
└───────────────────────────────────────────────┘
```

### 7-3. コマンドD&D操作

**新規コンポーネント:**
- `DraggableCommand.tsx` — ドラッグ可能な武器/魔法アイコン
- `DroppableTarget.tsx` — 敵/味方のドロップゾーン
- `ActionOrderSlot.tsx` — 行動順スロット（ドラッグで入れ替え）

**操作フロー:**
1. キャラの武器/魔法を敵 or 味方にドラッグ&ドロップ → コマンドセット
2. セット済みコマンドはキャラ欄に「→対象」で常時表示
3. 行動順スロットにキャラ顔が入る（セット順、ドラッグで入れ替え可）
4. どのキャラからでも自由にセット/変更可能（順序制約なし）
5. ポーション → キャラにドロップで即使用（フリーアクション）
6. 3人分セットしたら「実行」

### 7-4. フォールバック

タッチデバイスでD&Dが困難な場合のフォールバック:
- タップ → コマンド選択 → タップ → ターゲット選択 のクリックモードも維持

### プレイテストポイント

- [x] 武器/魔法を敵にドラッグ&ドロップでコマンドセットできる
- [x] 行動順スロットが自動的に埋まる
- [x] 行動順スロットのドラッグで順番を入れ替えられる
- [x] コマンドの上書きが自然に動作する
- [x] ポーションのフリーアクションが正常
- [x] キルラインバーがセットと同時に更新される
- [x] スマホでも操作可能

---

## Phase 8: ショップUI刷新

**目標:** 3人分の個別装備枠にD&Dで購入/売却。

### 8-1. ショップ画面レイアウト

**対象ファイル:** `src/Components/Screens/StoreScreen.tsx`（大幅リファクタ）

```
┌──────────────────────────────────────────────┐
│  ショップ                    所持金: 25G → 17G │
├──────────────────────────────────────────────┤
│  武器/魔法              [リロール 3G]          │
│  [商品1] [商品2] [商品3] [商品4]               │  ← ドラッグ元
├──────────────────────────────────────────────┤
│  レリック        │  ポーション                  │
│  [商品A] [商品B] │  [HP薬] [MP薬]              │
├──────────┬──────────┬──────────┬────────────┤
│  戦士     │  魔法使い │  僧侶    │ ポーション  │
│  武器枠   │  魔法枠   │  魔法枠   │ レリック枠  │  ← ドロップ先
├──────────┴──────────┴──────────┴────────────┤
│              [確定] [店を出る]                  │
└───────────────────────────────────────────────┘
```

### 8-2. D&D購入/売却

- 商品 → キャラ枠にドロップ = 購入（所持金リアルタイムプレビュー）
- キャラ枠 → 商品エリアにドロップ = 売却
- ドラッグ時にドロップ不可枠をグレーアウト
- 複数商品を同時にセット → 「確定」で一括購入

### 8-3. 価格バランス調整

- 3人分の装備を賄うため価格を下方調整
- 戦闘報酬を上方調整
- 具体値はプレイテストで調整

### プレイテストポイント

- [x] 商品を正しいキャラ枠にドロップできる
- [x] 不正なドロップ先はグレーアウトされる
- [x] 所持金がリアルタイムで変動する
- [x] 売却が機能する
- [x] 確定 → 一括購入が動作する
- [x] 3人分の装備で金策が成り立つバランス

---

## Phase 9: イベント更新 & 最終調整

**目標:** ゲーム全体のフローがパーティー制に完全対応。

### 9-1. イベント更新

**対象ファイル:** `src/Lib/Core/EventLogic.ts`, `src/Components/Screens/EventScreen.tsx`

```
休憩:     全員のHPをMaxHPの50%回復
宝箱:     共有レリック1個獲得（変更なし）
武器修理:  1人を選択 → その1人の全武器の使用回数を全回復
```

修理で「誰を選ぶか」のUIを追加。

### 9-2. マウスオーバー情報

**対象ファイル:** 新規コンポーネント群

- キルラインバーホバー: バフ/レリック込みダメージ内訳
- 武器/魔法アイコンホバー: 素のステータス
- 攻撃実行時: 寄与度表示（バフ/レリックの貢献が見える）

### 9-3. 最終バランス調整

- 敵HP/攻撃力の微調整
- ゴールド報酬の調整
- ポーション価格の調整
- 各ステージのターン制限見直し
- 初期ゴールドの見直し

### 9-4. セーブデータ互換性

- 旧セーブデータは破棄して新規開始（バージョンフラグで判定）

### プレイテストポイント

- [x] 休憩で全員が回復する
- [x] 武器修理で1人を選択でき、その人の全武器が回復する
- [x] マウスオーバーでダメージ内訳が見える
- [x] Stage 1〜7を通しでプレイできる
- [x] リソース管理（HP/MP/武器耐久/ゴールド）がゲーム全体を通じて機能する
- [x] 「確実性を買う」コアメカニクスが体感できる

---

## 実装順序の依存関係

```
Phase 1 (データモデル)
  ↓
Phase 2 (マルチキャラバトル)
  ↓
Phase 3 (ターゲティング) ← Phase 4 (個別レベルアップ) ※並行可能
  ↓                        ↓
Phase 5 (キルラインバー)
  ↓
Phase 6 (敵リバランス)
  ↓
Phase 7 (D&DバトルUI) ← Phase 8 (D&DショップUI) ※並行可能
  ↓                      ↓
Phase 9 (イベント & 最終調整)
```

**並行可能なペア:**
- Phase 3 + Phase 4: ターゲティングとレベルアップは独立
- Phase 7 + Phase 8: バトルUIとショップUIは独立

---

## リスクと対策

| リスク | 影響 | 対策 |
|-------|------|------|
| D&Dライブラリのスマホ対応 | タッチ操作が困難 | クリックフォールバック維持。ライブラリ選定時にタッチ対応を検証 |
| 3人分のUI表示がスマホ画面に収まらない | UX悪化 | レスポンシブレイアウト。スマホではタブ切り替えも検討 |
| バトルテンポの低下 | 退屈に感じる | 敵フェーズのアニメーション速度調整。同時行動表示 |
| セーブデータの非互換 | 既存セーブが壊れる | Phase 1でバージョンフラグ導入、旧データは自動クリア |
| 既存レリック/武器の調整漏れ | バランス崩壊 | Phase 6で全レリック/武器の効果を棚卸し |

---

## 各Phase の目安ファイル影響範囲

| Phase | 新規ファイル | 変更ファイル | 削除/大幅書換 |
|-------|-----------|-----------|-------------|
| 1 | Characters.json | Explorer.ts, Run.ts, PlayerStatus.tsx | - |
| 2 | - | Battle.ts, BattleReducer.ts, BattleActionProcessor.ts, BattleStateFactory.ts, BattleScreen.tsx, UseBattle.tsx, BattleEngine.ts | actionQueue系ロジック |
| 3 | TargetingSystem.ts | EnemyAI.ts, BattleActionProcessor.ts, PlayerStatus.tsx | - |
| 4 | - | LevelUpCalculator.ts, BattleActionProcessor.ts, LevelUpModal.tsx, ExpGauge.tsx | - |
| 5 | KillLineBar.tsx | DamagePredictor.ts, EnemyDisplay.tsx | - |
| 6 | - | Enemies.json, EnemyAI.ts, BattleActionProcessor.ts | - |
| 7 | DraggableCommand.tsx, DroppableTarget.tsx, ActionOrderSlot.tsx | BattleScreen.tsx（大幅） | CommandList.tsx, TargetSelector.tsx（D&Dに置換） |
| 8 | - | StoreScreen.tsx（大幅）, StoreShopPanel.tsx, UseGame.tsx | - |
| 9 | - | EventLogic.ts, EventScreen.tsx, 各種バランス値 | - |
