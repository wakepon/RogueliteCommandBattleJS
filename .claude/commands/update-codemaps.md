# Update Codemaps

コードベースの構造を分析し、アーキテクチャドキュメントを更新:

1. すべてのソースファイルをスキャンして import、export、依存関係を取得
2. 以下の形式でトークン効率の良い codemap を生成:
   - codemaps/architecture.md - 全体アーキテクチャ
   - codemaps/data.md - データモデルとスキーマ

3. 前バージョンからの差分パーセンテージを計算
4. 変更が 30% を超える場合、更新前にユーザーの承認を要求
5. 各 codemap に鮮度タイムスタンプを追加
6. レポートを .reports/codemap-diff.txt に保存

分析には TypeScript/Node.js を使用。実装の詳細ではなく、高レベルの構造に焦点を当てる。
