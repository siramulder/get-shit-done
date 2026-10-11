import { useId } from 'react'
import { focusNeighborControl } from './focusNeighbor'
import { labels } from '../lib/labels'
import type { Task } from '../types/task'

type Props = {
  tasks: Task[]
  onUncomplete: (id: string) => void
  onDelete: (id: string) => void
  focusFallback: () => void
}

const iconButton =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:bg-gray-800'

export function DoneSection({ tasks, onUncomplete, onDelete, focusFallback }: Props) {
  const headingId = useId()
  if (tasks.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {labels.doneHeading}
      </h2>
      <ul aria-labelledby={headingId} className="mt-3 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/50"
          >
            <span className="min-w-0 flex-1 break-words px-2 text-gray-500 line-through dark:text-gray-400">
              {task.title}
            </span>
            <button
              type="button"
              data-action="uncomplete"
              onClick={(event) => {
                focusNeighborControl(event.currentTarget, focusFallback)
                onUncomplete(task.id)
              }}
              aria-label={labels.uncomplete(task.title)}
              className={iconButton}
            >
              <span aria-hidden="true">{'↩︎'}</span>
            </button>
            <button
              type="button"
              data-action="remove"
              onClick={(event) => {
                focusNeighborControl(event.currentTarget, focusFallback)
                onDelete(task.id)
              }}
              aria-label={labels.remove(task.title)}
              className={`${iconButton} text-red-600 dark:text-red-400`}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
