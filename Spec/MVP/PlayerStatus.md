# プレイヤー・ステータス仕様

## 基礎ステータス（初期値）

MVPでは3クラス制（戦士・魔法使い・僧侶）のパーティーを実装。最初から3人パーティーでダンジョンを開始する。

### 戦士 (warrior)
* **HP:** Tuning Editorで調整可能
* **MP:** 5 / 5
* **筋力 (Str):** 7
* **知力 (Int):** 3
* **武器枠:** 4
* **魔法枠:** 0

### 魔法使い (mage)
* **HP:** Tuning Editorで調整可能
* **MP:** 25 / 25
* **筋力 (Str):** 3
* **知力 (Int):** 7
* **武器枠:** 0
* **魔法枠:** 4

### 僧侶 (cleric)
* **HP:** Tuning Editorで調整可能
* **MP:** 15 / 15
* **筋力 (Str):** 4
* **知力 (Int):** 5
* **武器枠:** 1（初期武器は空）
* **魔法枠:** 3

### 共通ステータス
* **所持金 (Gold):** 0 G（パーティー共有、createInitialRunの設定値）
* **レベル:** 1（各キャラクター個別）
* **Agi（素早さ）:** ExplorerState（プレイヤー）にAgiは存在しない。Agiは敵のみ。

## レベルアップ

* 必要討伐数 = `floor(3 × log2(現在のレベル + 1))`
* レベルアップ効果（**GrowthType選択制**）:
  * レベルアップ時に2択の成長方向を提示（5種のGrowthTypeからクラス別重み付きランダムで選択）。
  * 選択内容はBattleStateの`pendingGrowthChoices`キューに追加され、プレイヤーが選択する。

| GrowthType | 概要 |
| :--- | :--- |
| attack | STRまたはINT重点成長 |
| hp | HP重点成長 |
| mp | MP重点成長 |
| balance | バランス型成長 |
| allBonus | 全ステータス小幅成長 |

* **HP成長値:** HP成長値はTuning Editorで調整可能なパラメータ調整対象値。
* **HP/MP回復:** レベルアップ時の回復率はTuning Editorで調整可能（コード上のフォールバック値は**25%**: `levelup_hp_recovery_rate: 0.25`, `levelup_mp_recovery_rate: 0.25`）。上限は新最大値。
* 詳細は [BattleSystem.md](BattleSystem.md) を参照。

## 所持枠

レリックとポーションはパーティー共有。武器・魔法枠はクラスごとに異なる。

| クラス | 武器枠 | 魔法枠 | レリック枠 | ポーション枠 |
| :--- | :--- | :--- | :--- | :--- |
| warrior（戦士） | 4 | 0 | 5（共有） | 2（共有） |
| mage（魔法使い） | 0 | 4 | 5（共有） | 2（共有） |
| cleric（僧侶） | 1 | 3 | 5（共有） | 2（共有） |

* 薬師の鞄レリック所持時はポーション枠が+2される。

## パンチ（戦士のみ）

* 戦士のみの初期コマンド。`maxUses: null` により武器枠を消費しない。
* power=1（STR x 1 = STR分のダメージ）、variance=2のブレ幅あり。

## 初期装備

| クラス | 武器 | 魔法 |
| :--- | :--- | :--- |
| 戦士 (warrior) | パンチ（枠消費なし）、**ナイフ**（id: knife） | なし |
| 魔法使い (mage) | 魔力弾（slotFree、枠消費なし） | **アイス**（id: ice） |
| 僧侶 (cleric) | 祈り（slotFree、枠消費なし） | ヒール（id: heal） |

* 魔力弾と祈りはcommandCategory: "spell"、slotFree: trueとして実装（spells配列に格納）。
* 僧侶の武器枠は1だが初期武器は空（武器枠は将来の購入用）。
* レリック・ポーションは全クラス初期なし（Gold: 0G）。

## 前衛・後衛の動的決定

* ExplorerState に `position` フィールドは存在しない。`party` 配列の順序から動的に決定される。
* 配列先頭（index 0）の生存メンバーが前衛、それ以外の生存メンバーは全員後衛扱い。
* 先頭が死亡済み、または配列が空の場合は前衛なし扱いとなり、生存メンバー全員が後衛重みで均等按分される。
* 根拠コード: `src/Lib/Core/PositionUtils.ts`（`getFrontMemberId` / `isFrontMember`）、`src/Lib/Types/Explorer.ts`
