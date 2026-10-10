import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  useSensor,
  useSensors,
  type Announcements,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskItem } from './TaskItem'
import { CardPointerSensor } from './cardPointerSensor'
import { handleDragEnd } from './handleDragEnd'
import { labels } from '../lib/labels'
import type { Task } from '../types/task'

type Props = {
  tasks: Task[]
  labelledBy: string
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (activeId: string, overId: string) => void
}

export function TaskList({ tasks, labelledBy, onReorder, ...rowHandlers }: Props) {
  const sensors = useSensors(
    useSensor(CardPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const titleOf = (id: UniqueIdentifier) => tasks.find((t) => t.id === id)?.title ?? ''
  const positionOf = (id: UniqueIdentifier) => tasks.findIndex((t) => t.id === id) + 1
  const total = tasks.length
  const announcements: Announcements = {
    onDragStart: ({ active }) => labels.dnd.picked(titleOf(active.id), positionOf(active.id), total),
    onDragOver: ({ active, over }) =>
      over ? labels.dnd.over(titleOf(active.id), positionOf(over.id), total) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? labels.dnd.dropped(titleOf(active.id), positionOf(over.id), total)
        : labels.dnd.cancelled(titleOf(active.id)),
    onDragCancel: ({ active }) => labels.dnd.cancelled(titleOf(active.id)),
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => handleDragEnd(event, onReorder)}
      accessibility={{ screenReaderInstructions: { draggable: labels.dnd.instructions }, announcements }}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul aria-labelledby={labelledBy} className="mt-3 space-y-2">
          {tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              isFirst={index === 0}
              isLast={index === tasks.length - 1}
              {...rowHandlers}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
