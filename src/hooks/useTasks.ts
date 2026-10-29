import { useEffect, useReducer, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { Task } from '../types/task'
import { loadStore, saveTasks } from '../lib/storage'
import { isToday } from '../lib/date'
import { labels } from '../lib/labels'

function sortedTodo(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'todo').sort((a, b) => a.order - b.order)
}

function nextOrder(tasks: Task[]): number {
  return Math.max(-1, ...sortedTodo(tasks).map((t) => t.order)) + 1
}

function withTodoOrder(tasks: Task[], orderedTodo: Task[]): Task[] {
  const orderById = new Map(orderedTodo.map((t, index) => [t.id, index]))
  return tasks.map((t) => {
    const order = orderById.get(t.id)
    return order === undefined ? t : { ...t, order }
  })
}

const titleOf = (tasks: Task[], id: string) => tasks.find((t) => t.id === id)?.title ?? ''

// ---- history --------------------------------------------------------------------------------
// One snapshot of the whole list per action, in memory only. `past`/`future` entries carry the
// snapshot to return to and the label of the action that leads away from it.
export const HISTORY_LIMIT = 50

type Entry = { tasks: Task[]; label: string }
type History = { present: Task[]; past: Entry[]; future: Entry[]; dirty: boolean }
type HistoryAction =
  | { type: 'apply'; change: (prev: Task[]) => Task[]; label: (prev: Task[]) => string }
  | { type: 'undo'; redoable: boolean }
  | { type: 'redo' }

// Mutators return `prev` or map untouched tasks through unchanged, so a shallow compare tells a no-op apart.
function sameTasks(a: Task[], b: Task[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

function historyReducer(h: History, action: HistoryAction): History {
  switch (action.type) {
    case 'apply': {
      const next = action.change(h.present)
      if (sameTasks(next, h.present)) return h
      const past = [...h.past, { tasks: h.present, label: action.label(h.present) }].slice(-HISTORY_LIMIT)
      return { present: next, past, future: [], dirty: true }
    }
    case 'undo': {
      const entry = h.past[h.past.length - 1]
      if (entry === undefined) return h
      const future = action.redoable ? [...h.future, { tasks: h.present, label: entry.label }] : h.future
      return { present: entry.tasks, past: h.past.slice(0, -1), future, dirty: true }
    }
    case 'redo': {
      const entry = h.future[h.future.length - 1]
      if (entry === undefined) return h
      return {
        present: entry.tasks,
        past: [...h.past, { tasks: h.present, label: entry.label }],
        future: h.future.slice(0, -1),
        dirty: true,
      }
    }
  }
}

export function useTasks() {
  const [loaded] = useState(loadStore)
  // localStorage holds data from a newer app version: show an empty list, change nothing, write nothing.
  const newerVersion = loaded.status === 'newer-version'
  const [history, dispatch] = useReducer(historyReducer, loaded, (l) => ({
    present: l.status === 'ok' ? l.tasks : [],
    past: [],
    future: [],
    dirty: false,
  }))
  const tasks = history.present

  useEffect(() => {
    // `dirty` is false until the first real change, so nothing is written back on open (a failed or
    // partial read must not overwrite storage) — and an undo back to the first snapshot still saves.
    if (newerVersion || !history.dirty) return
    saveTasks(history.present)
  }, [newerVersion, history])

  // Every mutation goes through here, so the newer-version guard cannot be forgotten by a new action.
  function apply(change: (prev: Task[]) => Task[], label: (prev: Task[]) => string) {
    if (newerVersion) return
    dispatch({ type: 'apply', change, label })
  }

  const todoTasks = sortedTodo(tasks)
  const doneTodayTasks = tasks
    .filter((t) => t.status === 'done' && t.completedAt !== undefined && isToday(t.completedAt))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  function addTask(title: string) {
    const trimmed = title.trim()
    if (trimmed === '') return
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    apply(
      (prev) => [...prev, { id, title: trimmed, order: nextOrder(prev), status: 'todo', createdAt }],
      () => labels.history.add(trimmed),
    )
  }

  function completeTask(id: string) {
    const completedAt = new Date().toISOString()
    apply(
      (prev) =>
        prev.map((t): Task => (t.id === id && t.status === 'todo' ? { ...t, status: 'done', completedAt } : t)),
      (prev) => labels.history.complete(titleOf(prev, id)),
    )
  }

  function uncompleteTask(id: string) {
    apply(
      (prev) => {
        const order = nextOrder(prev)
        return prev.map((t): Task =>
          t.id === id && t.status === 'done'
            ? { id: t.id, title: t.title, order, status: 'todo', createdAt: t.createdAt }
            : t,
        )
      },
      (prev) => labels.history.uncomplete(titleOf(prev, id)),
    )
  }

  function deleteTask(id: string) {
    apply(
      (prev) => prev.filter((t) => t.id !== id),
      (prev) => labels.history.remove(titleOf(prev, id)),
    )
  }

  // `reason` only changes the history label: 'swap' is the review mode applying an answer.
  function moveTask(id: string, direction: 'up' | 'down', reason: 'move' | 'swap' = 'move') {
    apply(
      (prev) => {
        const todo = sortedTodo(prev)
        const from = todo.findIndex((t) => t.id === id)
        const to = direction === 'up' ? from - 1 : from + 1
        if (from === -1 || to < 0 || to >= todo.length) return prev
        return withTodoOrder(prev, arrayMove(todo, from, to))
      },
      (prev) => (reason === 'swap' ? labels.history.swap(titleOf(prev, id)) : labels.history.move(titleOf(prev, id))),
    )
  }

  function reorderTasks(activeId: string, overId: string) {
    apply(
      (prev) => {
        const todo = sortedTodo(prev)
        const from = todo.findIndex((t) => t.id === activeId)
        const to = todo.findIndex((t) => t.id === overId)
        if (from === -1 || to === -1 || from === to) return prev
        return withTodoOrder(prev, arrayMove(todo, from, to))
      },
      (prev) => labels.history.move(titleOf(prev, activeId)),
    )
  }

  // `redoable: false` is for the review mode, whose undone answers must not come back as a redo.
  function undo(options: { redoable?: boolean } = {}) {
    if (newerVersion) return
    dispatch({ type: 'undo', redoable: options.redoable ?? true })
  }

  function redo() {
    if (newerVersion) return
    dispatch({ type: 'redo' })
  }

  const lastPast = history.past[history.past.length - 1]
  const lastFuture = history.future[history.future.length - 1]

  return {
    todoTasks,
    doneTodayTasks,
    newerVersion,
    addTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    moveTask,
    reorderTasks,
    undo,
    redo,
    canUndo: !newerVersion && lastPast !== undefined,
    canRedo: !newerVersion && lastFuture !== undefined,
    lastUndoLabel: !newerVersion && lastPast !== undefined ? lastPast.label : null,
    lastRedoLabel: !newerVersion && lastFuture !== undefined ? lastFuture.label : null,
  }
}
