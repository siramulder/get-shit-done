import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { focusNeighborControl } from './focusNeighbor'
import { labels } from '../lib/labels'
import type { Task } from '../types/task'

type Props = {
  task: Task
  isFirst: boolean
  isLast: boolean
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  focusFallback: () => void
}

const iconButton =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800'
const controlButton = `${iconButton} cursor-pointer`

export function TaskItem({ task, isFirst, isLast, onMoveUp, onMoveDown, onComplete, onDelete, focusFallback }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, attributes: { roleDescription: labels.dnd.roleDescription } })

  return (
    // Pointer drags start anywhere on the card (CardPointerSensor skips its buttons); the activator ref and
    // attributes stay on the handle so keyboard dragging and screen-reader semantics live there.
    <li
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex cursor-grab items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 active:cursor-grabbing dark:border-gray-800 dark:bg-gray-900 ${
        isDragging ? 'relative z-10 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        aria-label={labels.dragHandle(task.title)}
        className={`${iconButton} cursor-grab touch-none text-gray-400 active:cursor-grabbing`}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <span className="min-w-0 flex-1 break-words px-1 text-gray-900 dark:text-gray-100">{task.title}</span>
      <button
        type="button"
        onClick={() => onMoveUp(task.id)}
        disabled={isFirst}
        aria-label={labels.moveUp(task.title)}
        className={controlButton}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        onClick={() => onMoveDown(task.id)}
        disabled={isLast}
        aria-label={labels.moveDown(task.title)}
        className={controlButton}
      >
        <span aria-hidden="true">↓</span>
      </button>
      <button
        type="button"
        data-action="complete"
        onClick={(event) => {
          focusNeighborControl(event.currentTarget, focusFallback)
          onComplete(task.id)
        }}
        aria-label={labels.complete(task.title)}
        className={`${controlButton} text-green-700 dark:text-green-400`}
      >
        <span aria-hidden="true">✓</span>
      </button>
      <button
        type="button"
        data-action="remove"
        onClick={(event) => {
          focusNeighborControl(event.currentTarget, focusFallback)
          onDelete(task.id)
        }}
        aria-label={labels.remove(task.title)}
        className={`${controlButton} text-red-600 dark:text-red-400`}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </li>
  )
}
