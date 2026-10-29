import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { labels } from '../lib/labels'
import { ANSWER_HOLD_MS, currentPair, questionNumber, totalQuestions, type Answer, type ReviewState } from '../lib/review'
import type { Task } from '../types/task'
import { UndoControls } from './UndoControls'

type Props = {
  tasks: Task[]
  state: ReviewState
  onAnswer: (answer: Answer) => void
  onRestart: () => void
  onClose: () => void
  /** Undo of the last *answer* (owned by App); redo is never available inside the mode. */
  onUndo: () => void
  canUndo: boolean
  undoLabel: string | null
  /** Increments on every answer-undo: ends a running hold and moves focus to the upper card. */
  undoCount: number
  /** Label of the answer just undone (announced with the restored pair), null after a new answer. */
  undoneLabel: string | null
}

// One class for both cards, so colour can never favour an answer.
const cardClass =
  'relative flex min-h-28 flex-1 flex-col items-start justify-center gap-1 rounded-[20px] border-[2.5px] border-ink bg-neon px-5 py-4 text-left text-on-neon focus-visible:outline-4 focus-visible:outline-offset-[3px] focus-visible:outline-ink'
const pillButton = 'h-11 rounded-full px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// While an answer is held the pair stays on screen, the chosen card is marked and the other one dims.
type Held = { state: ReviewState; choice: Answer; undoCount: number }

export function ReviewMode({
  tasks,
  state,
  onAnswer,
  onRestart,
  onClose,
  onUndo,
  canUndo,
  undoLabel,
  undoCount,
  undoneLabel,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const upperRef = useRef<HTMLButtonElement>(null)
  const againRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  // After an answer the answered pair is held for ANSWER_HOLD_MS so a repeated tap or a held key
  // cannot answer the next pair by accident. The swap itself is applied by the parent at once.
  const [heldRaw, setHeld] = useState<Held | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // An answer-undo (App) ends the hold at once: a hold started under an older undoCount no longer counts.
  const held = heldRaw !== null && heldRaw.undoCount === undoCount ? heldRaw : null
  const shown = held?.state ?? state
  const pair = currentPair(shown)
  const finished = currentPair(state) === null
  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title ?? ''
  const topTitle = tasks[0]?.title ?? ''

  // Cards keep their element between pairs, so focus stays on the card that was pressed.
  // Only entering a round (open, "again") moves focus to the upper card …
  useEffect(() => {
    if (!finished) upperRef.current?.focus()
  }, [finished])
  // … and the summary moves it to "again", once the hold on the last answer is over.
  useEffect(() => {
    if (finished && held === null) againRef.current?.focus()
  }, [finished, held])

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  // An answer-undo (button or ⌘Z, handled by App) ends any running hold at once and puts focus on the
  // restored pair's upper card.
  useEffect(() => {
    if (undoCount === 0) return
    clearTimeout(holdTimer.current)
    upperRef.current?.focus()
  }, [undoCount])

  function choose(choice: Answer) {
    if (held !== null) return
    setHeld({ state, choice, undoCount })
    onAnswer(choice)
    holdTimer.current = setTimeout(() => setHeld(null), ANSWER_HOLD_MS)
  }

  // Closing always works, even mid-hold.
  function close() {
    clearTimeout(holdTimer.current)
    onClose()
  }

  // Escape and the focus trap live on the outermost element of the mode (header + dialog),
  // so they still work after a click on empty space, and nothing is left on `document`
  // to steal Escape from keyboard dragging on the main page.
  // Tab order is fixed, not DOM order: cards → skip → close, then the header's undo (when enabled),
  // so the cards stay first even though the header comes first in the DOM.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab' || !rootRef.current) return
    const root = rootRef.current
    const order = [
      ...root.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)'),
      ...root.querySelectorAll<HTMLButtonElement>('header button:not(:disabled)'),
    ]
    if (order.length === 0) return
    event.preventDefault()
    const index = order.indexOf(document.activeElement as HTMLButtonElement)
    const last = order.length - 1
    const next =
      index === -1
        ? order[event.shiftKey ? last : 0]
        : order[event.shiftKey ? (index === 0 ? last : index - 1) : index === last ? 0 : index + 1]
    next.focus()
  }

  const announcement = pair
    ? undoneLabel !== null
      ? labels.review.announceUndo(
          undoneLabel,
          titleOf(pair.upperId),
          titleOf(pair.lowerId),
          questionNumber(shown),
          totalQuestions(shown),
        )
      : labels.review.announcePair(
          titleOf(pair.upperId),
          titleOf(pair.lowerId),
          questionNumber(shown),
          totalQuestions(shown),
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
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-5">
          <h1 className="text-[30px] font-bold leading-tight text-neon">{labels.appTitle}</h1>
          <UndoControls
            canUndo={canUndo}
            canRedo={false}
            onUndo={onUndo}
            onRedo={() => undefined}
            undoLabel={undoLabel}
            redoLabel={null}
          />
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
              {(['upper', 'lower'] as const).map((position) => {
                const chosen = held?.choice === position
                const dimmed = held !== null && !chosen
                return (
                <button
                  key={position}
                  ref={position === 'upper' ? upperRef : undefined}
                  type="button"
                  data-position={position}
                  data-chosen={chosen ? 'true' : undefined}
                  aria-disabled={held !== null ? 'true' : undefined}
                  onClick={() => choose(position)}
                  className={`${cardClass} ${held === null ? 'cursor-pointer' : 'cursor-default'} ${dimmed ? 'opacity-50' : ''}`}
                >
                  {chosen && (
                    <span aria-hidden="true" className="absolute top-3 right-4 text-2xl font-bold">
                      ✓
                    </span>
                  )}
                  <span aria-hidden="true" className="text-sm font-semibold">
                    {labels.review[position]}
                  </span>
                  <span className="w-full break-words text-[30px] font-bold leading-tight">
                    {titleOf(position === 'upper' ? pair.upperId : pair.lowerId)}
                  </span>
                </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-disabled={held !== null ? 'true' : undefined}
                  onClick={() => choose('skip')}
                  className={`${pillButton} border-2 border-ink bg-header text-neon ${held === null ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {labels.review.skip}
                </button>
                <button type="button" onClick={close} className={`${pillButton} cursor-pointer text-ink underline`}>
                  {labels.review.close}
                </button>
              </div>
              <p className="font-semibold text-muted">
                {labels.review.counter(questionNumber(shown), totalQuestions(shown))}
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
                className={`${pillButton} cursor-pointer border-2 border-ink bg-neon text-on-neon`}
              >
                {labels.review.again}
              </button>
              <button type="button" onClick={close} className={`${pillButton} cursor-pointer text-ink underline`}>
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
