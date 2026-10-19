# CLAUDE.md — Task Priority App

## Project Overview
A simple web app for manually prioritizing tasks. Users add tasks, reorder them by importance, and mark them done.
MVP1 shipped. Current work: **v2 "ตัดสินใจทีละคู่"** — pairwise ordering review, deadline labels, inline title editing, universal undo/redo.
- MVP1 requirements: `docs/PRD.md`
- v2 requirements and acceptance criteria: `docs/PRD-v2.md` — always check it before implementing a feature.
- Slice status, past decisions, and what comes next: `docs/DEV_PLAN.md` — read it before starting work.

## Tech Stack
- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first, no `tailwind.config`)
- @dnd-kit (core + sortable + utilities) for drag & drop
- localStorage for persistence
- Vitest + React Testing Library (+ user-event, jest-dom) for tests; oxlint for lint

## Commands
- `npm run dev` — start dev server
- `npm test` — run tests (use `npm test -- --run` for a single non-watch run)
- `npx vitest --run --sequence.shuffle` — shuffled run; tests must not depend on order
- `npm run build` — production build; its `tsc -b` step is what enforces type-level tests
- `npm run lint` — lint
- `bash scripts/verify-v2.sh [--pre-commit]` — v2 verification (report only)
- `bash scripts/verify-phase0.sh`, `bash scripts/verify-phase2.sh` — retired phase snapshots, see Scope guards

## Project Structure
```
src/
  types/        # Task, Store
  hooks/        # useTasks — sole owner of task state, persistence, and undo history
  lib/          # storage.ts (+ migration), date.ts, labels.ts (all UI text)
  components/   # presentational UI: TaskInput, TaskList, TaskItem, DoneSection, EmptyState,
                #   plus handleDragEnd.ts, cardPointerSensor.ts, listCollisionDetection.ts, focusNeighbor.ts
  test/         # setup.ts, smoke test
  App.tsx       # the only caller of useTasks
scripts/        # verify-phase0.sh, verify-phase2.sh + self-test (retired snapshots), verify-v2.sh + verify-v2.selftest.sh
docs/
  PRD.md        # MVP1
  PRD-v2.md     # v2 — user stories US-6..US-17 with Given/When/Then AC
  DEV_PLAN.md
  MANUAL_QA.md
```

## Data Model (v2)
```ts
type Task = {
  id: string;          // crypto.randomUUID()
  title: string;
  order: number;
  status: "todo" | "done";
  createdAt: string;   // ISO
  completedAt?: string;
  dueDate?: string;    // "YYYY-MM-DD" local calendar date, no time, no timezone
};

type Store = { schemaVersion: 2; tasks: Task[] };
```
- localStorage key: `task-priority-app:tasks`
- v1 data (a bare `Task[]`) migrates to `Store` v2 in memory on load and is written back only on the user's first change. A clean v1 array must never produce a corrupt-backup.
- Missing data, unparseable JSON, or a value that is neither an array nor a v2 store → start with an empty list; storage errors never throw.
- `schemaVersion` higher than this app knows → show an empty list with a "newer version" message, disable mutations, and never overwrite localStorage.
- Otherwise keep only valid tasks: drop items with missing/wrong-typed fields, a bad status, `done` without `completedAt`, or a malformed `dueDate` (must match `^\d{4}-\d{2}-\d{2}$` and be a real date — drop just that field, keep the task); keep the first of duplicate ids; strip unknown fields. Then renumber todo `order` to 0..n-1 (by order, then createdAt).
- If anything was discarded, first save the raw string to `task-priority-app:tasks:corrupt-backup` (latest overwrites); clean data never writes a backup.

## v2 Scope — IN
Pairwise ordering review (one button, bottom-up, n-1 questions, skippable, exit anytime), optional deadline shown as a label only, inline title editing, undo/redo across every action, schema v2 + migration, light-mode contrast fix.

## v2 Scope — OUT (do NOT build)
Sorting or auto-promoting by deadline, nudges to move overdue tasks up, pairwise comparison on add, auto-prompting the review at the start of a day, time-of-day in deadlines, recurring tasks, notifications, tags/categories/subtasks/notes, touch dragging, login/cloud sync/sharing, export/import JSON.
If a task seems to need any of these, stop and ask instead of implementing.

## Coding Conventions
- Functional components and hooks only.
- Keep all task state logic in `useTasks`; only `App.tsx` calls it. Components receive values and handlers via props and must not import `useTasks`, `lib/storage`, `lib/date`, or touch `localStorage`.
- All UI text lives in `src/lib/labels.ts`; no Thai literals in components or `App.tsx`.
- No new dependencies without asking first.
- Accessibility: all buttons have labels; drag & drop must support keyboard; ↑ disabled on first item, ↓ disabled on last; review mode announces each new pair via `aria-live="polite"` and traps focus inside itself.
- Drag & drop: a mouse drag can start anywhere on a card — `listeners` go on the `<li>`, and `CardPointerSensor` refuses to start from the card's buttons (↑ ↓ ✓ ✕ and any control added later). `attributes` and `setActivatorNodeRef` stay on the ⠿ handle, so keyboard dragging and screen-reader semantics live there. Sensors: `CardPointerSensor { distance: 5 }` + KeyboardSensor with `sortableKeyboardCoordinates`. Touch/mobile dragging is not supported. A row being edited inline must not start a drag.
- Deadline never changes `order`. Any code path that sets or clears `dueDate` leaves every task's `order` untouched.
- Undo/redo: one history stack in `useTasks`, max 50 steps, session-only (not persisted). Every mutation pushes one entry; every undo/redo writes localStorage like a normal action. Undo of a delete restores the task to its original position. ⌘Z/Ctrl+Z does nothing while focus is in a text field.
- Delete is immediate: no confirm dialog, never `window.confirm`.
- UI text in Thai unless told otherwise.

## Testing Conventions
- Put the requirement ID in the test name — v2 uses the AC ids from `docs/PRD-v2.md` (e.g. `it('AC-7.2 swaps the pair and advances', …)`); MVP1 tests keep their P1-xx / P2-xx ids.
- Colocate `*.test.ts(x)` with the file under test; query by role + accessible name taken from `labels`.
- Tests run with `TZ=Asia/Bangkok` (`vite.config.ts` → `test.env`); for date logic use `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`.
- No `.skip` / `.only` / `.todo`. Never weaken a test to make it pass — fix the code or ask.
- jsdom has no layout: mouse dragging and keyboard reordering cannot be proven by tests. Never claim them as tested; list them for manual browser checks in `docs/MANUAL_QA.md`.
- A test that starts a pointer drag must end it and then wait ~60ms: dnd-kit keeps a click-swallowing listener on `document` for 50ms, which can eat clicks in the next test.
- MVP1 tests (P1-xx, P2-xx) must keep passing through v2. If one legitimately no longer applies, stop and ask before changing it.

## Scope guards
- `scripts/verify-phase0.sh` and `scripts/verify-phase2.sh` are retired snapshots. verify-phase2 now fails by design (its P2-43 greps for "deadline", which v2 adds); don't edit them to pass and don't use them as a gate for v2 work.
- v2 has its own `scripts/verify-v2.sh` with a self-test, written in slice 0 and extended per slice.

## Workflow
1. Work one slice at a time, in the order in `docs/DEV_PLAN.md`. Propose a plan first (Plan Mode) and wait for approval.
2. Write tests first from the AC in `docs/PRD-v2.md`, see them fail, then implement.
3. Before saying a slice is done: `npm test -- --run`, the shuffled run ×3, `npm run build`, `npm run lint`, and `scripts/verify-v2.sh`.
4. Keep changes scoped to the current slice; one slice = one commit (plus a separate commit for verify-script changes).
5. Summarize what changed and anything not yet meeting the AC, and update `docs/DEV_PLAN.md`.
