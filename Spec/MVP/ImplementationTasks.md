# 実装タスク一覧（縦スライスアプローチ）

## 概要
- 技術スタック: React + TypeScript + Tailwind CSS + Vite
- 状態管理: useReducer + Context
- アプローチ: 縦スライス（機能単位で全レイヤーを実装し、画面で動作確認）

---

## 縦スライスアプローチとは

```
従来のアプローチ（横スライス）:
┌─────────────────────────────────────┐
│ 1. 全ての型定義                      │ ← 画面なし
├─────────────────────────────────────┤
│ 2. 全てのロジック                    │ ← 画面なし
├─────────────────────────────────────┤
│ 3. 全てのUI                          │ ← やっと動作確認
└─────────────────────────────────────┘

縦スライスアプローチ:
┌─────────┬─────────┬─────────┬─────────┐
│ タイトル │ 戦闘    │ ストア  │ イベント │
│ 画面    │ 画面    │ 画面    │ 画面    │
│ ─────── │ ─────── │ ─────── │ ─────── │
│ 型      │ 型      │ 型      │ 型      │
│ ロジック │ ロジック │ ロジック │ ロジック │
│ UI      │ UI      │ UI      │ UI      │
│ ↓確認   │ ↓確認   │ ↓確認   │ ↓確認   │
└─────────┴─────────┴─────────┴─────────┘
```

各スライス完了後に画面で動作確認できる。

---

## スライス1: タイトル画面 + 基盤構築
**動作確認**: タイトル画面が表示され、Startボタンが押せる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 1.1 | 基本型定義 | Game.ts, Run.ts, Explorer.ts | ⬜ 未着手 |
| 1.2 | GameReducer | START_GAME, RETURN_TITLEアクション | ⬜ 未着手 |
| 1.3 | GameProvider + useGame | Context設定 | ⬜ 未着手 |
| 1.4 | 共通UI: Button | 汎用ボタンコンポーネント | ⬜ 未着手 |
| 1.5 | TitleScreen | Start/Continue表示 | ⬜ 未着手 |
| 1.6 | App.tsx | 画面切り替えロジック | ⬜ 未着手 |

---

## スライス2: 戦闘画面の基本表示
**動作確認**: 戦闘画面に敵とプレイヤーのステータスが表示される

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 2.1 | 型定義追加 | Enemy.ts, Battle.ts, Weapon.ts, Item.ts | ⬜ 未着手 |
| 2.2 | マスターデータ | Enemies.json, Weapons.json, StagePatterns.json | ⬜ 未着手 |
| 2.3 | 初期状態生成 | createBattleState, createInitialExplorer | ⬜ 未着手 |
| 2.4 | 共通UI | ResourceBar, BuffIcon | ⬜ 未着手 |
| 2.5 | 戦闘UI | PlayerStatus, EnemyDisplay, TurnIndicator | ⬜ 未着手 |
| 2.6 | BattleScreen | 基本表示のみ | ⬜ 未着手 |

---

## スライス3: 戦闘コマンド実行
**動作確認**: 武器/魔法を選択して敵にダメージを与えられる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 3.1 | 型定義追加 | Spell.ts, Potion.ts, Command.ts, Consumable.ts | ⬜ 未着手 |
| 3.2 | マスターデータ | Spells.json, Potions.json | ⬜ 未着手 |
| 3.3 | DamageCalculator | ダメージ計算式 | ⬜ 未着手 |
| 3.4 | CommandValidator | コマンド使用可否判定 | ⬜ 未着手 |
| 3.5 | TurnOrder | 行動順計算 | ⬜ 未着手 |
| 3.6 | BattleReducer | 戦闘状態遷移 | ⬜ 未着手 |
| 3.7 | useBattle Hook | 戦闘画面用Hook | ⬜ 未着手 |
| 3.8 | 戦闘UI | CommandList, TargetSelector, DamagePopup | ⬜ 未着手 |
| 3.9 | BattleScreen更新 | コマンド実行対応 | ⬜ 未着手 |

---

## スライス4: 敵AIと戦闘終了
**動作確認**: 敵が行動し、勝利/敗北で結果画面に遷移する

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 4.1 | BattleEngine | 敵AI、ターン進行、勝敗判定 | ⬜ 未着手 |
| 4.2 | バフ/デバフ処理 | 毒スタック、力溜め | ⬜ 未着手 |
| 4.3 | ResultScreen | 勝敗表示、スタッツ表示 | ⬜ 未着手 |
| 4.4 | GameReducer更新 | END_BATTLEアクション | ⬜ 未着手 |

---

## スライス5: 報酬とレベルアップ
**動作確認**: 戦闘勝利後にゴールド・経験値を獲得、レベルアップする

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 5.1 | RewardCalculator | BaseGold、利子計算 | ⬜ 未着手 |
| 5.2 | LevelUpCalculator | 必要討伐数、レベルアップ効果 | ⬜ 未着手 |
| 5.3 | 報酬画面統合 | 報酬表示、レベルアップ演出 | ⬜ 未着手 |

---

## スライス6: ストア画面
**動作確認**: ストアで商品の購入・売却・リロールができる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 6.1 | 型定義追加 | Relic.ts, Purchasable.ts, Passive.ts | ⬜ 未着手 |
| 6.2 | マスターデータ | Relics.json | ⬜ 未着手 |
| 6.3 | StoreLogic | 商品抽選、売買、売却価格 | ⬜ 未着手 |
| 6.4 | 共通UI: ItemCard | アイテム情報表示 | ⬜ 未着手 |
| 6.5 | StoreScreen | 商品表示、売買UI | ⬜ 未着手 |
| 6.6 | GameReducer更新 | OPEN_STORE, CLOSE_STORE | ⬜ 未着手 |

---

## スライス7: イベント画面（Stage4）
**動作確認**: 休憩/宝箱/武器修理を選択して効果が適用される

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 7.1 | StageManager | isEventStage判定 | ⬜ 未着手 |
| 7.2 | EventScreen | 3つの選択肢UI | ⬜ 未着手 |
| 7.3 | GameReducer更新 | OPEN_EVENT, SELECT_EVENT | ⬜ 未着手 |

---

## スライス8: セーブ/ロード + 仕上げ
**動作確認**: 中断後に再開できる、ゲーム全体を通しプレイできる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 8.1 | SaveManager | localStorage操作 | ⬜ 未着手 |
| 8.2 | TitleScreen更新 | Continueボタン対応 | ⬜ 未着手 |
| 8.3 | 全体結合テスト | 通しプレイ確認、バグ修正 | ⬜ 未着手 |

---

## 進捗サマリー

| スライス | 完了タスク | 総タスク | 進捗 |
|---------|-----------|---------|------|
| 1: タイトル画面 | 0 | 6 | 0% |
| 2: 戦闘基本表示 | 0 | 6 | 0% |
| 3: コマンド実行 | 0 | 9 | 0% |
| 4: 敵AIと終了 | 0 | 4 | 0% |
| 5: 報酬とレベル | 0 | 3 | 0% |
| 6: ストア画面 | 0 | 6 | 0% |
| 7: イベント画面 | 0 | 3 | 0% |
| 8: セーブ/仕上げ | 0 | 3 | 0% |
| **合計** | **0** | **40** | **0%** |

---

## 各スライスの実装フロー

```
1. 必要な型定義を追加
2. 必要なロジックを実装
3. 必要なUIコンポーネントを実装
4. 画面に統合
5. ビルド確認（npx tsc --noEmit）
6. 画面で動作確認（npm run dev）
7. 問題があれば修正
8. 次のスライスへ
```

---

## 検証方法

各スライス完了後:
1. `npx tsc --noEmit` でビルドエラーがないことを確認
2. `npm run dev` で開発サーバーを起動
3. ブラウザで該当機能を動作確認
4. 問題があればその場で修正

---

## 作成するファイル一覧

```
src/
├── Lib/
│   ├── Types/           # 型定義
│   │   ├── Item.ts
│   │   ├── Purchasable.ts
│   │   ├── Command.ts
│   │   ├── Consumable.ts
│   │   ├── Passive.ts
│   │   ├── Weapon.ts
│   │   ├── Spell.ts
│   │   ├── Relic.ts
│   │   ├── Potion.ts
│   │   ├── Explorer.ts
│   │   ├── Enemy.ts
│   │   ├── Battle.ts
│   │   ├── Run.ts
│   │   ├── Game.ts
│   │   └── index.ts
│   ├── Core/            # コアロジック
│   │   ├── DamageCalculator.ts
│   │   ├── CommandValidator.ts
│   │   ├── TurnOrder.ts
│   │   ├── BattleEngine.ts
│   │   ├── InitialState.ts
│   │   ├── StageManager.ts
│   │   ├── RewardCalculator.ts
│   │   ├── LevelUpCalculator.ts
│   │   ├── StoreLogic.ts
│   │   └── index.ts
│   ├── State/           # 状態管理
│   │   ├── BattleReducer.ts
│   │   ├── GameReducer.ts
│   │   └── index.ts
│   └── Storage/         # 永続化
│       ├── SaveManager.ts
│       └── index.ts
├── Hooks/               # React Hooks
│   ├── UseGame.tsx
│   ├── UseBattle.ts
│   └── index.ts
├── Components/
│   ├── Common/          # 共通UI部品
│   │   ├── Button.tsx
│   │   ├── ResourceBar.tsx
│   │   ├── BuffIcon.tsx
│   │   ├── ItemCard.tsx
│   │   └── index.ts
│   ├── Battle/          # 戦闘UI部品
│   │   ├── PlayerStatus.tsx
│   │   ├── EnemyDisplay.tsx
│   │   ├── CommandList.tsx
│   │   ├── TurnIndicator.tsx
│   │   ├── DamagePopup.tsx
│   │   ├── TargetSelector.tsx
│   │   └── index.ts
│   └── Screens/         # 画面コンポーネント
│       ├── TitleScreen.tsx
│       ├── BattleScreen.tsx
│       ├── StoreScreen.tsx
│       ├── EventScreen.tsx
│       ├── ResultScreen.tsx
│       └── index.ts
├── Data/                # マスターデータ
│   ├── Weapons.json
│   ├── Spells.json
│   ├── Relics.json
│   ├── Potions.json
│   ├── Enemies.json
│   └── StagePatterns.json
└── App.tsx              # エントリーポイント
```
