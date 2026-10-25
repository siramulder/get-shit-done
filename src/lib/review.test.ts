import { answer, currentPair, isFinished, questionNumber, restart, startReview, totalQuestions, type Answer, type ReviewState } from './review'

const pairOf = (s: ReviewState) => {
  const p = currentPair(s)
  return p && [p.upperId, p.lowerId]
}

// Answers the whole round with `pick` and returns the final state plus every swap the caller would apply.
function runRound(start: ReviewState, pick: (upper: string, lower: string) => Answer) {
  let state = start
  const swaps: string[] = []
  while (!isFinished(state)) {
    const pair = currentPair(state)!
    const result = answer(state, pick(pair.upperId, pair.lowerId))
    if (result.swap) swaps.push(result.swap)
    state = result.state
  }
  return { state, swaps }
}

// mulberry32: a tiny seeded PRNG so the property test is reproducible without a dependency.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('review', () => {
  it('S1-01 four tasks start at index 2 with 3 questions, question 1, pair (T[2], T[3])', () => {
    const s = startReview(['A', 'B', 'C', 'D'])!
    expect(s.index).toBe(2)
    expect(totalQuestions(s)).toBe(3)
    expect(questionNumber(s)).toBe(1)
    expect(pairOf(s)).toEqual(['C', 'D'])
  })

  it('S1-02 answering "lower" every time gives D, A, B, C with counters 1, 2, 3', () => {
    let s = startReview(['A', 'B', 'C', 'D'])!
    const counters: number[] = []
    const swaps: Array<string | null> = []
    while (!isFinished(s)) {
      counters.push(questionNumber(s))
      const r = answer(s, 'lower')
      swaps.push(r.swap)
      s = r.state
    }
    expect(counters).toEqual([1, 2, 3])
    expect(swaps).toEqual(['D', 'D', 'D'])
    expect(s.order).toEqual(['D', 'A', 'B', 'C'])
  })

  it.each<Answer>(['upper', 'skip'])('S1-03 "%s" keeps the order and moves the pair up by one', (a) => {
    const s = startReview(['A', 'B', 'C', 'D'])!
    const r = answer(s, a)
    expect(r.swap).toBeNull()
    expect(r.state.order).toEqual(['A', 'B', 'C', 'D'])
    expect(pairOf(r.state)).toEqual(['B', 'C'])
    expect(questionNumber(r.state)).toBe(2)
  })

  it('S1-04 two tasks ask exactly one question and then finish', () => {
    const s = startReview(['A', 'B'])!
    expect(totalQuestions(s)).toBe(1)
    expect(pairOf(s)).toEqual(['A', 'B'])
    const r = answer(s, 'lower')
    expect(r.swap).toBe('B')
    expect(isFinished(r.state)).toBe(true)
    expect(currentPair(r.state)).toBeNull()
    expect(r.state.order).toEqual(['B', 'A'])
  })

  it.each([[[]], [['A']]])('S1-05 fewer than two tasks (%j) cannot start', (ids) => {
    expect(startReview(ids)).toBeNull()
  })

  it('S1-06 "again" restarts at index n-2 from the current order', () => {
    const { state } = runRound(startReview(['A', 'B', 'C', 'D'])!, () => 'lower')
    const again = restart(state)
    expect(again.order).toEqual(['D', 'A', 'B', 'C'])
    expect(again.index).toBe(2)
    expect(questionNumber(again)).toBe(1)
    expect(pairOf(again)).toEqual(['B', 'C'])
  })

  it.each<Answer>(['upper', 'lower', 'skip'])('S1-07 answering "%s" after the round finished changes nothing', (a) => {
    const { state } = runRound(startReview(['A', 'B', 'C'])!, () => 'upper')
    const r = answer(state, a)
    expect(r.swap).toBeNull()
    expect(r.state).toEqual(state)
  })

  it('S1-08 property: 200 random rounds keep the id set; without skips each pair winner ends on top of its pair and the best task ends first', () => {
    const random = rng(20261025)
    for (let round = 0; round < 200; round++) {
      const n = 2 + Math.floor(random() * 11) // 2..12
      const ids = Array.from({ length: n }, (_, i) => `t${i}`)

      // Random answers including skips: the id set never changes and swaps match the order.
      const choices: Answer[] = ['upper', 'lower', 'skip']
      const mixed = runRound(startReview(ids)!, () => choices[Math.floor(random() * 3)])
      expect([...mixed.state.order].sort()).toEqual([...ids].sort())

      // No skips, answers follow a hidden priority: after each answer the winner sits in the upper slot.
      const priority = new Map(ids.map((id) => [id, random()]))
      let s = startReview(ids)!
      while (!isFinished(s)) {
        const { upperId, lowerId } = currentPair(s)!
        const winner = priority.get(lowerId)! > priority.get(upperId)! ? lowerId : upperId
        const slot = s.index
        s = answer(s, winner === lowerId ? 'lower' : 'upper').state
        expect(s.order[slot]).toBe(winner)
      }
      const best = [...ids].sort((x, y) => priority.get(y)! - priority.get(x)!)[0]
      expect(s.order[0]).toBe(best)
      expect([...s.order].sort()).toEqual([...ids].sort())
    }
  })
})
