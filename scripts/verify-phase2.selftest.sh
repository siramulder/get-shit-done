#!/usr/bin/env bash
# Self-test for verify-phase2.sh: plants one defect at a time in a throwaway copy of the project
# and confirms the matching check turns FAIL. The real project is only read (plus one positive-control run).
# Usage: bash scripts/verify-phase2.selftest.sh

set -o pipefail
cd "$(dirname "$0")/.." || { echo "FATAL: cannot cd to project root"; exit 2; }
ROOT="$(pwd)"
VERIFY="scripts/verify-phase2.sh"
TARGET_IDS="P2-39 P2-40 P2-41 P2-42 P2-43 P2-44 P2-45 P2-49 X-01 X-02"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/verify-phase2-selftest.XXXXXX")" || { echo "FATAL: mktemp failed"; exit 2; }
COPY="$WORK/project"
TABLE="$WORK/table"
trap 'rm -rf "$WORK"' EXIT
trap 'exit 130' INT TERM

status_of() { # status_of <id> <log>: prints PASS / FAIL / SKIP for that ID
  grep -E "^(PASS|FAIL|SKIP) $1 - " "$2" | head -n 1 | cut -d' ' -f1
}

block_of() { # block_of <id> <log>: the result line for <id> plus its evidence lines
  awk -v id="$1" '
    index($0, "PASS " id " - ") == 1 || index($0, "FAIL " id " - ") == 1 || index($0, "SKIP " id " - ") == 1 { p = 1; print; next }
    p && (/^(PASS|FAIL|SKIP) / || /^===/ || /^$/) { p = 0 }
    p { print }
  ' "$2"
}

echo "== 1. Positive control: $TARGET_IDS must PASS in the real project =="
bash "$ROOT/$VERIFY" --pre-commit > "$WORK/positive.log" 2>&1
NOT_PASSING=""
for id in $TARGET_IDS; do
  st="$(status_of "$id" "$WORK/positive.log")"
  printf '   %-6s %s\n' "$id" "${st:-MISSING}"
  [ "$st" = "PASS" ] || NOT_PASSING="$NOT_PASSING $id"
done
if [ -n "$NOT_PASSING" ]; then
  echo
  echo "STOP: positive control failed for:$NOT_PASSING — the real project must pass these first."
  echo "Self-test cases were NOT run, so nothing here is a self-test result."
  for id in $NOT_PASSING; do block_of "$id" "$WORK/positive.log"; done
  exit 1
fi

# --- Throwaway copy: everything incl. .git, but node_modules is a folder of per-package symlinks
#     so tsc/vite caches (node_modules/.tmp, node_modules/.vite) land in the copy, not the real project.
sync_copy() {
  rsync -a --delete --exclude '/node_modules' --exclude '/dist' "$ROOT/" "$COPY/"
}
mkdir -p "$COPY"
sync_copy
mkdir "$COPY/node_modules"
for entry in "$ROOT"/node_modules/* "$ROOT"/node_modules/.bin "$ROOT"/node_modules/.package-lock.json; do
  [ -e "$entry" ] && ln -s "$entry" "$COPY/node_modules/"
done

append_line() { printf '%s\n' "$2" >> "$COPY/$1"; }

replace_text() { # replace_text <file> <from> <to>; fails if <from> is not in the file
  node -e '
    const fs = require("fs");
    const [file, from, to] = process.argv.slice(1);
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes(from)) { console.error(`"${from}" not found in ${file}`); process.exit(1); }
    fs.writeFileSync(file, text.split(from).join(to));
  ' "$COPY/$1" "$2" "$3"
}

add_dependency() {
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.dependencies = { ...pkg.dependencies, "left-pad": "^1.3.0" };
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  ' "$COPY/package.json"
}

mutate_a() { append_line src/components/EmptyState.tsx "export const selftestThai = 'ทดสอบ'"; }
mutate_b() { append_line src/components/EmptyState.tsx "import { useTasks } from '../hooks/useTasks'"; }
mutate_c() { append_line src/hooks/useTasks.ts "// selftest: one-line change"; }
mutate_d() { add_dependency; }
mutate_e() { append_line src/App.tsx "// deadline"; }
mutate_f() { replace_text src/main.tsx '<StrictMode>' '' && replace_text src/main.tsx '</StrictMode>' ''; }
mutate_g() { append_line src/components/EmptyState.tsx "export const selftestAsk = () => window.confirm('x')"; }
mutate_h() { append_line src/components/EmptyState.test.tsx "it.skip('selftest', () => {})"; }
mutate_i() { replace_text src/components/TaskInput.test.tsx 'P2-05' 'P2-X5'; }
mutate_j() { printf '/* selftest */\n' > "$COPY/src/App.css"; }

# run_case <letter> <expected-id> <description> <mutation> [<text the evidence must contain>]
run_case() {
  local letter=$1 id=$2 desc=$3 mutation=$4 must_mention=$5
  local log="$WORK/case-$letter.log" actual verdict
  sync_copy
  if ! "$mutation" 2> "$WORK/mutation.err"; then
    actual="ERROR"
    verdict="NO (could not plant defect: $(head -n 1 "$WORK/mutation.err"))"
  else
    bash "$COPY/$VERIFY" --pre-commit > "$log" 2>&1
    actual="$(status_of "$id" "$log")"
    actual="${actual:-MISSING}"
    verdict="YES"
    [ "$actual" = "FAIL" ] || verdict="NO"
    if [ "$verdict" = "YES" ] && [ -n "$must_mention" ] && ! block_of "$id" "$log" | grep -qF "$must_mention"; then
      verdict="NO (evidence does not name $must_mention)"
    fi
  fi
  printf '%s|%s|%s|%s|%s\n' "$letter" "$desc" "$id" "$actual" "$verdict" >> "$TABLE"
  printf '   %s) %-6s -> %-7s %s\n' "$letter" "$id" "$actual" "$verdict"
  [ "$verdict" = "YES" ] && [ "$actual" = "FAIL" ] && block_of "$id" "$log" | sed -n '2,3p'
}

echo
echo "== 2. Planting one defect per case in $COPY =="
: > "$TABLE"
run_case a "P2-39" "เพิ่มสตริงไทยใน component"                 mutate_a
run_case b "P2-40" "เพิ่ม import useTasks ใน component"          mutate_b
run_case c "P2-41" "แก้ src/hooks/useTasks.ts 1 บรรทัด"           mutate_c
run_case d "P2-42" "เพิ่ม dependency ใน package.json"             mutate_d
run_case e "P2-43" "เพิ่มคำว่า deadline ใน src/"                   mutate_e
run_case f "P2-45" "ลบ <StrictMode> ออกจาก main.tsx"             mutate_f
run_case g "P2-49" "เพิ่ม window.confirm( ใน component"           mutate_g
run_case h "X-02"  "เพิ่ม it.skip ในไฟล์เทสต์"                     mutate_h
run_case i "X-01"  "เปลี่ยนชื่อเทสต์ให้ P2-05 หายไป"                mutate_i "P2-05"
run_case j "P2-44" "เพิ่มไฟล์ src/App.css"                        mutate_j

echo
echo "== 3. Results =="
echo "กรณี | ความผิดพลาดที่ใส่ | ข้อที่คาดว่าจะ FAIL | ผลจริง | ผ่าน?"
echo "---- | ---------------- | ------------------ | ------ | -----"
sed 's/|/ | /g' "$TABLE"

TOTAL=$(wc -l < "$TABLE" | tr -d ' ')
OK=$(grep -c '|YES$' "$TABLE")
echo
echo "Self-test: $OK of $TOTAL cases caught by the expected check"
[ "$OK" -eq "$TOTAL" ] || exit 1
exit 0
