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
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg text-ink hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent'
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
      className={`flex cursor-grab items-center gap-1 rounded-xl border-2 border-line bg-surface p-1 active:cursor-grabbing ${
        isDragging ? 'relative z-10 outline-2 outline-ink' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        aria-label={labels.dragHandle(task.title)}
        className={`${iconButton} cursor-grab touch-none text-muted active:cursor-grabbing`}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <span className="min-w-0 flex-1 break-words px-1 text-[17px] font-semibold text-ink">{task.title}</span>
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
        className={controlButton}
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
        className={controlButton}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </li>
  )
}
