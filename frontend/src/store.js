import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
    persist(
        (set, get) => ({
            memos: [],
            structure: '',
            prevStructure: '',
            prose: '',
            isGeneratingStructure: false,
            isGeneratingProse: false,

            addMemo: (content, type = 'add') => set((state) => ({
                memos: [
                    ...state.memos.map(m => ({ ...m, applied: true })), // Mark previous memos as applied
                    { id: Date.now(), content, type, timestamp: new Date().toISOString(), applied: false }
                ]
            })),

            removeMemo: (id) => set((state) => ({
                memos: state.memos.filter(m => m.id !== id)
            })),

            updateStructure: (newStructure) => set((state) => ({
                prevStructure: state.structure,
                structure: newStructure
            })),

            markLastMemoApplied: () => set((state) => {
                const lastMemo = state.memos[state.memos.length - 1]
                if (!lastMemo) return {}
                return {
                    memos: state.memos.map(m => m.id === lastMemo.id ? { ...m, applied: true } : m)
                }
            }),

            updateMemoStatus: (id, status) => set((state) => ({
                memos: state.memos.map(m => m.id === id ? { ...m, status } : m)
            })),

            updateProse: (newProse) => set({ prose: newProse }),

            resetAll: () => {
                set({
                    memos: [],
                    structure: '',
                    prevStructure: '',
                    prose: '',
                    isGeneratingStructure: false,
                    isGeneratingProse: false,
                })
            },
        }),
        {
            name: 'aideaedit-storage',
        }
    )
)

export default useStore
