import { labels } from '../lib/labels'

type Props = { variant: 'noTasks' | 'allDone' }

export function EmptyState({ variant }: Props) {
  return (
    <p className="mt-3 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center text-muted">
      {variant === 'noTasks' ? labels.emptyNoTasks : labels.emptyAllDone}
    </p>
  )
}
