#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_NAME="cleanin-dev"
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux new-session -d -s "$SESSION_NAME" -n preview -c "$ROOT_DIR" 'npm run dev'
fi
for entry in 'preview|npm run dev' 'extension|npm run dev:extension' 'storybook|npm run storybook'; do
  name="${entry%%|*}"
  if ! tmux list-windows -t "$SESSION_NAME" -F '#W' | rg -qx "$name"; then
    tmux new-window -t "$SESSION_NAME" -n "$name" -c "$ROOT_DIR" "${entry#*|}"
  fi
done
printf 'CleanIn preview: http://127.0.0.1:11016/popup/popup.html\nStorybook: http://127.0.0.1:16016\nUnpacked extension: %s/Downloads/extensions/cleanin-dev\n' "$HOME"
