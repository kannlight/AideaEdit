import React, { useState } from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import useStore from '../store'
import { fetchSSE } from '../utils/sse'

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
        <div className="pane bg-gray-50/50">
            <div className="p-4 border-b border-border bg-white flex justify-between items-center">
                <h2 className="font-semibold text-gray-700">Memo Timeline</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {memos.length === 0 && (
                    <div className="text-sm text-gray-400 italic text-center py-10">
                        思いついたことを入力してください
                    </div>
                )}
                {memos.map((memo) => (
                    <div
                        key={memo.id}
                        className={`p-3 rounded-lg border shadow-sm flex justify-between items-start group ${memo.type === 'add' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
                            }`}
                    >
                        <div className="flex gap-2">
                            <span className={`mt-1 ${memo.type === 'add' ? 'text-blue-500' : 'text-red-500'}`}>
                                {memo.type === 'add' ? <Plus size={14} /> : <Minus size={14} />}
                            </span>
                            <p className="text-sm text-gray-800">{memo.content}</p>
                        </div>
                        <button
                            onClick={() => removeMemo(memo.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-white border-t border-border space-y-3 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="考えていることを書いてください..."
                    className="w-full p-3 text-sm border border-border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] resize-none"
                />
                <div className="flex gap-2">
                    <button
                        onClick={() => handleAdd('add')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> 構成に足す
                    </button>
                    <button
                        onClick={() => handleAdd('remove')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-red-600 border border-red-200 text-sm font-medium rounded-md hover:bg-red-50 transition-colors"
                    >
                        <Minus size={16} /> 構成から引く
                    </button>
                </div>
            </div>
        </div>
    )
}
