import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { labels } from '../lib/labels'
import { currentPair, questionNumber, totalQuestions, type Answer, type ReviewState } from '../lib/review'
import type { Task } from '../types/task'

type Props = {
  tasks: Task[]
  state: ReviewState
  onAnswer: (answer: Answer) => void
  onRestart: () => void
  onClose: () => void
}

// One class for both cards, so colour can never favour an answer.
const cardClass =
  'flex min-h-28 flex-1 cursor-pointer flex-col items-start justify-center gap-1 rounded-[20px] border-[2.5px] border-ink bg-neon px-5 py-4 text-left text-on-neon focus-visible:outline-4 focus-visible:outline-offset-[3px] focus-visible:outline-ink'
const pillButton = 'h-11 cursor-pointer rounded-full px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function ReviewMode({ tasks, state, onAnswer, onRestart, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const upperRef = useRef<HTMLButtonElement>(null)
  const againRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const pair = currentPair(state)
  const finished = pair === null
  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? ''
  const topTitle = tasks[0]?.title ?? ''

  // Cards keep their element between pairs, so focus stays on the card that was pressed.
  // Only entering a round (open, "again") or the summary moves focus.
  useEffect(() => {
    if (finished) againRef.current?.focus()
    else upperRef.current?.focus()
  }, [finished])

  // Escape and the focus trap live on the outermost element of the mode (header + dialog),
  // so they still work after a click on empty space, and nothing is left on `document`
  // to steal Escape from keyboard dragging on the main page.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !rootRef.current) return
    const focusable = [...rootRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === rootRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const announcement = pair
    ? labels.review.announcePair(
        titleOf(pair.upperId),
        titleOf(pair.lowerId),
        questionNumber(state),
        totalQuestions(state),
      )
    : labels.review.announceDone(topTitle)

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex min-h-screen flex-col bg-paper text-ink outline-none"
    >
      <header className="border-b-2 border-header-line bg-header">
        <div className="mx-auto w-full max-w-xl px-4 py-5">
          <h1 className="text-[30px] font-bold leading-tight text-neon">{labels.appTitle}</h1>
        </div>
      </header>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="mx-auto flex max-h-[44rem] min-h-[min(calc(100dvh-10rem),44rem)] w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6"
      >
        {pair ? (
          <>
            <h2 id={headingId} className="text-left text-[26px] font-bold leading-snug">
              {labels.review.question}
            </h2>
            <div className="flex flex-1 flex-col gap-3">
              {(['upper', 'lower'] as const).map((position) => (
                <button
                  key={position}
                  ref={position === 'upper' ? upperRef : undefined}
                  type="button"
                  data-position={position}
                  onClick={() => onAnswer(position)}
                  className={cardClass}
                >
                  <span aria-hidden="true" className="text-sm font-semibold">
                    {labels.review[position]}
                  </span>
                  <span className="w-full break-words text-[30px] font-bold leading-tight">
                    {titleOf(position === 'upper' ? pair.upperId : pair.lowerId)}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAnswer('skip')}
                  className={`${pillButton} border-2 border-ink bg-header text-neon`}
                >
                  {labels.review.skip}
                </button>
                <button type="button" onClick={onClose} className={`${pillButton} text-ink underline`}>
                  {labels.review.close}
                </button>
              </div>
              <p className="font-semibold text-muted">
                {labels.review.counter(questionNumber(state), totalQuestions(state))}
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 id={headingId} className="text-left text-[26px] font-bold leading-snug">
              {labels.review.doneTitle}
            </h2>
            <p className="break-words text-lg font-semibold">{labels.review.topTask(topTitle)}</p>
            <div className="flex items-center gap-2">
              <button
                ref={againRef}
                type="button"
                onClick={onRestart}
                className={`${pillButton} border-2 border-ink bg-neon text-on-neon`}
              >
                {labels.review.again}
              </button>
              <button type="button" onClick={onClose} className={`${pillButton} text-ink underline`}>
                {labels.review.close}
              </button>
            </div>
          </>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </section>
    </div>
  )
}
