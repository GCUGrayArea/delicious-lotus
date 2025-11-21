import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { persist, devtools } from 'zustand/middleware'
import { createIndexedDBStorage, STORE_NAMES } from '../lib/indexedDBStorage'
import type { UiStore, Toast, ModalState, PanelStates, KeyboardShortcut } from '../types/stores'
import { generateUUID } from '../utils/uuid'

const MAX_TOASTS = 5

// Initial state
const initialState = {
  modalStates: new Map<string, ModalState>(),
  toastQueue: [] as Toast[],
  panelStates: {
    isPropertiesPanelOpen: false,
    isMediaLibraryOpen: true,
    isTimelineExpanded: true,
  } as PanelStates,
  activeTool: null as string | null,
  keyboardShortcuts: new Map<string, KeyboardShortcut>(),
}

// Track toast timers for cleanup
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Create the vanilla store with devtools, persist, and immer middleware
export const createUiStore = () => {
  const store = createStore<UiStore>()(
    devtools(
      persist(
        immer((set, get) => ({
          ...initialState,

          // Modal operations
          openModal: (modalId: string, data?: Record<string, unknown>) => {
            set((state) => {
              state.modalStates.set(modalId, {
                id: modalId,
                isOpen: true,
                data,
              })
            })
          },

          closeModal: (modalId: string) => {
            set((state) => {
              const modal = state.modalStates.get(modalId)
              if (modal) {
                modal.isOpen = false
              }
            })
          },

          isModalOpen: (modalId: string) => {
            const { modalStates } = get()
            const modal = modalStates.get(modalId)
            return modal?.isOpen ?? false
          },

          // Toast operations
          addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => {
            const toastId = generateUUID()
            const newToast: Toast = {
              ...toast,
              id: toastId,
              createdAt: new Date(),
            }

            set((state) => {
              // Enforce max toasts limit
              if (state.toastQueue.length >= MAX_TOASTS) {
                // Remove oldest toast
                const oldestToast = state.toastQueue[0]
                if (oldestToast) {
                  // Clear its timer
                  const timer = toastTimers.get(oldestToast.id)
                  if (timer) {
                    clearTimeout(timer)
                    toastTimers.delete(oldestToast.id)
                  }
                  state.toastQueue.shift()
                }
              }

              state.toastQueue.push(newToast)
            })

            // Set up auto-dismiss timer
            if (toast.duration > 0) {
              const timer = setTimeout(() => {
                get().removeToast(toastId)
              }, toast.duration)
              toastTimers.set(toastId, timer)
            }

            return toastId
          },

          removeToast: (toastId: string) => {
            // Clear timer if exists
            const timer = toastTimers.get(toastId)
            if (timer) {
              clearTimeout(timer)
              toastTimers.delete(toastId)
            }

            set((state) => {
              const index = state.toastQueue.findIndex((t) => t.id === toastId)
              if (index !== -1) {
                state.toastQueue.splice(index, 1)
              }
            })
          },

          clearToasts: () => {
            // Clear all timers
            toastTimers.forEach((timer) => clearTimeout(timer))
            toastTimers.clear()

            set((state) => {
              state.toastQueue = []
            })
          },

          // Panel operations
          togglePanel: (panel: keyof PanelStates) => {
            set((state) => {
              state.panelStates[panel] = !state.panelStates[panel]
            })
          },

          setPanelState: (panel: keyof PanelStates, isOpen: boolean) => {
            set((state) => {
              state.panelStates[panel] = isOpen
            })
          },

          // Tool operations
          setActiveTool: (tool: string | null) => {
            set((state) => {
              state.activeTool = tool
            })
          },

          // Keyboard shortcut operations
          registerShortcut: (shortcut: KeyboardShortcut) => {
            set((state) => {
              const key = `${shortcut.modifiers.sort().join('+')}+${shortcut.key}`
              state.keyboardShortcuts.set(key, shortcut)
            })
          },

          removeShortcut: (key: string) => {
            set((state) => {
              state.keyboardShortcuts.delete(key)
            })
          },

          getShortcut: (key: string) => {
            const { keyboardShortcuts } = get()
            return keyboardShortcuts.get(key)
          },

          // Utility
          reset: () => {
            // Clear all toast timers
            toastTimers.forEach((timer) => clearTimeout(timer))
            toastTimers.clear()

            set(initialState)
          },
        })),
        {
          name: 'ui-store',
          storage: createIndexedDBStorage(STORE_NAMES.UI) as ReturnType<typeof createIndexedDBStorage>,
          // Custom serialization for Map and to only persist certain fields
          serialize: (state: { state: typeof initialState; version: number }) => {
            return JSON.stringify({
              state: {
                panelStates: state.state.panelStates,
                keyboardShortcuts: Array.from(state.state.keyboardShortcuts.entries()),
              },
              version: state.version,
            })
          },
          deserialize: (str: string) => {
            const parsed = JSON.parse(str)
            const shortcutsArray = parsed.state?.keyboardShortcuts || []
            const shortcutsMap = new Map(shortcutsArray)

            return {
              state: {
                ...initialState,
                panelStates: parsed.state?.panelStates || initialState.panelStates,
                keyboardShortcuts: shortcutsMap,
              },
              version: parsed.version,
            }
          },
        }
      ),
      { name: 'UiStore' }
    )
  )

  return store
}

// Export type for the store instance
export type UiStoreInstance = ReturnType<typeof createUiStore>
