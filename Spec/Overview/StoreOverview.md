## 1. 概要
* **ラインナップ：** 武器、魔法、レリック、ポーション、パーティーによって異なる。
* **判断時間：** 10秒 ~ 1分ぐらいで終えてもらうように
## 2. レリック
* **効果：** リソースやパラメータ増減の**永続効果**。
* **レリックの例：**
    * 攻撃力増減（条件付き/永続/時限）。
    * 残り武器使用回数/所持金/ダメージ回数に応じたステータス強化。
    * 全体攻撃・単体攻撃の性質変更、バフ効果・確率の倍化。
    * 特定行動回数（レベルアップ、吸血、ポーション使用など）に応じた効果。
    * 戦闘後のHP/MP回復、配当（不労所得）。
    * 死亡/復活時に効果発動（強化、回復、敵に大ダメージ）。
* **MVP実装済みレリック（24種）:** 戦士の腕輪、鋭い砥石、貯金箱、魔術師の指輪、壊れかけの鎧、武器お手入れ用油、ストレス発散、研ぎ師の名刺、集中の水晶、反撃の棘、再生のコケ、錬金術の触媒、血の契約、苦痛のリング、商人の護符、金の指輪、努力の証、鍛冶師の金槌、怒りの炎、闘気の腕輪、修羅の証、番狂わせの一撃、強い者いじめ、身代わりの人形。
* **効果タイプ:** statBonus, weaponDamageBonus, interestCap, firstHitShield, weaponDurabilitySave, weaponAttackMpRecover, lastStrikeDamageMultiplier, lowMpDamageBonus, thornsDamage, regenPerTurn, potionEffectMultiplier, lowHpDamageMultiplier, battleStartHpReduction, damageTakenToMp, goldPerKill, weaponBreakDamageMultiplier, weaponBreakNextAttackBonus, levelUpDamageBoost, battleEndBonusExp, lowestLevelDamageMultiplier, highHpTargetRateBonus, deathProtection, killStreakBonus。
## 3 **武器**
* 武器は使用回数制限がある
* キャンプで休憩することで使用回数復活
## 4 **魔法**
* 魔法はMPを消費する
* MPはキャンプで休憩したりレベルアップやポーションで回復
## 5. ポーション
* MVPで実装されているポーションは以下の3種:
    * HPポーション（HP回復）
    * MPポーション（MP回復）
    * 修復ポーション（repair_potion）: 武器使用回数を回復する（`repairWeapons` 効果）
* **ターゲット:** targetTypeがallySingle（パーティー制で回復対象を選択）。
* **即時発動:** ターン消費なし。1ターンに複数回使用可能（所持数が上限）。
## 6. **ストアの枠**
* 2択選択制を採用: 4カテゴリ（武器/魔法/レリック/ポーション）をシード付きシャッフルし2+2に分割。ShopOption A/B（各6枠 = 2カテゴリ × 3枠）からどちらかを選択する。
  * ShopOption A: カテゴリ2種 × 3枠 = 計6枠
  * ShopOption B: カテゴリ2種 × 3枠 = 計6枠
* 品揃え変更(リロール): 初期コスト3G、使用ごとに1G増加
* 商品を購入した枠は売り切れ表示となり、品揃え変更してもその枠に新たな商品は出現しない

> **バランス調整:** 各枠数、リロールコスト、レリック上限、ポーション上限はTuning Editorで調整可能である。
## 7. **初期アイテム**
* このままだと序盤に何の選択もないまま終わってしまいそう
    * ソウルで解放することで、ダンジョン開始時にランダムな武器/魔法/レリックから1つ選んで獲得できるように
    * 上記はソウルのチュートリアルとして最初に解放をさせる。
