#!/bin/bash
# プロンプトをTSV形式で記録する UserPromptSubmit フック

hook_input=$(cat)

prompt=$(echo "$hook_input" | jq -r '.prompt // ""')
session_id=$(echo "$hook_input" | jq -r '.session_id // ""')
cwd=$(echo "$hook_input" | jq -r '.cwd // ""')
timestamp=$(date "+%Y-%m-%d %H:%M:%S")
user=$(git config user.name 2>/dev/null || echo "unknown")

# cwd が取得できなければ終了
if [ -z "$cwd" ] || [ -z "$prompt" ]; then
  exit 0
fi

# task-notification（subagent完了通知）は記録しない
case "$prompt" in
  '<task-notification>'*) exit 0 ;;
esac

log_dir="$cwd/RawData/PromptLogs"
mkdir -p "$log_dir"

log_file="$log_dir/${user}_$(date '+%Y-%m-%d').tsv"

# ファイルが新規ならヘッダーを書く
if [ ! -f "$log_file" ]; then
  printf '日時\tユーザー\tセッションID\tプロンプト\n' > "$log_file"
fi

# 改行・タブをスペースに置換してTSV安全にする
safe_prompt=$(echo "$prompt" | tr '\n\r\t' '   ')

printf '%s\t%s\t%s\t%s\n' "$timestamp" "$user" "$session_id" "$safe_prompt" >> "$log_file"

exit 0
