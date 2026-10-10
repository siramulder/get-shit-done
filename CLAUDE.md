# CLAUDE.md — Task Priority App (MVP1)

## Project Overview
A simple web app for manually prioritizing tasks. Users add tasks, reorder them by importance, and mark them done.
Full requirements and acceptance criteria: `docs/PRD.md` — always check it before implementing a feature.
Phase status, past decisions, and what comes next: `docs/DEV_PLAN.md` — read it before starting work.

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
- `bash scripts/verify-phase2.sh [--pre-commit]` — Phase 2 verification (report only)
- `bash scripts/verify-phase2.selftest.sh` — proves the verify script catches planted defects (~4 min)

## Project Structure
```
src/
  types/        # Task type
  hooks/        # useTasks — sole owner of task state and persistence
  lib/          # storage.ts, date.ts, labels.ts (all UI text)
  components/   # presentational UI: TaskInput, TaskList, TaskItem, DoneSection, EmptyState,
                #   plus handleDragEnd.ts and cardPointerSensor.ts
  test/         # setup.ts, smoke test
  App.tsx       # the only caller of useTasks
scripts/        # verify-phase0.sh (Phase 0 snapshot, now expected to fail P0-33/P0-36), verify-phase2.sh + self-test
docs/
  PRD.md
  DEV_PLAN.md
```

## Data Model
```ts
type Task = {
  id: string;          // crypto.randomUUID()
  title: string;
  order: number;
  status: "todo" | "done";
  createdAt: string;   // ISO
  completedAt?: string;
};
```
- localStorage key: `task-priority-app:tasks`
- Missing data, unparseable JSON, or a non-array → start with an empty list; storage errors never throw.
- Otherwise keep only valid tasks: drop items with missing/wrong-typed fields, a bad status, or `done` without `completedAt`; keep the first of duplicate ids; strip unknown fields. Then renumber todo `order` to 0..n-1 (by order, then createdAt).
- If anything was discarded, first save the raw string to `task-priority-app:tasks:corrupt-backup` (latest overwrites); clean data never writes a backup.

## MVP1 Scope — IN
Add task (title only), reorder (drag & drop + ↑↓ buttons), complete / undo complete, delete, Today view, empty state, localStorage persistence.

## MVP1 Scope — OUT (do NOT build)
Deadlines, tags/categories, subtasks, notes, auto-prioritization/AI suggestions, collaboration/sharing, login/accounts, backend/cloud sync, mobile app.
If a task seems to need any of these, stop and ask instead of implementing.

## Coding Conventions
- Functional components and hooks only.
- Keep all task state logic in `useTasks`; only `App.tsx` calls it. Components receive values and handlers via props and must not import `useTasks`, `lib/storage`, `lib/date`, or touch `localStorage`.
- All UI text lives in `src/lib/labels.ts`; no Thai literals in components or `App.tsx`.
- No new dependencies without asking first.
- Accessibility: all buttons have labels; drag & drop must support keyboard; ↑ disabled on first item, ↓ disabled on last.
- Drag & drop: a mouse drag can start anywhere on a card — `listeners` go on the `<li>`, and `CardPointerSensor` refuses to start from the card's buttons (↑ ↓ ✓ ✕). `attributes` and `setActivatorNodeRef` stay on the ⠿ handle, so keyboard dragging and screen-reader semantics live there. Sensors: `CardPointerSensor { distance: 5 }` + KeyboardSensor with `sortableKeyboardCoordinates`. Touch/mobile dragging is not supported.
- Delete is immediate: no confirm dialog, never `window.confirm`.
- UI text in Thai unless told otherwise.

## Testing Conventions
- Put the requirement ID in the test name (e.g. `it('P2-05 clears the box …')`) and colocate `*.test.ts(x)` with the file under test.
- Query by role + accessible name taken from `labels`.
- Tests run with `TZ=Asia/Bangkok` (`vite.config.ts` → `test.env`); for date logic use `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`.
- No `.skip` / `.only` / `.todo`. Never weaken a test to make it pass — fix the code or ask.
- jsdom has no layout: mouse dragging and keyboard reordering cannot be proven by tests. Never claim them as tested; list them for manual browser checks.
- A test that starts a pointer drag must end it and then wait ~60ms: dnd-kit keeps a click-swallowing listener on `document` for 50ms, which can eat clicks in the next test.

## Workflow
1. For each phase, propose a plan first (Plan Mode) and wait for approval.
2. Write tests first from the acceptance criteria in `docs/PRD.md`, see them fail, then implement.
3. Before saying a phase is done: `npm test -- --run`, the shuffled run ×3, `npm run build`, `npm run lint`, and the phase's verify script.
4. Keep changes scoped to the current phase; one phase = one commit.
5. Summarize what changed and anything not yet meeting the acceptance criteria, and update `docs/DEV_PLAN.md`.
