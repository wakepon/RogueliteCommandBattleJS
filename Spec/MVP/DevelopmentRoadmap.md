# 開発ロードマップ

## フェーズ1：戦闘ロジックの構築（The Toy）
ダミーの敵に対し、武器/魔法で攻撃し、計算式通りにダメージが出て、リソースが減る処理を作る。

## フェーズ2：ゲームループの構築（The Loop）
戦闘終了 → 報酬獲得 → ストア画面 → 次の戦闘への遷移を作る。

## フェーズ3：データ投入とUI（The Game）
* 武器19種、魔法16種、レリック24種、ポーション3種、敵12種（normal 6種、elite 5種、boss 1種）のデータを入れる。
* リソース消費が一目でわかるUIを実装する。

## フェーズ4：パーティー制導入（実装済み）
以下の機能が実装済み（ロードマップ策定時には計画されていなかった機能）:
* 3人パーティー制（戦士・魔法使い・僧侶）と CharacterClass/Position 型
* コマンドスロット制（CommandSlot）による行動順管理
* D&Dターゲティング（ドラッグ&ドロップによるターゲット選択）
* REORDER_PARTY によるパーティー並び替え（GameReducer側。commandSlotsも連動）
* メンバー間装備移動（TRANSFER_WEAPON/SPELL）
* パーティー内EXP分配
* UNDO 系アクション（購入・売却取り消し）
* ダメージ寄与者表示（DamageContributor）
* 敵行動予告（EnemyIntent）
* 敵パターン拡張（新敵8体追加: sewer_rat, hedro_slime, shaman, fairy, assassin, sleep_tiger, dark_mage, orc_lord）
* 敵行動システム拡張（全体力溜め、召喚、自己/味方回復、AoE攻撃、弱体デバフ、自己防御バフ）
* EnemyEffectProcessor.ts 新規追加

## フェーズ5：バランス調整（実施済み）
「ジリ貧になるか、圧倒するか」のバランスを調整する。以下が実施済み:
* Tuning Editorの実装（DEV専用パラメータ調整ツール。BroadcastChannelによるリアルタイム反映）
* 敵HPの引き上げ（難易度調整）
* 敵脅威度の引き上げ（攻撃力・行動パターン調整）
* レベルアップ時のHP/MP回復率の変更
* 3アーキタイプ実装（ローHP戦略・金策戦略・武器破壊戦略）: 新レリック6種・新魔法6種・新武器7種追加（スライス12）
* 2択ショップ制の導入: StoreState型をshopOptions[ShopOption, ShopOption] + selectedShopIndexに変更（スライス12）
* 武器修理バグ修正（スライス12）
* EXP/防御系アーキタイプ追加（闘気の腕輪・修羅の証・番狂わせの一撃・強い者いじめ・身代わりの人形＋師弟の絆・教育の魔弾魔法）（スライス13）
* リザルト/UI演出強化: 戦闘前後差分逐次アニメ（BattleStartSnapshot + MemberAnimationPhase）、味方丸アイコン、行動アニメ、HPバー統合、ゲームオーバーオーバーレイ（isGameOver）（スライス13）
* パーティーポジション動的化（PositionUtils 新設、ExplorerState.position 削除）（スライス13）
* ポーション即時発動（USE_POTION_INSTANT）・修復ポーション（repair_potion）追加（スライス13）
* HP回復量・敵ステータスの再調整（スライス14相当のバランス調整）
* 武器の売値設定（各武器に適切な売値を設定）
* stage 1 のパターン変更（初期難易度の調整）
* ヒール魔法のMP消費軽減

## フェーズ6：第二階層追加（実施済み）
第一階層クリア後の第二セットを追加する。以下が実施済み:
* stage_8〜stage_11 の StagePatterns.json 追加（stage_9 はイベントステージ）
* BattleState に enemyHpMultiplier / enemyDamageMultiplier フィールド追加
* StoreState に rareRate フィールド追加（第二階層でRare率上昇）
* createStoreState に stage 引数追加、pickWithRarity 関数追加
* generateEnemyIntents に damageMultiplier 引数追加
* EnemyEffectProcessor.applySummonEnemy で enemyHpMultiplier を参照してHP倍率適用
* isEventStage で stage 4 と stage 9 の両方をイベントステージと判定
* TuningConfig に floor カテゴリ追加（7カテゴリ化）
* BattleResultDiff.ts 新規追加（戦闘結果差分計算）
* ResultState 型を全フィールド記載に拡張
