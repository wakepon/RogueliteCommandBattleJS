# NoMP 化: 魔法の耐久値消費への統一

## 背景・目的
認知負荷軽減のため **MP システムを廃止**し、魔法を武器と同じ **耐久値（使用回数）消費**に統一する。
リソースを「耐久値」1本に集約し、全コマンドを「残り回数」という単一のメンタルモデルで読めるようにする。

作業ブランチ: `NoMP`

**実装状況**: A（MP前提魔法の廃止）・C（威力/耐久リバランス）は実装済み。
MP自体（`explorer.mp/maxMp`）はstateに残置しており、魔法はゲート判定・消費とも耐久値ベースに切替済み。
MPバー等のUI撤去（D以降/UIタスク）は未着手。

---

## 今回の意思決定（スコープ）

### A. MP前提の効果を持つ魔法は廃止【採用】
MP残量・MP消費に機構が依存する魔法は、耐久値化では意味をなさないため **削除**する。

廃止対象:
| ID | 名前 | 効果 | 廃止理由 |
|----|------|------|----------|
| `thirst_fire` | 渇きの大火 | `recoilMpDrain` | 消費MP依存 |
| `mp_charge` | MPチャージ | `healMp` | MP回復そのもの |

※ `mana_shield`（魔力の盾）は名称に反し `scalingShieldInt`（INT依存）なので **存続**。
※ `Spell.ts` 内の `旧・互換` 系 MP効果型（`mpAllDamage` / `mpPercentShield` / `lowMpConditional` / `recoilMpDrain` / `healMp` など）も、参照魔法が消えるため整理対象。

### B. 回復魔法の枯渇デス対策【今回は保留】
`heal` / `revive` 等が有限化することによる「回復手段の枯渇 → 詰み」リスクは認識するが、
**回数制に移行後、実プレイのバランスを見て調整**する。今回は対策を入れない。

### C. 威力／回数のリバランス【採用・下表で確定】
MPの細かい粒度を失うぶん、**MP消費量に応じて初期耐久（maxUses）を割り当てる**。
方針: MP消費が小さい魔法ほど耐久が多く（最大5）、大きいほど少なく（最小2）、間を4段で補間。

補間バンド:
| 旧MP消費 | 割り当て耐久 |
|---------|------------|
| 0（基礎・`slotFree`）| ∞（無制限 = `currentUses: null`）|
| 1〜3 | 5 |
| 4〜5 | 4 |
| 6〜7 | 3 |
| 8以上 | 2 |

各魔法への適用結果:
| ID | 名前 | 旧MP | 新maxUses |
|----|------|-----|-----------|
| `magic_bullet` | 魔力弾 | 0 | ∞ |
| `prayer` | 祈り | 0 | ∞ |
| `precision` | 精密 | 2 | 5 |
| `barrier` | バリア | 4 | 4 |
| `weapon_enchant` | 武器強化 | 4 | 4 |
| `ice` | アイス | 5 | 4 |
| `heal` | ヒール | 5 | 4 |
| `revenge_ice` | 復讐の氷弾 | 5 | 4 |
| `training_fire` | お手本ファイア | 5 | 4 |
| `mana_shield` | 魔力の盾 | 5 | 4 |
| `fire` | ファイア | 6 | 3 |
| `recoil_flame` | 反動フレイム | 6 | 3 |
| `greater_heal` | 大ヒール | 6 | 3 |
| `followup_flame` | 追撃の炎 | 7 | 3 |
| `healing_wind` | 癒しの風 | 7 | 3 |
| `field_repair` | 戦場の鍛冶 | 7 | 3 |
| `flame_storm` | フレイムストーム | 10 | 2 |
| `revive` | 蘇生呪文 | 20 | 2 |
| ~~`thirst_fire`~~ | ~~渇きの大火~~ | 1 | 廃止(A) |
| ~~`mp_charge`~~ | ~~MPチャージ~~ | 10 | 廃止(A) |

補足:
- `slotFree` かつ旧MP0 の基礎魔法（魔力弾・祈り）は **無制限**とし、全魔法の耐久が尽きても行動できるフォールバックを兼ねる（項目E相当）。
- 威力(`power`)自体は今回据え置き。回数で総火力を調整する。

### UI 変更【今回採用】
- **MPバーの削除**（パーティ表示・バトル画面などの MP ゲージ）。
- **ツールチップ／ショップの MP在庫・MP消費表示の撤去**。武器と同様「残り回数（耐久）」表示に統一。
- 武器の耐久セグメントバー（`SegmentedBar`）を魔法にも流用する方針。

---

## 今回は保留 / 移行後に再考（D以降）
回数制へ移行し、実際に触ってから再検討する:
- **D. クラス差別化の再設計**: MP量が担っていた「魔法使い＝リソースに深みのある詠唱者」という個性軸の代替（魔法枠・INTスケール・初期耐久・修理コスト・戦闘間の一部自動回復など）。
- **F. 耐久回復システムの拡張**: `repairWeapons`/`repairLastWeapon`・ショップ修理・レリックを魔法の耐久にも適用。ラン全体の消耗カーブが武器＋魔法を1レバーで支配する点の調整。
- **H. INTの役割強化 / Tuning整理**: MP系Tuning（`global_mp_cost_multiplier` 等）の死に項目整理、INTを威力以外にも効かせる案。
- **B（再掲）**: 回復魔法の枯渇デス対策。

---

## 影響範囲（実装時の着手点メモ）
- 型: `ExplorerState.mp / maxMp` の撤去、`Spell.ts`(`IMpCost` / `mpCostRate` / MP系 `SpellEffect`) の整理、`SpellInstance` への `currentUses` / `maxUses` 付与。
- ロジック: `MpCostCalculator.ts`（撤去）、`CommandValidator.isSpellAvailable`（耐久判定へ）、`BattleActionProcessor`（消費処理）、`Explorer.ts` クラステンプレの `mp` 撤去。
- データ: `Spells.json` に `maxUses` 付与、廃止2件の削除。
- UI: MPバー・MP表示コンポーネント（`PartyAvatars` / `TooltipCard` / `ItemDescription` / `StoreScreen` / `NextStagePreview` 等）。
- Tuning: `*_mp` / `global_mp_cost_*` 系の整理。

## 敵デザインとの整合（メモリ方針）
魔法も耐久制になるため「耐久ドレイン敵」は全装備を脅かす統一脅威になる。
既存方針どおり**武器/魔法の耐久を攻撃する敵は引き続き避ける**。
