import type { DragEndEvent } from '@dnd-kit/core'
import { handleDragEnd } from './handleDragEnd'

function dragEnd(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId === null ? null : { id: overId },
  } as unknown as DragEndEvent
}

describe('handleDragEnd', () => {
  it('P2-35 calls reorderTasks(active.id, over.id) once when dropped on another task', () => {
    const reorderTasks = vi.fn()
    handleDragEnd(dragEnd('a', 'c'), reorderTasks)
    expect(reorderTasks).toHaveBeenCalledTimes(1)
    expect(reorderTasks).toHaveBeenCalledWith('a', 'c')
  })

  it('P2-36 does nothing when dropped outside any task (over is null)', () => {
    const reorderTasks = vi.fn()
    handleDragEnd(dragEnd('a', null), reorderTasks)
    expect(reorderTasks).not.toHaveBeenCalled()
  })

  it('P2-37 does nothing when dropped on itself', () => {
    const reorderTasks = vi.fn()
    handleDragEnd(dragEnd('a', 'a'), reorderTasks)
    expect(reorderTasks).not.toHaveBeenCalled()
  })
})
