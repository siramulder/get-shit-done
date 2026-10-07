#!/usr/bin/env bash
# Phase 2 verification — report only. Never edits project files; temp files live in a mktemp dir removed by trap.
# Usage: bash scripts/verify-phase2.sh [--pre-commit]
#   --pre-commit  checks that depend on a commit (P2-48, X-03) report SKIP instead of running.
# Portable to macOS bash 3.2: no grep -P, no `timeout`, no sed -i, no associative arrays, no mapfile.

set -o pipefail
cd "$(dirname "$0")/.." || { echo "FATAL: cannot cd to project root"; exit 2; }

PRE_COMMIT=0
for arg in "$@"; do
  case "$arg" in
    --pre-commit) PRE_COMMIT=1 ;;
    *) echo "unknown argument: $arg (supported: --pre-commit)"; exit 2 ;;
  esac
done

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_IDS=""
DEV_PID=""
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/verify-phase2.XXXXXX")" || { echo "FATAL: mktemp failed"; exit 2; }

kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill -TERM "$pid" 2>/dev/null
}

cleanup() {
  if [ -n "$DEV_PID" ]; then
    kill_tree "$DEV_PID"
    wait "$DEV_PID" 2>/dev/null
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

pass() { echo "PASS $1 - $2"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "FAIL $1 - $2"; FAIL_COUNT=$((FAIL_COUNT + 1)); FAILED_IDS="$FAILED_IDS $1"; }
skip() { echo "SKIP $1 - $2"; SKIP_COUNT=$((SKIP_COUNT + 1)); }
evidence() { sed 's/^/      /' | head -n "${1:-20}"; }

# scan_lines <list-file> <js-regex> <flags>: prints "file:line: text" per matching line.
# exit 0 = no match, 1 = match found, 2 = the scan itself failed.
scan_lines() {
  node -e '
    const fs = require("fs");
    try {
      const [listFile, source, flags] = process.argv.slice(1);
      const files = fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean);
      const re = new RegExp(source, flags);
      let found = 0;
      for (const file of files) {
        fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          if (re.test(line)) { console.log(`${file}:${i + 1}: ${line.trim()}`); found++; }
        });
      }
      process.exit(found ? 1 : 0);
    } catch (error) {
      console.log(String(error));
      process.exit(2);
    }
  ' "$@"
}

# report_scan <id> <pass-text> <fail-text> <list-file> <regex> <flags>
report_scan() {
  local id=$1 ok=$2 bad=$3 out rc
  out="$(scan_lines "$4" "$5" "$6" 2>&1)"
  rc=$?
  if [ $rc -eq 0 ]; then
    pass "$id" "$ok"
  elif [ $rc -eq 1 ]; then
    fail "$id" "$bad"
    printf '%s\n' "$out" | evidence
  else
    fail "$id" "the check could not run"
    printf '%s\n' "$out" | evidence
  fi
}

# --- File lists (test file = *.test.ts, *.test.tsx, or anything under src/test/) ---
ALL_SRC="$TMP_DIR/all-src"
NON_TEST="$TMP_DIR/non-test"
TEST_FILES="$TMP_DIR/test-files"
SPEC_FILES="$TMP_DIR/spec-files"
COMPONENTS="$TMP_DIR/components"
COMPONENTS_AND_APP="$TMP_DIR/components-and-app"
: > "$NON_TEST"; : > "$TEST_FILES"; : > "$SPEC_FILES"
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | LC_ALL=C sort > "$ALL_SRC"
while IFS= read -r f; do
  case "$f" in
    *.test.ts|*.test.tsx) echo "$f" >> "$TEST_FILES"; echo "$f" >> "$SPEC_FILES" ;;
    src/test/*) echo "$f" >> "$TEST_FILES" ;;
    *) echo "$f" >> "$NON_TEST" ;;
  esac
done < "$ALL_SRC"
grep -E '^src/components/' "$NON_TEST" > "$COMPONENTS"
cp "$COMPONENTS" "$COMPONENTS_AND_APP"
[ -f src/App.tsx ] && echo "src/App.tsx" >> "$COMPONENTS_AND_APP"

# --- BASE = the Phase 1 commit in HEAD's history ---
BASE="$(git log --format=%H --grep='^feat: task data model, storage layer, and useTasks hook$' -1 2>/dev/null)"
if [ -n "$BASE" ]; then
  echo "BASE = $(git log --format='%h %s' -1 "$BASE")"
else
  echo "BASE = (not found) — every check that compares against BASE will FAIL"
fi
[ $PRE_COMMIT -eq 1 ] && echo "mode = --pre-commit"
echo

echo "=== Git state (checked before build/test) ==="
if [ $PRE_COMMIT -eq 1 ]; then
  skip "X-03" "working tree cleanliness is not checked in --pre-commit mode"
else
  DIRTY="$(git status --porcelain --untracked-files=all | grep -vE '^.. scripts/verify-phase2(\.selftest)?\.sh$')"
  if [ -z "$DIRTY" ]; then
    pass "X-03" "working tree is clean (ignoring the two verify-phase2 scripts)"
  else
    fail "X-03" "working tree has uncommitted changes"
    printf '%s\n' "$DIRTY" | evidence
  fi
fi

echo "=== Structure and scope ==="
report_scan "P2-39" "no Thai characters in src/components or src/App.tsx (non-test)" \
  "Thai characters found outside src/lib/labels.ts" \
  "$COMPONENTS_AND_APP" '[฀-๿]' ''

report_scan "P2-40" "components do not import useTasks / lib/storage / lib/date or use localStorage" \
  "a component reaches past its props" \
  "$COMPONENTS" '[\x27"][^\x27"]*(hooks/useTasks|lib/storage|lib/date)(\.tsx?)?[\x27"]|\blocalStorage\b' ''

PHASE1_PATHS="src/hooks src/types src/lib/storage.ts src/lib/date.ts src/lib/storage.test.ts src/lib/date.test.ts"
if [ -z "$BASE" ]; then
  fail "P2-41" "cannot compare Phase 1 files: BASE commit not found"
else
  CHANGED="$(git diff --name-status "$BASE" -- $PHASE1_PATHS)"
  UNTRACKED="$(git ls-files --others --exclude-standard -- $PHASE1_PATHS | sed 's/^/??	/')"
  if [ -z "$CHANGED$UNTRACKED" ]; then
    pass "P2-41" "Phase 1 files are identical to BASE (committed and uncommitted)"
  else
    fail "P2-41" "Phase 1 files differ from BASE"
    {
      [ -n "$CHANGED" ] && printf '%s\n' "$CHANGED"
      [ -n "$UNTRACKED" ] && printf '%s\n' "$UNTRACKED"
      git diff -U0 "$BASE" -- $PHASE1_PATHS | grep -E '^(\+\+\+|@@|[-+][^-+])'
    } | evidence 25
  fi
fi

if [ -z "$BASE" ]; then
  fail "P2-42" "cannot compare package files: BASE commit not found"
elif git diff --quiet "$BASE" -- package.json package-lock.json; then
  pass "P2-42" "package.json and package-lock.json are identical to BASE"
else
  fail "P2-42" "package.json or package-lock.json changed since BASE"
  { git diff --stat "$BASE" -- package.json package-lock.json; git diff -U0 "$BASE" -- package.json | grep -E '^[-+][^-+]'; } | evidence
fi

report_scan "P2-43" "no whole-word deadline / snackbar / tag in src (non-test)" \
  "out-of-scope word found (reported as-is, not auto-excused)" \
  "$NON_TEST" '\b(deadline|snackbar|tag)\b' 'i'

P244="$TMP_DIR/p2-44"
: > "$P244"
[ -e src/App.css ] && echo "src/App.css exists" >> "$P244"
if [ -d src/assets ]; then
  grep -v '^src/assets/' "$ALL_SRC" > "$TMP_DIR/outside-assets"
  scan_lines "$TMP_DIR/outside-assets" '[\x27"][^\x27"]*assets/[^\x27"]*[\x27"]' '' >> "$P244"
fi
scan_lines "$ALL_SRC" '(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)[\x27"][^\x27"]*\.svg(\?[^\x27"]*)?[\x27"]' '' >> "$P244"
grep -rniF 'count is' src >> "$P244"
grep -qF '<html lang="th">' index.html || echo 'index.html: missing <html lang="th">' >> "$P244"
grep -qF '<title>Task Priority</title>' index.html || echo 'index.html: missing <title>Task Priority</title>' >> "$P244"
if [ -s "$P244" ]; then
  fail "P2-44" "Vite boilerplate leftovers or index.html is not as specified"
  evidence < "$P244"
else
  pass "P2-44" "no App.css / imported assets / .svg imports / \"count is\" (any case); index.html has lang=\"th\" and the title"
fi

P245="$(node -e '
  const fs = require("fs");
  try {
    const source = fs.readFileSync("src/main.tsx", "utf8");
    if (/<StrictMode>\s*<App\s*\/>\s*<\/StrictMode>/m.test(source)) process.exit(0);
    source.split("\n").forEach((line, i) => {
      if (/StrictMode|<App/.test(line)) console.log(`src/main.tsx:${i + 1}: ${line.trim()}`);
    });
    process.exit(1);
  } catch (error) {
    console.log(String(error));
    process.exit(2);
  }
' 2>&1)"
case $? in
  0) pass "P2-45" "src/main.tsx wraps <App /> in <StrictMode>" ;;
  1) fail "P2-45" "<App /> is not wrapped in <StrictMode> in src/main.tsx"; printf '%s\n' "${P245:-(no StrictMode or <App /> found)}" | evidence ;;
  *) fail "P2-45" "the check could not run"; printf '%s\n' "$P245" | evidence ;;
esac

report_scan "P2-49" "no confirm( / window.confirm( calls in src (non-test)" \
  "a confirm() call was found" \
  "$NON_TEST" '(^|[^\w$])confirm\s*\(' ''

echo "=== Git ==="
P248_SUBJECT="feat: presentational components and Today view composition"
if [ $PRE_COMMIT -eq 1 ]; then
  skip "P2-48" "commit check is not run in --pre-commit mode"
elif [ -z "$BASE" ]; then
  fail "P2-48" "cannot search BASE..HEAD: BASE commit not found"
elif git log --format=%s "$BASE..HEAD" | grep -Fxq "$P248_SUBJECT"; then
  pass "P2-48" "\"$P248_SUBJECT\" is in BASE..HEAD"
else
  fail "P2-48" "no commit with subject \"$P248_SUBJECT\" in BASE..HEAD"
  { echo "commits in BASE..HEAD:"; git log --oneline "$BASE..HEAD"; } | evidence
fi

echo "=== Test hygiene ==="
X01="$(node -e '
  const fs = require("fs");
  try {
    const files = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean);
    const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    const missing = [];
    for (let n = 1; n <= 38; n++) {
      const id = `P2-${String(n).padStart(2, "0")}`;
      if (!new RegExp(`${id}(?!\\d)`).test(text)) missing.push(id);
    }
    if (missing.length) { console.log(`missing: ${missing.join(", ")}`); process.exit(1); }
    process.exit(0);
  } catch (error) {
    console.log(String(error));
    process.exit(2);
  }
' "$SPEC_FILES" 2>&1)"
case $? in
  0) pass "X-01" "every ID P2-01..P2-38 appears in a *.test.ts(x) file" ;;
  1) fail "X-01" "test IDs are missing from *.test.ts(x) files"; printf '%s\n' "$X01" | evidence ;;
  *) fail "X-01" "the check could not run"; printf '%s\n' "$X01" | evidence ;;
esac

report_scan "X-02" "no skipped / focused / todo tests" \
  "a skipped, focused, or todo test was found" \
  "$TEST_FILES" '\b(it|describe|test)\.(skip|only)\b|\bit\.todo\b|(^|[^\w$.])(xit|xdescribe|fit|fdescribe)\s*\(' ''

echo "=== Build and test ==="
LOG="$TMP_DIR/run.log"
if npm test -- --run > "$LOG" 2>&1; then
  pass "P2-46a" "npm test -- --run exit 0 ($(grep -E 'Tests +[0-9]' "$LOG" | sed 's/^ *//'))"
else
  fail "P2-46a" "npm test -- --run failed"
  { grep -E '×|FAIL|Error' "$LOG" || tail -n 15 "$LOG"; } | evidence
fi

SHUFFLE_FAILED=""
SHUFFLE_EVIDENCE="$TMP_DIR/shuffle-evidence"
: > "$SHUFFLE_EVIDENCE"
for run in 1 2 3; do
  if ! npx vitest --run --sequence.shuffle > "$LOG" 2>&1; then
    SHUFFLE_FAILED="$SHUFFLE_FAILED $run"
    { echo "run $run:"; grep -E '×|FAIL|Error|seed' "$LOG" || tail -n 10 "$LOG"; } >> "$SHUFFLE_EVIDENCE"
  fi
done
if [ -z "$SHUFFLE_FAILED" ]; then
  pass "P2-46b" "npx vitest --run --sequence.shuffle passed 3 of 3 runs"
else
  fail "P2-46b" "shuffled run(s) failed:$SHUFFLE_FAILED"
  evidence 30 < "$SHUFFLE_EVIDENCE"
fi

if npm run build > "$LOG" 2>&1; then
  pass "P2-46c" "npm run build exit 0"
else
  fail "P2-46c" "npm run build failed"
  { grep -iE 'error' "$LOG" || tail -n 15 "$LOG"; } | evidence
fi

if npm run lint > "$LOG" 2>&1; then
  pass "P2-46d" "npm run lint exit 0"
else
  fail "P2-46d" "npm run lint failed"
  tail -n 20 "$LOG" | evidence
fi

DEV_PORT=5199
if command -v lsof > /dev/null 2>&1; then
  PORT_HOLDER="$(lsof -nP -iTCP:$DEV_PORT -sTCP:LISTEN 2>/dev/null)"
else
  PROBE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://localhost:$DEV_PORT/" 2>/dev/null)"
  PORT_HOLDER=""
  [ "$PROBE" != "000" ] && PORT_HOLDER="something answered HTTP $PROBE on port $DEV_PORT"
fi
if [ -n "$PORT_HOLDER" ]; then
  fail "P2-47" "port $DEV_PORT is already in use by another process (left running, not killed)"
  printf '%s\n' "$PORT_HOLDER" | evidence
else
  npm run dev -- --port "$DEV_PORT" --strictPort > "$TMP_DIR/dev.log" 2>&1 &
  DEV_PID=$!
  HTTP_CODE="000"
  START=$SECONDS
  while [ $((SECONDS - START)) -lt 15 ]; do
    kill -0 "$DEV_PID" 2>/dev/null || break
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://localhost:$DEV_PORT/" 2>/dev/null)"
    [ "$HTTP_CODE" = "200" ] && break
    sleep 1
  done
  ELAPSED=$((SECONDS - START))
  kill_tree "$DEV_PID"
  wait "$DEV_PID" 2>/dev/null
  DEV_PID=""
  if [ "$HTTP_CODE" = "200" ]; then
    pass "P2-47" "dev server answered HTTP 200 on port $DEV_PORT after ~${ELAPSED}s (server stopped)"
  else
    fail "P2-47" "dev server did not answer HTTP 200 on port $DEV_PORT within 15s (last code: $HTTP_CODE)"
    tail -n 15 "$TMP_DIR/dev.log" | evidence
  fi
fi

echo
echo "=== ต้องตรวจเอง (ไม่ได้ตรวจอัตโนมัติ) ==="
echo "  M-01 ลากด้วยเมาส์"
echo "  M-02 เรียงด้วยคีย์บอร์ด (Space → ลูกศร → Space, Esc ยกเลิก)"
echo "  M-03 กดปุ่มรัว ๆ แล้วไม่เริ่มลากโดยไม่ตั้งใจ"
echo "  M-04 จอมือถือ ~375px"
echo "  M-05 ลากด้วยนิ้ว"
echo "  M-06 ชื่อยาว"
echo "  M-07 กด F5 ข้อมูลอยู่"
echo "  M-08 Tab order และ focus ring"
echo "  M-09 VoiceOver ภาษาไทย"
echo "  M-10 Console ไม่มี error/warning"
echo "  ⚠ P2-46 และ P2-47 ที่ผ่าน ไม่ได้แปลว่า M-10 ผ่าน — ต้องเปิด DevTools ดู console เอง"
echo "  ⚠ M-01, M-02, M-03, M-07 ต้องผ่านก่อนปิด Phase 2"

echo
echo "==================================="
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed, $SKIP_COUNT skipped"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "Failed:$FAILED_IDS"
  exit 1
fi
exit 0
