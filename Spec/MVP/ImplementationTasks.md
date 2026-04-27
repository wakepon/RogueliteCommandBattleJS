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
| 3.5 | 行動順管理 | BattleStateFactory.ts 内の createBattleState / generateEnemyIntents として実装。AGI順ソートは廃止。commandSlots 配列順で行動順管理し、REORDER_PARTY (GameReducer) でパーティー並び替え可能。commandSlotsも連動。createActionQueue は生存メンバー全員と敵全員を対象とした Phase 2 拡張済み（export 化）。REORDER_PARTY 時に actionQueue も再生成される | ✅ 完了 |
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
| 9.5 | パーティー並び替え | REORDER_PARTY アクション（GameReducer）。commandSlotsも連動 | ✅ 完了 |
| 9.6 | メンバー間装備移動 | TRANSFER_WEAPON/SPELL アクション | ✅ 完了 |
| 9.7 | UNDO系アクション | 購入・売却取り消し | ✅ 完了 |
| 9.8 | ダメージ寄与者表示 | DamageContributor 型と表示UI | ✅ 完了 |
| 9.9 | 敵行動予告 | EnemyIntent 型と表示UI | ✅ 完了 |
| 9.10 | パーティー内EXP分配 | 戦闘終了時の経験値配布 | ✅ 完了 |

---

## スライス10: 敵パターン拡張
**動作確認**: 新敵が正しく行動し、拡張された行動システムが機能する

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 10.1 | 新敵8体追加 | sewer_rat, hedro_slime, shaman, fairy（normal）、assassin, sleep_tiger, dark_mage, orc_lord（elite）をEnemies.jsonに追加 | ✅ 完了 |
| 10.2 | EnemyActionResult拡張 | chargeAllAllies, summonEnemyId, healSelf, healAlly, isAoe, applyWeakness, applySelfDefense フィールド追加 | ✅ 完了 |
| 10.3 | EnemyEffectProcessor.ts新規追加 | 防御バフ軽減、力溜め付与/消費、全体力溜め、自己防御バフ、自己回復、味方回復、召喚の処理を担当 | ✅ 完了 |
| 10.4 | StagePatterns.json拡張 | 新敵12種を含むパターンに全面更新 | ✅ 完了 |
| 10.5 | EnemyIntent.storedAction追加 | インテント生成時に行動結果を格納し実行時に再利用 | ✅ 完了 |
| 10.6 | Debuff型weakness追加 | `{ type: 'weakness'; value: number; duration: number }` をunion型に追加 | ✅ 完了 |

---

## スライス11: Tuning Editor
**動作確認**: DEV環境でTuning Editorを開き、スライダー操作がリアルタイムにゲームへ反映される

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 11.1 | TuningConfig型定義 | 6カテゴリの型定義（enemy, player, reward, store, levelup, battle） | ✅ 完了 |
| 11.2 | TuningSchema | デフォルト値・バリデーション | ✅ 完了 |
| 11.3 | TuningStore | 現在のTuningConfigを保持・参照 | ✅ 完了 |
| 11.4 | TuningSerializer | TuningConfig ↔ JSON変換 | ✅ 完了 |
| 11.5 | TuningReceiver | BroadcastChannel受信 → TuningStore更新 | ✅ 完了 |
| 11.6 | TuningData.json | Tuning Editorが書き出すパラメータ調整値ファイル | ✅ 完了 |
| 11.7 | tuning-save-plugin | Viteプラグイン: 保存リクエストをTuningData.jsonに書き出す | ✅ 完了 |
| 11.8 | editor UI | editor/index.html, style.css, main.ts, EditorUI.ts（React非依存） | ✅ 完了 |
| 11.9 | vite.config.ts MPA化 | appType: 'mpa' に設定しeditorを別エントリーポイントとして扱う | ✅ 完了 |
| 11.10 | tsconfig更新 | include に "editor" を追加 | ✅ 完了 |
| 11.11 | getTuningValue統合 | 各Core/TypesのコードがTuningStoreからパラメータを参照するよう統合 | ✅ 完了 |

---

## スライス12: 3アーキタイプ + ショップ2択制
**動作確認**: 3アーキタイプ（ローHP/金策/武器破壊）のビルドが機能し、ストアで2択からショップを選べる

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 12.1 | StoreState型変更 | weaponSlots/relicSlots/potionSlots を削除し shopOptions[ShopOption, ShopOption] + selectedShopIndex に変更。StoreCategory, ShopSlot, ShopOption 型を追加 | ✅ 完了 |
| 12.2 | SELECT_SHOP アクション | GameReducer にSELECT_SHOPアクション追加。2択からどちらかのショップを選択する処理 | ✅ 完了 |
| 12.3 | shield効果処理 | SpellEffect shield に対応する BattleActionProcessor の処理（被ダメージ軽減バフ付与） | ✅ 完了 |
| 12.4 | hpToMp効果処理 | SpellEffect hpToMp に対応する処理（HPをMPに変換） | ✅ 完了 |
| 12.5 | goldOnHit効果処理 | SpellEffect goldOnHit に対応する処理（攻撃ヒット時ゴールド獲得） | ✅ 完了 |
| 12.6 | goldDamage効果処理 | SpellEffect goldDamage に対応する処理（所持ゴールドに応じてダメージ増加） | ✅ 完了 |
| 12.7 | repairWeapons効果処理 | SpellEffect repairWeapons に対応する処理（装備中武器の耐久回復） | ✅ 完了 |
| 12.8 | weaponPowerBuff効果処理 | SpellEffect weaponPowerBuff に対応する処理（武器ダメージバフ付与） | ✅ 完了 |
| 12.9 | battleStartHpReduction処理 | PassiveEffectType battleStartHpReduction に対応する処理（戦闘開始時HP減少、applyBloodPact） | ✅ 完了 |
| 12.10 | damageTakenToMp処理 | PassiveEffectType damageTakenToMp に対応する処理（被ダメージをMPに変換） | ✅ 完了 |
| 12.11 | goldPerKill処理 | PassiveEffectType goldPerKill に対応する処理（敵撃破時ゴールド獲得） | ✅ 完了 |
| 12.12 | weaponBreakDamageMultiplier処理 | PassiveEffectType weaponBreakDamageMultiplier に対応する処理（武器破壊時ダメージ倍率）。RunState.weaponBreakMultiplier を使用 | ✅ 完了 |
| 12.13 | weaponBreakNextAttackBonus処理 | PassiveEffectType weaponBreakNextAttackBonus に対応する処理（武器破壊後の次攻撃ボーナス） | ✅ 完了 |
| 12.14 | WeaponEffect conditionalPower追加 | WeaponEffect に conditionalPower を追加し DamageCalculator で対応 | ✅ 完了 |
| 12.15 | 新武器9種追加 | Weapons.json に cursed_spear, berserker_axe, golden_sword, jewel_staff, disposable_blade, glass_sword, rusty_greatsword, soul_eater_sword, guardian_shield を追加（最終19種） | ✅ 完了 |
| 12.16 | 新魔法6種追加 | Spells.json に barrier, life_tap, gold_hex, gold_burst, field_repair, weapon_enchant を追加（最終16種。master_bond, education_bullet, healing_wind を含む） | ✅ 完了 |
| 12.17 | 新レリック追加 | Relics.json に3アーキタイプ対応レリック群を追加（最終24種） | ✅ 完了 |
| 12.18 | 武器修理バグ修正 | repairWeapons効果が正しく全スロットの武器を修理するよう修正 | ✅ 完了 |

---

## スライス13: EXP/防御系アーキタイプ + リザルトアニメ + ポジション動的化
**動作確認**: EXP/防御系レリック・魔法が機能し、リザルト画面に戦闘前後差分アニメが表示される

| # | タスク | 説明 | ステータス |
|---|--------|------|:----------:|
| 13.1 | PositionUtils.ts 新設 | getFrontMemberId / isFrontMember を Lib/Core/ に追加。Core/index.ts で re-export | ✅ 完了 |
| 13.2 | ExplorerState.position 削除 | Explorer.ts から position フィールドと Position 型を削除。呼び出し元を getFrontMemberId(party) に変更 | ✅ 完了 |
| 13.3 | USE_POTION_INSTANT アクション | GameReducer にコマンド選択フェーズ中のポーション即時発動を追加（HP/MP回復・武器修理対応） | ✅ 完了 |
| 13.4 | repair_potion 追加 | Potions.json に repair_potion を追加（計3種）。PotionEffect に repairWeapons を追加 | ✅ 完了 |
| 13.5 | levelUpDamageBoost 処理 | PassiveEffectType levelUpDamageBoost に対応する処理（レベルアップ時の次攻撃ダメージ倍率） | ✅ 完了 |
| 13.6 | battleEndBonusExp 処理 | PassiveEffectType battleEndBonusExp に対応する処理（修羅の証：戦闘後全員ボーナスEXP＋ゴールドペナルティ） | ✅ 完了 |
| 13.7 | lowestLevelDamageMultiplier 処理 | PassiveEffectType lowestLevelDamageMultiplier に対応する処理（最低レベル者のダメージ倍率） | ✅ 完了 |
| 13.8 | highHpTargetRateBonus 処理 | PassiveEffectType highHpTargetRateBonus に対応する処理（HP最大者の被弾率上昇） | ✅ 完了 |
| 13.9 | deathProtection 処理 | PassiveEffectType deathProtection に対応する処理（致死ダメージでHP1耐え、1ラン1回消滅） | ✅ 完了 |
| 13.10 | guidanceBuff 処理 | SpellEffect guidanceBuff に対応する処理（次のトドメで+1ボーナスEXP）。master_bond 魔法で発動 | ✅ 完了 |
| 13.11 | killBonusExpToAll 処理 | SpellEffect killBonusExpToAll に対応する処理（トドメ時に全員へボーナスEXP）。education_bullet 魔法で発動 | ✅ 完了 |
| 13.12 | 新レリック5種追加 | Relics.json に fighting_spirit_bracelet, shura_mark, upset_strike, bully_strong, substitute_doll を追加（計24種） | ✅ 完了 |
| 13.13 | BattleStartSnapshot 型追加 | Run.ts に BattleStartSnapshot 型追加。RunState.battleStartSnapshot フィールド追加。戦闘開始時に記録し END_BATTLE で null に戻す | ✅ 完了 |
| 13.14 | ResultState/MemberBattleDiff 型追加 | Game.ts に WeaponUsesDiff, MemberBattleDiff, ResultBonusEntry, MemberAnimationPhase, ResultState 型追加 | ✅ 完了 |
| 13.15 | リザルト画面逐次アニメ | ResultScreen.tsx でメンバーカードに HP/MP/レベル/EXP/武器耐久の変化を MemberAnimationPhase で逐次表示 | ✅ 完了 |
| 13.16 | isGameOver フラグ追加 | BattleState.isGameOver を追加。敗北時にゲームオーバーオーバーレイを表示 | ✅ 完了 |
| 13.17 | expPopups 追加 | BattleState.expPopups: ExpPopup[] を追加。経験値獲得アニメ用ポップアップ処理 | ✅ 完了 |

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
| 10: 敵パターン拡張 | 6 | 6 | 100% |
| 11: Tuning Editor | 11 | 11 | 100% |
| 12: 3アーキタイプ+ショップ2択制 | 18 | 18 | 100% |
| 13: EXP/防御系アーキタイプ+リザルトアニメ+ポジション動的化 | 17 | 17 | 100% |
| **合計** | **102** | **102** | **100%** |

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
│   │   ├── TargetingSystem.ts   # 前衛/後衛ターゲット率計算
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
│   ├── Tuning/          # バランス調整システム（DEV専用）
│   │   ├── TuningConfig.ts
│   │   ├── TuningSchema.ts
│   │   ├── TuningStore.ts
│   │   ├── TuningReceiver.ts
│   │   ├── TuningSerializer.ts
│   │   └── index.ts
│   ├── Data/            # マスターデータ
│   │   ├── Weapons.json
│   │   ├── Spells.json
│   │   ├── Relics.json
│   │   ├── Potions.json
│   │   ├── Enemies.json
│   │   ├── StagePatterns.json
│   │   └── TuningData.json      # Tuning Editorが書き出すパラメータ調整値
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

editor/                  # Tuning Editor（プロジェクトルート、React非依存）
├── index.html
├── style.css
├── main.ts
└── EditorUI.ts

vite-plugins/            # Viteカスタムプラグイン
└── tuning-save-plugin.ts
```
