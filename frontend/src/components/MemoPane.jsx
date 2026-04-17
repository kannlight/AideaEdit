import React, { useState } from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import useStore from '../store'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'

export default function MemoPane() {
    const { memos, addMemo, removeMemo, structure, startStructureGeneration, endStructureGeneration, updateStructureStream, activeServiceId } = useStore()
    const [inputValue, setInputValue] = useState('')

    const handleAdd = async (type) => {
        if (!inputValue.trim()) return

        const newMemo = { content: inputValue, type }
        addMemo(inputValue, type)
        setInputValue('')

        // 構成案更新のリクエスト
        startStructureGeneration(structure)
        let fullStructure = ''
        await fetchSSE('/api/structure/update', {
            method: 'POST',
            body: JSON.stringify({
                current_structure: structure,
                new_memo: newMemo,
                service_id: activeServiceId
            })
        }, (data) => {
            fullStructure += data.content
            updateStructureStream(fullStructure)
        }, () => {
            console.log('Structure update done')
            endStructureGeneration()
        })
    }

    return (
        <div className="pane bg-muted/30 relative flex flex-col h-full">
            <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur z-10 sticky top-0 shrink-0">
                <h2 className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2">
                    Memo Timeline
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{memos.length}</span>
                </h2>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    {memos.length === 0 && (
                        <div className="text-sm text-muted-foreground italic text-center py-12 bg-muted/20 rounded-lg border border-dashed border-border mx-2">
                            思いついたことを入力してください
                        </div>
                    )}
                    {memos.map((memo) => (
                        <div
                            key={memo.id}
                            className={`p-3 rounded-lg border transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 group relative
                                ${memo.type === 'add'
                                    ? 'bg-card border-border hover:border-primary/50 shadow-sm'
                                    : 'bg-muted/50 border-transparent text-muted-foreground'
                                }`}
                        >
                            <div className="flex gap-2.5 items-start">
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-relaxed break-words ${memo.type === 'add' ? 'text-card-foreground' : 'text-muted-foreground line-through decoration-destructive/30'}`}>
                                        {memo.content}
                                    </p>
                                    <div className="flex gap-2 mt-1.5">
                                        {memo.status === 'PENDING' && (
                                            <span className="text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                                Pending
                                            </span>
                                        )}
                                        {memo.status === 'REJECTED' && (
                                            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                                Rejected
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => removeMemo(memo.id)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                                title="削除"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 bg-background border-t border-border mt-auto shrink-0 z-10">
                <div className="relative shadow-sm">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="考えていることを書いてください..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.metaKey) {
                                handleAdd('add');
                            }
                        }}
                        className="w-full p-3 text-sm bg-muted/30 border border-input rounded-md focus:bg-background focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
                    />
                </div>
                <div className="flex gap-2 mt-3">
                    <button
                        onClick={() => handleAdd('add')}
                        disabled={!inputValue.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <Plus size={16} /> 構成に足す
                    </button>
                    <button
                        onClick={() => handleAdd('remove')}
                        disabled={!inputValue.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-background text-destructive border border-input hover:bg-destructive/10 hover:border-destructive/30 text-sm font-medium rounded-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <Minus size={16} /> 構成から引く
                    </button>
                </div>
                <div className="flex justify-center mt-2">
                    <span className="text-[10px] text-muted-foreground">⌘+Enter で構成に足す</span>
                </div>
            </div>
        </div>
    )
}
