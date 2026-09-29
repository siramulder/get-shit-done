#!/usr/bin/env bash
# Verifies the Phase 0 (scaffold) state of Task Priority App against the
# CLAUDE.md/PRD spec. Read-only against the project: any file it creates
# (a temp .ts file, a temp log file) is removed via trap before exit.
#
# Usage: bash scripts/verify-phase0.sh   (run from the project root)

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || { echo "FATAL: cannot cd to project root"; exit 1; }

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_IDS=()
TMP_FILES=()
DEV_SERVER_PID=""

cleanup() {
  if [[ -n "$DEV_SERVER_PID" ]] && kill -0 "$DEV_SERVER_PID" 2>/dev/null; then
    kill "$DEV_SERVER_PID" 2>/dev/null
    wait "$DEV_SERVER_PID" 2>/dev/null
  fi
  for f in "${TMP_FILES[@]:-}"; do
    [[ -n "$f" && -e "$f" ]] && rm -f "$f"
  done
}
trap cleanup EXIT

pass() { echo "PASS $1 - $2"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo "FAIL $1 - $2"; FAIL_COUNT=$((FAIL_COUNT+1)); FAILED_IDS+=("$1"); }
skip() { echo "SKIP $1 - $2"; SKIP_COUNT=$((SKIP_COUNT+1)); }

# Reads an installed package's version via `npm ls --json` (never text-greps npm output).
get_pkg_version() {
  local pkg="$1"
  export PKG_NAME="$pkg"
  npm ls "$pkg" --json --depth=0 2>/dev/null | node -e '
    let data = "";
    process.stdin.on("data", d => (data += d));
    process.stdin.on("end", () => {
      try {
        const json = JSON.parse(data || "{}");
        const name = process.env.PKG_NAME;
        const dep = json.dependencies && json.dependencies[name];
        if (dep && dep.version) process.stdout.write(dep.version);
      } catch (e) {
        // leave output empty -> treated as "not installed"
      }
    });
  '
}

check_all_major_version() {
  local id="$1" expected_major="$2"; shift 2
  local pkgs=("$@") all_ok=true details="" version major
  for pkg in "${pkgs[@]}"; do
    version="$(get_pkg_version "$pkg")"
    if [[ -z "$version" ]]; then
      all_ok=false; details+="$pkg=MISSING "; continue
    fi
    major="${version%%.*}"
    details+="$pkg=$version "
    [[ "$major" == "$expected_major" ]] || all_ok=false
  done
  if $all_ok; then pass "$id" "$details(all major $expected_major)"
  else fail "$id" "$details(expected major $expected_major)"; fi
}

check_all_present() {
  local id="$1" desc="$2"; shift 2
  local pkgs=("$@") all_ok=true details="" version
  for pkg in "${pkgs[@]}"; do
    version="$(get_pkg_version "$pkg")"
    if [[ -z "$version" ]]; then all_ok=false; details+="$pkg=MISSING "
    else details+="$pkg=$version "; fi
  done
  if $all_ok; then pass "$id" "$desc: $details"
  else fail "$id" "$desc: $details"; fi
}

check_file_identical() {
  local id="$1" project_file="$2" source_file="$3" desc="$4"
  if [[ ! -f "$source_file" ]]; then
    skip "$id" "$desc (source not found: $source_file)"; return
  fi
  if [[ ! -f "$project_file" ]]; then
    fail "$id" "$desc ($project_file missing)"; return
  fi
  if cmp -s "$project_file" "$source_file"; then
    pass "$id" "$desc (identical)"
  else
    fail "$id" "$desc (differs from source)"
  fi
}

echo "=== โครงสร้างและ Git ==="

if [[ -f package.json && -d src && -d docs && -f CLAUDE.md ]]; then
  pass "P0-01" "package.json, src/, docs/, CLAUDE.md exist"
else
  fail "P0-01" "missing one or more of: package.json, src/, docs/, CLAUDE.md"
fi

if GRANDPARENT="$(cd "$PROJECT_ROOT/../.." 2>/dev/null && pwd)"; then
  if [[ ! -e "$GRANDPARENT/node_modules" && ! -e "$GRANDPARENT/package.json" && ! -e "$GRANDPARENT/vite.config.ts" ]]; then
    pass "P0-03" "../.. ($GRANDPARENT) has no node_modules/package.json/vite.config.ts"
  else
    fail "P0-03" "../.. ($GRANDPARENT) contains node_modules/package.json/vite.config.ts"
  fi
else
  fail "P0-03" "could not resolve ../.. from project root"
fi

TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ "$TOPLEVEL" == "$PROJECT_ROOT" ]]; then
  pass "P0-04" "git toplevel matches project root"
else
  fail "P0-04" "git toplevel ('$TOPLEVEL') != project root ('$PROJECT_ROOT')"
fi

if [[ -n "$GRANDPARENT" ]] && git -C "$GRANDPARENT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "P0-05" "../.. ($GRANDPARENT) is a git repo"
else
  pass "P0-05" "../.. is not a git repo"
fi

FIRST_COMMIT_MSG="$(git log --reverse --format=%s 2>/dev/null | head -n1)"
if [[ "$FIRST_COMMIT_MSG" == *"chore: scaffold Task Priority App"* ]]; then
  pass "P0-06" "first commit message contains expected text"
else
  fail "P0-06" "first commit message ('$FIRST_COMMIT_MSG') missing expected text"
fi

TRACKED_BAD="$(git ls-files | grep -E '(^|/)(node_modules|dist)(/|$)' || true)"
GITIGNORE_OK=true
if [[ -f .gitignore ]]; then
  grep -qE '(^|/)node_modules(/|$)' .gitignore || GITIGNORE_OK=false
  grep -qE '(^|/)dist(/|$)' .gitignore || GITIGNORE_OK=false
else
  GITIGNORE_OK=false
fi
if [[ -z "$TRACKED_BAD" ]] && $GITIGNORE_OK; then
  pass "P0-07" "no node_modules/dist tracked; .gitignore covers both"
else
  fail "P0-07" "tracked node_modules/dist files present, or .gitignore missing an entry"
fi

# Must run before any build/test/tsc command below, so files created during
# verification itself never affect this check.
GIT_STATUS_PORCELAIN="$(git status --porcelain 2>/dev/null)"
if [[ -z "$GIT_STATUS_PORCELAIN" ]]; then
  pass "P0-08" "git status --porcelain is clean (checked before build/test)"
else
  fail "P0-08" "git status --porcelain is not empty"
fi

echo "=== Dependencies ==="

check_all_major_version "P0-09" "18" react react-dom
check_all_major_version "P0-10" "18" @types/react @types/react-dom
check_all_present "P0-11" "dnd-kit packages installed" @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

TW_VERSION="$(get_pkg_version tailwindcss)"
TW_VITE_VERSION="$(get_pkg_version @tailwindcss/vite)"
if [[ "${TW_VERSION%%.*}" == "4" && -n "$TW_VITE_VERSION" ]]; then
  pass "P0-12" "tailwindcss=$TW_VERSION @tailwindcss/vite=$TW_VITE_VERSION"
else
  fail "P0-12" "tailwindcss=${TW_VERSION:-MISSING} @tailwindcss/vite=${TW_VITE_VERSION:-MISSING} (need tailwindcss 4.x + @tailwindcss/vite)"
fi

check_all_present "P0-13" "test tooling installed" vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

ALLOWLIST_EXTRA="$(node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const allowlist = new Set([
    "react", "react-dom",
    "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities",
    "@tailwindcss/vite", "@testing-library/jest-dom", "@testing-library/react",
    "@testing-library/user-event", "@types/node", "@types/react", "@types/react-dom",
    "@vitejs/plugin-react", "jsdom", "oxlint", "tailwindcss", "typescript", "vite", "vitest"
  ]);
  const all = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const extra = Object.keys(all).filter(name => !allowlist.has(name));
  process.stdout.write(JSON.stringify(extra));
' 2>/dev/null)"
if [[ "$ALLOWLIST_EXTRA" == "[]" ]]; then
  pass "P0-14" "no unexpected dependencies"
else
  fail "P0-14" "unexpected dependencies found: $ALLOWLIST_EXTRA"
fi

if npm ls >/dev/null 2>&1; then
  pass "P0-15" "npm ls exits 0"
else
  fail "P0-15" "npm ls exited non-zero"
fi

echo "=== Config ==="

TSCONFIG_STRICT="$(node -e '
  const fs = require("fs");
  let text = fs.readFileSync("tsconfig.app.json", "utf8");
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  text = text.replace(/(^|[^:])\/\/.*$/gm, "$1");
  text = text.replace(/,(\s*[}\]])/g, "$1");
  try {
    const json = JSON.parse(text);
    process.stdout.write(json.compilerOptions && json.compilerOptions.strict === true ? "true" : "false");
  } catch (e) {
    process.stdout.write("parse-error");
  }
' 2>/dev/null)"
if [[ "$TSCONFIG_STRICT" == "true" ]]; then
  pass "P0-16" "tsconfig.app.json has strict: true"
else
  fail "P0-16" "tsconfig.app.json strict flag is '$TSCONFIG_STRICT', expected true"
fi

STRICT_CHECK_FILE="src/__strict_check__.ts"
TMP_FILES+=("$STRICT_CHECK_FILE")
cat > "$STRICT_CHECK_FILE" <<'EOF'
export function __strictCheckFn(value) {
  return value.length
}
EOF
TSC_STRICT_OUTPUT="$(npx tsc -p tsconfig.app.json --noEmit 2>&1)"
rm -f "$STRICT_CHECK_FILE"
if echo "$TSC_STRICT_OUTPUT" | grep -q "__strict_check__.ts"; then
  pass "P0-17" "tsc reports an error on an injected implicit-any parameter (strict mode enforced)"
else
  fail "P0-17" "tsc did not report an error for an implicit-any parameter — strict mode may not be enforced"
fi

if grep -qE "import\s+tailwindcss\s+from\s+['\"]@tailwindcss/vite['\"]" vite.config.ts && grep -q "tailwindcss()" vite.config.ts; then
  pass "P0-18" "vite.config.ts imports and calls tailwindcss()"
else
  fail "P0-18" "vite.config.ts missing tailwindcss import or call"
fi

if grep -qF '@import "tailwindcss";' src/index.css && [[ ! -f tailwind.config.js && ! -f tailwind.config.ts ]]; then
  pass "P0-19" "index.css imports tailwindcss; no tailwind.config.js/ts"
else
  fail "P0-19" "index.css missing tailwind import, or a tailwind.config.js/ts exists"
fi

if grep -qE "environment:\s*['\"]jsdom['\"]" vite.config.ts && grep -q "setupFiles" vite.config.ts && grep -q "src/test/setup.ts" vite.config.ts; then
  pass "P0-20" "vite.config.ts has jsdom environment and setupFiles pointing at src/test/setup.ts"
else
  fail "P0-20" "vite.config.ts missing jsdom environment or correct setupFiles path"
fi

if [[ -f src/test/setup.ts ]] && grep -q "@testing-library/jest-dom" src/test/setup.ts; then
  pass "P0-21" "src/test/setup.ts imports @testing-library/jest-dom"
else
  fail "P0-21" "src/test/setup.ts missing or doesn't import @testing-library/jest-dom"
fi

TSC_B_OUTPUT="$(npx tsc -b --noEmit 2>&1)"
TSC_B_EXIT=$?
if [[ $TSC_B_EXIT -eq 0 ]]; then
  pass "P0-22" "npx tsc -b --noEmit passes"
else
  fail "P0-22" "npx tsc -b --noEmit failed (exit $TSC_B_EXIT): $(echo "$TSC_B_OUTPUT" | head -n5)"
fi

echo "=== Scripts ==="

SCRIPTS_OK="$(node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const s = pkg.scripts || {};
  process.stdout.write(s.dev && s.build && s.lint && s.test === "vitest" ? "true" : "false");
' 2>/dev/null)"
if [[ "$SCRIPTS_OK" == "true" ]]; then
  pass "P0-23" "scripts dev/test/build/lint present, test == 'vitest'"
else
  fail "P0-23" "missing a required script, or test script != 'vitest'"
fi

# --- P0-26 / P0-25: build once, reuse the output for both checks ---
BUILD_OUTPUT="$(npm run build 2>&1)"
BUILD_EXIT=$?
if [[ $BUILD_EXIT -eq 0 && -f dist/index.html ]]; then
  pass "P0-26" "npm run build exit 0 and dist/index.html exists"
else
  fail "P0-26" "npm run build exit $BUILD_EXIT or dist/index.html missing"
fi

CSS_FILE="$(find dist/assets -maxdepth 1 -name '*.css' 2>/dev/null | head -n1)"
if [[ -n "$CSS_FILE" ]] && grep -qE -- '--tw-|tailwindcss' "$CSS_FILE"; then
  pass "P0-25" "dist CSS contains a Tailwind output marker (automated part only — visually verify styling manually)"
else
  fail "P0-25" "no dist CSS file found, or it has no Tailwind marker"
fi

# --- P0-27 / P0-29: run tests once, reuse the output for both checks ---
TEST_OUTPUT="$(npm test -- --run 2>&1)"
TEST_EXIT=$?
if [[ $TEST_EXIT -eq 0 ]]; then
  pass "P0-27" "npm test -- --run exit code 0"
else
  fail "P0-27" "npm test -- --run failed (exit $TEST_EXIT)"
fi

TEST_FILE_COUNT="$(find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) 2>/dev/null | wc -l | tr -d ' ')"
TESTS_PASSED_COUNT="$(echo "$TEST_OUTPUT" | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+' | head -n1)"
TESTS_PASSED_COUNT="${TESTS_PASSED_COUNT:-0}"
if [[ "$TEST_FILE_COUNT" -gt 0 && "$TESTS_PASSED_COUNT" -gt 0 ]]; then
  pass "P0-29" "$TEST_FILE_COUNT test file(s), $TESTS_PASSED_COUNT test(s) passed"
else
  fail "P0-29" "$TEST_FILE_COUNT test file(s), $TESTS_PASSED_COUNT test(s) passed (need > 0 of both)"
fi

if npm run lint >/dev/null 2>&1; then
  pass "P0-30" "npm run lint exit code 0"
else
  fail "P0-30" "npm run lint failed"
fi

# --- P0-24: boot the dev server on an isolated port, poll, then always kill it ---
DEV_PORT=5199
DEV_LOG="$(mktemp)"
TMP_FILES+=("$DEV_LOG")
npm run dev -- --port "$DEV_PORT" --strictPort >"$DEV_LOG" 2>&1 &
DEV_SERVER_PID=$!

DEV_OK=false
WAITED=0
while [[ $WAITED -lt 15 ]]; do
  if ! kill -0 "$DEV_SERVER_PID" 2>/dev/null; then
    break
  fi
  HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$DEV_PORT/" 2>/dev/null || echo "000")"
  if [[ "$HTTP_CODE" == "200" ]]; then
    DEV_OK=true
    break
  fi
  sleep 1
  WAITED=$((WAITED+1))
done

if kill -0 "$DEV_SERVER_PID" 2>/dev/null; then
  kill "$DEV_SERVER_PID" 2>/dev/null
  wait "$DEV_SERVER_PID" 2>/dev/null
fi
DEV_SERVER_PID=""

if $DEV_OK; then
  pass "P0-24" "dev server responded HTTP 200 on port $DEV_PORT within ${WAITED}s (automated part only — check browser console errors manually)"
else
  fail "P0-24" "dev server did not respond HTTP 200 on port $DEV_PORT within 15s"
fi

echo "=== เอกสารและโครงสร้างโฟลเดอร์ ==="

ALL_DIRS_OK=true
for d in src/types src/hooks src/components src/lib src/test; do
  [[ -d "$d" ]] || ALL_DIRS_OK=false
done
if $ALL_DIRS_OK; then
  pass "P0-31" "all required src subfolders exist"
else
  fail "P0-31" "one or more required src subfolders are missing"
fi

ALL_TRACKED_OK=true
UNTRACKED_DIRS=()
for d in src/types src/hooks src/components src/lib src/test; do
  COUNT="$(git ls-files "$d" 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$COUNT" -eq 0 ]]; then
    ALL_TRACKED_OK=false
    UNTRACKED_DIRS+=("$d")
  fi
done
if $ALL_TRACKED_OK; then
  pass "P0-32" "all required src subfolders have at least one tracked file"
else
  fail "P0-32" "no tracked files in: ${UNTRACKED_DIRS[*]}"
fi

check_file_identical "P0-33" "CLAUDE.md" "/Users/sirau/Downloads/CLAUDE.md" "CLAUDE.md matches source"
check_file_identical "P0-34" "docs/PRD.md" "$HOME/Downloads/PRD Task Priority App – MVP1.md" "docs/PRD.md matches source"

echo "=== Scope Guard ==="

BAD_DIRS=()
for d in src/types src/hooks src/components src/lib; do
  if [[ -d "$d" ]]; then
    EXTRA_FILES="$(find "$d" -maxdepth 1 -type f ! -name '.gitkeep' 2>/dev/null)"
    [[ -n "$EXTRA_FILES" ]] && BAD_DIRS+=("$d")
  fi
done
if [[ ${#BAD_DIRS[@]} -eq 0 ]]; then
  pass "P0-36" "src/types|hooks|components|lib contain no feature code yet"
else
  fail "P0-36" "unexpected files found in: ${BAD_DIRS[*]}"
fi

FORBIDDEN_TERMS=("deadline" "react-router" "firebase" "supabase")
FOUND_TERMS=()
for term in "${FORBIDDEN_TERMS[@]}"; do
  if grep -riq "$term" src/ package.json 2>/dev/null; then
    FOUND_TERMS+=("$term")
  fi
done
if [[ ${#FOUND_TERMS[@]} -eq 0 ]]; then
  pass "P0-37" "no forbidden terms in src/ or package.json"
else
  fail "P0-37" "forbidden terms found: ${FOUND_TERMS[*]}"
fi

echo ""
echo "=== ต้องตรวจด้วยตนเอง (ไม่ได้ทำอัตโนมัติ) ==="
echo "  P0-02  ไม่มีคำอธิบายใน spec — ไม่ได้ implement automated check"
echo "  P0-24  ต้องดู console errors ในเบราว์เซอร์ระหว่าง dev server รันเอง (ส่วนที่เหลือ automated แล้ว)"
echo "  P0-25  ต้องดูด้วยตาว่า Tailwind class แสดงผลจริงบนหน้าจอ (ส่วนที่เหลือ automated แล้ว)"
echo "  P0-28  ไม่มีคำอธิบายใน spec — ไม่ได้ implement automated check"
echo "  P0-35  ไม่มีคำอธิบายใน spec — ไม่ได้ implement automated check"

echo ""
echo "==================================="
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed, $SKIP_COUNT skipped"
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "Failed: ${FAILED_IDS[*]}"
  exit 1
fi
exit 0
