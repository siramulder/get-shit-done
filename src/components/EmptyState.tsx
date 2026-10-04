import { labels } from '../lib/labels'

type Props = { variant: 'noTasks' | 'allDone' }

export function EmptyState({ variant }: Props) {
  return (
    <p className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {variant === 'noTasks' ? labels.emptyNoTasks : labels.emptyAllDone}
    </p>
  )
}
