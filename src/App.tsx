import { useId, useRef } from 'react'
import { useTasks } from './hooks/useTasks'
import { labels } from './lib/labels'
import { DoneSection } from './components/DoneSection'
import { EmptyState } from './components/EmptyState'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = () => inputRef.current?.focus()

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
          <h2 id={todoHeadingId} className="text-lg font-semibold">
            {labels.todoHeading}
          </h2>
          {newerVersion ? (
            <p
              role="status"
              className="mt-3 rounded-xl border-2 border-ink bg-surface px-4 py-3 text-ink"
            >
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
