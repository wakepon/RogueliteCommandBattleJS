# Git ワークフロー

## コミットメッセージの形式

```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

## Git コマンドの実行

現在の作業ディレクトリがgitリポジトリ内の場合、`-C` オプションは使用しない:

```bash
# ✅ 良い例（リポジトリ内にいる場合）
git show 42c544c --stat
git log --oneline -10

# ❌ 悪い例（不要な -C オプション）
git -C /path/to/repo show 42c544c --stat
```

## Pull Request ワークフロー

PR を作成する際:
1. コミット履歴全体を分析する（最新のコミットだけでなく）
2. `git diff [base-branch]...HEAD` で全ての変更を確認する
3. 包括的な PR サマリーを作成する
4. TODO を含むテスト計画を記載する
5. 新しいブランチの場合は `-u` フラグ付きで push する

## 機能実装ワークフロー

1. **まず計画を立てる**
   - **planner** agent を使用して実装計画を作成する
   - 依存関係とリスクを特定する
   - フェーズに分解する

2. **コードレビュー**
   - コードを書いた直後に **code-reviewer** agent を使用する
   - CRITICAL と HIGH の問題に対処する
   - 可能であれば MEDIUM の問題も修正する

3. **コミット & プッシュ**
   - 詳細なコミットメッセージを書く
   - conventional commits 形式に従う
