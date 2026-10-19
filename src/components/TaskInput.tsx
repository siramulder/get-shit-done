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
        className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-500 focus:border-blue-600 focus:outline-2 focus:outline-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
      />
      <button
        type="submit"
        disabled={disabled}
        className="h-11 shrink-0 rounded-lg bg-blue-600 px-4 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-blue-600"
      >
        {labels.addButton}
      </button>
    </form>
  )
}
