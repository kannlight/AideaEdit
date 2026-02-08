import React, { useState, useEffect } from 'react'
import useStore from '../store'
import ReactMarkdown from 'react-markdown'
import { Check, X, Undo2, RefreshCw } from 'lucide-react'
import DiffMatchPatch from 'diff-match-patch'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'

export default function StructurePane() {
    const { structure, prevStructure, updateStructure, memos, updateMemoStatus } = useStore()
    const [isEditing, setIsEditing] = useState(false)
    const [localStructure, setLocalStructure] = useState(structure)
    const [diffHtml, setDiffHtml] = useState('')

    // 最新のPENDINGメモを取得
    const pendingMemo = memos.findLast(m => m.status === 'PENDING')
    const hasDiff = prevStructure && structure && prevStructure !== structure

    useEffect(() => {
        if (!isEditing) {
            setLocalStructure(structure)
        }
    }, [structure, isEditing])

    useEffect(() => {
        if (hasDiff) {
            const dmp = new DiffMatchPatch()
            const diffs = dmp.diff_main(prevStructure, structure)
            dmp.diff_cleanupSemantic(diffs)

            const html = diffs.map(([op, text]) => {
                const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                if (op === 1) { // Insert
                    return `< span class="bg-green-100 text-green-800 px-1 rounded" > ${safeText}</span > `
                } else if (op === -1) { // Delete
                    return `< span class="bg-red-50 text-red-400 px-1 rounded line-through decoration-red-400 opacity-60 text-xs" > ${safeText}</span > `
                }
                return safeText
            }).join('')

            setDiffHtml(html)
        }
    }, [structure, prevStructure, hasDiff])

    const handleConfirm = () => {
        if (pendingMemo) {
            updateMemoStatus(pendingMemo.id, 'APPLIED')
        }
        // Diff確定：現在のstructureをprevStructureとしても保存（store側でupdateStructure時に行われる）
        // ただしここでは単にDiff状態を解消したい。
        // store.jsのupdateStructureはprevStructureを上書きしてしまうので、
        // 実は「Diffを消す」＝「prevStructureをstructureと同じにする」必要がある。
        // しかしstoreにはそのアクションがないため、再度updateStructureを呼ぶことで実質的に同期させる。
        updateStructure(structure)
    }

    const handleUndo = () => {
        if (pendingMemo) {
            updateMemoStatus(pendingMemo.id, 'REJECTED')
        }
        // 前の状態に戻す
        updateStructure(prevStructure)
    }

    const handleReload = async () => {
        handleUndo() // まず元に戻す

        // 直近のメモ（今Rejectしたばかりのメモ）を使って再生成
        // undoでREJECTEDになったメモを再度PENDINGに戻してリクエストする
        if (pendingMemo) {
            updateMemoStatus(pendingMemo.id, 'PENDING')

            let fullStructure = ''
            await fetchSSE('/api/structure/update', {
                method: 'POST',
                body: JSON.stringify({
                    current_structure: prevStructure, // 元の状態をベースにする
                    new_memo: pendingMemo // 再度同じメモを送る
                })
            }, (data) => {
                fullStructure += data.content
                updateStructure(fullStructure)
            }, () => {
                console.log('Reload done')
            })
        }
    }

    const handleSave = () => {
        updateStructure(localStructure)
        setIsEditing(false)
    }

    // プレビュークリックで編集モードへ
    const handlePreviewClick = () => {
        setIsEditing(true)
    }

    return (
        <div className="pane bg-white dark:bg-card flex flex-col h-full">
            <div className="p-4 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10 shrink-0">
                <h2 className="font-semibold text-foreground">Structure Draft</h2>

                {/* Action Buttons for Diff */}
                {hasDiff && !isEditing && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleReload}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
                            title="再生成 (Reload)"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={handleUndo}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="取り消し (Undo)"
                        >
                            <Undo2 size={18} />
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                            title="確定 (Confirm)"
                        >
                            <Check size={16} /> 確定
                        </button>
                    </div>
                )}

                {/* Editing Save/Cancel */}
                {isEditing && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
                            title="キャンセル"
                        >
                            <X size={18} />
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                            title="保存"
                        >
                            <Check size={16} /> 保存
                        </button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="flex-1 overflow-hidden p-4">
                    <textarea
                        value={localStructure}
                        onChange={(e) => setLocalStructure(e.target.value)}
                        className="w-full h-full p-3 text-sm font-mono text-foreground bg-secondary/50 border border-border rounded-md focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                        placeholder="Markdown形式で構成を入力..."
                        onBlur={() => setIsEditing(false)}
                        autoFocus
                    />
                </div>
            ) : (
                <ScrollArea className="p-4">
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none min-h-full cursor-text"
                        onClick={handlePreviewClick}
                    >
                        {structure ? (
                            hasDiff ? (
                                <div
                                    className="whitespace-pre-wrap font-sans text-foreground"
                                    dangerouslySetInnerHTML={{ __html: diffHtml }}
                                />
                            ) : (
                                <ReactMarkdown>{structure}</ReactMarkdown>
                            )
                        ) : (
                            <div className="text-muted-foreground italic text-center py-10 pointer-events-none">構成案がここに表示されます</div>
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}
