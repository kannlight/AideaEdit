import React, { useState, useEffect } from 'react'
import useStore from './store'
import { RotateCcw, Moon, Sun } from 'lucide-react'
import MemoPane from './components/MemoPane'
import StructurePane from './components/StructurePane'
import EditorPane from './components/EditorPane'

function App() {
    const { memos, structure, prose, resetAll, theme, toggleTheme, initTheme, viewMode, setViewMode } = useStore()
    const [showResetConfirm, setShowResetConfirm] = useState(false)

    useEffect(() => {
        initTheme()
    }, [])

    const handleReset = () => {
        const fullText = `Memos:\n${memos.map(m => `- ${m.content}`).join('\n')}\n\nStructure:\n${structure}\n\nProse:\n${prose}`
        navigator.clipboard.writeText(fullText)
        resetAll()
        setShowResetConfirm(false)
        alert('現在の内容をクリップボードにコピーしてリセットしました。')
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shadow-sm">A</div>
                    <h1 className="text-xl font-bold tracking-tight">AideaEdit</h1>
                    <div className="h-6 w-px bg-border mx-2"></div>
                    <div className="flex bg-muted p-1 rounded-md">
                        <button
                            onClick={() => setViewMode('planning')}
                            className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'planning' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Planning
                        </button>
                        <button
                            onClick={() => setViewMode('writing')}
                            className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'writing' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Writing
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        title={theme === 'light' ? 'ダークモードへ' : 'ライトモードへ'}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <div className="h-4 w-px bg-border mx-1"></div>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all border border-transparent"
                    >
                        <RotateCcw size={16} />
                        新規セッション
                    </button>
                </div>
            </header>

            {/* Main Content (Panes) */}
            <main className="flex-1 flex overflow-hidden divide-x divide-border">
                {viewMode === 'planning' ? (
                    <>
                        {/* Memo Pane */}
                        <div className="w-1/3 shrink-0 flex flex-col min-w-[300px]">
                            <MemoPane />
                        </div>

                        {/* Structure Pane (Takes remaining space in Planning mode) */}
                        <div className="flex-1 flex flex-col min-w-[300px]">
                            <StructurePane />
                        </div>
                    </>
                ) : (
                    /* Editor Pane (Full Width in Writing mode) */
                    <div className="flex-1 flex flex-col min-w-[400px]">
                        <EditorPane />
                    </div>
                )}
            </main>

            {/* Reset Confirmation Overlay */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-card p-6 rounded-lg shadow-lg border border-border max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold mb-2">セッションのリセット</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            現在の作業内容（メモ、構成案、文章）を全て消去します。
                            続行する前に、内容をクリップボードにコピーすることを推奨します。
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-md"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:opacity-90 rounded-md shadow-sm"
                            >
                                コピーしてリセット
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
