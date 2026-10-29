import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UndoControls } from './UndoControls'
import { labels } from '../lib/labels'

const TOKEN_ONLY = /\b(?:bg|text|border|outline)-(?:paper|surface|ink|muted|line|disabled|header|neon|on-neon|hot|transparent)\b/

describe('UndoControls', () => {
  it('S2-20 renders two buttons with fixed names that call onUndo / onRedo and follow the disabled props', async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    render(
      <UndoControls
        canUndo
        canRedo={false}
        onUndo={onUndo}
        onRedo={onRedo}
        undoLabel={labels.history.add('A')}
        redoLabel={null}
      />,
    )
    const undo = screen.getByRole('button', { name: labels.undo.undo })
    const redo = screen.getByRole('button', { name: labels.undo.redo })
    expect(undo).toBeEnabled()
    expect(redo).toBeDisabled()
    expect(undo).toHaveAccessibleDescription(labels.history.add('A'))
    expect(undo).toHaveAttribute('title', labels.history.add('A'))
    expect(redo).toHaveAccessibleDescription(labels.undo.nothingToRedo)
    await user.click(undo)
    await user.click(redo)
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).not.toHaveBeenCalled()
  })

  it('S2-20 colours come from tokens only: neon text and border when enabled, muted when disabled', () => {
    render(<UndoControls canUndo={false} canRedo onUndo={vi.fn()} onRedo={vi.fn()} undoLabel={null} redoLabel={labels.history.remove('B')} />)
    const undo = screen.getByRole('button', { name: labels.undo.undo })
    const redo = screen.getByRole('button', { name: labels.undo.redo })
    for (const b of [undo, redo]) {
      const classes = b.className.split(/\s+/)
      expect(classes).toEqual(expect.arrayContaining(['text-neon', 'border-neon', 'disabled:text-muted', 'disabled:border-muted']))
      // every colour utility (bg-/text-/border-/outline-<colour>) must name a token; widths and offsets are not colours
      const colourClasses = classes.filter((c) => /(?:^|:)(?:bg|text|border|outline)-(?!offset-|\d)/.test(c))
      expect(colourClasses.length).toBeGreaterThan(0)
      expect(colourClasses.every((c) => TOKEN_ONLY.test(c))).toBe(true)
      expect(b.className).not.toMatch(/#[0-9a-f]{3,8}|-(?:gray|zinc|neutral|slate|lime|green|pink)-\d/i)
    }
    expect(undo).toBeDisabled()
    expect(undo).toHaveAccessibleDescription(labels.undo.nothingToUndo)
    expect(redo).toBeEnabled()
    expect(redo).toHaveAccessibleDescription(labels.history.remove('B'))
  })
})
