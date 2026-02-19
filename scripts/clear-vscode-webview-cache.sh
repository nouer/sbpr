#!/usr/bin/env bash
# VS Code / Cursor の Webview「Could not register service worker」エラー用
# キャッシュ一括削除スクリプト（Linux）
#
# 使い方:
#   1. VS Code と Cursor を**完全に終了**する（タスクトレイも含む）
#   2. ターミナルで: ./scripts/clear-vscode-webview-cache.sh
#   3. 再度 VS Code または Cursor を起動する

set -e
BASE="$HOME/.config"
CODE_DIR="$BASE/Code"
CURSOR_DIR="$BASE/Cursor"

echo "=== Webview キャッシュ削除（Code / Cursor）==="
echo "※ 事前に VS Code と Cursor を終了してください。"
echo ""

for NAME in "Code" "Cursor"; do
  DIR="$BASE/$NAME"
  if [[ ! -d "$DIR" ]]; then
    echo "[$NAME] スキップ（$DIR なし）"
    continue
  fi
  echo "[$NAME] $DIR"
  for SUB in "Cache" "CachedData" "Code Cache" "GPUCache" "Service Worker"; do
    PATH_SUB="$DIR/$SUB"
    if [[ -d "$PATH_SUB" ]]; then
      rm -rf "$PATH_SUB"
      echo "  削除: $SUB"
    fi
  done
done

echo ""
echo "完了。VS Code / Cursor を再起動してください。"
