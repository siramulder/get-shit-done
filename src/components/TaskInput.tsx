import { useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { labels } from '../lib/labels'

type Props = { onAdd: (title: string) => void; inputRef?: RefObject<HTMLInputElement>; disabled?: boolean }

export function TaskInput({ onAdd, inputRef: externalRef, disabled = false }: Props) {
  const [text, setText] = useState('')
  const ownRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? ownRef
  const inputId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return
    const title = text.trim()
    if (title === '') return
    onAdd(title)
    setText('')
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor={inputId} className="sr-only">
        {labels.inputLabel}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={labels.inputLabel}
        autoComplete="off"
        disabled={disabled}
        className="h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 text-base font-medium text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled}
        className="h-11 shrink-0 rounded-xl border-2 border-ink bg-neon px-4 font-semibold text-on-neon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-not-allowed disabled:opacity-60"
      >
        {labels.addButton}
      </button>
    </form>
  )
}
