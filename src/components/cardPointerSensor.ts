import { PointerSensor, type DraggableNode, type PointerSensorOptions } from '@dnd-kit/core'
import type { PointerEvent } from 'react'

const CONTROLS = 'button, a, input, textarea, select'

// A pointer drag may start anywhere on a card except on its own controls; the drag handle is the one control allowed.
export class CardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (
        { nativeEvent: event }: PointerEvent,
        { onActivation }: PointerSensorOptions,
        context?: { active: DraggableNode },
      ): boolean => {
        if (!event.isPrimary || event.button !== 0) return false
        const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null
        if (control && control !== context?.active.activatorNode.current) return false
        onActivation?.({ event })
        return true
      },
    },
  ]
}
