import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
    persist(
        (set, get) => ({
            memos: [],
            structure: '',
            prose: '',
            isGeneratingStructure: false,
            isGeneratingProse: false,

            addMemo: (content, type = 'add') => set((state) => ({
                memos: [...state.memos, { id: Date.now(), content, type, timestamp: new Date().toISOString() }]
            })),

            removeMemo: (id) => set((state) => ({
                memos: state.memos.filter(m => m.id !== id)
            })),

            updateStructure: (newStructure) => set({ structure: newStructure }),
            updateProse: (newProse) => set({ prose: newProse }),

            resetAll: () => {
                set({
                    memos: [],
                    structure: '',
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
