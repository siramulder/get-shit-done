import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'
import { labels } from '../lib/labels'

describe('EmptyState', () => {
  it('invites the user to add a first task when there is nothing at all', () => {
    render(<EmptyState variant="noTasks" />)
    expect(screen.getByText(labels.emptyNoTasks)).toBeInTheDocument()
    expect(screen.queryByText(labels.emptyAllDone)).not.toBeInTheDocument()
  })

  it('says everything is done when only finished tasks remain', () => {
    render(<EmptyState variant="allDone" />)
    expect(screen.getByText(labels.emptyAllDone)).toBeInTheDocument()
    expect(screen.queryByText(labels.emptyNoTasks)).not.toBeInTheDocument()
  })
})
