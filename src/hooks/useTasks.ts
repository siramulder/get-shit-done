import { useEffect, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { Task } from '../types/task'
import { loadStore, saveTasks } from '../lib/storage'
import { isToday } from '../lib/date'

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

export function useTasks() {
  const [loaded] = useState(loadStore)
  // localStorage holds data from a newer app version: show an empty list, change nothing, write nothing.
  const newerVersion = loaded.status === 'newer-version'
  const [tasks, setTasks] = useState<Task[]>(() => (loaded.status === 'ok' ? loaded.tasks : []))
  const initialTasks = useRef(tasks)

  useEffect(() => {
    // Skip the mount so a failed or partial read is never written back before the user changes anything.
    if (newerVersion || tasks === initialTasks.current) return
    saveTasks(tasks)
  }, [newerVersion, tasks])

  // Every mutation goes through here, so the newer-version guard cannot be forgotten by a new action.
  function update(change: (prev: Task[]) => Task[]) {
    if (newerVersion) return
    setTasks(change)
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
    update((prev) => [
      ...prev,
      { id, title: trimmed, order: nextOrder(prev), status: 'todo', createdAt },
    ])
  }

  function completeTask(id: string) {
    const completedAt = new Date().toISOString()
    update((prev) =>
      prev.map((t): Task =>
        t.id === id && t.status === 'todo' ? { ...t, status: 'done', completedAt } : t,
      ),
    )
  }

  function uncompleteTask(id: string) {
    update((prev) => {
      const order = nextOrder(prev)
      return prev.map((t): Task =>
        t.id === id && t.status === 'done'
          ? { id: t.id, title: t.title, order, status: 'todo', createdAt: t.createdAt }
          : t,
      )
    })
  }

  function deleteTask(id: string) {
    update((prev) => prev.filter((t) => t.id !== id))
  }

  function moveTask(id: string, direction: 'up' | 'down') {
    update((prev) => {
      const todo = sortedTodo(prev)
      const from = todo.findIndex((t) => t.id === id)
      const to = direction === 'up' ? from - 1 : from + 1
      if (from === -1 || to < 0 || to >= todo.length) return prev
      return withTodoOrder(prev, arrayMove(todo, from, to))
    })
  }

  function reorderTasks(activeId: string, overId: string) {
    update((prev) => {
      const todo = sortedTodo(prev)
      const from = todo.findIndex((t) => t.id === activeId)
      const to = todo.findIndex((t) => t.id === overId)
      if (from === -1 || to === -1 || from === to) return prev
      return withTodoOrder(prev, arrayMove(todo, from, to))
    })
  }

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
  }
}
