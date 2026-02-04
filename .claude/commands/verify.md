# Verification コマンド

現在のコードベースの状態に対して包括的な検証を実行します。

## 手順

以下の順序で正確に検証を実行:

1. **ビルドチェック**
   - このプロジェクトのビルドコマンドを実行
   - 失敗した場合、エラーを報告して停止

2. **型チェック**
   - TypeScript/型チェッカーを実行
   - すべてのエラーを file:line 形式で報告

3. **Lint チェック**
   - Linter を実行
   - 警告とエラーを報告

4. **テストスイート**
   - すべてのテストを実行
   - pass/fail 数を報告
   - カバレッジ率を報告

5. **console.log 監査**
   - ソースファイル内の console.log を検索
   - 場所を報告

6. **Git Status**
   - コミットされていない変更を表示
   - 最後のコミット以降に変更されたファイルを表示

## 出力

簡潔な検証レポートを生成:

```
VERIFICATION: [PASS/FAIL]

Build:    [OK/FAIL]
Types:    [OK/X errors]
Lint:     [OK/X issues]
Tests:    [X/Y passed, Z% coverage]
Secrets:  [OK/X found]
Logs:     [OK/X console.logs]

Ready for PR: [YES/NO]
```

重大な問題がある場合は、修正の提案とともにリスト化。

## 引数

$ARGUMENTS:
- `quick` - ビルド + 型のみ
- `full` - すべてのチェック（デフォルト）
- `pre-commit` - コミットに関連するチェック
- `pre-pr` - フルチェック + セキュリティスキャン
