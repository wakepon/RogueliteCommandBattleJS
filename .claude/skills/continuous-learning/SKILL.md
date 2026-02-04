---
name: continuous-learning
description: Claude Code セッションから再利用可能なパターンを自動的に抽出し、将来使用するための学習済みスキルとして保存します。
---

# Continuous Learning Skill

Claude Code セッション終了時に、再利用可能なパターンを抽出できるかどうかを自動的に評価します。

## 動作の仕組み

このスキルは各セッション終了時に **Stop hook** として実行されます:

1. **セッション評価**: セッションが十分なメッセージ数（デフォルト: 10以上）を持っているか確認
2. **パターン検出**: セッションから抽出可能なパターンを特定
3. **スキル抽出**: 有用なパターンを `.claude/skills/learned/` に保存

## 設定

`config.json` を編集してカスタマイズ:

```json
{
  "min_session_length": 10,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": ".claude/skills/learned/",
  "patterns_to_detect": [
    "error_resolution",
    "user_corrections",
    "workarounds",
    "debugging_techniques",
    "project_specific"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues"
  ]
}
```

## パターンタイプ

| パターン | 説明 |
|---------|------|
| `error_resolution` | 特定のエラーがどのように解決されたか |
| `user_corrections` | ユーザーの修正から得られたパターン |
| `workarounds` | フレームワーク/ライブラリの問題への回避策 |
| `debugging_techniques` | 効果的なデバッグアプローチ |
| `project_specific` | プロジェクト固有の規約 |

## Hook の設定

`.claude/settings.json` に追加:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": ".claude/skills/continuous-learning/evaluate-session.sh"
      }]
    }]
  }
}
```

## なぜ Stop Hook なのか？

- **軽量**: セッション終了時に1回だけ実行
- **ノンブロッキング**: 各メッセージにレイテンシを追加しない
- **完全なコンテキスト**: 完全なセッションのトランスクリプトにアクセス可能

## 関連

- `/learn` コマンド - セッション中に手動でパターン抽出
