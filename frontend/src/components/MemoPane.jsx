import React, { useState } from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import useStore from '../store'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'

export default function MemoPane() {
    const { memos, addMemo, removeMemo, structure, updateStructure } = useStore()
    const [inputValue, setInputValue] = useState('')

    const handleAdd = async (type) => {
        if (!inputValue.trim()) return

        const newMemo = { content: inputValue, type }
        addMemo(inputValue, type)
        setInputValue('')

        // 構成案更新のリクエスト
        let fullStructure = ''
        await fetchSSE('/api/structure/update', {
            method: 'POST',
            body: JSON.stringify({
                current_structure: structure,
                new_memo: newMemo
            })
        }, (data) => {
            fullStructure += data.content
            updateStructure(fullStructure)
        }, () => {
            console.log('Structure update done')
        })
    }

    return (
        <div className="pane bg-secondary/30">
            <div className="p-4 border-b border-border bg-card flex justify-between items-center sticky top-0 z-10">
                <h2 className="font-semibold text-foreground">Memo Timeline</h2>
            </div>

            <ScrollArea className="space-y-3 p-4">
                {memos.length === 0 && (
                    <div className="text-sm text-muted-foreground italic text-center py-10">
                        思いついたことを入力してください
                    </div>
                )}
                {memos.map((memo) => (
                    <div
                        key={memo.id}
                        className={`p-3 rounded-lg border shadow-sm flex justify-between items-start group ${memo.type === 'add'
                            ? 'bg-background border-primary/20 dark:border-primary/50'
                            : 'bg-background border-destructive/20 dark:border-destructive/50'
                            }`}
                    >
                        <div className="flex gap-2">
                            <span className={`mt-1 ${memo.type === 'add' ? 'text-primary' : 'text-destructive'}`}>
                                {memo.type === 'add' ? <Plus size={14} /> : <Minus size={14} />}
                            </span>
                            <div className="flex flex-col">
                                <p className="text-sm text-foreground">{memo.content}</p>
                                <div className="flex gap-2 mt-1">
                                    {memo.status === 'PENDING' && <span className="text-[10px] bg-accent/20 text-accent px-1.5 rounded">Pending</span>}
                                    {memo.status === 'REJECTED' && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 rounded">Rejected</span>}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => removeMemo(memo.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </ScrollArea>

            <div className="p-4 bg-card border-t border-border space-y-3 shadow-sm">
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="考えていることを書いてください..."
                    className="w-full p-3 text-sm bg-background border border-border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] resize-none text-foreground"
                />
                <div className="flex gap-2">
                    <button
                        onClick={() => handleAdd('add')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                    >
                        <Plus size={16} /> 構成に足す
                    </button>
                    <button
                        onClick={() => handleAdd('remove')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-background text-destructive border border-destructive/30 text-sm font-medium rounded-md hover:bg-destructive/10 transition-colors"
                    >
                        <Minus size={16} /> 構成から引く
                    </button>
                </div>
            </div>
        </div>
    )
}
