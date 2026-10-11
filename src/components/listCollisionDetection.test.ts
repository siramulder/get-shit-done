import type { ClientRect, CollisionDetection } from '@dnd-kit/core'
import { listCollisionDetection } from './listCollisionDetection'

const rect = (top: number, left = 0, width = 300, height = 40): ClientRect => ({
  top,
  left,
  width,
  height,
  right: left + width,
  bottom: top + height,
})

// Three stacked cards with 8px gaps: the list spans x 0..300 and y 0..136.
const cards: Record<string, ClientRect> = { a: rect(0), b: rect(48), c: rect(96) }

function args(pointer: { x: number; y: number } | null, draggedTop: number) {
  return {
    active: { id: 'a' },
    collisionRect: rect(draggedTop),
    droppableRects: new Map(Object.entries(cards)),
    droppableContainers: Object.keys(cards).map((id) => ({ id })),
    pointerCoordinates: pointer,
  } as unknown as Parameters<CollisionDetection>[0]
}

const target = (pointer: { x: number; y: number } | null, draggedTop: number) =>
  listCollisionDetection(args(pointer, draggedTop))[0]?.id ?? null

describe('listCollisionDetection', () => {
  it('P3-05 inside the list it targets the nearest card, like closestCenter', () => {
    expect(target({ x: 150, y: 110 }, 92)).toBe('c')
    expect(target({ x: 150, y: 10 }, 4)).toBe('a')
  })

  it('P3-05 in the gap between two cards it still targets a card', () => {
    expect(target({ x: 150, y: 44 }, 30)).not.toBeNull()
  })

  it.each([
    ['below', { x: 150, y: 400 }],
    ['above', { x: 150, y: -60 }],
    ['to the right of', { x: 640, y: 110 }],
    ['to the left of', { x: -20, y: 110 }],
  ])('P3-05 with the pointer %s the list there is no drop target', (_where, pointer) => {
    expect(listCollisionDetection(args(pointer, 92))).toEqual([])
  })

  it('P3-05 keyboard drags (no pointer) still use closestCenter', () => {
    expect(target(null, 92)).toBe('c')
  })
})
