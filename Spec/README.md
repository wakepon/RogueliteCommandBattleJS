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

### 2026-06-16: カテゴリ制リデザイン + ゴールドシステム廃止 + 第三階層追加 + 回復メニュー + 成長選択システム

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (9ファイル更新):
- `Overview/BattleOverview.md` — ダメージ計算式をPower加算方式に全面改訂、武器18種（カテゴリ制: knife/greatsword/staff/shield/other）・魔法22種に全面刷新、ポーション7種に拡大、vulnerabilityデバフ・thorns・damageReduction・comboPowerBonusバフ追加、第三階層（Stage 15-21）追加、回復メニューセクション追加、GrowthType選択制セクション追加、利子システム削除
- `Overview/EnemyOverview.md` — 敵14種に更新（盾持ちゴブリン/ガーディアン/リッチ追加、オークロード削除）、ゴブリン・シャーマン・ダークメイジ・ドラゴンの行動パターン修正、HP/goldReward値を実装値に修正、新規行動カテゴリ8種追加
- `Overview/StoreOverview.md` — 5枠2選択方式に変更、レリック20種に全面刷新、階層別レアリティフィルタ（第3階層追加）、ポーション7種更新
- `Overview/DungeonExploreOverview.md` — 全21ステージ構成に更新、第三階層（Stage 15-21）追加、イベントステージをStage 4/11/18に修正、回復メニュー追加
- `MVP/BattleSystem.md` — ダメージ計算式全面改訂、レリック効果20種に刷新、レベルアップをGrowthType選択制に変更、HP/MP回復率25%に修正、報酬処理簡素化
- `MVP/EnemyCharacter.md` — 敵一覧全面更新（14種）、出現パターンをStage 21まで拡張、goldReward方式に変更
- `MVP/GameFlow.md` — 全21ステージ進行に更新、第三階層追加、回復メニューフェーズ追加、初期所持金0Gに修正
- `MVP/StoreItem.md` — 5枠2選択方式、武器18種・魔法22種・レリック20種・ポーション7種に全面刷新、階層別レアリティフィルタ追加
- `MVP/PlayerStatus.md` — 初期所持金0G、戦士初期武器「ナイフ」、魔法使い初期魔法「アイス」、僧侶初期「祈り+ヒール」に修正、GrowthType選択制に変更、HP/MP回復率25%に修正

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — GamePhaseにrecovery追加、RecoveryState/GrowthType/Enhancement型定義追加、PassiveEffectType全面更新（20種）、WeaponEffect全面更新（16種）、SpellEffect更新（13種）、PotionEffect7種に拡張、StoreState5枠方式に変更、BattleState/ResultState整理、GameReducerアクション更新（SELL系→DISCARD系、Recovery/Growth系追加）、データ数更新（武器18/魔法22/レリック20/ポーション7/敵14種）、SAVE_VERSION=6
- `MVP/MVPScope.md` — 5枠2選択方式に修正、金利システム削除、回復メニュー/成長選択/強化システム/slotFree魔法を追加
- `MVP/DevelopmentRoadmap.md` — データ数修正、フェーズ7（ゴールドシステム廃止・カテゴリ制リデザイン）新規追加
- `MVP/ImplementationTasks.md` — スライス12/14のタスク修正、スライス15（ゴールドシステム廃止・カテゴリ制リデザイン）新規追加、ファイル一覧更新

**UI チーム** (1ファイル更新):
- `MVP/UIUXDesign.md` — recoveryフェーズ追加、回復メニュー画面セクション新規追加、成長方向選択モーダル（GrowthSelectModal）セクション追加、ストア画面を5枠2選択・削除枠方式に全面改訂（2段階構成廃止）、Reroll無料化、所持金表示を回復メニューのみに変更、結果画面ボタン「回復メニューへ」に修正、報酬内訳表示簡素化、ツールチップ武器・魔法効果リスト全面更新、ItemDescriptionレリック効果リスト更新、BuffIcon新規バフ表示追加、vulnerabilityデバフ視覚化、ダメージ予測値インライン表示追加、slotFree魔法のストア表示追加

### 2026-05-11: 第二階層追加 + 敵改善 + UIレイアウト刷新 + バランス調整の反映

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (9ファイル更新):
- `Overview/BattleOverview.md` — 第二階層（ステージ8-11）の敵HP/ダメージ倍率追記、スリープタイガーPhase2に乱れ引っかき（3連撃ランダムターゲット）追加・マッドタイガー変身追記、ドラゴン自己再生を最大HP80%と明記、妖精ヒールをpercentOfMaxHp方式に修正、戦場の鍛冶のtargetTypeをallySingleに修正、精密を「ショップ購入可能」に修正、癒しの風heal valueをパラメータ調整対象表現に
- `Overview/EnemyOverview.md` — スリープタイガーPhase2確率テーブル更新（乱れ引っかき25%追加）、マッドタイガー変身追記、妖精のヒール方式をpercentOfMaxHp: 0.3に修正
- `Overview/StoreOverview.md` — killStreakBonusを未使用と注記、第二階層Rare出現率補正追加、武器売却価格を最低売値保証付き新計算式に更新
- `Overview/DungeonExploreOverview.md` — 全7ステージ→全11ステージ構成に更新、第二階層（Stage 8-11）の編成テーブル・敵強化倍率を追加、Stage 9をイベントステージに追加
- `MVP/BattleSystem.md` — Stage 8/10/11のturnLimit追加、levelup_required_kills_cap追記、HP/MP回復率をTuning Editor表現に修正
- `MVP/EnemyCharacter.md` — Stage 1パターンA「スライムx1」→「ゴブリン+スライム」修正、Stage 8/10/11編成テーブル追加、スリープタイガー・ドラゴン・妖精の行動パターン更新
- `MVP/GameFlow.md` — 全11ステージ構成に更新、第二階層の進行追加、Stage 1編成修正、成長値をパラメータ調整対象表現に
- `MVP/StoreItem.md` — 売却価格計算式更新、Rare出現率補正追加、ヒールMP/癒しの風heal value/ポーション価格をパラメータ調整対象に、呪いの槍Rare/黄金の剣Uncommonに修正、戦場の鍛冶allySingleに修正
- `MVP/PlayerStatus.md` — 初期HPをTuning Editor調整可能表現に、HP成長値・回復率をパラメータ調整対象と明記

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — BattleStateにbonusGains/enemyHpMultiplier/enemyDamageMultiplier追加、StoreStateにrareRate追加、ShopSlotをタグ付きユニオン型に修正、TuningConfigを7カテゴリに更新、StageManagerセクション新設（TOTAL_STAGES=11/getFloor/isBossStage）、EnemyActionResultにtransformName/isRandomTarget追加、StagePatterns stage_8〜11追加、GameReducerイベントアクション6種追加
- `MVP/MVPScope.md` — 「1階層」→「2階層」に修正、第二階層をCore実装項目に追加
- `MVP/DevelopmentRoadmap.md` — フェーズ5にバランス調整実施済み項目追記、フェーズ6（第二階層追加）を新規追加
- `MVP/ImplementationTasks.md` — スライス14（第二階層実装、21タスク）を新規追加、進捗サマリー更新

**UI チーム** (1ファイル更新):
- `MVP/UIUXDesign.md` — SharedPanel廃止→左サイドパネル（LeftPanel）構成に全面改訂、キャラ欄をgrid-cols-3に変更、次ステージプレビューを左パネル内縦並びに移動、経験値バーをSegmentedBar（区画分割）に変更、レベルアップ演出をフローティングポップアップ化、弱体デバフバッジ・シールド軽減ポップアップ追加、ストア画面も左サイドバー化、ドロップ先強調表示・商品カード効果文追加、マップ画面「ステージX/11」表示、戦闘結果画面の報酬内訳順序修正・純増行削除

### 2026-04-26: 前衛・後衛動的化 + リザルト演出 + 新アイテム群の反映

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (8ファイル更新):
- `Overview/BattleOverview.md` — 前衛・後衛のparty配列順動的決定（先頭の生存者が前衛、先頭が死体／空なら前衛なし）追記、ダメージ計算式に lowHpDamageMultiplier/lowestLevelDamageMultiplier/levelUpDamageBoost 追記、新魔法3種（師弟の絆/教育の魔弾/癒しの風）・新武器2種（魂喰いの剣/守護の盾）・修復ポーション追加、levelUpDamageBoost/guidanceBuff バフ追記、討伐ターンペナルティをUIのみ表示に修正
- `Overview/EnemyOverview.md` — 各敵の行動確率値を実装値に修正（シャーマン45%/55%、ヘドロスライム50%/50%等）、行動バリエーションに「弱体デバフ複合」追記
- `Overview/StoreOverview.md` — レリック18種→24種、効果タイプ列挙更新（hpCostDamageBonus削除、新7種追加）、ポーション2種→3種（修復ポーション追加・即時発動仕様）、ストア枠をシード付きシャッフル+ShopOption A/B方式に修正
- `Overview/DungeonExploreOverview.md` — 休憩を「パーティー全員の最大HPの50%回復」に修正
- `MVP/BattleSystem.md` — ダメージ計算式に追加レリック倍率3種、レリック効果テーブルに6種（怒りの炎/闘気の腕輪/修羅の証/番狂わせの一撃/強い者いじめ/身代わりの人形）、ターゲティング動的決定とHPバー緑色統一・KillLineバー仕様を新規セクションで追加、ペナルティダメージを未実装と明記
- `MVP/EnemyCharacter.md` — 各敵の行動確率値を実装に一致させる修正（スリープタイガー2フェーズ詳細、アサシン55%/45%等）、新規行動カテゴリ表に「弱体デバフ複合」追加
- `MVP/GameFlow.md` — Stage 4 武器修理をキャラクター単位選択方式（1人選択→全武器一括全回復）に修正、結果画面を逐次表示アニメ・bonusEntries/memberDiffs/goldDiff・討伐数削除に変更、ゲームオーバーオーバーレイ追記
- `MVP/StoreItem.md` — 武器17種→19種（魂喰いの剣/守護の盾追加）、魔法13種→16種（師弟の絆/教育の魔弾/癒しの風追加）、精密 mpCost=2/price=4G、レリック18種→24種、ポーション2種→3種、ポーション即時発動仕様追加
- `MVP/PlayerStatus.md` — 戦士の初期装備順をパンチ→錆びたナイフに修正、僧侶の初期魔法をヒールのみに修正（精密削除）、レベルアップHP/MP回復を「旧最大値の50%回復」に修正、前衛・後衛動的決定セクションを新規追加

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — 959行→797行に削減しつつ全差分反映。PositionUtils.ts追加・Position型/ExplorerState.position削除、PassiveEffectType 5種追加（levelUpDamageBoost/battleEndBonusExp/lowestLevelDamageMultiplier/highHpTargetRateBonus/deathProtection）と既存型修正、WeaponEffectにshield/killPreserveDurability追加、SpellEffect全面更新（guidanceBuff/killBonusExpToAll追加）、PotionEffect.repairWeapons追加、CommandSlot.weaponIndex?/PlayerDamagePopup.label?/ExpPopup型/BattleState.expPopups・isGameOver?追加、RunState.battleStartSnapshot追加とSaveManager非永続化、Game.tsにMemberBattleDiff/ResultBonusEntry/MemberAnimationPhase等追加、USE_POTION_INSTANTアクション追加、武器19種・魔法16種・レリック24種・ポーション3種に更新
- `MVP/MVPScope.md` — EXP/防御系アーキタイプ群、ポーション即時発動、リザルト差分表示の3項目を追加
- `MVP/DevelopmentRoadmap.md` — フェーズ3のデータ件数を更新（武器19/魔法16/レリック24/ポーション3）、フェーズ5にスライス13の4項目（ポジション動的化・リザルト演出・ポーション即時発動・EXP/防御系拡張）を追記
- `MVP/ImplementationTasks.md` — スライス3タスク3.5にactionQueue再生成追記、スライス12タスク12.15-17を実装IDに合わせて修正、スライス13（EXP/防御系+リザルトアニメ+ポジション動的化、17タスク）を新規追加、進捗サマリーを102タスク合計に更新

**UI チーム** (1ファイル更新):
- `MVP/UIUXDesign.md` — 288行→342行に更新。メンバーカード形式（rounded-lg + border）、味方丸アイコン表示エリア（PartyAvatars、クラス絵文字・右肩下がり配置・Tooltip・状態別リング・D&D 0.7倍縮小オーバーレイ）、行動アニメーション（panel-rise/avatar-attack/avatar-heal/panel-shake）、ゲームオーバーオーバーレイ、戦闘結果画面のアニメーション演出（card-fade/item-fade/メンバーカード enter→done フェーズ進行・ResourceBar transitionMs）、数値エフェクト（ExpPopupEffect/PlayerDamagePopupEffect/DamagePopup）、レリックツールチップの最大攻撃力変化表示を新規セクションで追加。SharedPanel位置を「右端」→「最左」に修正、行動順表示の番号を①〜⑤に拡張、前衛/後衛動的判定を追記、KillLineBarを統合HPバー（緑色統一・右端起点オーバーレイ）に修正、ターゲット選択にally-avatar-${id}追加、コマンドカテゴリに「癒」バッジ追加、ポーション即時発動仕様追加、Next/Next+枠との余白（pr-60）注記

### 2026-04-14: 3アーキタイプ(ローHP/金策/武器破壊) + ショップ2択制の反映

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (4ファイル更新):
- `Overview/BattleOverview.md` — ダメージ計算式にconditionalPower/weaponPowerBonus/weaponBreakMultiplier追記、新規武器7種・魔法6種の概要追加、シールドバフ2系統明記、バフ一覧にshield/weaponPowerBonus追加
- `Overview/StoreOverview.md` — レリック15→18種更新（3種削除・6種追加）、効果タイプ一覧更新、ショップ枠を固定8枠→2択選択制(6枠)に変更
- `MVP/BattleSystem.md` — ダメージ計算式更新、レリック倍率修正(怒りの炎・血染めの手袋削除→努力の証追加)、バフテーブル・レリック効果テーブル更新
- `MVP/StoreItem.md` — 武器7種・魔法6種・レリック6種追加、3種削除、レアリティ修正、商品抽選を2択選択制に修正

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — StoreState型を2択ショップ制に変更、ShopOption/ShopSlot型追加、RunState.weaponBreakMultiplier追加、WeaponEffect/SpellEffect/PassiveEffectType拡張、SELECT_SHOPアクション追加、applyBloodPact・新効果処理の概要追記、データ種数更新
- `MVP/MVPScope.md` — ストア機能を2択ショップ制に更新、3アーキタイプシステム追加
- `MVP/DevelopmentRoadmap.md` — データ数更新(武器16/魔法13/レリック19)、フェーズ5に3アーキタイプ実装追記
- `MVP/ImplementationTasks.md` — スライス12(3アーキタイプ+ショップ2択制、18タスク)追加

**UI チーム** (1ファイル更新):
- `MVP/UIUXDesign.md` — ストア画面を2段階構成(ショップ選択→選択済みショップ)に改訂、selectShopコールバック追記、TooltipCard新効果(conditionalPower/hpCost/goldCost/shield等)追記、ItemDescription新レリック説明追記、goldCostコマンドの選択不可条件を汎用化

### 2026-04-13: Tuning Editor導入・バランス調整・ポーションD&D修正の反映

3チーム並列（Core Game / Data & State / UI）で分析・書き出しを実施。

**Core Game チーム** (8ファイル更新):
- `Overview/BattleOverview.md` — 戦闘報酬の基礎ゴールドをTuning Editor調整可能表記に修正（デフォルト: normal 6G, elite 10G, boss 20G）、利息上限をTuning Editor調整可能表記に修正、バランス調整の注記追加
- `Overview/EnemyOverview.md` — 全12敵のHP値をコード現在値に更新（全敵3倍、ドラゴン1.5倍の引き上げ反映）
- `Overview/StoreOverview.md` — ストア枠数・リロールコスト・上限がTuning Editorで調整可能の注記追加
- `Overview/DungeonExploreOverview.md` — 休憩回復量にTuning Editor調整可能の注記追加
- `MVP/BattleSystem.md` — レベルアップ回復を「全回復」→「旧最大値の50%回復」に修正、報酬・利子をTuning Editor対応に修正
- `MVP/EnemyCharacter.md` — 全12敵のHP値をコード現在値に更新
- `MVP/GameFlow.md` — レベルアップ回復を「部分回復（50%）」に修正、休憩回復にTuning Editor注記追加
- `MVP/StoreItem.md` — リロールコスト・枠数のTuning Editor調整可能注記追加

**Data & State チーム** (4ファイル更新):
- `Architecture/SystemDesign.md` — Lib/Tuning/（6ファイル）・editor/（4ファイル）・vite-plugins/のフォルダ構造追加、「バランス調整システム（Tuning Editor）」セクション新設、設計方針・ビルド設定変更を記載
- `MVP/MVPScope.md` — 実装するもの（Core）にTuning Editorを追加
- `MVP/DevelopmentRoadmap.md` — フェーズ5「バランス調整」を詳細化（Tuning Editor・敵HP引き上げ・回復率変更）
- `MVP/ImplementationTasks.md` — スライス11（Tuning Editor、11タスク）追加、進捗サマリー更新

**UI チーム** (1ファイル更新):
- `MVP/UIUXDesign.md` — Tuning Editorセクション新設（レイアウト・BroadcastChannel通信・保存機能）、ポーションD&D操作仕様（shared→アクティブエクスプローラー変換）追記、全体攻撃バッジ「全体」→「全」修正

**注意:** `Architecture/SystemDesign.md` が914行（800行上限超過）。次回メンテナンス時にセクション分割を推奨。

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
