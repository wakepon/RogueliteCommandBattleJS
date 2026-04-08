# 仕様書 (Spec)

ゲームの設計・仕様ドキュメント群。コードが正（Source of Truth）であり、仕様書はコードの現状を反映する。

## ディレクトリ構成

```
Spec/
├── Overview/           # ゲーム全体の設計方針・概要
├── MVP/                # MVP実装の詳細仕様
├── Architecture/       # システム設計・アーキテクチャ
├── Plan/               # 実装計画・デザイン検討
└── DesignNotes/        # ゲームデザイン分析メモ
```

## 更新履歴

### 2026-04-08: 敵パターン拡張・バグ修正・UI統合の反映

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (6ファイル更新):
- `Overview/BattleOverview.md` — 弱体(weakness)デバフ・自己防御バフ追加、storedActionによるインテント一致保証を追記、ゴブリン所持金3Gに修正
- `Overview/EnemyOverview.md` — 実装済み敵を4種→12種に拡張（新敵8体の行動パターン追加）、行動バリエーション拡張（召喚・AoE・回復・デバフ等）、既存敵の行動名修正、ドラゴンのフェーズ行動を全面更新
- `MVP/EnemyCharacter.md` — 新敵8体のステータス・行動パターン追加、ステージ編成テーブル全面更新（Stage 1〜6）、新行動カテゴリ概要テーブル追加
- `MVP/BattleSystem.md` — 弱体デバフ・自己防御バフを持続ターン表に追加、バフ/デバフ処理タイミングをturnEndフェーズに修正
- `MVP/GameFlow.md` — Stage 1〜6の敵構成を新編成に更新
- `MVP/StoreItem.md` — マッスルアップ（未実装）を魔法テーブルから削除

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — EnemyEffectProcessor.ts追加、型定義全面更新（EnemyIntent.storedAction、Debuff union型、DamageContributor、LevelUpPopup、MapNode/MapState、EnemyActionResult拡張フィールド等）、Enemies.json 12種・StagePatterns.json拡張、GameReducer/BattleReducerアクション一覧更新
- `MVP/MVPScope.md` — 敵AI機能範囲を拡張（召喚・AoE・回復・デバフ等）
- `MVP/DevelopmentRoadmap.md` — 敵データ数12種に修正、フェーズ4に敵パターン拡張・EnemyEffectProcessor等を追記
- `MVP/ImplementationTasks.md` — REORDER_PARTY修正、スライス10（敵パターン拡張）追加

**UI チーム** (1ファイル更新):
- `MVP/UIUXDesign.md` — ActionOrderSlots→CharacterPanel統合に修正、TargetSelector統合ナビゲーション追記、LevelUpModalキュー形式・フェーズ一時停止追記、コマンドカテゴリ拡張（祈/回）、弱体デバフバッジ追記

### 2026-04-06: パーティー制・敵行動刷新・UI全面更新の反映

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (8ファイル更新):
- `Overview/BattleOverview.md` — 3人パーティー制（戦士・魔法使い・僧侶）に全面更新、4フェーズ制（command→partyAction→enemyAction→turnEnd）追加、新武器（魔力弾・祈り）・新魔法（精密）追加、ターゲティングシステム（前衛/後衛）追加、敵行動予告（Intent）追加、毒を実質未発動に修正
- `Overview/EnemyOverview.md` — 全敵の行動パターンを刷新（無行動・弱攻撃・毒を削除）、ステータス値を修正（HP・所持金等）、ターゲット選択を前衛/後衛の重み付き確率に修正
- `Overview/StoreOverview.md` — 枠数を武器/魔法4・レリック2・ポーション2（計8枠）に修正、ポーションtargetType追記
- `MVP/BattleSystem.md` — 行動順をAgi順から4フェーズ制に修正、クラス別成長値テーブル追加、精密バフ・被ターゲット率UPバフ追加、経験値配分を「全員+1・止め刺し+1」に修正、俊足のブーツをSTRに修正
- `MVP/EnemyCharacter.md` — 全敵のHP/ATK/所持金・行動パターンを正確な値に更新
- `MVP/GameFlow.md` — レベルアップ効果をクラス別成長値＋全回復に修正
- `MVP/StoreItem.md` — 陳列数を8枠に修正、魔力弾・祈り・精密を追加、レリックレアリティ複数修正
- `MVP/PlayerStatus.md` — 3クラス制に全面改定、Agi削除、クラス別所持枠・初期装備テーブル追加

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — パーティー制の型定義全面更新（CharacterClass/Position/CommandSlot/BattlePhase等）、StoreState分離、SaveManager v2、Reducerアクション概要追加、sortActorsByAgi削除
- `MVP/MVPScope.md` — 3人パーティー制実装済みに修正、敵AIから毒削除、Post-MVPから複数ユニット項目削除
- `MVP/DevelopmentRoadmap.md` — 武器10種・魔法7種に修正、パーティー制導入フェーズ追加
- `MVP/ImplementationTasks.md` — commandSlots管理に修正、パーティー制実装スライス追加

**UI チーム** (3ファイル更新):
- `MVP/UIUXDesign.md` — D&Dコマンドセット・ActionOrderSlots・KillLineBar・EnemyIntent・被弾率表示・ダメージ寄与者表示・TooltipCard追加、ストア画面D&D全面刷新・Undo機能・ダメージ予測追加、レイアウトを4等分グリッドに修正
- `Overview/DungeonExploreOverview.md` — 武器修理をキャラクター単位選択方式に修正
- `Overview/PartyAndUnitOverview.md` — 初期パーティーを3人構成に修正、各クラスのPosition・スロット数・初期装備を記載

### 2026-03-31: Next/Next+枠の追加反映

- `MVP/UIUXDesign.md` — 「次ステージプレビュー（Next/Next+枠）」セクションを追加。敵エリア右上にNextとNext+の情報表示仕様を記載

### 2026-03-30: 全仕様書の初回一括更新

コードの現状に合わせて全仕様書を更新。3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (9ファイル更新):
- `Overview/BattleOverview.md` — ダメージ計算式を加算ブレ方式に修正、バフ/デバフを実装済みのみに整理、討伐ターンをStage別固定値に修正、報酬・経験値の未実装要素を削除
- `Overview/EnemyOverview.md` — 実装済み敵4種（スライム・ゴブリン・オーク・ドラゴン）を追記、確率テーブル方式を追記、次の行動予告表示を削除
- `Overview/StoreOverview.md` — 実装済みレリック15種追記、ポーション2種に修正、ストア枠・リロールコストを修正
- `MVP/BattleSystem.md` — ブレ補正を加算方式に修正、レリック効果テーブルに12種追加、毒ダメージを固定値に修正、戦闘状態管理セクション追加
- `MVP/EnemyCharacter.md` — ゴースト削除・ゴブリン追加、キメラ→ドラゴンに全面更新、全敵の数値・行動パターンを実装に合わせて修正
- `MVP/GameFlow.md` — マップ画面追加、各ステージの敵構成とturnLimitを追記
- `MVP/StoreItem.md` — 武器・魔法・レリックテーブルを実装済みデータに全面更新、variance列追加、リロール・抽選方式を修正
- `MVP/PlayerStatus.md` — 魔法枠4→2に修正、パンチを1枠占有に修正

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — フォルダ構造を実ファイルに合わせて全面更新、型定義の追加フィールド反映、画面遷移フローにmapフェーズ追加、JSONサンプルデータを最新に更新
- `MVP/MVPScope.md` — 敵AIの説明を確率テーブル・行動バリエーション方式に更新
- `MVP/DevelopmentRoadmap.md` — データ量を実際の値（武器8種、魔法6種、レリック15種、ポーション2種、敵4種）に更新
- `MVP/ImplementationTasks.md` — ファイル一覧を実構造に合わせて更新

**UI チーム** (3ファイル更新):
- `MVP/UIUXDesign.md` — ゲームフェーズ一覧追加、タイトル/マップ/イベント/結果画面セクション追加、EXPゲージ・ダメージ予測・ツールチップ・キーボード操作追加、ストアUIを2カラム構成に修正、リソースアラートの赤表示を削除しグレーアウトに統一
- `Overview/DungeonExploreOverview.md` — 全7ステージ直線進行に修正、イベントステージ・マップ画面追記、難易度システムをMVP未実装と明記
- `Overview/PartyAndUnitOverview.md` — 初期パーティの魔法枠説明を修正
