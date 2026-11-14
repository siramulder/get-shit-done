import type { DueBadge } from '../types/task'

type Props = {
  badge: DueBadge
  /** 'list' = on a task row (surface); 'card' = on a review card, whose neon fill only ever takes on-neon text. */
  tone: 'list' | 'card'
}

const base = 'inline-flex items-center gap-1.5 text-sm font-semibold'

// The same words in both places; only the colours follow the background. Hot (pink) means "time needs attention":
// the overdue fill everywhere, and the dot of "today" in the list.
export function DueBadgeLabel({ badge, tone }: Props) {
  const onCard = tone === 'card'
  if (badge.kind === 'overdue') {
    return <span className={`${base} rounded-[6px] bg-hot px-1.5 text-on-neon`}>{badge.text}</span>
  }
  if (badge.kind === 'today') {
    return (
      <span className={`${base} ${onCard ? 'text-on-neon' : 'text-ink'}`}>
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${onCard ? 'bg-on-neon' : 'bg-hot'}`} />
        {badge.text}
      </span>
    )
  }
  return <span className={`${base} ${onCard ? 'text-on-neon' : 'text-muted'}`}>{badge.text}</span>
}
