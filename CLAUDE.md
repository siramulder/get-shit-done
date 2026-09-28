# CLAUDE.md — Task Priority App (MVP1)

## Project Overview
A simple web app for manually prioritizing tasks. Users add tasks, reorder them by importance, and mark them done.
Full requirements and acceptance criteria: `docs/PRD.md` — always check it before implementing a feature.

## Tech Stack
- React 18 + Vite + TypeScript (strict mode)
- Tailwind CSS for styling
- @dnd-kit (core + sortable) for drag & drop
- localStorage for persistence
- Vitest + React Testing Library for tests

## Commands
- `npm run dev` — start dev server
- `npm test` — run tests (use `npm test -- --run` for a single non-watch run)
- `npm run build` — production build
- `npm run lint` — lint

## Project Structure
```
src/
  types/        # Task type and shared types
  hooks/        # useTasks (state + localStorage)
  components/   # UI components (TaskInput, TaskList, TaskItem, DoneSection, EmptyState)
  lib/          # storage helpers
  App.tsx
docs/
  PRD.md
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
- If stored data is missing or invalid, start with an empty list — never crash.

## MVP1 Scope — IN
Add task (title only), reorder (drag & drop + ↑↓ buttons), complete / undo complete, delete, Today view, empty state, localStorage persistence.

## MVP1 Scope — OUT (do NOT build)
Deadlines, tags/categories, subtasks, notes, auto-prioritization/AI suggestions, collaboration/sharing, login/accounts, backend/cloud sync, mobile app.
If a task seems to need any of these, stop and ask instead of implementing.

## Coding Conventions
- Functional components and hooks only.
- Keep all task state logic in `useTasks`; components stay presentational.
- No new dependencies without asking first.
- Accessibility: all buttons have labels; drag & drop must support keyboard; ↑ disabled on first item, ↓ disabled on last.
- UI text in Thai unless told otherwise.

## Workflow
1. For each phase, propose a plan first (Plan Mode) and wait for approval.
2. Write tests based on the acceptance criteria in `docs/PRD.md`.
3. Run `npm test -- --run` and `npm run build` before saying a phase is done.
4. Keep changes scoped to the current phase; one phase = one commit.
5. Summarize what changed and anything not yet meeting the acceptance criteria.
