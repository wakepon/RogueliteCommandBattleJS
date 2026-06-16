## 1. 概要
* **ラインナップ：** 武器、魔法、レリック、ポーション、パーティーによって異なる。
* **判断時間：** 10秒 ~ 1分ぐらいで終えてもらうように
## 2. レリック
* **効果：** リソースやパラメータ増減の**永続効果**。
* **レリックの例：**
    * 攻撃力増減（条件付き/永続/時限）。
    * 残り武器使用回数/ポジション/デバフ状態に応じたステータス強化。
    * 特定行動回数（レベルアップ、ライフスティール、ポーション使用など）に応じた効果。
    * 戦闘後のHP/MP回復、毎ターン回復。
    * 死亡/復活時に効果発動（強化、回復）。
* **MVP実装済みレリック（20種）:**
  修羅の血脈、逆境の鎧、魔力の残滓、研ぎ師の名刺、討伐の対価、前衛の矜持、後衛の叡智、挑発式防御、連携の紋章、闘気の腕輪、努力の証、苦痛のリング、血の契約、身代わりの人形、再生のコケ、武器お手入れ用油、修羅の証、棘の書、錬金術の触媒、薬師の鞄。
* **効果タイプ:** hpCostPowerBoost, vulnerabilityPowerBoost, mpSpendShield, knifeUseDurabilityRestore, killMpRecover, frontRowIntBonus, backRowStrBonus, shieldTaunt, comboAttackBonus, levelUpStatBoost, brokenWeaponStatBonus, damageTakenToMp, battleStartHpReduction, deathProtection, regenPerTurn, weaponDurabilitySave, battleEndBonusExp, thornsDurationBonus, potionEffectMultiplier, potionSlotBonus。

## 3 **武器**
* 武器は使用回数制限がある
* カテゴリ制（knife, greatsword, staff, shield, other）が導入されている
* キャンプで休憩することで使用回数復活
## 4 **魔法**
* 魔法はMPを消費する（commandCategory: "spell"）
* MPはキャンプで休憩したりレベルアップやポーションで回復
* 魔力弾と祈りはslotFree: trueで枠を消費しない
## 5. ポーション
* MVPで実装されているポーションは7種:
    * HPポーション（HP回復）
    * MPポーション（MP回復）
    * 修復ポーション（repair_potion）: 武器使用回数を回復する（`repairWeapons` 効果）
    * 挑発ポーション（taunt_potion）: 使用者を敵に挑発（taunt）
    * 興奮ポーション（excitement_potion）: STR・INT一時的加算（statBoost）
    * 防御ポーション（defense_potion）: 被ダメージ軽減（damageReduction）
    * 全体化ポーション（aoe_potion）: 次の攻撃を全体化（aoeConvert）
* **ターゲット:** targetTypeがallySingle（パーティー制で回復対象を選択）。
* **即時発動:** ターン消費なし。1ターンに複数回使用可能（所持数が上限）。
* **薬師の鞄レリック:** potionSlotBonusによってポーション枠が+2される。
## 6. **ストアの枠**
* **5枠2選択方式を採用:** 5枠（武器1/魔法1/ランダム〔武器or魔法〕1/レリック1/ポーション1）から2つを選択する。
* 品揃え変更(リロール): 初期コスト3G、使用ごとに1G増加
* 商品を購入した枠は売り切れ表示となり、品揃え変更してもその枠に新たな商品は出現しない
* **階層別レアリティフィルタ:**
  * 第1階層（Stage 1-7）: Common/Uncommonのみ出現
  * 第2階層（Stage 8-14）: Uncommon/Rareのみ出現
  * 第3階層（Stage 15-21）: Rareのみ出現（floor_3_rare_rate=0.7の加重抽選も適用）

## 6.x **武器売却価格**
* 計算式: `floor((購入価格 - 最低売値) * (現在の使用回数 / 最大使用回数) * 0.5 + 最低売値)`
* 最低売値: 購入価格10G以上なら2G、10G未満なら1G（耐久0でも最低売値を保証）。

> **バランス調整:** 各枠数、リロールコスト、レリック上限、ポーション上限はTuning Editorで調整可能である。
## 7. **初期アイテム**
* このままだと序盤に何の選択もないまま終わってしまいそう
    * ソウルで解放することで、ダンジョン開始時にランダムな武器/魔法/レリックから1つ選んで獲得できるように
    * 上記はソウルのチュートリアルとして最初に解放をさせる。
