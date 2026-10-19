import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskInput } from './TaskInput'
import { labels } from '../lib/labels'

function setup() {
  const onAdd = vi.fn()
  const user = userEvent.setup()
  render(<TaskInput onAdd={onAdd} />)
  return {
    onAdd,
    user,
    input: screen.getByRole('textbox', { name: labels.inputLabel }),
    button: screen.getByRole('button', { name: labels.addButton }),
  }
}

describe('TaskInput', () => {
  it('P2-01 has a labelled text box and an "เพิ่มงาน" button', () => {
    const { input, button } = setup()
    expect(input).toBeInTheDocument()
    expect(button).toBeInTheDocument()
    expect(input.closest('form')).toContainElement(button)
  })

  it('P2-02 pressing Enter calls onAdd with the typed text', async () => {
    const { user, input, onAdd } = setup()
    await user.type(input, 'ซื้อนม{Enter}')
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith('ซื้อนม')
  })

  it('P2-03 clicking the button calls onAdd', async () => {
    const { user, input, button, onAdd } = setup()
    await user.type(input, 'ส่งรายงาน')
    await user.click(button)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith('ส่งรายงาน')
  })

  it('P2-04 does not call onAdd for an empty or whitespace-only title', async () => {
    const { user, input, button, onAdd } = setup()
    await user.click(button)
    await user.type(input, '{Enter}')
    await user.type(input, '    {Enter}')
    await user.click(button)
    expect(onAdd).not.toHaveBeenCalled()
    expect(input).toHaveValue('    ')
  })

  it('P2-05 clears the box and keeps focus on it after adding (Enter and button)', async () => {
    const { user, input, button } = setup()
    await user.type(input, 'งานแรก{Enter}')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()

    await user.type(input, 'งานสอง')
    await user.click(button)
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('AC-16.4 the disabled prop disables both the text box and the button', () => {
    render(<TaskInput onAdd={vi.fn()} disabled />)
    expect(screen.getByRole('textbox', { name: labels.inputLabel })).toBeDisabled()
    expect(screen.getByRole('button', { name: labels.addButton })).toBeDisabled()
  })
})
