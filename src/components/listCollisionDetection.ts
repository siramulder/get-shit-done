import { closestCenter, type CollisionDetection } from '@dnd-kit/core'

// closestCenter alone always picks the nearest card, so a drop far outside the list would still reorder.
// With a pointer outside the cards' bounding box there is no target, and handleDragEnd ignores the drop.
// Keyboard drags have no pointer and keep plain closestCenter.
export const listCollisionDetection: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableRects } = args
  if (pointerCoordinates) {
    const rects = [...droppableRects.values()]
    if (rects.length === 0) return []
    const { x, y } = pointerCoordinates
    const inside =
      x >= Math.min(...rects.map((r) => r.left)) &&
      x <= Math.max(...rects.map((r) => r.right)) &&
      y >= Math.min(...rects.map((r) => r.top)) &&
      y <= Math.max(...rects.map((r) => r.bottom))
    if (!inside) return []
  }
  return closestCenter(args)
}
