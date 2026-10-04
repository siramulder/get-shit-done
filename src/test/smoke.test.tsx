import { render, screen } from '@testing-library/react'
import App from '../App'
import { labels } from '../lib/labels'

test('P2-34 renders the app shell (jsdom + RTL + jest-dom work together)', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1, name: labels.appTitle })).toBeInTheDocument()
})
