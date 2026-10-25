#!/usr/bin/env bash
# Self-test for verify-v2.sh: plants one defect at a time in a throwaway copy of the project
# and confirms the matching check turns FAIL. The real project is only read (plus one positive-control run).
# Usage: bash scripts/verify-v2.selftest.sh

set -o pipefail
cd "$(dirname "$0")/.." || { echo "FATAL: cannot cd to project root"; exit 2; }
ROOT="$(pwd)"
VERIFY="scripts/verify-v2.sh"
TARGET_IDS="V2-01 V2-02 V2-03 V2-04 V2-05 V2-06 V2-07 V2-08 V2-09 V2-13 V2-14"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/verify-v2-selftest.XXXXXX")" || { echo "FATAL: mktemp failed"; exit 2; }
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

# --- Throwaway copy: everything incl. .git (verify-v2 needs BASE), but node_modules is a folder of
#     per-package symlinks so tsc/vite caches (node_modules/.tmp, node_modules/.vite) land in the copy.
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

rename_id() { # rename_id <from> <to>: in every *.test.ts(x) under src of the copy that contains <from>
  local from=$1 to=$2 f n=0
  (cd "$COPY" && find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \)) > "$WORK/specs"
  while IFS= read -r f; do
    if grep -qF "$from" "$COPY/$f"; then
      replace_text "$f" "$from" "$to" || return 1
      n=$((n + 1))
    fi
  done < "$WORK/specs"
  [ "$n" -gt 0 ] || { echo "$from not found in any test file" >&2; return 1; }
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
mutate_b() { append_line src/components/EmptyState.tsx "import { loadStore } from '../lib/storage'"; }
mutate_c() { add_dependency; }
mutate_d() { append_line src/components/EmptyState.tsx "export const selftestAsk = () => window.confirm('x')"; }
mutate_e() { append_line src/components/EmptyState.test.tsx "it.skip('selftest', () => {})"; }
mutate_f() { rename_id 'P1-24' 'P1-X4'; }
mutate_g() { append_line src/hooks/useTasks.ts "export const selftestSort = (t: Task[]) => [...t].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))"; }
mutate_h() { rename_id 'AC-16.3' 'AC-16.X'; }
mutate_i() { replace_text src/components/TaskItem.tsx 'className={`flex cursor-grab' 'className={`flex touch-none cursor-grab'; }
mutate_j() { append_line scripts/verify-phase2.sh "# selftest: one-line change"; }
mutate_k() { append_line src/components/EmptyState.tsx "export const selftestNotify = () => new window.Notification('x')"; }
mutate_l() { append_line src/hooks/useTasks.ts "export const selftestTasks = loadTasks()"; }
mutate_m() { rename_id 'AC-7.2' 'AC-7.X'; }
mutate_n() { replace_text src/lib/review.ts 'export type Answer' "import { loadStore } from './storage'
export const selftestLoad = loadStore
export type Answer"; }
mutate_o() { replace_text src/components/EmptyState.tsx 'text-muted' 'text-gray-500'; }

# run_case <letter> <expected-id> <description> <mutation> [<text the evidence lines (not the FAIL headline) must contain>]
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
    if [ "$verdict" = "YES" ] && [ -n "$must_mention" ] && ! block_of "$id" "$log" | sed '1d' | grep -qF "$must_mention"; then
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
run_case a "V2-01" "เพิ่มสตริงไทยใน component"                    mutate_a
run_case b "V2-02" "เพิ่ม import lib/storage ใน component"          mutate_b
run_case c "V2-03" "เพิ่ม dependency ใน package.json"                mutate_c
run_case d "V2-04" "เพิ่ม window.confirm( ใน component"              mutate_d
run_case e "V2-05" "เพิ่ม it.skip ในไฟล์เทสต์"                        mutate_e
run_case f "V2-06" "เปลี่ยนชื่อเทสต์ให้ P1-24 หายไป"                   mutate_f "P1-24"
run_case g "V2-08" "เพิ่ม .sort((a, b) => a.dueDate…) ใน useTasks.ts" mutate_g
run_case h "V2-07" "เปลี่ยนชื่อเทสต์ให้ AC-16.3 หายไป"                 mutate_h "AC-16.3"
run_case i "V2-09" "ใส่ touch-none ที่ <li> ของการ์ด"                   mutate_i
run_case j "V2-13" "แก้ scripts/verify-phase2.sh 1 บรรทัด"            mutate_j
run_case k "V2-08" "เพิ่ม window.Notification ใน component"           mutate_k
run_case l "V2-02" "เรียก loadTasks() ใน useTasks.ts"                 mutate_l "selftestTasks"
run_case m "V2-07" "เปลี่ยนชื่อเทสต์ให้ AC-7.2 หายไป"                  mutate_m "AC-7.2"
run_case n "V2-02" "import { loadStore } ใน lib/review.ts"            mutate_n "src/lib/review.ts"
run_case o "V2-14" "ใส่ text-gray-500 ใน component"                    mutate_o "text-gray-500"

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
