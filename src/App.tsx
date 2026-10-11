import { useId, useRef } from 'react'
import { useTasks } from './hooks/useTasks'
import { labels } from './lib/labels'
import { DoneSection } from './components/DoneSection'
import { EmptyState } from './components/EmptyState'
import { TaskInput } from './components/TaskInput'
import { TaskList } from './components/TaskList'

function App() {
  const { todoTasks, doneTodayTasks, addTask, completeTask, uncompleteTask, deleteTask, moveTask, reorderTasks } =
    useTasks()
  const todoHeadingId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = () => inputRef.current?.focus()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <main className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        <h1 className="text-2xl font-semibold">{labels.appTitle}</h1>

        <div className="mt-4">
          <TaskInput onAdd={addTask} inputRef={inputRef} />
        </div>

        <section aria-labelledby={todoHeadingId} className="mt-6">
          <h2 id={todoHeadingId} className="text-lg font-semibold">
            {labels.todoHeading}
          </h2>
          {todoTasks.length === 0 ? (
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
