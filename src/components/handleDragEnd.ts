import type { DragEndEvent } from '@dnd-kit/core'

export function handleDragEnd(
  { active, over }: Pick<DragEndEvent, 'active' | 'over'>,
  reorderTasks: (activeId: string, overId: string) => void,
): void {
  if (over && active.id !== over.id) {
    reorderTasks(String(active.id), String(over.id))
  }
}
