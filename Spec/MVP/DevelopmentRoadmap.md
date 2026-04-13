# 開発ロードマップ

## フェーズ1：戦闘ロジックの構築（The Toy）
ダミーの敵に対し、武器/魔法で攻撃し、計算式通りにダメージが出て、リソースが減る処理を作る。

## フェーズ2：ゲームループの構築（The Loop）
戦闘終了 → 報酬獲得 → ストア画面 → 次の戦闘への遷移を作る。

## フェーズ3：データ投入とUI（The Game）
* 武器10種、魔法7種、レリック15種、ポーション2種、敵12種（normal 6種、elite 5種、boss 1種）のデータを入れる。
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
