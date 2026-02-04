---
name: verification-loop
description: 機能完成後やPR作成前に、ビルド・型チェック・Lint・テスト・セキュリティスキャンを包括的に実行する検証システム。
---

# Verification Loop Skill

Claude Code セッション用の包括的な検証システム。

## 使用タイミング

このスキルを呼び出す場面:
- 機能または重要なコード変更の完了後
- PR 作成前
- 品質ゲートの通過を確認したい時
- リファクタリング後

## 検証フェーズ

### Phase 1: ビルド検証
```bash
# プロジェクトがビルドできるか確認
npm run build 2>&1 | tail -20
# または
pnpm build 2>&1 | tail -20
```

ビルドが失敗した場合、停止して続行前に修正する。

### Phase 2: 型チェック
```bash
# TypeScript プロジェクト
npx tsc --noEmit 2>&1 | head -30

# Python プロジェクト
pyright . 2>&1 | head -30
```

すべての型エラーを報告。続行前にクリティカルなものを修正する。

### Phase 3: Lint チェック
```bash
# JavaScript/TypeScript
npm run lint 2>&1 | head -30

# Python
ruff check . 2>&1 | head -30
```

### Phase 4: テストスイート
```bash
# テストを実行
npm run test 2>&1 | tail -50
```

レポート:
- 総テスト数: X
- 成功: X
- 失敗: X

注意: 高カバレッジは目指さない。重要なロジック（ゲームのコア部分など）のみをテスト対象とする。

### Phase 5: セキュリティスキャン
```bash
# シークレットを確認
grep -rn "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# console.log を確認
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | head -10
```

### Phase 6: Diff レビュー
```bash
# 変更内容を表示
git diff --stat
git diff HEAD~1 --name-only
```

各変更ファイルを以下の観点でレビュー:
- 意図しない変更
- 欠けているエラーハンドリング
- 潜在的なエッジケース

## 出力形式

すべてのフェーズ実行後、検証レポートを生成:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

修正すべき問題:
1. ...
2. ...
```

## 継続モード

長いセッションでは、15分ごとまたは大きな変更後に検証を実行:

```markdown
メンタルチェックポイントを設定:
- 各関数の完了後
- コンポーネントの完成後
- 次のタスクに移る前

実行: /verify
```

## Hooks との統合

このスキルは PostToolUse hooks を補完しますが、より深い検証を提供します。
Hooks は問題を即座にキャッチし、このスキルは包括的なレビューを提供します。
