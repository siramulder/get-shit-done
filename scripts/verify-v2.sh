#!/usr/bin/env bash
# v2 verification — report only. Never edits project files; temp files live in a mktemp dir removed by trap.
# Usage: bash scripts/verify-v2.sh [--pre-commit] [--slice N]
#   --pre-commit  V2-12 (clean working tree) reports SKIP instead of running.
#   --slice N     require the test ids of slices 0..N (default: LATEST_SLICE below).
# Portable to macOS bash 3.2: no grep -P, no `timeout`, no sed -i, no associative arrays, no mapfile.

set -o pipefail
cd "$(dirname "$0")/.." || { echo "FATAL: cannot cd to project root"; exit 2; }

# BASE = the last MVP1 commit, right before v2 slice 0 started ("ci: deploy to GitHub Pages", 2026-10-12).
BASE_HASH=19ccfada7707c509d73a0f61effb89096df3ed00

# Test ids that must appear in *.test.ts(x) names, per slice (checked cumulatively 0..N).
# When a slice starts: add SLICE_<n>="..." and bump LATEST_SLICE.
SLICE_0="AC-16.1 AC-16.2 AC-16.3 AC-16.4 AC-17.1 S0-01 S0-02 S0-03 S0-04 S0-05 S0-05b S0-06 S0-07 S0-08 S0-09 S0-10"
SLICE_1="AC-6.1 AC-6.2 AC-6.4 AC-7.1 AC-7.2 AC-7.3 AC-7.4 AC-7.5 AC-7.6 AC-8.1 AC-10.1 AC-10.2 AC-10.3 AC-F1.1 AC-F1.3 S1-01 S1-02 S1-03 S1-04 S1-05 S1-06 S1-07 S1-08 S1-09 S1-10 S1-11 S1-12 S1-13 S1-14 S1-15"
LATEST_SLICE=1

PRE_COMMIT=0
SLICE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --pre-commit) PRE_COMMIT=1 ;;
    --slice) shift; SLICE="${1:-}"; [ -n "$SLICE" ] || { echo "--slice needs a number 0..$LATEST_SLICE"; exit 2; } ;;
    --slice=*) SLICE="${1#--slice=}"; [ -n "$SLICE" ] || { echo "--slice needs a number 0..$LATEST_SLICE"; exit 2; } ;;
    *) echo "unknown argument: $1 (supported: --pre-commit, --slice N)"; exit 2 ;;
  esac
  [ $# -gt 0 ] && shift
done
[ -z "$SLICE" ] && SLICE=$LATEST_SLICE
case "$SLICE" in
  *[!0-9]*) echo "--slice needs a number 0..$LATEST_SLICE (got: $SLICE)"; exit 2 ;;
esac
if [ "$SLICE" -gt "$LATEST_SLICE" ]; then
  echo "--slice $SLICE is not declared in this script (latest: $LATEST_SLICE)"; exit 2
fi
REQUIRED_IDS=""
n=0
while [ $n -le "$SLICE" ]; do
  var="SLICE_$n"
  REQUIRED_IDS="$REQUIRED_IDS ${!var}"
  n=$((n + 1))
done

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_IDS=""
DEV_PID=""
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/verify-v2.XXXXXX")" || { echo "FATAL: mktemp failed"; exit 2; }

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

# check_ids <ids-file> <spec-list>: every id (one per line) must appear in the joined spec files,
# as a whole token — "P1-11" is not satisfied by "P1-11b", "AC-16.1" not by "AC-16.10".
# Prints "missing: ..." and exits 1 when something is missing; 2 when the check itself failed.
check_ids() {
  node -e '
    const fs = require("fs");
    try {
      const [idsFile, listFile] = process.argv.slice(1);
      const ids = fs.readFileSync(idsFile, "utf8").split("\n").filter(Boolean);
      const files = fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean);
      const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const missing = ids.filter((id) => !new RegExp(`${esc(id)}(?![0-9A-Za-z])`).test(text));
      if (missing.length) { console.log(`missing: ${missing.join(", ")}`); process.exit(1); }
      console.log(`${ids.length} ids present`);
      process.exit(0);
    } catch (error) {
      console.log(String(error));
      process.exit(2);
    }
  ' "$@"
}

# --- File lists (test file = *.test.ts, *.test.tsx, or anything under src/test/) ---
ALL_SRC="$TMP_DIR/all-src"
NON_TEST="$TMP_DIR/non-test"
TEST_FILES="$TMP_DIR/test-files"
SPEC_FILES="$TMP_DIR/spec-files"
COMPONENTS="$TMP_DIR/components"
COMPONENTS_AND_APP="$TMP_DIR/components-and-app"
NON_TEST_EXCEPT_STORAGE="$TMP_DIR/non-test-except-storage"
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
grep -v '^src/lib/storage\.ts$' "$NON_TEST" > "$NON_TEST_EXCEPT_STORAGE"
PURE_LIB="$TMP_DIR/pure-lib"
: > "$PURE_LIB"
[ -f src/lib/review.ts ] && echo "src/lib/review.ts" >> "$PURE_LIB"

if git cat-file -e "${BASE_HASH}^{commit}" 2>/dev/null; then
  BASE=$BASE_HASH
  echo "BASE = $(git log --format='%h %s' -1 "$BASE")"
else
  BASE=""
  echo "BASE = $BASE_HASH (not found in this clone) — every check that compares against BASE will FAIL"
fi
echo "slice = $SLICE (ids required: $(echo $REQUIRED_IDS | wc -w | tr -d ' '))"
[ $PRE_COMMIT -eq 1 ] && echo "mode = --pre-commit"
echo

echo "=== Git state (checked before build/test) ==="
if [ $PRE_COMMIT -eq 1 ]; then
  skip "V2-12" "working tree cleanliness is not checked in --pre-commit mode"
else
  DIRTY="$(git status --porcelain --untracked-files=all | grep -vE '^.. scripts/verify-v2(\.selftest)?\.sh$')"
  if [ -z "$DIRTY" ]; then
    pass "V2-12" "working tree is clean (ignoring the two verify-v2 scripts)"
  else
    fail "V2-12" "working tree has uncommitted changes"
    printf '%s\n' "$DIRTY" | evidence
  fi
fi

echo "=== Structure and scope ==="
report_scan "V2-01" "no Thai characters in src/components or src/App.tsx (non-test)" \
  "Thai characters found outside src/lib/labels.ts" \
  "$COMPONENTS_AND_APP" '[฀-๿]' ''

V202_A="$(scan_lines "$COMPONENTS" '[\x27"][^\x27"]*(hooks/useTasks|lib/storage|lib/date)(\.tsx?)?[\x27"]|\blocalStorage\b' '' 2>&1)"; V202_A_RC=$?
V202_B="$(scan_lines "$NON_TEST_EXCEPT_STORAGE" '\bloadTasks\s*\(' '' 2>&1)"; V202_B_RC=$?
# Pure logic (src/lib/review.ts) must not reach React, storage, dates or the hook.
V202_C="$(scan_lines "$PURE_LIB" '[\x27"](react|react-dom|[^\x27"]*(hooks/useTasks|storage|date))(\.tsx?)?[\x27"]|\blocalStorage\b' '' 2>&1)"; V202_C_RC=$?
if [ $V202_A_RC -eq 0 ] && [ $V202_B_RC -eq 0 ] && [ $V202_C_RC -eq 0 ]; then
  pass "V2-02" "components do not import useTasks / lib/storage / lib/date or use localStorage; loadTasks( only in lib/storage.ts and tests; lib/review.ts imports no react / storage / date / useTasks"
elif [ $V202_A_RC -gt 1 ] || [ $V202_B_RC -gt 1 ] || [ $V202_C_RC -gt 1 ]; then
  fail "V2-02" "the check could not run"
  printf '%s\n%s\n%s\n' "$V202_A" "$V202_B" "$V202_C" | evidence
else
  fail "V2-02" "a component reaches past its props, loadTasks( is called outside lib/storage.ts, or lib/review.ts is not pure"
  { [ $V202_A_RC -eq 1 ] && printf '%s\n' "$V202_A"; [ $V202_B_RC -eq 1 ] && printf '%s\n' "$V202_B"; [ $V202_C_RC -eq 1 ] && printf '%s\n' "$V202_C"; } | evidence
fi

if [ -z "$BASE" ]; then
  fail "V2-03" "cannot compare package files: BASE commit not found"
elif git diff --quiet "$BASE" -- package.json package-lock.json; then
  pass "V2-03" "package.json and package-lock.json are identical to BASE"
else
  fail "V2-03" "package.json or package-lock.json changed since BASE"
  { git diff --stat "$BASE" -- package.json package-lock.json; git diff -U0 "$BASE" -- package.json | grep -E '^[-+][^-+]'; } | evidence
fi

report_scan "V2-04" "no confirm( / window.confirm( calls in src (non-test)" \
  "a confirm() call was found" \
  "$NON_TEST" '(^|[^\w$])confirm\s*\(' ''

report_scan "V2-08" "no sort by dueDate, snackbar, or window.Notification in src (non-test)" \
  "out-of-scope code found (deadline is a label only; no sorting, no snackbar, no notifications)" \
  "$NON_TEST" '(sortBy|\.sort)\s*\([^\n]*dueDate|\bsnackbar\b|window\.Notification' 'i'

V209="$(node -e '
  const fs = require("fs");
  try {
    const ts = require("typescript");
    const files = fs.readFileSync(process.argv[1], "utf8").split("\n").filter((f) => f.endsWith(".tsx"));
    let found = 0;
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node) => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sf) === "li") {
          const text = node.getText(sf);
          if (/\btouch-none\b/.test(text)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            console.log(`${file}:${line + 1}: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
            found++;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    process.exit(found ? 1 : 0);
  } catch (error) {
    console.log(String(error));
    process.exit(2);
  }
' "$COMPONENTS" 2>&1)"
case $? in
  0) pass "V2-09" "no <li> in src/components carries touch-none (only the ⠿ button may)" ;;
  1) fail "V2-09" "a card <li> has touch-none, which would block page scrolling on touch screens"; printf '%s\n' "$V209" | evidence ;;
  *) fail "V2-09" "the check could not run"; printf '%s\n' "$V209" | evidence ;;
esac

report_scan "V2-14" "no hex colours or Tailwind palette colour classes in src/components or src/App.tsx (tokens only)" \
  "a hex colour or a Tailwind palette colour was found — use the tokens in src/index.css (CLAUDE.md, Visual Direction)" \
  "$COMPONENTS_AND_APP" '#[0-9a-fA-F]{3,8}\b|\b(?:[a-z-]+:)*(?:bg|text|border|outline|ring|placeholder|from|to|via|fill|stroke|decoration|accent|caret|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\b(?:[a-z-]+:)*(?:bg|text|border)-(?:white|black)\b' ''

RETIRED_SCRIPTS="scripts/verify-phase0.sh scripts/verify-phase2.sh"
if [ -z "$BASE" ]; then
  fail "V2-13" "cannot compare the retired scripts: BASE commit not found"
elif git diff --quiet "$BASE" -- $RETIRED_SCRIPTS; then
  pass "V2-13" "scripts/verify-phase2.sh and scripts/verify-phase0.sh are identical to BASE (snapshots untouched)"
else
  fail "V2-13" "a retired snapshot script was edited since BASE"
  { git diff --stat "$BASE" -- $RETIRED_SCRIPTS; git diff -U0 "$BASE" -- $RETIRED_SCRIPTS | grep -E '^(\+\+\+|[-+][^-+])'; } | evidence
fi

echo "=== Test hygiene ==="
report_scan "V2-05" "no skipped / focused / todo tests" \
  "a skipped, focused, or todo test was found" \
  "$TEST_FILES" '\b(it|describe|test)\.(skip|only)\b|\bit\.todo\b|(^|[^\w$.])(xit|xdescribe|fit|fdescribe)\s*\(' ''

BASE_IDS="$TMP_DIR/base-ids"
if [ -z "$BASE" ]; then
  fail "V2-06" "cannot list MVP1 test ids: BASE commit not found"
else
  git grep -hoE 'P[123]-[0-9]+[a-z]?' "$BASE" -- 'src/*.test.ts' 'src/*.test.tsx' 2>/dev/null | LC_ALL=C sort -u > "$BASE_IDS"
  if [ -s "$BASE_IDS" ]; then
    V206="$(check_ids "$BASE_IDS" "$SPEC_FILES" 2>&1)"; V206_RC=$?
  else
    V206="no P1-/P2-/P3- ids found in the test files at BASE (git grep returned nothing)"; V206_RC=2
  fi
  case $V206_RC in
    0) pass "V2-06" "every MVP1 test id present at BASE ($(wc -l < "$BASE_IDS" | tr -d ' ') ids: P1-, P2-, P3-) still appears in a *.test.ts(x) file" ;;
    1) fail "V2-06" "an MVP1 test id from BASE no longer appears in any test file (a test was deleted or renamed)"; printf '%s\n' "$V206" | evidence ;;
    *) fail "V2-06" "the check could not run"; printf '%s\n' "$V206" | evidence ;;
  esac
fi

SLICE_IDS="$TMP_DIR/slice-ids"
printf '%s\n' $REQUIRED_IDS > "$SLICE_IDS"
V207="$(check_ids "$SLICE_IDS" "$SPEC_FILES" 2>&1)"
case $? in
  0) pass "V2-07" "every required id of slices 0..$SLICE appears in a *.test.ts(x) file ($(wc -l < "$SLICE_IDS" | tr -d ' ') ids)" ;;
  1) fail "V2-07" "a required test id of slices 0..$SLICE is missing"; printf '%s\n' "$V207" | evidence ;;
  *) fail "V2-07" "the check could not run"; printf '%s\n' "$V207" | evidence ;;
esac

echo "=== Build and test ==="
LOG="$TMP_DIR/run.log"
if npm test -- --run > "$LOG" 2>&1; then
  pass "V2-10a" "npm test -- --run exit 0 ($(grep -E 'Tests +[0-9]' "$LOG" | sed 's/^ *//'))"
else
  fail "V2-10a" "npm test -- --run failed"
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
  pass "V2-10b" "npx vitest --run --sequence.shuffle passed 3 of 3 runs"
else
  fail "V2-10b" "shuffled run(s) failed:$SHUFFLE_FAILED"
  evidence 30 < "$SHUFFLE_EVIDENCE"
fi

if npm run build > "$LOG" 2>&1; then
  pass "V2-10c" "npm run build exit 0 (tsc -b also enforces the type-level tests P1-01, P1-02, S0-09)"
else
  fail "V2-10c" "npm run build failed"
  { grep -iE 'error' "$LOG" || tail -n 15 "$LOG"; } | evidence
fi

if npm run lint > "$LOG" 2>&1; then
  pass "V2-10d" "npm run lint exit 0"
else
  fail "V2-10d" "npm run lint failed"
  tail -n 20 "$LOG" | evidence
fi

DEV_PORT=5198
if command -v lsof > /dev/null 2>&1; then
  PORT_HOLDER="$(lsof -nP -iTCP:$DEV_PORT -sTCP:LISTEN 2>/dev/null)"
else
  PROBE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://localhost:$DEV_PORT/" 2>/dev/null)"
  PORT_HOLDER=""
  [ "$PROBE" != "000" ] && PORT_HOLDER="something answered HTTP $PROBE on port $DEV_PORT"
fi
if [ -n "$PORT_HOLDER" ]; then
  fail "V2-11" "port $DEV_PORT is already in use by another process (left running, not killed)"
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
    pass "V2-11" "dev server answered HTTP 200 on port $DEV_PORT after ~${ELAPSED}s (server stopped)"
  else
    fail "V2-11" "dev server did not answer HTTP 200 on port $DEV_PORT within 15s (last code: $HTTP_CODE)"
    tail -n 15 "$TMP_DIR/dev.log" | evidence
  fi
fi

echo
echo "=== ต้องตรวจเอง (ไม่ได้ตรวจอัตโนมัติ) ==="
echo "  M-14 contrast ของ placeholder ใน light และ dark (AC-17.1: เทสต์ตรวจได้แค่ class ตัวเลขจริงต้องวัดในเบราว์เซอร์)"
echo "  M-15 ข้อมูล schemaVersion 3 → เห็นข้อความ ช่องเพิ่มงาน disabled อ่านออกทั้ง light/dark"
echo "  M-16 localStorage ของ MVP1 จริง → งานครบ ลำดับเดิม → กด 1 ครั้ง → refresh ยังครบ"
echo "  M-17–M-21 โหมดตรวจลำดับ: 375px, คีย์บอร์ดล้วน, เมาส์ 6 งาน + reload, light/dark ที่ 375px และ 1280×900, VoiceOver (รอ PO)"
echo "  M-02 ซ้ำ: Escape ของการลากด้วยคีย์บอร์ดยังยกเลิกได้หลังเปิด-ปิดโหมดตรวจลำดับ"
echo "  ⚠ V2-10 และ V2-11 ที่ผ่าน ไม่ได้แปลว่า M-10 (console สะอาด) ผ่าน — ต้องเปิด DevTools ดูเอง"
echo "  ⚠ ทุกครั้งที่แก้ส่วนลากวาง ต้องตรวจ M-01, M-02, M-03, M-11 ใหม่ (ดู docs/MANUAL_QA.md)"

echo
echo "==================================="
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed, $SKIP_COUNT skipped"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "Failed:$FAILED_IDS"
  exit 1
fi
exit 0
