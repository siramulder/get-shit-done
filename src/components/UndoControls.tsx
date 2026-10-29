import { useId } from 'react'
import { labels } from '../lib/labels'

type Props = {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Label of the action undo would revert, or null when there is nothing to undo. */
  undoLabel: string | null
  redoLabel: string | null
}

// Secondary buttons on the black header bar: neon text and border on a transparent fill
// (CLAUDE.md, Visual Direction), muted when disabled. Names stay fixed; the action goes into
// title + aria-describedby.
const buttonClass =
  'h-10 cursor-pointer rounded-full border-2 border-neon bg-transparent px-4 font-semibold text-neon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-not-allowed disabled:border-muted disabled:text-muted'

export function UndoControls({ canUndo, canRedo, onUndo, onRedo, undoLabel, redoLabel }: Props) {
  const undoId = useId()
  const redoId = useId()
  const undoText = canUndo && undoLabel !== null ? undoLabel : labels.undo.nothingToUndo
  const redoText = canRedo && redoLabel !== null ? redoLabel : labels.undo.nothingToRedo

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoText}
        aria-describedby={undoId}
        className={buttonClass}
      >
        {labels.undo.undo}
      </button>
      <span id={undoId} className="sr-only">
        {undoText}
      </span>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoText}
        aria-describedby={redoId}
        className={buttonClass}
      >
        {labels.undo.redo}
      </button>
      <span id={redoId} className="sr-only">
        {redoText}
      </span>
    </div>
  )
}
