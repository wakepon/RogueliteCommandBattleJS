# パーティー制実装 進捗管理

## Phase 1: データモデル拡張 & パーティー初期化
- [x] 1-1. 型定義の拡張 (Explorer.ts) — CharacterClass, Position, killCount, weaponSlotCount/magicSlotCount追加, agi削除
- [x] 1-2. キャラクターマスターデータ — Explorer.ts内にCLASS_TEMPLATESとして定義
- [x] 1-3. 新規コマンドデータ — 魔力弾(Weapons.json), 祈り(Weapons.json), 精密(Spells.json)
- [x] 1-4. パーティー初期化ファクトリ — createInitialParty(): 戦士・魔法使い・僧侶の3人生成
- [x] 1-5. RunState の更新 — saveVersion追加, createInitialParty()使用
- [x] 1-6. 後方互換の確保 & ビルド確認 — tsc, vitest, vite build全パス
- [x] 1-7. PlayerStatus に3人分の簡易表示 — BattleScreenで3人横並びGrid表示
- [x] 追加: AGI廃止 — BattleStateFactory, LevelUpCalculator, Passive型, RelicProcessor, 俊足のブーツ変更
- [x] 追加: クラス別レベルアップ成長値 — LevelUpCalculator
- [x] 追加: セーブバージョン更新 — SaveManager v2
- [x] 追加: INT依存武器(scaleStat)対応 — DamageCalculator
- [x] 追加: checkBattleResult をパーティー全滅判定に変更 — BattleEngine
- [x] 追加: レビュー指摘対応 — precisionバフ適用、祈りコマンドパス追加、actionQueue制限

**Phase 1 完了** ✓ tsc, vitest, vite build 全パス

## Phase 2: マルチキャラクターバトル（クリックベース）
- [x] 2-1. BattleState の型変更 — phase, commandSlots, activeExplorerIndex, currentCommandIndex, currentEnemyIndex追加
- [x] 2-2. BattleStateFactory 更新 — createCommandSlots, phase:'command'初期化
- [x] 2-3. BattleReducer 全面書き換え — フェーズベースフロー(command→partyAction→enemyAction→turnEnd)
- [x] 2-4. UseBattle Hook 全面書き換え — マルチキャラ対応、フェーズ制御メソッド追加
- [x] 2-5. GameReducer EXECUTE_COMMAND更新 — commandSlotsから情報取得、explorerIdで対象特定
- [x] 2-6. BattleScreen UI全面書き換え — コマンドスロット表示、フェーズ自動進行、実行ボタン
- [x] 2-7. 戦闘不能 & HP1復活 — END_BATTLEでrevivedParty生成、戦闘不能キャラはグレーアウト

- [x] 2-8. レビュー指摘修正 — setTimeout二重クリーンアップ, turnEndフェーズ分離, processTurnEnd全パーティー化, 味方ターゲット判定, 戦闘不能スキップ, スロット巡回探索, regenを行動キャラに適用

**Phase 2 完了** ✓ tsc, vitest, vite build 全パス

## Phase 3: 前衛/後衛 & ターゲティング
- [x] 3-1. TargetingSystem.ts — calculateTargetRates, selectTargetByRate 新規作成
- [x] 3-2. UseBattle enemyAction — ランダム→TargetingSystem確率ベースに変更
- [x] 3-3. PlayerStatus — 前衛/後衛ラベル + 被ターゲット率表示
- [x] 3-4. 祈りコマンド効果実装 — executeAllyWeaponCommandでtargetRateUpバフ付与

**Phase 3 完了** ✓ tsc, vitest, vite build 全パス

## Phase 4: キャラ個別レベルアップ
- [x] 4-1. distributeExpToParty — 全員+1、止めキャラ+1ボーナス、killCount更新
- [x] 4-2. BattleActionProcessor — 3箇所のレベルアップ処理をdistributeExpToPartyに置換
- [x] 4-3. ExpGauge — 既存のPlayerStatus内に3人分表示済み（Phase 1で対応済み）

**Phase 4 完了** ✓ tsc, vitest, vite build 全パス

## Phase 5: キルラインバー & ダメージプレビュー
- [x] 5-1. DamagePredictor — scaleStat対応 + calculateCumulativeDamagePreview(全スロット累計)
- [x] 5-2. KillLineBar.tsx — 確定ダメ/ブレ幅/残HP割合表示、KILL/KILL?判定
- [x] 5-3. EnemyDisplay統合 — HPバー下にKillLineBar追加
- [x] 5-4. BattleScreen — コマンドフェーズ中に累計ダメージプレビューを計算して渡す

**Phase 5 完了** ✓ tsc, vitest, vite build 全パス

## Phase 6: 敵リバランス & 行動予告
- [x] 6-1. Enemies.json — HP上方調整(スライム18,ゴブリン28,オーク55,ドラゴン160), 報酬増
- [x] 6-2. 敵行動予告(EnemyIntent) — BattleState型追加, BattleStateFactory生成, START_NEW_TURN再生成
- [x] 6-3. EnemyDisplay — 行動予告表示（次: 斬りつける(5)）
- [x] 6-4. 空振りメカニクス — ターゲット死亡時リソース消費なしスキップ

**Phase 6 完了** ✓ tsc, vitest, vite build 全パス

## Phase 9: イベント更新
- [x] 9-1. 休憩 — 全パーティー分のHP表示 + 各キャラの回復量表示
- [x] 9-2. 武器修理 — 1人選択→全武器修理のキャラ選択UI
- [x] 9-3. 宝箱 — 変更なし（共有レリック、既にパーティー対応済み）

**Phase 9 完了** ✓ tsc, vitest, vite build 全パス

## Phase 8: ショップUI刷新
- [x] 8-1. GameReducer — BUY_WEAPON/BUY_SPELL/SELL_WEAPON/SELL_SPELLにmemberIndex追加
- [x] 8-2. UseGame — buyWeapon/buySpell/sellWeapon/sellSpellのインターフェース更新
- [x] 8-3. StoreLogic — canBuyWeapon/canBuySpellをExplorerState.weaponSlotCount/magicSlotCount基準に
- [x] 8-4. StoreScreen — キャラ選択タブ追加、選択キャラの装備を表示・購入・売却
- [x] 8-5. StoreShopPanel — 武器/魔法枠数の動的表示、無限使用武器の売却防止

**Phase 8 完了** ✓ tsc, vitest, vite build 全パス

## Phase 7: D&Dバトル UI
- [x] 7-1. @dnd-kit/core, @dnd-kit/sortable インストール
- [x] 7-2. DraggableCommand.tsx — ドラッグ可能な武器/魔法/ポーションアイテム
- [x] 7-3. DroppableTarget.tsx — 敵/味方のドロップゾーン
- [x] 7-4. ActionOrderSlots.tsx — コマンドセット順の行動順表示
- [x] 7-5. BattleScreen — DndContext統合、D&Dでコマンドセット + クリックフォールバック維持
- [x] 7-6. DragOverlay — ドラッグ中のコマンド名表示

**Phase 7 完了** ✓ tsc, vitest, vite build 全パス

---

## 全Phase完了
Phase 1〜9 すべて実装完了。3人パーティー制バトルが完全に動作する状態。
