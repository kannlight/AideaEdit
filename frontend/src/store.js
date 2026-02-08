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
            theme: 'light', // 'light' or 'dark'

            toggleTheme: () => set((state) => {
                const newTheme = state.theme === 'light' ? 'dark' : 'light'
                if (window.document) {
                    const root = window.document.documentElement
                    root.classList.remove('light', 'dark')
                    root.classList.add(newTheme)
                }
                return { theme: newTheme }
            }),

            initTheme: () => {
                const state = get()
                if (window.document) {
                    const root = window.document.documentElement
                    root.classList.remove('light', 'dark')
                    root.classList.add(state.theme)
                }
            },

            addMemo: (content, type = 'add') => set((state) => {
                // Determine the new state of existing memos
                const updatedMemos = state.memos.map(m => {
                    if (m.status === 'PENDING') {
                        return { ...m, status: 'APPLIED' }
                    }
                    return m
                })

                return {
                    memos: [
                        ...updatedMemos,
                        {
                            id: Date.now(),
                            content,
                            type,
                            timestamp: new Date().toISOString(),
                            status: 'PENDING'
                        }
                    ]
                }
            }),

            removeMemo: (id) => set((state) => ({
                memos: state.memos.filter(m => m.id !== id)
            })),

            updateStructure: (newStructure) => set((state) => ({
                prevStructure: state.structure,
                structure: newStructure
            })),

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
