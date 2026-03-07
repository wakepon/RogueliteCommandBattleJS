---
name: refactor-clean
description: 不要コード削除・統合の専門スキル。未使用コードや重複コードの特定と安全な削除を行う。
---

# Refactor Clean Skill - チーム編成マルチエージェント並列ワークフロー

不要コードの検出・分類・安全な削除をチーム体制で並列処理する。

```
Analyzer×3 (並列) ──→ Verifier×N (並列) ──→ Cleaner×N (並列) ──→ BuildCheck + Reviewer
```

## チームメンバーと役割

| メンバー     | Agent種別              | 役割                               | 並列度            |
| ------------ | ---------------------- | ---------------------------------- | ----------------- |
| **Analyzer** | Bash（直接実行）       | knip/depcheck/ts-prune の実行      | 3（同時実行）     |
| **Verifier** | Explore subagent       | 削除候補の参照チェック・安全性検証 | カテゴリ数に応じN |
| **Cleaner**  | refactor-cleaner agent | カテゴリ別に不要コードを削除       | カテゴリ数に応じN |
| **Reviewer** | code-reviewer agent    | 全変更の最終レビュー               | 1                 |

## 実行フロー

### Phase 1: 並列分析（Analyzer×3）

以下の3コマンドを **1つのメッセージ内で3つの並列Bash tool call** として同時実行する:

```bash
# 並列実行1: 未使用 export/ファイル/依存関係
npx knip 2>&1 | head -80

# 並列実行2: 未使用 npm 依存関係
npx depcheck 2>&1 | head -80

# 並列実行3: 未使用 TypeScript export
npx ts-prune 2>&1 | head -50
```

**出力**: 3ツールの分析結果を統合し、削除候補リストを作成する。

### Phase 2: 分類 + 並列参照チェック（Verifier×N）

Phase 1 の結果を以下のカテゴリに分類し、カテゴリごとに **Explore subagent を並列起動** して参照チェックを行う:

| カテゴリ            | Verifier の検証内容                               |
| ------------------- | ------------------------------------------------- |
| 未使用 npm 依存関係 | package.json 以外で require/import されていないか |
| 未使用 export       | コードベース内で参照されていないか、動的importは  |
| 未使用ファイル      | import/require で参照されていないか               |
| 重複コード          | 最適な統合先の特定                                |

各 Verifier (Task subagent_type=Explore) に渡す情報:

- 分析ツールが検出した削除候補の一覧
- 検証すべきカテゴリ
- 「各候補のインポート参照・動的参照を grep で確認し、SAFE/CAUTION/DANGER に分類して報告せよ」

**出力**: カテゴリ別の安全性レポート

```markdown
## VERIFICATION REPORT: [カテゴリ名]

### SAFE（削除可能）

- [項目]: [理由]

### CAUTION（確認必要）

- [項目]: [理由]

### DANGER（削除不可）

- [項目]: [理由]
```

全 Verifier の結果をまとめて `.reports/dead-code-analysis.md` に保存する。
CAUTION 項目がある場合はユーザーに確認を取る。

### Phase 3: 並列削除（Cleaner×N）

ビルドのベースラインを確認した後、SAFE 項目のみを対象に **カテゴリ別に Cleaner を並列起動** する:

```bash
# まずベースライン確認
npm run build
```

Cleaner は Task(subagent_type=refactor-cleaner) として起動し、**ファイル競合しないカテゴリを並列実行**:

- **Cleaner 1**: 未使用 npm 依存関係の削除
- **Cleaner 2**: 未使用 export の削除
- **Cleaner 3**: 未使用ファイルの削除

各 Cleaner への指示テンプレート:

```markdown
## 削除タスク: [カテゴリ名]

### 削除対象（SAFEのみ）

- [対象1]: [削除方法]
- [対象2]: [削除方法]

### 注意事項

- SAFE に分類された項目のみ削除すること
- CAUTION/DANGER は絶対に触れないこと
- 削除した内容を一覧で報告すること
```

### Phase 4: 検証 + レビュー（BuildCheck + Reviewer 並列）

全 Cleaner 完了後:

1. `npm run build` でビルド確認
2. **失敗時**: `git checkout -- .` でロールバックし、問題の Cleaner の変更を個別に調査
3. **成功時**: code-reviewer agent で全変更をレビュー

ビルド確認とレビューは直列実行（ビルドが通らなければレビュー不要）。

### Phase 5: サマリー

```
REFACTOR CLEAN REPORT
=====================
チーム: Analyzer(3) + Verifier(N) + Cleaner(N) + Reviewer(1)

Phase 1: 分析
-----------
knip: [検出数]件
depcheck: [検出数]件
ts-prune: [検出数]件

Phase 2: 分類結果
--------------
SAFE: [N]件 → 削除対象
CAUTION: [N]件 → スキップ
DANGER: [N]件 → スキップ

Phase 3: 削除結果
--------------
Cleaner 1 (依存関係): [削除数]件
Cleaner 2 (export): [削除数]件
Cleaner 3 (ファイル): [削除数]件

Phase 4: 検証
-----------
ビルド: PASS/FAIL
レビュー: Approve / Warning

削除済み:
- [file/export/dep]: [理由]

スキップ（CAUTION/DANGER）:
- [file/export/dep]: [理由]
```

## 並列実行の原則

1. **Phase 1**: 3つのBashコマンドを並列実行（agent不要、直接Bash）
2. **Phase 2**: カテゴリ別に Explore subagent を並列起動（参照チェック）
3. **Phase 3**: カテゴリ別に refactor-cleaner agent を並列起動（削除作業）
4. **Phase 間**: 前フェーズの出力が次フェーズの入力になるため直列

## コンテキスト節約の原則

1. **Verifier は Explore subagent**: 大量の grep 結果でメインコンテキストを消費しない
2. **Cleaner は refactor-cleaner agent**: 各自のコンテキストで独立作業
3. **メインエージェントはオーケストレーションに徹する**: 分析・削除はサブエージェントに委譲
4. **引き継ぎは最小限に**: 各 Phase の出力は要約して次に渡す

## 注意事項

- DANGER 分類の項目は絶対に削除しない
- CAUTION 分類の項目はユーザーに確認してから削除する
- Phase 4 のビルド確認を省略しない
- 検出結果が少ない場合（カテゴリ1〜2件のみ）は Cleaner を並列化せず直接実行してもよい
