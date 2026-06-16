# 戦闘システム仕様

## ターン進行

### 1. ターン開始時
* 討伐ターンカウント減少。0未満の場合、ペナルティダメージ発生。

### 2. 行動フェーズ
* `command → partyAction → enemyAction → turnEnd` の4フェーズ制。
* Agi順ではなく、パーティー全員が先に行動してから敵が行動する。
* **commandフェーズ:** 全パーティーメンバーのコマンドを一括セット（CommandSlot[]）。
* **partyActionフェーズ:** セットしたコマンドを順次実行。
* **enemyActionフェーズ:** 敵がまとめて行動。
* **turnEndフェーズ:** バフ/デバフのターン経過処理（毒ダメージ、weaknessのduration減少等）。

### 3. 各キャラクターの行動
* **プレイヤー:** 武器/魔法を選択 → ターゲット選択 → 実行。
  * 実行時、対応するリソース（MP、使用回数、HP、Gold）を消費。
  * **リソース不足時は選択不可**とする。
  * **ターゲット選択:** 敵をタップ/クリックで直接選択。
* **敵:** 敵の行動ロジックに基づき攻撃。

### 4. ポーション
* ポーションは**ターン消費なし（フリーアクション）**で使用可能。
* **使用タイミング:** プレイヤーの行動ターン中のみ（敵ターン中は使用不可）。
* **使用回数制限:** 1ターンに何回でも使用可能（所持数が上限）。
* 戦闘中・ストア画面の両方で使用可能。

### 5. 終了判定
* 敵全滅 → 勝利（報酬画面へ）。
* パーティー全員HP0（全滅）→ 敗北（ゲームオーバー）。1人でも生存していれば継続。

## 討伐ターン制限

各戦闘にはターン制限があり、超過するとUIにターン超過が表示される。

ターン制限は敵種別ではなくステージごとにStagePatterns.jsonで個別設定される。

| ステージ | 制限ターン数 |
| :--- | :--- |
| stage_1 | 5ターン |
| stage_2 | 6ターン |
| stage_3 | 7ターン |
| stage_5 | 8ターン |
| stage_6 | 9ターン |
| stage_7 | 12ターン |
| stage_8 | 10ターン |
| stage_9 | 10ターン |
| stage_10 | 11ターン |
| stage_12 | 12ターン |
| stage_13 | 12ターン |
| stage_14 | 14ターン |
| stage_15 | 12ターン |
| stage_16 | 12ターン |
| stage_17 | 13ターン |
| stage_19 | 14ターン |
| stage_20 | 14ターン |
| stage_21 | 16ターン |

* **ペナルティダメージ:** 現状ペナルティ未実装、UIにのみ超過表示がある。

## ダメージ計算式（最重要）

現在の実装（DamageCalculator.ts）:

```
rawDamage = effectiveStat * effectivePower * buffMultiplier
          + effectiveStat * hpCostPowerBoostValue * buffMultiplier  // 修羅の血脈
          + effectiveStat * vulnBonus * buffMultiplier              // 逆境の鎧
          + effectiveStat * comboBuff.value * buffMultiplier        // 連携の紋章
          × weakness補正（1.0 - debuff.value）

最終ダメージ = floor(rawDamage) + offset(±variance) + shieldBashBonus
```

* **effectiveStat:** `baseStat + positionBonus + brokenBonus`
  * positionBonus: 前衛の矜持（frontRowIntBonus）または後衛の叡智（backRowStrBonus）
  * brokenBonus: 努力の証（brokenWeaponStatBonus）により壊れた武器1本あたりSTR加算
* **effectivePower:** `weapon.power + conditionalPowerBonus + weaponPowerBonusValue`
* **conditionalPower（条件付きPower加算）の種類:**
  * `selfHpConditional`（怒りの大剣）: 自身HP閾値以下で追加Power
  * `targetHpConditional`（処刑の大剣/処刑の雷）: ターゲットHP閾値以下で追加Power
  * `followUp`（追撃のナイフ/追撃の炎）: 同ターンで味方が先に攻撃済みのとき追加Power
  * `levelScale`（成長のナイフ）: 使用者レベル分を追加Power
  * `lowMpConditional`（渇きの火）: MP閾値以下のとき追加Power
* **weaponPowerBonus:** 武器強化バフ（weaponPowerBuff）によって付与される威力加算。
* **buffMultiplier:** `1.0 + totalStatBuffValue * buff_multiplier_per_point(0.1)`
* **shieldBashBonus:** 盾殴り（shieldBash）の場合、シールドバフのvalue値を最終ダメージに加算。
* **弱体（weakness）:** rawDamage に`(1.0 - debuff.value)`を乗算。
* **UnitStat:** 武器のscaleStatプロパティに従い、`str` または `int` で計算。

### ダメージ/回復ブレ幅
* **ブレ補正:** 加算方式。各武器/魔法にvariance値が設定されている。
* **分布:** `-variance ~ +variance` の整数が均等分布で生成され、基礎ダメージ(floor済み)に加算される。
* 計算例: 基礎ダメージ100、variance=5の場合、最終的に95～105のダメージになる。

### 端数処理
* 浮動小数点は計算途中で保持し、**最終ダメージで切り捨て（floor）**。
* 通常の回復量の端数は切り捨て（floor）。ただしレベルアップ時のHP/MP回復量はceil（切り上げ）。
* HP回復は最大HPでキャップされる（オーバーヒールなし）。

### 全体攻撃
* 全体攻撃（フレイムストーム等）は**各敵に同じダメージ**を与える。

## バフ/デバフ

### 持続ターン数
効果ごとに個別設定する。

| 効果 | 持続 |
| :--- | :--- |
| マッスルアップ（ダメージ倍率上昇） | 戦闘終了まで |
| 毒 | スタック制（後述） |
| 力溜め | 次の攻撃まで（攻撃後解除） |
| 精密バフ | 次の攻撃まで（nextAction持続） |
| 被ターゲット率UP | 戦闘中持続 |
| 弱体（weakness） | 持続ターン制（durationが毎ターン減少、0で解除） |
| vulnerability（被ダメ増加） | 持続ターン制（durationが毎ターン減少、0で解除） |
| 自己防御バフ（selfDefense） | 持続ターン制 |
| シールド（shield） | 持続ターン制（ダメージ吸収、0で解除） |
| 武器強化（weaponPowerBonus） | 持続ターン制（weaponPowerBonusに加算） |
| damageReduction | 持続ターン制（防御ポーション効果） |
| comboPowerBonus | 持続ターン制（連携の紋章効果） |
| thorns（棘） | 持続ターン制（被弾時反撃） |

### vulnerability（被ダメ増加）デバフ
* multiplierで受けるダメージが倍化される持続ターン制デバフ。
* シャーマンの「弱体の呪い」が付与する。
* BuffProcessor.tsで被ダメージ計算時に適用される。
* 逆境の鎧（vulnerabilityPowerBoost）を持つ場合、vulnerability状態中に攻撃力ボーナスを得る。

### 精密バフ
* 次の攻撃のダメージブレを最大値で固定する（varianceを最大値に固定）。
* nextAction持続（攻撃後解除）。

### 被ターゲット率UP (targetRateUp)
* 祈り（prayer）効果によって付与される。
* 敵ターゲット選択時の被弾率が上昇する。

### 毒システム（スタック制）
* 毒はスタックされ、毎ターン **固定ダメージ** を受ける（スタック数分ではない）。
* 毎ターン終了時、スタックは1減少する。スタックが0になると毒が解除される。
* 戦闘終了時にリセットされる。
* **注意:** 敵行動から毒攻撃は全削除されており実質的に発動しない（コードに処理は残存）。

## レリック効果の詳細（20種）

### 効果の適用タイミング

| レリック | 効果タイプ | 説明 |
| :--- | :--- | :--- |
| 修羅の血脈 | hpCostPowerBoost | HP消費コマンド使用時、Power加算ブーストが適用される |
| 逆境の鎧 | vulnerabilityPowerBoost | vulnerability状態中にPowerボーナス加算 |
| 魔力の残滓 | mpSpendShield | MP消費時、閾値以上のMP消費でシールド付与 |
| 研ぎ師の名刺 | knifeUseDurabilityRestore | ナイフ系武器の使用回数を一定使用ごとに自動回復 |
| 討伐の対価 | killMpRecover | 敵撃破時にMP回復 |
| 前衛の矜持 | frontRowIntBonus | 前衛（index=0）のINTにボーナス加算 |
| 後衛の叡智 | backRowStrBonus | 後衛のSTRにボーナス加算 |
| 挑発式防御 | shieldTaunt | シールドバフ付与時に挑発効果も付与 |
| 連携の紋章 | comboAttackBonus | 同ターン味方攻撃後にcomboPowerBonusバフ付与 |
| 闘気の腕輪 | levelUpStatBoost | レベルアップ時にSTR/INTを永続加算 |
| 努力の証 | brokenWeaponStatBonus | 壊れた武器1本あたりSTRを加算 |
| 苦痛のリング | damageTakenToMp | 被ダメージをMP変換 |
| 血の契約 | battleStartHpReduction | 戦闘開始時にHPを一定割合減らしSTRを加算 |
| 身代わりの人形 | deathProtection | 瀕死時に1度だけ生存する |
| 再生のコケ | regenPerTurn | 毎ターンHP回復 |
| 武器お手入れ用油 | weaponDurabilitySave | 確率で武器使用回数消費を防ぐ |
| 修羅の証 | battleEndBonusExp | 戦闘終了時にボーナスEXP獲得 |
| 棘の書 | thornsDurationBonus | thorns（棘）バフの持続ターン延長 |
| 錬金術の触媒 | potionEffectMultiplier | ポーション効果倍率上昇 |
| 薬師の鞄 | potionSlotBonus | ポーション所持枠を拡張 |

### レリックの重複
* 同じレリックを複数所持可能。
* 効果は加算される（例: 前衛の矜持 x2 → INTボーナス2倍）。

### レリック効果の永続性
* レリック効果はダンジョン内で永続する。
* ゲームオーバー/クリア時にリセットされる（ソウルシステム未実装のため）。

## レベルアップシステム

### 経験値
* **経験値配分:** 全パーティーメンバーに1EXP加算。さらに止めを刺したキャラにさらに+1EXP。

### レベルアップ条件
* 必要討伐数 = `floor(3 × log2(現在のレベル + 1))`
* 必要討伐数には上限キャップが設定されている（`levelup_required_kills_cap`、デフォルト5、Tuning Editorで調整可能）。

| レベル | 必要討伐数 | 累計討伐数 |
| :--- | :--- | :--- |
| 1→2 | 3体 | 3体 |
| 2→3 | 5体 | 8体 |
| 3→4 | 6体 | 14体 |
| 4→5 | 7体 | 21体 |

### レベルアップ効果（GrowthType選択制）

レベルアップ時、固定成長値の代わりに **2択の成長方向選択** が提示される。

* 5種の成長タイプ（attack/hp/mp/balance/allBonus）からクラス別重み付きランダムで2択を生成。
* 選択内容はBattleStateの`pendingGrowthChoices`キューに追加され、プレイヤーが選択する。
* 選択後に成長値が即時適用される。

| GrowthType | 概要 |
| :--- | :--- |
| attack | STRまたはINT重点成長 |
| hp | HP重点成長 |
| mp | MP重点成長 |
| balance | バランス型成長 |
| allBonus | 全ステータス小幅成長 |

* **HP/MP回復:** レベルアップ時の回復率はTuning Editorで調整可能（コード上のフォールバック値は25%: `levelup_hp_recovery_rate: 0.25`, `levelup_mp_recovery_rate: 0.25`）。回復量の端数はceil（切り上げ）処理。上限は新最大値。
* **Agi:** ExplorerState（プレイヤー）にAgiは存在しない。Agiは敵のみ。

### レベルアップのタイミング
* **敵討伐時に即時発動**。
* 戦闘中にHP/MP回復が発生するため、ピンチの場面での逆転が可能。

## ターゲティング詳細

### 前衛・後衛の動的決定
* ExplorerState に `position` フィールドは存在しない。`party` 配列の順序から動的に決定される。
* 配列先頭（index 0）の生存メンバーが前衛。先頭が死亡済み、または配列が空の場合は前衛なし扱い。
* 前衛なし時は生存メンバー全員が後衛重みで均等按分される。
* 根拠コード: `src/Lib/Core/PositionUtils.ts`（`getFrontMemberId` / `isFrontMember`）、`src/Lib/Core/TargetingSystem.ts`

## UI表示仕様

* **HPバー:** 全キャラクター共通で緑色で統一。
* **KillLineバー:** HPバー上の右端起点オーバーレイ方式で表示。KILL（確定キル）/ KILL?（不確定キル）のラベルがある。

## 戦闘状態管理

戦闘中に以下の状態が管理される:

* **battleMessage:** 敵行動のメッセージ表示。
* **relicState:** レリックに関連する戦闘内部状態。
* **pendingGrowthChoices:** レベルアップ時の成長選択キュー（GrowthType[][]）。

## 報酬処理

勝利時、以下の計算でゴールドを加算する。

* **報酬:** 戦闘に出現した**全ての敵のgoldReward合計**。
  * normal敵: 4G、elite敵: 7G、boss敵: 12G（Enemies.jsonで定義、パラメータ調整対象）。
  * 例: ボス（12G） + 雑魚2体（各4G）= 20G
* 利子（interest）システムは削除済み。BaseGold/Interest方式は廃止。
* **盗んだゴールド:** 別枠で加算（吸魔の杖等の効果）。
