import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DueBadgeLabel } from './DueBadgeLabel'
import { focusNeighborControl } from './focusNeighbor'
import { labels } from '../lib/labels'
import type { DueBadge, Task } from '../types/task'

type Props = {
  task: Task
  /** What the due date reads as today (computed by App); null when the task has none. */
  dueBadge: DueBadge | null
  isFirst: boolean
  isLast: boolean
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  /** `null` removes the due date. */
  onSetDueDate: (id: string, dueDate: string | null) => void
  focusFallback: () => void
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const iconButton = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg text-ink hover:bg-ink/10 ${focusRing} disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent`
const controlButton = `${iconButton} cursor-pointer`
// Text buttons of the due date: small type, but still a 40px-high target.
const textButton = `inline-flex min-h-10 cursor-pointer items-center rounded-md text-sm font-semibold hover:bg-ink/10 ${focusRing}`

// What the browser reports while a date is still being typed, which is not a date the user chose:
// '' while a part (day / month / year) is empty, and a year below 1000 while the year is typed digit by digit
// (20/11/2026 arrives as 0002-11-20, 0020-…, 0202-…, then 2026-11-20).
function isStillBeingTyped(value: string): boolean {
  return value === '' || Number(value.split('-')[0]) < 1000
}

export function TaskItem({
  task,
  dueBadge,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onComplete,
  onDelete,
  onSetDueDate,
  focusFallback,
}: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, attributes: { roleDescription: labels.dnd.roleDescription } })

  const [editingDue, setEditingDue] = useState(false)
  const dueButtonRef = useRef<HTMLButtonElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  // Opening the editor puts focus in the date field.
  useEffect(() => {
    if (editingDue) dateRef.current?.focus()
  }, [editingDue])

  // The date field is uncontrolled: while one part of a date (day / month / year) is being retyped the browser
  // reports an empty value, and a controlled field would be reset to the old date at that moment, wiping what was
  // typed. React therefore never writes to it during typing; the only write is here, when the due date changes
  // from somewhere else while the editor is open (undo / redo in the header) — a value the user has just typed
  // already matches and is left alone.
  useEffect(() => {
    const input = dateRef.current
    const current = task.dueDate ?? ''
    if (input && (current === '' || input.value !== current)) input.value = current
  }, [task.dueDate])

  function closeDueEditor() {
    setEditingDue(false)
    dueButtonRef.current?.focus()
  }

  // Escape is handled on the editor itself, never on window / document (it must stay free for keyboard dragging).
  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') closeDueEditor()
  }

  return (
    // Pointer drags start anywhere on the card (CardPointerSensor skips its buttons and the due-date editor); the
    // activator ref and attributes stay on the handle so keyboard dragging and screen-reader semantics live there.
    <li
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex cursor-grab flex-wrap items-center gap-1 rounded-xl border-2 border-line bg-surface p-1 active:cursor-grabbing ${
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
      <div className="flex min-w-0 flex-1 flex-col items-start px-1">
        <span className="min-w-0 max-w-full break-words text-[17px] font-semibold text-ink">{task.title}</span>
        <button
          ref={dueButtonRef}
          type="button"
          aria-expanded={editingDue}
          aria-label={
            dueBadge ? labels.due.buttonWithBadge(task.title, dueBadge.text) : labels.due.button(task.title)
          }
          onClick={() => setEditingDue((open) => !open)}
          className={`${textButton} -ml-1 max-w-full gap-1 px-1 text-left ${dueBadge ? '' : 'text-muted'}`}
        >
          {dueBadge ? (
            <DueBadgeLabel badge={dueBadge} tone="list" />
          ) : (
            <>
              <span aria-hidden="true">+</span>
              {labels.due.add}
            </>
          )}
        </button>
      </div>
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
      {editingDue && (
        // A full-width line under the row. `data-no-drag`: no pointer drag starts anywhere in here, empty space included.
        <div
          data-no-drag=""
          onKeyDown={handleEditorKeyDown}
          className="flex basis-full cursor-auto flex-wrap items-center gap-2 pb-1 pl-12 pr-1"
        >
          <input
            ref={dateRef}
            type="date"
            aria-label={labels.due.dateInput(task.title)}
            defaultValue={task.dueDate ?? ''}
            onChange={(event) => {
              // A half-typed date changes nothing. Removing the due date is the button's job only.
              if (!isStillBeingTyped(event.target.value)) onSetDueDate(task.id, event.target.value)
            }}
            className={`h-10 rounded-md border-2 border-line bg-surface px-2 text-ink ${focusRing}`}
          />
          {task.dueDate !== undefined && (
            <button
              type="button"
              onClick={() => {
                onSetDueDate(task.id, null)
                closeDueEditor()
              }}
              className={`${textButton} px-2 text-ink underline`}
            >
              {labels.due.clear}
            </button>
          )}
          <button type="button" onClick={closeDueEditor} className={`${textButton} border-2 border-ink px-3 text-ink`}>
            {labels.due.done}
          </button>
        </div>
      )}
    </li>
  )
}
