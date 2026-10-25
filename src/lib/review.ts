// Pairwise ordering review (US-7): walk the todo list bottom-up, one adjacent pair at a time.
// Pure functions only — the caller applies each swap with useTasks().moveTask(swap, 'up').

export type Answer = 'upper' | 'lower' | 'skip'

/** `order` = todo ids top to bottom, kept in step with the real list; `index` = position of the upper card, -1 when finished. */
export type ReviewState = { order: string[]; index: number }

/** Starts at the bottom pair. Returns null when there are fewer than two tasks to compare. */
export function startReview(order: string[]): ReviewState | null {
  if (order.length < 2) return null
  return { order: [...order], index: order.length - 2 }
}

export function isFinished(state: ReviewState): boolean {
  return state.index < 0
}

export function currentPair(state: ReviewState): { upperId: string; lowerId: string } | null {
  if (isFinished(state)) return null
  return { upperId: state.order[state.index], lowerId: state.order[state.index + 1] }
}

export function totalQuestions(state: ReviewState): number {
  return state.order.length - 1
}

/** 1-based number of the current question. */
export function questionNumber(state: ReviewState): number {
  return state.order.length - 2 - state.index + 1
}

/** "lower" swaps the pair (the caller must move `swap` up one place); "upper" and "skip" keep it. */
export function answer(state: ReviewState, choice: Answer): { state: ReviewState; swap: string | null } {
  const pair = currentPair(state)
  if (pair === null) return { state, swap: null }
  let order = state.order
  let swap: string | null = null
  if (choice === 'lower') {
    order = [...order]
    order[state.index] = pair.lowerId
    order[state.index + 1] = pair.upperId
    swap = pair.lowerId
  }
  return { state: { order, index: state.index - 1 }, swap }
}

/** "Again": a new round from the bottom pair of the current order. */
export function restart(state: ReviewState): ReviewState {
  return { order: state.order, index: state.order.length - 2 }
}
