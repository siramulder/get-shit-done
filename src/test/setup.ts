import '@testing-library/jest-dom/vitest'

// @testing-library/react only auto-advances *jest* fake timers after each event (it looks for a global
// `jest`). Without this, user-event hangs whenever vitest fake timers include setTimeout. Harmless when
// timers are real: RTL only calls it while `setTimeout.clock` exists.
vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
