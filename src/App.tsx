import { useEffect, useId, useRef, useState } from 'react'
import { useTasks } from './hooks/useTasks'
import { labels } from './lib/labels'
import { answer, restart, startReview, type Answer, type ReviewState } from './lib/review'
import { DoneSection } from './components/DoneSection'
import { EmptyState } from './components/EmptyState'
import { ReviewMode } from './components/ReviewMode'
import { TaskInput } from './components/TaskInput'
import { TaskList } from './components/TaskList'
import { UndoControls } from './components/UndoControls'

// One answer of the review mode: the state to return to, whether the list was swapped, and its label.
type ReviewStep = { prevState: ReviewState; swapped: boolean; label: string }

function isTextField(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return true
  return element.isContentEditable || element.getAttribute('contenteditable') === 'true'
}

function App() {
  const {
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
    canUndo,
    canRedo,
    lastUndoLabel,
    lastRedoLabel,
  } = useTasks()
  const todoHeadingId = useId()
  const needTwoId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = () => inputRef.current?.focus()
  const titleOf = (id: string) => todoTasks.find((t) => t.id === id)?.title ?? ''

  // Announced after undo / redo on the main page (the review mode announces through its own region).
  const [notice, setNotice] = useState('')

  function undoMain() {
    if (!canUndo || lastUndoLabel === null) return false
    undo()
    setNotice(labels.undo.undone(lastUndoLabel))
    return true
  }

  function redoMain() {
    if (!canRedo || lastRedoLabel === null) return false
    redo()
    setNotice(labels.undo.redone(lastRedoLabel))
    return true
  }

  // Review mode lives in memory only: a reload always opens the normal list (AC-F1.3).
  const [review, setReview] = useState<ReviewState | null>(null)
  const [reviewHistory, setReviewHistory] = useState<ReviewStep[]>([])
  const [reviewUndoCount, setReviewUndoCount] = useState(0)
  const [reviewUndoneLabel, setReviewUndoneLabel] = useState<string | null>(null)
  const reviewButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  function openReview() {
    setReview(startReview(todoTasks.map((t) => t.id)))
    setReviewHistory([])
    setReviewUndoneLabel(null)
  }

  function answerReview(choice: Answer) {
    if (review === null) return
    const result = answer(review, choice)
    const upperId = review.order[review.index]
    const lowerId = review.order[review.index + 1]
    const label =
      result.swap !== null
        ? labels.history.swap(titleOf(lowerId))
        : choice === 'skip'
          ? labels.review.answerSkip(titleOf(upperId), titleOf(lowerId))
          : labels.review.answerUpper(titleOf(upperId))
    if (result.swap !== null) moveTask(result.swap, 'up', 'swap')
    setReviewHistory((h) => [...h, { prevState: review, swapped: result.swap !== null, label }])
    setReviewUndoneLabel(null)
    setReview(result.state)
  }

  // Undo of the last answer: revert the swap without leaving a redo behind, go back to that pair.
  function undoReview() {
    const step = reviewHistory[reviewHistory.length - 1]
    if (step === undefined) return false
    if (step.swapped) undo({ redoable: false })
    setReviewHistory((h) => h.slice(0, -1))
    setReview(step.prevState)
    setReviewUndoneLabel(step.label)
    setReviewUndoCount((c) => c + 1)
    return true
  }

  function restartReview(current: ReviewState) {
    setReview(restart(current))
    setReviewHistory([])
    setReviewUndoneLabel(null)
  }

  function closeReview() {
    returnFocus.current = true
    setReview(null)
    setReviewHistory([])
    setReviewUndoneLabel(null)
  }

  // The review button only exists again after the main page re-renders, so focus it from an effect.
  useEffect(() => {
    if (review === null && returnFocus.current) {
      returnFocus.current = false
      reviewButtonRef.current?.focus()
    }
  }, [review])

  // A round needs at least two todo tasks; if that stops being true, the mode is closed.
  const activeReview = review !== null && todoTasks.length >= 2 ? review : null
  const inReview = activeReview !== null

  // ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y. The one window listener in the app; it handles nothing else.
  // Matched on e.code so a Thai keyboard layout works; skipped inside text fields (native undo),
  // while a task is lifted with the keyboard (aria-pressed on the activator), on key repeat, and for
  // newer-version data. preventDefault only when an undo / redo actually happened.
  const handleShortcut = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined)
  useEffect(() => {
    handleShortcut.current = (event) => {
      if (event.repeat || newerVersion) return
      if (!(event.metaKey || event.ctrlKey)) return
      const isUndo = event.code === 'KeyZ' && !event.shiftKey
      const isRedo = (event.code === 'KeyZ' && event.shiftKey) || (event.ctrlKey && event.code === 'KeyY')
      if (!isUndo && !isRedo) return
      const active = document.activeElement
      if (isTextField(active) || active?.getAttribute('aria-pressed') === 'true') return
      const handled = inReview ? (isUndo ? undoReview() : false) : isUndo ? undoMain() : redoMain()
      if (handled) event.preventDefault()
    }
  })
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => handleShortcut.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  if (activeReview !== null) {
    const lastStep = reviewHistory[reviewHistory.length - 1]
    return (
      <ReviewMode
        tasks={todoTasks}
        state={activeReview}
        onAnswer={answerReview}
        onRestart={() => restartReview(activeReview)}
        onClose={closeReview}
        onUndo={undoReview}
        canUndo={lastStep !== undefined}
        undoLabel={lastStep?.label ?? null}
        undoCount={reviewUndoCount}
        undoneLabel={reviewUndoneLabel}
      />
    )
  }

  const canReview = todoTasks.length >= 2

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-header-line bg-header">
        <div className="mx-auto w-full max-w-xl px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[30px] font-bold leading-tight text-neon">{labels.appTitle}</h1>
            {!newerVersion && (
              <UndoControls
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undoMain}
                onRedo={redoMain}
                undoLabel={lastUndoLabel}
                redoLabel={lastRedoLabel}
              />
            )}
          </div>
          <div className="mt-4">
            <TaskInput onAdd={addTask} inputRef={inputRef} disabled={newerVersion} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-8">
        <section aria-labelledby={todoHeadingId}>
          <div className="flex items-center justify-between gap-3">
            <h2 id={todoHeadingId} className="text-lg font-semibold">
              {labels.todoHeading}
            </h2>
            {!newerVersion && (
              <>
                <button
                  ref={reviewButtonRef}
                  type="button"
                  onClick={openReview}
                  disabled={!canReview}
                  aria-describedby={canReview ? undefined : needTwoId}
                  className="h-10 shrink-0 cursor-pointer rounded-full border-2 border-ink bg-neon px-4 font-semibold text-on-neon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {labels.review.button}
                </button>
                <span id={needTwoId} className="sr-only">
                  {labels.review.needTwo}
                </span>
              </>
            )}
          </div>
          {newerVersion ? (
            <p role="status" className="mt-3 rounded-xl border-2 border-ink bg-surface px-4 py-3 text-ink">
              {labels.newerVersion}
            </p>
          ) : todoTasks.length === 0 ? (
            <EmptyState variant={doneTodayTasks.length > 0 ? 'allDone' : 'noTasks'} />
          ) : (
            <TaskList
              tasks={todoTasks}
              labelledBy={todoHeadingId}
              onMoveUp={(id) => moveTask(id, 'up')}
              onMoveDown={(id) => moveTask(id, 'down')}
              onComplete={completeTask}
              onDelete={deleteTask}
              onReorder={reorderTasks}
              focusFallback={focusInput}
            />
          )}
        </section>

        <DoneSection
          tasks={doneTodayTasks}
          onUncomplete={uncompleteTask}
          onDelete={deleteTask}
          focusFallback={focusInput}
        />
        <p aria-live="polite" className="sr-only">
          {notice}
        </p>
      </main>
    </div>
  )
}

export default App
