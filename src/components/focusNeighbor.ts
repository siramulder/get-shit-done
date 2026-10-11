// Call before the clicked row is removed: moves focus to the button with the same data-action in the
// next row, else the previous row, else calls fallback (no row left in this list).
export function focusNeighborControl(control: HTMLElement, fallback: () => void): void {
  const row = control.closest('li')
  const action = control.dataset.action
  const neighbor = row?.nextElementSibling ?? row?.previousElementSibling
  const target = action ? neighbor?.querySelector<HTMLElement>(`[data-action="${action}"]`) : null
  if (target) target.focus()
  else fallback()
}
