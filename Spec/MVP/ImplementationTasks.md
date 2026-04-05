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
| 1.1 | 基本型定義 | Game.ts, Run.ts, Explorer.ts | ✅ 完了 |
| 1.2 | GameReducer | START_GAME, RETURN_TITLEアクション | ✅ 完了 |
| 1.3 | GameProvider + useGame | Context設定 | ✅ 完了 |
| 1.4 | 共通UI: Button | 汎用ボタンコンポーネント | ✅ 完了 |
| 1.5 | TitleScreen | Start/Continue表示 | ✅ 完了 |
| 1.6 | App.tsx | 画面切り替えロジック | ✅ 完了 |

---

## スライス2: 戦闘画面の基本表示
**動作確認**: 戦闘画面に敵とプレイヤーのステータスが表示される

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 2.1 | 型定義追加 | Enemy.ts, Battle.ts, Weapon.ts, Item.ts | ✅ 完了 |
| 2.2 | マスターデータ | Enemies.json, Weapons.json, StagePatterns.json | ✅ 完了 |
| 2.3 | 初期状態生成 | createBattleState, createInitialExplorer | ✅ 完了 |
| 2.4 | 共通UI | ResourceBar, BuffIcon | ✅ 完了 |
| 2.5 | 戦闘UI | PlayerStatus, EnemyDisplay, TurnIndicator | ✅ 完了 |
| 2.6 | BattleScreen | 基本表示のみ | ✅ 完了 |

---

## スライス3: 戦闘コマンド実行
**動作確認**: 武器/魔法を選択して敵にダメージを与えられる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 3.1 | 型定義追加 | Spell.ts, Potion.ts, Command.ts, Consumable.ts | ✅ 完了 |
| 3.2 | マスターデータ | Spells.json, Potions.json | ✅ 完了 |
| 3.3 | DamageCalculator | ダメージ計算式 | ✅ 完了 |
| 3.4 | CommandValidator | コマンド使用可否判定 | ✅ 完了 |
| 3.5 | 行動順管理 | BattleStateFactory.ts 内の createBattleState / generateEnemyIntents として実装。AGI順ソートは廃止。commandSlots 配列順で行動順管理し、REORDER_COMMAND_SLOTS で並べ替え可能 | ✅ 完了 |
| 3.6 | BattleReducer | 戦闘状態遷移 | ✅ 完了 |
| 3.7 | useBattle Hook | 戦闘画面用Hook | ✅ 完了 |
| 3.8 | 戦闘UI | CommandList, TargetSelector, DamagePopup | ✅ 完了 |
| 3.9 | BattleScreen更新 | コマンド実行対応 | ✅ 完了 |

---

## スライス4: 敵AIと戦闘終了
**動作確認**: 敵が行動し、勝利/敗北で結果画面に遷移する

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 4.1 | BattleEngine | 敵AI、ターン進行、勝敗判定 | ✅ 完了 |
| 4.2 | バフ/デバフ処理 | 毒スタック、力溜め | ✅ 完了 |
| 4.3 | ResultScreen | 勝敗表示、スタッツ表示 | ✅ 完了 |
| 4.4 | GameReducer更新 | END_BATTLEアクション | ✅ 完了 |

---

## スライス5: 報酬とレベルアップ
**動作確認**: 戦闘勝利後にゴールド・経験値を獲得、レベルアップする

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 5.1 | RewardCalculator | BaseGold、利子計算、貯金箱レリック対応 | ✅ 完了 |
| 5.2 | LevelUpCalculator | 必要討伐数、レベルアップ効果 | ✅ 完了 |
| 5.3 | 報酬画面統合 | 報酬表示、レベルアップ演出 | ✅ 完了 |

---

## スライス6: ストア画面
**動作確認**: ストアで商品の購入・売却・リロールができる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 6.1 | 型定義追加 | Relic.ts, Purchasable.ts, Passive.ts | ✅ 完了 |
| 6.2 | マスターデータ | Relics.json | ✅ 完了 |
| 6.3 | StoreLogic | 商品抽選、売買、売却価格 | ✅ 完了 |
| 6.4 | 共通UI: ItemCard | アイテム情報表示 | ✅ 完了 |
| 6.5 | StoreScreen | 商品表示、売買UI | ✅ 完了 |
| 6.6 | GameReducer更新 | OPEN_STORE, CLOSE_STORE | ✅ 完了 |

---

## スライス7: イベント画面（Stage4）
**動作確認**: 休憩/宝箱/武器修理を選択して効果が適用される

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 7.1 | StageManager | isEventStage判定 | ✅ 完了 |
| 7.2 | EventScreen | 3つの選択肢UI | ✅ 完了 |
| 7.3 | GameReducer更新 | OPEN_EVENT, SELECT_EVENT | ✅ 完了 |

---

## スライス8: セーブ/ロード + 仕上げ
**動作確認**: 中断後に再開できる、ゲーム全体を通しプレイできる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 8.1 | SaveManager | localStorage操作 | ✅ 完了 |
| 8.2 | TitleScreen更新 | Continueボタン対応 | ✅ 完了 |
| 8.3 | 全体結合テスト | 通しプレイ確認、バグ修正 | ✅ 完了 |

---

## スライス9: パーティー制実装
**動作確認**: 3人パーティーでコマンドスロット制のバトルが動作する

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 9.1 | CharacterClass/Position型 | Explorer.ts に追加 | ✅ 完了 |
| 9.2 | CommandSlot制 | Battle.ts に CommandSlot 型追加、行動順管理 | ✅ 完了 |
| 9.3 | createInitialParty | 3人パーティー生成関数 | ✅ 完了 |
| 9.4 | D&Dターゲティング | ドラッグ&ドロップによるターゲット選択UI | ✅ 完了 |
| 9.5 | 行動順並べ替え | REORDER_COMMAND_SLOTS アクション | ✅ 完了 |
| 9.6 | メンバー間装備移動 | TRANSFER_WEAPON/SPELL アクション | ✅ 完了 |
| 9.7 | UNDO系アクション | 購入・売却取り消し | ✅ 完了 |
| 9.8 | ダメージ寄与者表示 | DamageContributor 型と表示UI | ✅ 完了 |
| 9.9 | 敵行動予告 | EnemyIntent 型と表示UI | ✅ 完了 |
| 9.10 | パーティー内EXP分配 | 戦闘終了時の経験値配布 | ✅ 完了 |

---

## 進捗サマリー

| スライス | 完了タスク | 総タスク | 進捗 |
|---------|-----------|---------|------|
| 1: タイトル画面 | 6 | 6 | 100% |
| 2: 戦闘基本表示 | 6 | 6 | 100% |
| 3: コマンド実行 | 9 | 9 | 100% |
| 4: 敵AIと終了 | 4 | 4 | 100% |
| 5: 報酬とレベル | 3 | 3 | 100% |
| 6: ストア画面 | 6 | 6 | 100% |
| 7: イベント画面 | 3 | 3 | 100% |
| 8: セーブ/仕上げ | 3 | 3 | 100% |
| 9: パーティー制 | 10 | 10 | 100% |
| **合計** | **50** | **50** | **100%** |

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
│   │   ├── BattleEngine.ts
│   │   ├── StageManager.ts
│   │   ├── RewardCalculator.ts
│   │   ├── LevelUpCalculator.ts
│   │   ├── StoreLogic.ts
│   │   ├── EnemyAI.ts
│   │   ├── BuffProcessor.ts
│   │   ├── EventLogic.ts
│   │   ├── MapGenerator.ts
│   │   ├── RelicProcessor.ts
│   │   └── index.ts
│   ├── State/           # 状態管理
│   │   ├── BattleReducer.ts
│   │   ├── GameReducer.ts
│   │   ├── BattleActionProcessor.ts
│   │   ├── BattleStateFactory.ts    # createBattleState, generateEnemyIntents を含む
│   │   └── index.ts
│   ├── Utils/           # ユーティリティ
│   │   ├── ItemDescription.ts
│   │   └── DamagePredictor.ts
│   ├── Data/            # マスターデータ
│   │   ├── Weapons.json
│   │   ├── Spells.json
│   │   ├── Relics.json
│   │   ├── Potions.json
│   │   ├── Enemies.json
│   │   └── StagePatterns.json
│   └── Storage/         # 永続化
│       ├── SaveManager.ts
│       └── index.ts              # 追加済み
├── Hooks/               # React Hooks
│   ├── UseGame.tsx
│   ├── UseBattle.tsx
│   └── index.ts
├── Components/
│   ├── Common/          # 共通UI部品
│   │   ├── Button.tsx
│   │   ├── ResourceBar.tsx
│   │   ├── BuffIcon.tsx
│   │   ├── ItemCard.tsx
│   │   ├── MapContent.tsx
│   │   └── index.ts
│   ├── Battle/          # 戦闘UI部品
│   │   ├── BattleScreen.tsx
│   │   ├── PlayerStatus.tsx
│   │   ├── EnemyDisplay.tsx
│   │   ├── CommandList.tsx
│   │   ├── TurnIndicator.tsx
│   │   ├── DamagePopup.tsx
│   │   ├── TargetSelector.tsx
│   │   ├── LevelUpModal.tsx
│   │   ├── ExpGauge.tsx
│   │   └── index.ts
│   ├── Store/           # ストアUI部品
│   │   ├── MapOverlay.tsx
│   │   ├── StoreCommandPanel.tsx
│   │   └── StoreShopPanel.tsx
│   └── Screens/         # 画面コンポーネント
│       ├── TitleScreen.tsx
│       ├── StoreScreen.tsx
│       ├── EventScreen.tsx
│       ├── ResultScreen.tsx
│       ├── MapScreen.tsx
│       └── index.ts
└── App.tsx              # エントリーポイント
```
