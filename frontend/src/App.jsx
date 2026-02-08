import React, { useState, useEffect } from 'react'
import useStore from './store'
import { RotateCcw, Moon, Sun } from 'lucide-react'
import MemoPane from './components/MemoPane'
import StructurePane from './components/StructurePane'
import EditorPane from './components/EditorPane'

function App() {
    const { memos, structure, prose, resetAll, theme, toggleTheme, initTheme } = useStore()
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
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shadow-sm z-20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">A</div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">AideaEdit</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
                        title={theme === 'light' ? 'ダークモードへ' : 'ライトモードへ'}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <div className="h-6 w-px bg-border mx-1"></div>
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all border border-transparent"
                    >
                        <RotateCcw size={16} />
                        新規セッション
                    </button>
                </div>
            </header>

            {/* Main Content (3 Panes) */}
            <main className="flex-1 flex overflow-x-auto overflow-y-hidden">
                <div className="min-w-[320px] w-1/4 max-w-[400px]">
                    <MemoPane />
                </div>
                <div className="min-w-[400px] w-1/3">
                    <StructurePane />
                </div>
                <div className="flex-1 min-w-[500px]">
                    <EditorPane />
                </div>
            </main>

            {/* Reset Confirmation Overlay */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold mb-2">セッションのリセット</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            現在の作業内容（メモ、構成案、文章）を全て消去します。
                            続行する前に、内容をクリップボードにコピーすることを推奨します。
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm"
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
