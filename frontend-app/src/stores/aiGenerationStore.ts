import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import type {
  AIGenerationStore,
  GenerationRequest,
  GenerationHistory,
} from '../types/stores'

// Initial state
const initialState = {
  activeGenerations: new Map<string, GenerationRequest>(),
  completingGenerations: new Map<string, GenerationRequest>(),
  generationHistory: [] as GenerationHistory[],
  maxConcurrentGenerations: Number(import.meta.env.VITE_MAX_AI_GENERATIONS) || 30, // MAX_GENERATIONS concurrency limit
}

// Create the vanilla store with devtools, persist, and immer middleware
export const createAIGenerationStore = () => {
  return createStore<AIGenerationStore>()(
    devtools(
      persist(
        immer((set, get) => ({
          ...initialState,

          // Generation operations
          queueGeneration: (request) => {
            const generationId = `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`
            const newRequest: GenerationRequest = {
              ...request,
              id: generationId,
              status: 'queued',
              createdAt: new Date(),
            }

            set((state) => {
              state.activeGenerations.set(generationId, newRequest)

              // If below max concurrent, start immediately
              const activeCount = Array.from(state.activeGenerations.values()).filter(
                (gen) => gen.status === 'generating'
              ).length

              if (activeCount < state.maxConcurrentGenerations) {
                const gen = state.activeGenerations.get(generationId)
                if (gen) {
                  gen.status = 'generating'
                }
              }
            })

            return generationId
          },

          updateGenerationStatus: (generationId, status, updates) =>
            set((state) => {
              const generation = state.activeGenerations.get(generationId)
              if (generation) {
                generation.status = status
                if (updates) {
                  Object.assign(generation, updates)
                }

                // If completed or failed, add to history
                if (status === 'completed' || status === 'failed') {
                  generation.completedAt = new Date()
                }

                // Start next queued generation if one completes
                if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                  const queuedGenerations = Array.from(state.activeGenerations.values())
                    .filter((gen) => gen.status === 'queued')
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

                  if (queuedGenerations.length > 0) {
                    const nextGen = queuedGenerations[0]
                    const gen = state.activeGenerations.get(nextGen.id)
                    if (gen) {
                      gen.status = 'generating'
                    }
                  }
                }
              }
            }),

          updateGenerationProgress: (generationId, progress) =>
            set((state) => {
              const generation = state.activeGenerations.get(generationId)
              if (generation) {
                generation.progress = Math.max(0, Math.min(100, progress))
              }
            }),

          cancelGeneration: (generationId) =>
            set((state) => {
              const generation = state.activeGenerations.get(generationId)
              if (generation && generation.status !== 'completed') {
                generation.status = 'cancelled'
              }
            }),

          removeGeneration: (generationId) =>
            set((state) => {
              state.activeGenerations.delete(generationId)
            }),

          moveToCompleting: (generationId) =>
            set((state) => {
              const generation = state.activeGenerations.get(generationId)
              if (generation) {
                state.activeGenerations.delete(generationId)
                state.completingGenerations.set(generationId, generation)
              }
            }),

          clearCompletingGeneration: (generationId) =>
            set((state) => {
              state.completingGenerations.delete(generationId)
            }),

          // History operations
          addToHistory: (generation, assetId) =>
            set((state) => {
              const historyItem: GenerationHistory = {
                id: `history-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                request: generation,
                assetId,
                isFavorite: false,
              }
              state.generationHistory.unshift(historyItem) // Add to beginning

              // Keep only last 100 history items
              if (state.generationHistory.length > 100) {
                state.generationHistory = state.generationHistory.slice(0, 100)
              }
            }),

          removeFromHistory: (historyId) =>
            set((state) => {
              state.generationHistory = state.generationHistory.filter((h) => h.id !== historyId)
            }),

          toggleFavorite: (historyId) =>
            set((state) => {
              const historyItem = state.generationHistory.find((h) => h.id === historyId)
              if (historyItem) {
                historyItem.isFavorite = !historyItem.isFavorite
              }
            }),

          searchHistory: (query) => {
            const { generationHistory } = get()
            const lowerQuery = query.toLowerCase()
            return generationHistory.filter((item) =>
              item.request.prompt.toLowerCase().includes(lowerQuery)
            )
          },

          // Utility
          reset: () => set(initialState),
        })),
        {
          name: 'ai-generation-store',
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => ({
            activeGenerations: Array.from(state.activeGenerations.entries()),
            completingGenerations: Array.from(state.completingGenerations.entries()),
            generationHistory: state.generationHistory,
            maxConcurrentGenerations: state.maxConcurrentGenerations,
          }),
          merge: (persistedState, currentState) => {
            const persisted = persistedState as any

            // Reconstruct activeGenerations Map with proper Date objects
            const activeGenerationsMap = new Map<string, any>(
              (persisted.activeGenerations || []).map(([id, gen]: [string, any]) => [
                id,
                {
                  ...gen,
                  createdAt: new Date(gen.createdAt),
                  completedAt: gen.completedAt ? new Date(gen.completedAt) : undefined,
                }
              ])
            ) as Map<string, GenerationRequest>

            // Reconstruct completingGenerations Map with proper Date objects
            const completingGenerationsMap = new Map<string, any>(
              (persisted.completingGenerations || []).map(([id, gen]: [string, any]) => [
                id,
                {
                  ...gen,
                  createdAt: new Date(gen.createdAt),
                  completedAt: gen.completedAt ? new Date(gen.completedAt) : undefined,
                }
              ])
            ) as Map<string, GenerationRequest>

            return {
              ...currentState,
              activeGenerations: activeGenerationsMap,
              completingGenerations: completingGenerationsMap,
              generationHistory: (persisted.generationHistory || []).map((item: any) => ({
                ...item,
                request: {
                  ...item.request,
                  createdAt: new Date(item.request.createdAt),
                  completedAt: item.request.completedAt ? new Date(item.request.completedAt) : undefined,
                }
              })),
              maxConcurrentGenerations: persisted.maxConcurrentGenerations || Number(import.meta.env.VITE_MAX_AI_GENERATIONS) || 30,
            }
          },
        }
      ),
      { name: 'AIGenerationStore' }
    )
  )
}

// Export type for the store instance
export type AIGenerationStoreInstance = ReturnType<typeof createAIGenerationStore>
