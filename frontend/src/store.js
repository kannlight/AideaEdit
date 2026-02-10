import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
    persist(
        (set, get) => ({
            memos: [],
            structure: '',
            prevStructure: '',
            prose: '',
            prevProse: '',
            isGeneratingStructure: false,
            isGeneratingProse: false,
            theme: 'light', // 'light' or 'dark'
            viewMode: 'planning', // 'planning' | 'writing'

            toggleTheme: () => set((state) => {
                const newTheme = state.theme === 'light' ? 'dark' : 'light'
                if (window.document) {
                    const root = window.document.documentElement
                    root.classList.remove('light', 'dark')
                    root.classList.add(newTheme)
                }
                return { theme: newTheme }
            }),

            setViewMode: (mode) => set({ viewMode: mode }),

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

            updateStructure: (newStructure) => set((state) => {
                const hasPending = state.memos.some(m => m.status === 'PENDING')
                if (hasPending) {
                    // If reviewing AI suggestion, only update current structure.
                    // Keep prevStructure as the original base to show diffs against.
                    return { structure: newStructure }
                } else {
                    // If regular manual editing, update both.
                    // This treats manual edits as "Confirmed" immediately, preventing unwanted diffs.
                    return {
                        structure: newStructure,
                        prevStructure: newStructure
                    }
                }
            }),

            revertStructure: () => set((state) => {
                // Find the last PENDING memo to reject
                const pendingMemo = state.memos.findLast(m => m.status === 'PENDING')
                const updatedMemos = pendingMemo
                    ? state.memos.map(m => m.id === pendingMemo.id ? { ...m, status: 'REJECTED' } : m)
                    : state.memos

                return {
                    structure: state.prevStructure,
                    // Critical: Do NOT swap structure and prevStructure.
                    // We are reverting to the confirmed state. The pending state is discarded.
                    // prevStructure remains as the confirmed state (which is what we reverted to).
                    // Actually, if we revert, the "current" structure becomes what was "previous".
                    // But effectively, we just want to discard the change.
                    // So we set structure = prevStructure.
                    // We can keep prevStructure as is, or maybe it should theoretically stay same?
                    // If A -> B (pending), prev=A, curr=B.
                    // Revert: curr=A. prev=A.
                    prevStructure: state.prevStructure,
                    memos: updatedMemos
                }
            }),

            confirmStructure: () => set((state) => {
                // Find the last PENDING memo to apply
                const pendingMemo = state.memos.findLast(m => m.status === 'PENDING')
                const updatedMemos = pendingMemo
                    ? state.memos.map(m => m.id === pendingMemo.id ? { ...m, status: 'APPLIED' } : m)
                    : state.memos

                return {
                    // Confirming means the current structure is now the accepted baseline.
                    // So prevStructure becomes the current structure.
                    prevStructure: state.structure,
                    memos: updatedMemos
                }
            }),

            startStructureGeneration: (currentStructure) => set({
                prevStructure: currentStructure,
                isGeneratingStructure: true
            }),

            endStructureGeneration: () => set({
                isGeneratingStructure: false
            }),

            updateStructureStream: (newStructure) => set({
                structure: newStructure
            }),

            updateMemoStatus: (id, status) => set((state) => ({
                memos: state.memos.map(m => m.id === id ? { ...m, status } : m)
            })),

            updateProse: (newProse, isAuto = false) => set((state) => {
                if (isAuto) {
                    // AI generation: Update current prose only.
                    // Keep prevProse as the baseline for diff.
                    return { prose: newProse }
                } else {
                    // Manual edit: Update both.
                    // This treats manual edits as confirmed immediately.
                    return {
                        prose: newProse,
                        prevProse: newProse
                    }
                }
            }),

            revertProse: () => set((state) => ({
                prose: state.prevProse
            })),

            confirmProse: () => set((state) => ({
                prevProse: state.prose
            })),

            startProseGeneration: () => set((state) => ({
                prevProse: state.prose,
                isGeneratingProse: true
            })),

            endProseGeneration: () => set({
                isGeneratingProse: false
            }),

            resetAll: () => {
                set({
                    memos: [],
                    structure: '',
                    prevStructure: '',
                    prose: '',
                    prevProse: '',
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
