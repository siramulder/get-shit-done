import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewMode } from './ReviewMode'
import { labels } from '../lib/labels'
import { ANSWER_HOLD_MS, answer, startReview } from '../lib/review'
import type { DueBadge, Task } from '../types/task'

const task = (id: string, order: number): Task => ({
  id,
  title: `งาน ${id}`,
  order,
  status: 'todo',
  createdAt: '2026-10-05T01:00:00.000Z',
})
const tasks = [task('A', 0), task('B', 1), task('C', 2), task('D', 3)]

type UndoProps = { canUndo: boolean; undoLabel: string | null; undoCount: number; undoneLabel: string | null }
const noUndo: UndoProps = { canUndo: false, undoLabel: null, undoCount: 0, undoneLabel: null }

type Badges = ReadonlyMap<string, DueBadge>
const noBadges: Badges = new Map()

function renderMode(state = startReview(tasks.map((t) => t.id))!, undo: UndoProps = noUndo, dueBadges: Badges = noBadges) {
  const handlers = { onAnswer: vi.fn(), onRestart: vi.fn(), onClose: vi.fn(), onUndo: vi.fn() }
  const view = render(<ReviewMode tasks={tasks} dueBadges={dueBadges} state={state} {...handlers} {...undo} />)
  const rerenderWith = (next = state, nextUndo = undo) =>
    view.rerender(<ReviewMode tasks={tasks} dueBadges={dueBadges} state={next} {...handlers} {...nextUndo} />)
  return { ...handlers, rerenderWith, unmount: view.unmount }
}

// Answers are held for ANSWER_HOLD_MS, so every test runs on fake timers and advances past the hold explicitly.
const settle = () => act(() => vi.advanceTimersByTime(ANSWER_HOLD_MS))
const setupUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
const skipButton = () => screen.getByRole('button', { name: labels.review.skip })

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }))
afterEach(() => vi.useRealTimers())

const card = (position: 'upper' | 'lower') =>
  within(screen.getByRole('dialog')).getAllByRole('button').find((b) => b.dataset.position === position)!

describe('ReviewMode', () => {
  it('S1-10 both cards carry exactly the same classes before an answer and again once the hold is over', async () => {
    const user = setupUser()
    const { rerenderWith } = renderMode()
    expect(card('upper').className).toBe(card('lower').className)
    expect(card('upper')).toHaveClass('bg-neon', 'text-on-neon')
    await user.click(card('upper'))
    rerenderWith(answer(startReview(tasks.map((t) => t.id))!, 'upper').state)
    settle()
    expect(card('upper').className).toBe(card('lower').className)
    expect(card('upper')).toHaveClass('bg-neon', 'text-on-neon')
    expect(card('upper')).not.toHaveClass('opacity-50')
  })

  it('AC-10.1 Tab cycles upper card → lower card → skip → close and stays inside the mode', async () => {
    const user = setupUser()
    renderMode()
    expect(card('upper')).toHaveFocus()
    await user.tab()
    expect(card('lower')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: labels.review.skip })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: labels.review.close })).toHaveFocus()
    await user.tab()
    expect(card('upper')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: labels.review.close })).toHaveFocus()
  })

  it('AC-10.1 with "undo" enabled the cycle is upper → lower → skip → close → undo → upper (and back)', async () => {
    const user = setupUser()
    renderMode(undefined, { ...noUndo, canUndo: true, undoLabel: labels.history.swap('งาน D') })
    const undo = screen.getByRole('button', { name: labels.undo.undo })
    expect(card('upper')).toHaveFocus()
    await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: labels.review.close })).toHaveFocus()
    await user.tab()
    expect(undo).toHaveFocus()
    await user.tab()
    expect(card('upper')).toHaveFocus()
    await user.tab({ shift: true })
    expect(undo).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: labels.review.close })).toHaveFocus()
    expect(screen.getByRole('button', { name: labels.undo.redo })).toBeDisabled()
  })

  it('AC-10.1 card names are the task titles only when the tasks have no due date; the บน/ล่าง tags are hidden from assistive tech', () => {
    renderMode()
    expect(screen.getByRole('button', { name: 'งาน C' })).toBe(card('upper'))
    expect(screen.getByRole('button', { name: 'งาน D' })).toBe(card('lower'))
  })

  it('AC-10.3 one polite live region announces the question, both titles and the counter', () => {
    renderMode()
    const live = screen.getByRole('dialog').querySelectorAll('[aria-live]')
    expect(live).toHaveLength(1)
    expect(live[0]).toHaveAttribute('aria-live', 'polite')
    expect(live[0]).toHaveTextContent(labels.review.announcePair('งาน C', 'งาน D', 1, 3))
  })

  it.each([['{Enter}'], [' ']])('AC-10.2 %s on a card answers through onAnswer', async (key) => {
    const user = setupUser()
    const { onAnswer } = renderMode()
    card('lower').focus()
    await user.keyboard(key)
    expect(onAnswer.mock.calls).toEqual([['lower']])
  })

  it('S1-13 after an answer the pair is held: cards and skip ignore clicks and keys until the hold ends', async () => {
    const user = setupUser()
    const start = startReview(tasks.map((t) => t.id))!
    const { onAnswer, rerenderWith } = renderMode(start)
    await user.click(card('upper'))
    expect(onAnswer.mock.calls).toEqual([['upper']])

    // The parent re-renders with the next state at once, but the answered pair stays on screen.
    rerenderWith(answer(start, 'upper').state)
    expect(card('upper')).toHaveTextContent('งาน C')
    expect(card('lower')).toHaveTextContent('งาน D')
    expect(card('upper')).toHaveAttribute('aria-disabled', 'true')
    expect(card('lower')).toHaveAttribute('aria-disabled', 'true')
    expect(skipButton()).toHaveAttribute('aria-disabled', 'true')
    expect(card('upper')).toHaveAttribute('data-chosen', 'true')
    expect(card('lower')).not.toHaveAttribute('data-chosen')
    expect(card('lower')).toHaveClass('opacity-50')
    expect(screen.getByText(labels.review.counter(1, 3))).toBeInTheDocument()

    await user.click(card('upper'))
    await user.click(card('lower'))
    card('lower').focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(skipButton())
    expect(onAnswer).toHaveBeenCalledTimes(1)

    settle()
    expect(card('upper')).toHaveTextContent('งาน B')
    expect(card('lower')).toHaveTextContent('งาน C')
    expect(card('upper')).not.toHaveAttribute('aria-disabled')
    expect(skipButton()).not.toHaveAttribute('aria-disabled')
    expect(screen.getByText(labels.review.counter(2, 3))).toBeInTheDocument()
    await user.click(card('lower'))
    expect(onAnswer.mock.calls).toEqual([['upper'], ['lower']])
  })

  it('S1-13 skip is held the same way: both cards dim and a second skip is ignored', async () => {
    const user = setupUser()
    const { onAnswer } = renderMode()
    await user.click(skipButton())
    await user.click(skipButton())
    await user.click(card('upper'))
    expect(onAnswer.mock.calls).toEqual([['skip']])
    expect(card('upper')).toHaveClass('opacity-50')
    expect(card('lower')).toHaveClass('opacity-50')
    expect(card('upper')).not.toHaveAttribute('data-chosen')
  })

  it.each<[string, (user: ReturnType<typeof setupUser>) => Promise<void>]>([
    ['Escape', (user) => user.keyboard('{Escape}')],
    ['the close button', (user) => user.click(screen.getByRole('button', { name: labels.review.close }))],
  ])('S1-14 %s closes at once during the hold and leaves no timer behind', async (_how, closeIt) => {
    const user = setupUser()
    const { onAnswer, onClose, unmount } = renderMode()
    await user.click(card('lower'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    await closeIt(user)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0) // the hold timer is cancelled by close itself, not only by unmount
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('S1-14 unmounting during the hold clears the timer', async () => {
    const user = setupUser()
    const { unmount } = renderMode()
    await user.click(card('upper'))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('S1-15 focus stays on the pressed card through the hold and into the next pair', async () => {
    const user = setupUser()
    const start = startReview(tasks.map((t) => t.id))!
    const { rerenderWith } = renderMode(start)
    await user.click(card('lower'))
    expect(card('lower')).toHaveFocus()
    rerenderWith(answer(start, 'lower').state)
    expect(card('lower')).toHaveFocus()
    settle()
    expect(card('lower')).toHaveFocus()
    expect(card('lower')).toHaveTextContent('งาน D')
  })

  it('S1-15 after the last answer focus moves to "again" only once the hold is over', async () => {
    const user = setupUser()
    const start = startReview(['A', 'B'])!
    const { rerenderWith } = renderMode(start)
    await user.click(card('upper'))
    rerenderWith(answer(start, 'upper').state)
    expect(card('upper')).toHaveFocus()
    expect(screen.queryByRole('button', { name: labels.review.again })).not.toBeInTheDocument()
    settle()
    expect(screen.getByRole('button', { name: labels.review.again })).toHaveFocus()
  })

  it('AC-7.5 the summary shows the top task with "again" and "close" and no cards', async () => {
    const user = setupUser()
    let state = startReview(['A', 'B'])!
    state = answer(state, 'upper').state
    const { onRestart, onClose } = renderMode(state)
    expect(screen.getByText(labels.review.topTask('งาน A'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.review.again })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'งาน A' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: labels.review.again }))
    await user.click(screen.getByRole('button', { name: labels.review.close }))
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('due-date badges on the cards (slice 3)', () => {
  const overdue: DueBadge = { kind: 'overdue', text: labels.due.overdue(2) }
  const today: DueBadge = { kind: 'today', text: labels.due.today }
  const tomorrow: DueBadge = { kind: 'tomorrow', text: labels.due.tomorrow }
  const later: DueBadge = { kind: 'later', text: '24 ต.ค.' }
  const liveText = () => screen.getByRole('dialog').querySelector('[aria-live]')?.textContent

  it('AC-6.3 both cards show the badge under the title, and the badge is part of the card name and of the announcement', () => {
    renderMode(undefined, noUndo, new Map([['C', overdue], ['D', later]]))
    expect(within(card('upper')).getByText('งาน C')).toBeInTheDocument()
    expect(within(card('upper')).getByText(overdue.text)).toBeInTheDocument()
    expect(within(card('lower')).getByText('งาน D')).toBeInTheDocument()
    expect(within(card('lower')).getByText('24 ต.ค.')).toBeInTheDocument()
    expect(card('upper')).toHaveAccessibleName(labels.review.cardName('งาน C', overdue.text))
    expect(card('upper')).toHaveAccessibleName('งาน C, เลยกำหนด 2 วัน')
    expect(card('lower')).toHaveAccessibleName(labels.review.cardName('งาน D', '24 ต.ค.'))
    expect(liveText()).toBe(
      labels.review.announcePair(labels.review.cardName('งาน C', overdue.text), labels.review.cardName('งาน D', '24 ต.ค.'), 1, 3),
    )
  })

  it('AC-6.3 only the task that has a due date gets a badge; the other card keeps its plain title as its name', () => {
    renderMode(undefined, noUndo, new Map([['D', today]]))
    expect(card('upper')).toHaveAccessibleName('งาน C')
    expect(within(card('upper')).queryByText(today.text)).not.toBeInTheDocument()
    expect(card('lower')).toHaveAccessibleName(labels.review.cardName('งาน D', today.text))
    expect(liveText()).toBe(labels.review.announcePair('งาน C', labels.review.cardName('งาน D', today.text), 1, 3))
    // S1-10 still holds: the badge is a child, the card class is the same on both
    expect(card('upper').className).toBe(card('lower').className)
  })

  it('AC-6.3 after an answer-undo the restored pair is announced with its badges too', () => {
    renderMode(undefined, { canUndo: false, undoLabel: null, undoCount: 1, undoneLabel: labels.review.answerUpper('งาน C') }, new Map([['C', overdue]]))
    expect(liveText()).toBe(
      labels.review.announceUndo(labels.review.answerUpper('งาน C'), labels.review.cardName('งาน C', overdue.text), 'งาน D', 1, 3),
    )
  })

  it.each<[string, DueBadge]>([
    ['overdue', overdue],
    ['today', today],
    ['tomorrow', tomorrow],
    ['later', later],
  ])('S3-11 a %s badge on a neon card never uses muted text', (_kind, badge) => {
    renderMode(undefined, noUndo, new Map([['C', badge], ['D', badge]]))
    for (const position of ['upper', 'lower'] as const) {
      const shown = within(card(position)).getByText(badge.text)
      expect(card(position).querySelectorAll('.text-muted')).toHaveLength(0)
      expect(shown).not.toHaveClass('text-muted')
      expect(shown).not.toHaveClass('text-ink') // ink is near-white: unreadable on neon
      expect(shown).toHaveClass('text-on-neon')
    }
  })

  it('S3-11 on a card the overdue badge keeps its hot fill; the "วันนี้" dot is on-neon, not hot', () => {
    renderMode(undefined, noUndo, new Map([['C', overdue], ['D', today]]))
    const late = within(card('upper')).getByText(overdue.text)
    expect(late).toHaveClass('bg-hot', 'text-on-neon', 'rounded-[6px]')
    const now = within(card('lower')).getByText(today.text)
    const dot = now.querySelector('[aria-hidden="true"]')
    expect(dot).toHaveClass('bg-on-neon')
    expect(card('lower').querySelector('.bg-hot')).toBeNull()
  })
})
