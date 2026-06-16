## 1. 戦闘システム
### 1.1 **パーティ構成：** 最初から3人パーティー（戦士・魔法使い・僧侶）でダンジョンを開始する。段階的解放の仕組みは存在しない。
* **クラス:** warrior（戦士）、mage（魔法使い）、cleric（僧侶）の3種類。
* **ポジション:** 前衛（front）と後衛（back）の概念がある。前衛は後衛の2倍の確率で敵に狙われる。
* **前衛・後衛の動的決定:** ExplorerState に固定の position プロパティは存在しない。`party` 配列順から動的に決定される。配列先頭（index 0）の生存者が前衛、それ以外の生存者は全員後衛扱い。先頭が死亡済み、または配列が空の場合は前衛なし扱いとなり、生存者全員が後衛重みで均等按分される。これにより「死体を先頭に配置して被弾を分散する」戦術が成立する。
### 1.2 **攻撃の種類：** 武器か魔法を選んで攻撃
* 単体、全体、味方単体、味方全体、ランダム。
### 1.3 **パンチ**
* 戦士が持つ、無制限使用の無限行動コマンド（枠を消費しない）。他クラスは魔力弾や祈りなど別の無限行動を持つ。
* 戦士の初期武器はパンチ（枠消費なし）とナイフ（knife）。
* power値は1（STR x 1 = STR分のダメージ）、variance（ブレ幅）が設定されている。
* `maxUses: null` により枠を消費しない。
### 1.4 **ダメージ計算：**
現在のダメージ計算式（DamageCalculator.ts）:

```
rawDamage = effectiveStat * effectivePower * buffMultiplier
          + 各種追加Power加算分（修羅の血脈・逆境の鎧・連携の紋章）
          + 弱体補正（乗算）
最終ダメージ = floor(rawDamage) + offset(±variance) + shieldBashBonus
```

* **effectiveStat:** `baseStat + positionBonus + brokenBonus`。positionBonusはポジションボーナス（前衛の矜持/後衛の叡智）、brokenBonusは壊れた武器STRボーナス（努力の証）。
* **effectivePower:** `weapon.power + conditionalPowerBonus + weaponPowerBonusValue`。
* **conditionalPower:** 条件付きで加算される追加威力。以下の種類が実装されている:
  * **selfHpConditional（怒りの大剣）**: 自身HPが閾値以下のとき追加Power加算。
  * **targetHpConditional（処刑の大剣/処刑の雷）**: ターゲットHPが閾値以下のとき追加Power加算。
  * **followUp（追撃のナイフ/追撃の炎）**: 同ターンで味方が先に攻撃済みのとき追加Power加算。
  * **levelScale（成長のナイフ）**: 使用者のレベル分を追加Power加算。
  * **lowMpConditional（渇きの火）**: MPが閾値以下のとき追加Power加算。
* **weaponPowerBonus:** 武器強化バフによって付与される威力加算ボーナス。
* **バフ倍率（buffMultiplier）:** STRまたはINTバフの合計値に応じた乗算。未適用時は1.0。
* **ポジションボーナス:** 前衛の矜持（frontRowIntBonus）または後衛の叡智（backRowStrBonus）によってStat値に加算。
* **壊れた武器STRボーナス（努力の証）:** 壊れた武器1本あたりSTRに加算（brokenWeaponStatBonus）。
* **修羅の血脈:** HP消費時にPowerブーストを rawDamage に加算（`effectiveStat * hpCostPowerBoostValue * buffMultiplier`）。
* **逆境の鎧:** vulnerability（被ダメ増加）デバフ中にPowerボーナスを rawDamage に加算。
* **連携の紋章:** comboPowerBonusバフ分を rawDamage に加算。
* **シールドバッシュ（shieldBash）:** シールドバフのvalue値を最終ダメージに加算。
* **弱体（weakness）:** rawDamage に`(1.0 - debuff.value)`を乗算。

* **戦闘ペース：** 1戦闘は平均3ターン程度。ダンジョンクリアまでにトータル45回分の攻撃リソースが必要（21ステージ構成では増加）。

### 1.5 **武器のscaleStat**
* 武器にscaleStatプロパティが追加されており、`str` または `int` いずれかのステータスでダメージ計算が可能。

### 1.6 **ターゲットタイプ**
* `enemySingle`（敵単体）、`allySingle`（味方単体）、`enemyAll`（敵全体）、`allyAll`（味方全体）、`enemyRandom`（敵ランダム）の5種類。
* **isRandomTarget:** EnemyActionResult に `isRandomTarget` フィールドが存在し、各ヒットでランダムにターゲットを選択する行動に使用される。

### 1.7 **敵行動予告 (Intent)**
* EnemyIntent型が実装されており、敵の次ターンの行動と予測ダメージが事前に表示される。
* **storedActionによる行動一致保証:** 敵の行動はターン開始時に決定され`storedAction`として保持される。表示している予告と実際の行動が一致することが保証される仕組み。

### 1.8 **パーティー行動フェーズ**
* ターン進行は `command → partyAction → enemyAction → turnEnd` の4フェーズ制。
* Agi順ではなく、パーティー全員が先に行動してから敵が行動する。
* commandフェーズで全パーティーメンバーのコマンドを一括セット（CommandSlot[]）し、partyActionフェーズで順次実行する。

## 2. 武器・魔法
* **武器の特性：**
    * 攻撃力と攻撃対象への特殊効果。
    * 使用回数：平均3〜6回程度。
    * カテゴリ制（knife, greatsword, staff, shield, other）が導入されている。
    * 特殊効果：lifesteal、シールド付与、HP消費、自己vulnerability付与、追撃、HP%ダメージ、現在HP依存ダメージなど。

* **武器カテゴリ別一覧（18種）:**

  **knifeカテゴリ（4種）:**
    * **ナイフ（knife）:** 汎用ナイフ。効果なし。戦士初期装備。
    * **追撃のナイフ（followup_knife）:** 同ターン味方攻撃後に追加Power加算（followUp）。
    * **成長のナイフ（growth_knife）:** 使用者レベル分のPowerを追加（levelScale）。
    * **鍛錬のナイフ（training_knife）:** 使用時に戦闘中STR永続加算（combatStrGain）。

  **greatswordカテゴリ（5種）:**
    * **反動の大剣（recoil_greatsword）:** 高威力だが使用時にHPを消費（hpCost）。
    * **後隙の大剣（opening_greatsword）:** 高威力だが使用後に自身にvulnerability付与（selfVulnerability）。
    * **気まぐれ大剣（fickle_greatsword）:** 高威力・高variance。
    * **怒りの大剣（rage_greatsword）:** 自身HP閾値以下で追加Power（selfHpConditional）。
    * **処刑の大剣（execution_greatsword）:** ターゲットHP閾値以下で追加Power（targetHpConditional）。

  **staffカテゴリ（3種）:**
    * **稽古の杖（training_staff）:** INT依存。キル時全員追加EXP（killBonusExpToAll）。
    * **吸血の杖（vampire_staff）:** INT依存。ダメージの50%ライフスティール（lifestealPercent）。
    * **吸魔の杖（mana_drain_staff）:** INT依存。ダメージの75%をMP吸収（manaSteal）。

  **shieldカテゴリ（2種）:**
    * **守護の盾（guardian_shield）:** 味方単体にシールド付与（shield, value=20）。
    * **棘の盾（thorns_shield）:** 味方単体にシールド＋棘バフ付与（thornsShield）。

  **otherカテゴリ（4種）:**
    * **旋風剣（whirlwind_sword）:** 全体攻撃（enemyAll）。
    * **盾殴り（shield_bash）:** 自身のシールドvalue分のボーナスダメージ（shieldBash）。
    * **生命の拳（life_fist）:** ターゲット最大HPの30%ダメージ（hpPercentDamage）。
    * **捨て身の一撃（desperate_strike）:** 使用者の現在HPに基づくダメージ（currentHpDamage）。

* **魔法の特性：**
    * commandCategory: "spell"として実装。
    * 使用回数：MPを消費して発動。
    * 魔力弾・祈りはslotFree: trueでspells配列に格納（武器枠を消費しない）。

* **魔法一覧（22種）:**

  **slotFree魔法（2種）:**
    * **魔力弾（magic_bullet）:** 無制限。INT依存単体ダメージ。魔法使い初期装備。
    * **祈り（prayer）:** 無制限。味方単体の被ターゲット率UP（targetRateUp, value=25）。僧侶初期装備。

  **攻撃魔法（11種）:**
    * **ファイア（fire）:** 単体ダメージ（Common）。
    * **アイス（ice）:** 単体ダメージ（Common）。
    * **ボルケーノ（volcano）:** 高威力単体ダメージ（Rare）。
    * **反動フレイム（recoil_flame）:** HP消費の高威力単体ダメージ（Common）。
    * **暴走魔法（chaos_magic）:** 高威力・高variance単体ダメージ（Common）。
    * **渇きの火（thirst_fire）:** MP低下時に追加Power（lowMpConditional, Uncommon）。
    * **追撃の炎（followup_flame）:** 同ターン味方攻撃後に追加Power（followUp, Uncommon）。
    * **処刑の雷（execution_thunder）:** ターゲットHP閾値以下で追加Power（targetHpConditional, Uncommon）。
    * **お手本ファイア（training_fire）:** キル時全員追加EXP（killBonusExpToAll, Uncommon）。
    * **フレイムストーム（flame_storm）:** 全体ダメージ（enemyAll, Rare）。
    * **魔力放出（mana_release）:** 現在MP全消費のダメージ（mpAllDamage, Rare）。

  **補助魔法（9種）:**
    * **ヒール（heal）:** 味方単体HP回復（Common）。
    * **バリア（barrier）:** 味方単体シールド付与（shield, value=15, Common）。
    * **大ヒール（greater_heal）:** 味方単体HP大回復（Uncommon）。
    * **癒しの風（healing_wind）:** 味方全体HP回復（allyAll, Uncommon）。
    * **武器強化（weapon_enchant）:** 味方単体に武器強化バフ付与（weaponPowerBuff, Uncommon）。
    * **精密（precision）:** 次の攻撃のダメージブレを最大値で固定（Uncommon）。
    * **棘の護り（thorns_grant）:** 味方単体に棘バフ付与（thorns, Uncommon）。
    * **戦場の鍛冶（field_repair）:** 味方単体の武器使用回数回復（repairWeapons, Rare）。
    * **魔力の盾（mana_shield）:** MP50%消費してシールド付与（mpPercentShield, Rare）。

## 3. ポーション(消耗アイテム)
* **役割：** ゴールドで購入し、HP/MP回復やバフ付与に使用。
* **ターゲット:** targetTypeがallySingle（パーティー制で回復対象を選択）。
* **実装済みポーション（7種）:**
  * **HPポーション（hp_potion）:** HP回復。targetType: allySingle。
  * **MPポーション（mp_potion）:** MP回復。targetType: allySingle。
  * **修復ポーション（repair_potion）:** 武器使用回数を回復（repairWeapons value=2）。
  * **挑発ポーション（taunt_potion）:** 使用者を敵に挑発（taunt）。Uncommon。
  * **興奮ポーション（excitement_potion）:** STR・INT両方を一時的に加算（statBoost）。Uncommon。
  * **防御ポーション（defense_potion）:** 被ダメージを一定率軽減（damageReduction）。Uncommon。
  * **全体化ポーション（aoe_potion）:** 次の攻撃を全体化（aoeConvert）。Rare。
* **即時発動:** ポーションはターン消費なしで使用可能。1ターンに複数回使用可能（所持数が上限）。

## 4. バフ
* MVP実装されているバフ:
    * **マッスルアップ（筋力バフ）:** 倍率として機能（`1.0 + totalValue * 0.1` の乗算倍率）。
    * **力溜め:** 次の攻撃まで有効（主に敵が使用）。
    * **精密バフ (precision):** 次の攻撃のダメージブレを最大値で固定（nextAction持続）。
    * **被ターゲット率UP (targetRateUp):** 祈り効果による被弾率上昇バフ。
    * **自己防御バフ (selfDefense):** 敵が自分自身に付与する防御強化バフ。
    * **シールド (shield):** 被ダメージを一定量吸収するバリア。
    * **武器強化 (weaponPowerBonus):** 武器の威力を加算するバフ。
    * **棘 (thorns):** 被弾時に反撃ダメージを与えるバフ（棘の護り魔法等が付与）。
    * **damageReduction:** 被ダメージ軽減バフ（防御ポーション）。
    * **comboPowerBonus（連携の紋章）:** 連携ボーナスのPower加算バフ。
* 毎ターン回復はレリック「再生のコケ」(regenPerTurn)として実装されている。

## 5. デバフ
* MVP実装されているデバフ:
    * **毒:** スタック制。毎ターン固定ダメージ、スタックは毎ターン1減少し0になると解除される。ただし、敵行動から毒攻撃は全削除されており実質的に発動しない（コードに処理は残存）。
    * **弱体 (weakness):** 持続ターン制（durationが毎ターン減少し0で解除）。プレイヤーのダメージを低下させる。武器・魔法の両方に適用される。敵が付与するデバフ。
    * **vulnerability（被ダメ増加）:** 持続ターン制。multiplierで受けるダメージが倍化される。シャーマンの「弱体の呪い」が付与する。BuffProcessor.tsで被ダメージ計算時に適用。Explorer型に実装。
* 「出血」はMVP未実装。

## 6. 討伐ターン
* ターン制限はStageパターンごとに固定値として設定されている（StagePatterns.json）。
* 討伐ターン数を超過した場合のペナルティダメージは現状未実装。UIにのみターン超過の表示がある。

### 第二階層（Stage 8-14）
* BattleState に `enemyHpMultiplier` / `enemyDamageMultiplier` フィールドが存在し、第二階層では敵HP・敵攻撃力に倍率が適用される（Tuning Editorで調整可能）。

### 第三階層（Stage 15-21）
* `floor_3_hp_multiplier`（デフォルト3.0）と `floor_3_damage_multiplier`（デフォルト2.5）が適用される。

## 6.x ターゲティングシステム
* 前衛・後衛の判定は party 配列順から動的に決定される（1.1 参照）。
* 前衛（front）は後衛（back）の2倍の確率で敵に狙われる。先頭が死亡済みの場合は前衛なし扱いで生存者全員が後衛重みで均等按分。
* 祈りバフ（targetRateUp）による被ターゲット率の補正がある。

## 7. 戦闘後の報酬
* 報酬は出現した**全ての敵のgoldReward合計**（利子システムは削除済み）。
  * normal敵: 4G、elite敵: 7G、boss敵: 12G（Enemies.jsonで固定値）。
* BaseGold/Interest方式は廃止。利子（interest）は存在しない。

## 8. 回復メニュー（recoveryフェーズ）
* 戦闘後のストア画面に加え、別途回復メニューが表示される（phase: 'recovery'）。
* ゴールドを消費して以下の操作が可能：
  * HP回復
  * MP回復
  * 武器修理（全武器+1）
  * HP→MP変換
  * MP→HP変換
* 各操作にはコストが設定されており、Tuning Editorで調整可能。

## 9. レベルアップ成長選択（GrowthType）
* レベルアップ時、固定成長値の代わりに **2択の成長方向選択** が提示される。
* 5種の成長タイプ（attack/hp/mp/balance/allBonus）から重み付きランダムで2択を生成。
* 選択内容はBattleStateの`pendingGrowthChoices`キューに追加され、プレイヤーが戦闘中または戦闘後に選択する。

## 10. 経験値
* 全パーティーメンバーに1EXP加算 + 止めを刺したキャラにさらに+1EXP。
* 倒した瞬間に経験値を入手し、戦闘中でもレベルアップが発生する場合もある。
* レベルアップタイミングは次のユニットの行動前。
