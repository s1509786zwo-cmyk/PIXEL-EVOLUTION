#!/usr/bin/env bash
# ===========================================================
# 恒久データ保護ゲート — 今後すべてのコード・機能変更で必ず実行する
#   bash tests/verify_all.sh
#
# 1 つでも失敗したら「その変更は適用しない」。直前の正常な状態へ戻すこと。
# 保護テスト (check_data_guard.mjs) は最初に実行する。
# ===========================================================
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd)
LOG=$(mktemp /tmp/ocf_verify_XXXXXX.log)
PASS=0
FAIL=0
FAILED=()

run () {
  local label="$1"; shift
  printf '%-46s ' "$label"
  if "$@" >"$LOG" 2>&1; then
    echo "OK"; PASS=$((PASS + 1))
  else
    echo "FAIL"; FAIL=$((FAIL + 1)); FAILED+=("$label")
    echo "----- $label -----"; tail -n 30 "$LOG"
  fi
}

echo "== 0. 構文（node --check / py_compile / CSS 括弧） =="
SYN=0
for f in js/*.js tests/*.mjs; do
  node --check "$f" >/dev/null 2>&1 || { echo "JS SYNTAX FAIL: $f"; SYN=1; }
done
for f in serve.py tests/*.py; do
  python3 -m py_compile "$f" >/dev/null 2>&1 || { echo "PY SYNTAX FAIL: $f"; SYN=1; }
done
CSS=$(python3 - <<'PY'
import re
s=open('css/style.css',encoding='utf-8').read()
print(s.count('{'), s.count('}'))
PY
)
set -- $CSS
[ "$1" = "$2" ] || { echo "CSS BRACES FAIL: $CSS"; SYN=1; }
if [ "$SYN" -eq 0 ]; then echo "ALL_JS_OK / ALL_MJS_OK / PY_OK / CSS BRACES $CSS OK"; PASS=$((PASS+1));
else echo "SYNTAX FAIL"; FAIL=$((FAIL+1)); FAILED+=("構文チェック"); fi

echo
echo "== 1. 最重要：恒久データ保護テスト（変更前後・再起動・二重バックアップ） =="
run "check_data_guard.mjs (必須)"      node tests/check_data_guard.mjs
run "check_idb.mjs"                     node tests/check_idb.mjs
run "check_modules.mjs"                node tests/check_modules.mjs
run "check_save.mjs"                   node tests/check_save.mjs
run "check_new_char.mjs"               node tests/check_new_char.mjs

echo
echo "== 2. 既存機能の回帰（全画面・戦闘・素材・画面追加の影響確認） =="
run "check_runtime.mjs"                node tests/check_runtime.mjs
run "check_enemy_art.mjs"              node tests/check_enemy_art.mjs
run "check_skill_info.mjs"             node tests/check_skill_info.mjs
run "check_creator.mjs"                node tests/check_creator.mjs
run "check_story_hint.mjs"             node tests/check_story_hint.mjs

echo
echo "== 3. 配信・静的検証 =="
run "check_update.py"                  python3 tests/check_update.py
run "check_cache.py"                   python3 tests/check_cache.py
run "check_served.py"                  python3 tests/check_served.py

echo
echo "==========================================================="
if [ "$FAIL" -ne 0 ]; then
  echo "PROTECTION GATE FAILED — $FAIL 件 / 成功 $PASS 件"
  printf '  - %s\n' "${FAILED[@]}"
  echo
  echo "⚠ この変更は適用しないでください。データを守れないアップデートは実行しません。"
  echo "  直前の正常な状態へ戻す手順: git diff --stat で差分を確認し、"
  echo "  git stash push -u -m 'revert-failed-change' または git restore <file> で戻す。"
  echo "  戻した後、必ず再度 bash tests/verify_all.sh を実行して合格を確認すること。"
  echo "  詳細ログ: $LOG"
  exit 1
fi
rm -f "$LOG"
echo "ALL $((PASS)) SUITES PASSED — データ保護ゲート合格（変更を適用してよい）"
