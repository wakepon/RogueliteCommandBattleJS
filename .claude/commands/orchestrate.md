# Orchestrate コマンド

複雑なタスクのためのシーケンシャル Agent ワークフロー。

## 使用方法

`/orchestrate [workflow-type] [task-description]`

## ワークフロータイプ

### feature
フル機能実装ワークフロー:
```
planner -> code-reviewer
```

### tdd-feature
テスト駆動でフル機能実装ワークフロー:
```
planner -> tdd-guide -> code-reviewer
```

### bugfix
バグ調査・修正ワークフロー:
```
planner -> code-reviewer
```

### refactor
安全なリファクタリングワークフロー:
```
architect -> code-reviewer
```

## 実行パターン

ワークフロー内の各 Agent について:

1. **Agent を呼び出す** 前の Agent からのコンテキストを含めて
2. **出力を収集** 構造化された引き継ぎドキュメントとして
3. **次の Agent に渡す** チェーン内の次へ
4. **結果を集約** 最終レポートに

## 引き継ぎドキュメント形式

Agent 間で引き継ぎドキュメントを作成:

```markdown
## HANDOFF: [previous-agent] -> [next-agent]

### コンテキスト
[行われたことの要約]

### 発見事項
[主要な発見や決定]

### 変更されたファイル
[触れたファイルのリスト]

### 未解決の質問
[次の Agent への未解決項目]

### 推奨事項
[提案される次のステップ]
```

## 例: tdd-feature ワークフロー

```
/orchestrate tdd-feature "ユーザー認証を追加"
```

実行内容:

1. **Planner Agent**
   - 要件を分析
   - 実装計画を作成
   - 依存関係を特定
   - 出力: `HANDOFF: planner -> tdd-guide`

2. **TDD Guide Agent**
   - planner の引き継ぎを読む
   - まずテストを書く
   - テストをパスするように実装
   - 出力: `HANDOFF: tdd-guide -> code-reviewer`

3. **Code Reviewer Agent**
   - 実装をレビュー
   - 問題をチェック
   - 改善を提案
   - 出力: 最終レポート

## 最終レポート形式

```
ORCHESTRATION REPORT
====================
ワークフロー: feature
タスク: ユーザー認証を追加
Agents: planner -> tdd-guide -> code-reviewer

サマリー
-------
[1段落の要約]

Agent 出力
-------------
Planner: [要約]
TDD Guide: [要約]
Code Reviewer: [要約]

変更されたファイル
-------------
[変更された全ファイルのリスト]

テスト結果
------------
[テスト pass/fail サマリー]

推奨
--------------
[SHIP / NEEDS WORK / BLOCKED]
```

## 並列実行

独立したチェックには Agent を並列で実行:

```markdown
### 並列フェーズ
同時に実行:
- code-reviewer (品質)
- architect (設計)

### 結果のマージ
出力を単一のレポートに統合
```

## 引数

$ARGUMENTS:
- `feature <description>` - フル機能ワークフロー
- `bugfix <description>` - バグ修正ワークフロー
- `refactor <description>` - リファクタリングワークフロー
- `custom <agents> <description>` - カスタム Agent シーケンス

## カスタムワークフロー例

```
/orchestrate custom "architect,tdd-guide,code-reviewer" "キャッシュ層の再設計"
```

## ヒント

1. **複雑な機能は planner から始める**
2. **マージ前は必ず code-reviewer を含める**
3. **引き継ぎは簡潔に** - 次の Agent が必要なものに焦点を当てる
4. **必要に応じて Agent 間で検証を実行**
