# ストア・アイテム仕様

## ストア画面

* **表示タイミング:** 毎戦闘後に必ず表示（イベントステージ後は表示なし）。
* **陳列数:** 5枠2選択方式。5枠（武器1/魔法1/ランダム〔武器or魔法〕1/レリック1/ポーション1）から2つを選択する。
* **レイアウト:** 1画面に全商品を表示（タブ切り替えなし）。
* **品揃え変更 (Reroll):** 初期コスト3G（Tuning Editorで調整可能）、使用ごとに1G増加。
  * 同じ商品が再度出現する可能性あり（完全ランダム）。
* **売却:** 所持アイテムを選択後、売却ボタンで売却。
  * 武器の売却価格: `floor((購入価格 - 最低売値) * (現在の使用回数 / 最大使用回数) * 0.5 + 最低売値)`。最低売値は購入価格10G以上なら2G、10G未満なら1G（耐久0でも最低売値を保証）。
* **購入制限:** 所持枠が上限の場合は購入不可（先に売却が必要）。
* **ポーション使用:** ストア画面でもポーションを使用可能。

### 商品抽選システム

* **アイテムデータ:** 各アイテムに`価格`と`レアリティ`を個別設定（JSONデータで管理）。
* **階層別レアリティフィルタ:**
  * 第1階層（Stage 1-7）: Common/Uncommonのみ出現
  * 第2階層（Stage 8-14）: Uncommon/Rareのみ出現
  * 第3階層（Stage 15-21）: Rareのみ出現（floor_3_rare_rate=0.7の加重抽選も適用）
* **薬師の鞄レリック:** potionSlotBonusによってポーション枠が拡張される。

## MVP用データセット

実装ボリュームを抑えるための最小セットです。

### 武器 (Weapons)
各武器にはvariance（ダメージブレ幅）が設定されており、ダメージ計算時に±varianceの加算ブレが適用される。
カテゴリ（category）プロパティ: knife, greatsword, staff, shield, other。

| 名前 | カテゴリ | 威力 | 回数 | 価格 | レアリティ | 範囲 | 特殊効果 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ナイフ** | knife | 4 | 6 | 4 | Common | 単体 | 戦士初期装備。効果なし。 |
| **追撃のナイフ** | knife | 3 | 5 | 7 | Uncommon | 単体 | 同ターン味方攻撃後に追加Power（followUp）。 |
| **成長のナイフ** | knife | 2 | 6 | 7 | Uncommon | 単体 | 使用者レベル分のPower追加（levelScale）。 |
| **鍛錬のナイフ** | knife | 2 | 6 | 8 | Uncommon | 単体 | 使用時に戦闘中STR永続加算（combatStrGain）。 |
| **反動の大剣** | greatsword | 8 | 3 | 5 | Common | 単体 | 使用時にHP消費（hpCost: 10）。 |
| **後隙の大剣** | greatsword | 7 | 4 | 5 | Common | 単体 | 使用後に自身にvulnerability付与（selfVulnerability）。 |
| **気まぐれ大剣** | greatsword | 9 | 2 | 4 | Common | 単体 | 高variance（14）。 |
| **怒りの大剣** | greatsword | 3 | 4 | 7 | Uncommon | 単体 | 自身HP≤50%で追加Power（selfHpConditional, +5）。 |
| **処刑の大剣** | greatsword | 3 | 3 | 8 | Uncommon | 単体 | ターゲットHP≤30%で追加Power（targetHpConditional, +5）。 |
| **稽古の杖** | staff | 3 | 5 | 8 | Uncommon | 単体 | INT依存。キル時全員追加EXP（killBonusExpToAll）。 |
| **吸血の杖** | staff | 3 | 4 | 10 | Rare | 単体 | INT依存。ダメージの50%ライフスティール（lifestealPercent）。 |
| **吸魔の杖** | staff | 2 | 4 | 10 | Rare | 単体 | INT依存。ダメージの75%をMP吸収（manaSteal）。 |
| **守護の盾** | shield | 0 | 5 | 7 | Uncommon | 味方単体 | 味方単体にシールド付与（shield, value=20）。 |
| **棘の盾** | shield | 0 | 4 | 10 | Rare | 味方単体 | 味方単体にシールド＋棘バフ付与（thornsShield）。 |
| **旋風剣** | other | 3 | 3 | 10 | Rare | 全体(enemyAll) | 全体攻撃。 |
| **盾殴り** | other | 2 | 4 | 8 | Uncommon | 単体 | シールドバフのvalue分ボーナスダメージ（shieldBash）。 |
| **生命の拳** | other | - | 3 | 7 | Uncommon | 単体 | ターゲット最大HPの30%ダメージ（hpPercentDamage）。 |
| **捨て身の一撃** | other | - | 2 | 10 | Rare | 単体 | 使用者の現在HPに基づくダメージ（currentHpDamage）。 |

### 魔法 (Spells)
commandCategory: "spell"。各魔法にもvariance（ダメージブレ幅）が設定されている。

**slotFree魔法（枠を消費しない）:**

| 名前 | MP | レアリティ | 範囲 | 特殊効果 |
| :--- | :--- | :--- | :--- | :--- |
| **魔力弾** | 0 | Common | 単体 | 魔法使い初期。INT依存ダメージ（slotFree: true）。 |
| **祈り** | 0 | Common | 味方単体 | 僧侶初期。被ターゲット率UP（targetRateUp, slotFree: true）。 |

**通常魔法（攻撃系）:**

| 名前 | 威力 | MP | 価格 | レアリティ | 範囲 | 特殊効果 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ファイア** | 5 | 6 | 5 | Common | 単体 | 単体ダメージ。 |
| **アイス** | 4 | 5 | 5 | Common | 単体 | 単体ダメージ。 |
| **ボルケーノ** | 8 | 16 | 12 | Rare | 単体 | 高威力単体ダメージ。 |
| **反動フレイム** | 7 | 6 | 5 | Common | 単体 | HP消費（hpCost: 8）の高威力ダメージ。 |
| **暴走魔法** | 8 | 8 | 5 | Common | 単体 | 高variance（14）の高威力ダメージ。 |
| **渇きの火** | 3 | 4 | 7 | Uncommon | 単体 | MP≤25%で追加Power（lowMpConditional, +5）。 |
| **追撃の炎** | 3 | 5 | 7 | Uncommon | 単体 | 同ターン味方攻撃後に追加Power（followUp, +4）。 |
| **処刑の雷** | 3 | 6 | 8 | Uncommon | 単体 | ターゲットHP≤30%で追加Power（targetHpConditional, +5）。 |
| **お手本ファイア** | 3 | 5 | 7 | Uncommon | 単体 | キル時全員追加EXP（killBonusExpToAll）。 |
| **フレイムストーム** | 3 | 10 | 11 | Rare | 全体(enemyAll) | 全体ダメージ。各敵に同じダメージ。 |
| **魔力放出** | - | 全MP | 10 | Rare | 単体 | 現在MP全消費のダメージ（mpAllDamage）。 |

**通常魔法（補助系）:**

| 名前 | MP | 価格 | レアリティ | 範囲 | 特殊効果 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ヒール** | 5 | 4 | Common | 味方単体 | 僧侶初期。HPを回復（heal, value=20）。 |
| **バリア** | 4 | 5 | Common | 味方単体 | シールドを付与（shield, value=15）。 |
| **大ヒール** | 6 | 8 | Uncommon | 味方単体 | HP大回復（heal, value=25）。 |
| **癒しの風** | 7 | 8 | Uncommon | 味方全体 | 味方全員HP回復（heal, value=8, allyAll）。 |
| **武器強化** | 4 | 7 | Uncommon | 味方単体 | 武器威力バフ付与（weaponPowerBuff, value=3）。 |
| **精密** | 2 | 4 | Common | 味方単体 | 次の攻撃ダメージブレを最大値に固定（buff: precision）。 |
| **棘の護り** | 4 | 7 | Uncommon | 味方単体 | 棘バフ付与（thorns, value=10）。 |
| **戦場の鍛冶** | 6 | 10 | Rare | 味方単体 | 武器使用回数回復（repairWeapons, value=2）。 |
| **魔力の盾** | 50%MP | 10 | Rare | 味方単体 | MP50%消費してシールド付与（mpPercentShield）。 |

### レリック (Relics)
| 名前 | 価格 | レアリティ | 効果タイプ | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **修羅の血脈** | 10 | Rare | hpCostPowerBoost | HP消費コマンド使用時にPowerブースト（duration=1） |
| **逆境の鎧** | 8 | Uncommon | vulnerabilityPowerBoost | vulnerability状態中にPowerボーナス加算 |
| **魔力の残滓** | 7 | Uncommon | mpSpendShield | MP消費時に閾値以上消費でシールド付与 |
| **研ぎ師の名刺** | 5 | Common | knifeUseDurabilityRestore | ナイフ系武器を一定回数使用ごとに耐久自動回復 |
| **討伐の対価** | 5 | Common | killMpRecover | 敵撃破時にMP回復 |
| **前衛の矜持** | 5 | Common | frontRowIntBonus | 前衛（index=0）のINTにボーナス加算 |
| **後衛の叡智** | 5 | Common | backRowStrBonus | 後衛のSTRにボーナス加算 |
| **挑発式防御** | 7 | Uncommon | shieldTaunt | シールドバフ付与時に挑発効果も付与 |
| **連携の紋章** | 10 | Rare | comboAttackBonus | 同ターン味方攻撃後にcomboPowerBonusバフ付与 |
| **闘気の腕輪** | 7 | Uncommon | levelUpStatBoost | レベルアップ時にSTR/INTを永続加算 |
| **努力の証** | 7 | Uncommon | brokenWeaponStatBonus | 壊れた武器1本あたりSTRを加算 |
| **苦痛のリング** | 5 | Common | damageTakenToMp | 被ダメージをMP変換 |
| **血の契約** | 7 | Uncommon | battleStartHpReduction | 戦闘開始時にHPを一定割合減らしSTR加算 |
| **身代わりの人形** | 10 | Rare | deathProtection | 瀕死時に1度だけ生存する |
| **再生のコケ** | 5 | Common | regenPerTurn | 毎ターンHP回復 |
| **武器お手入れ用油** | 5 | Common | weaponDurabilitySave | 確率で武器使用回数消費を防ぐ |
| **修羅の証** | 10 | Rare | battleEndBonusExp | 戦闘終了時にボーナスEXP獲得 |
| **棘の書** | 10 | Rare | thornsDurationBonus | thorns（棘）バフの持続ターン延長 |
| **錬金術の触媒** | 5 | Common | potionEffectMultiplier | ポーション効果倍率上昇（×1.5） |
| **薬師の鞄** | 7 | Uncommon | potionSlotBonus | ポーション所持枠を+2拡張 |

### ポーション (Potions)
| 名前 | 価格 | レアリティ | 効果 |
| :--- | :--- | :--- | :--- |
| **HPポーション** | 2 | Common | HPを回復（healHp, value=10）。targetType: allySingle。 |
| **MPポーション** | 2 | Common | MPを回復（healMp, value=10）。targetType: allySingle。 |
| **修復ポーション** | 4 | Common | 武器使用回数を回復（repairWeapons value=2）。targetType: allySingle。 |
| **挑発ポーション** | 3 | Uncommon | 使用者を敵に挑発（taunt）。targetType: allySingle。 |
| **興奮ポーション** | 4 | Uncommon | STR・INT両方を一時的に加算（statBoost: str+4, int+4）。targetType: allySingle。 |
| **防御ポーション** | 3 | Uncommon | 被ダメージを軽減（damageReduction, rate=0.5）。targetType: allySingle。 |
| **全体化ポーション** | 5 | Rare | 次の攻撃を全体化（aoeConvert）。targetType: allySingle。 |

* **即時発動:** ポーションはターン消費なし（フリーアクション）。1ターンに複数回使用可能（所持数が上限）。
