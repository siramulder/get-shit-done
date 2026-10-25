import { useEffect, useId, useRef, useState } from 'react'
import { useTasks } from './hooks/useTasks'
import { labels } from './lib/labels'
import { answer, restart, startReview, type Answer, type ReviewState } from './lib/review'
import { DoneSection } from './components/DoneSection'
import { EmptyState } from './components/EmptyState'
import { ReviewMode } from './components/ReviewMode'
import { TaskInput } from './components/TaskInput'
import { TaskList } from './components/TaskList'

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
  } = useTasks()
  const todoHeadingId = useId()
  const needTwoId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = () => inputRef.current?.focus()

  // Review mode lives in memory only: a reload always opens the normal list (AC-F1.3).
  const [review, setReview] = useState<ReviewState | null>(null)
  const reviewButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  function openReview() {
    setReview(startReview(todoTasks.map((t) => t.id)))
  }

  function answerReview(choice: Answer) {
    if (review === null) return
    const result = answer(review, choice)
    if (result.swap !== null) moveTask(result.swap, 'up')
    setReview(result.state)
  }

  function closeReview() {
    returnFocus.current = true
    setReview(null)
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

  if (activeReview !== null) {
    return (
      <ReviewMode
        tasks={todoTasks}
        state={activeReview}
        onAnswer={answerReview}
        onRestart={() => setReview(restart(activeReview))}
        onClose={closeReview}
      />
    )
  }

  const canReview = todoTasks.length >= 2

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-header-line bg-header">
        <div className="mx-auto w-full max-w-xl px-4 py-5">
          <h1 className="text-[30px] font-bold leading-tight text-neon">{labels.appTitle}</h1>
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
      </main>
    </div>
  )
}

export default App
