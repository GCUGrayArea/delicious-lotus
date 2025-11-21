import { useEffect } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: () => void
  description: string
  enabled?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Find matching shortcut
      const matchedShortcut = shortcuts.find((shortcut) => {
        // Check if the key matches (case-insensitive)
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()

        // Check modifiers
        const ctrlMatches = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatches = shortcut.alt ? event.altKey : !event.altKey
        const metaMatches = shortcut.meta ? event.metaKey : true // Meta is optional for Mac

        // Check if shortcut is enabled
        const isEnabled = shortcut.enabled !== false

        return keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches && isEnabled
      })

      if (matchedShortcut) {
        event.preventDefault()
        event.stopPropagation()
        matchedShortcut.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, enabled])
}
