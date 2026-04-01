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
