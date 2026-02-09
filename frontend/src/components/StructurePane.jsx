import React, { useState, useEffect } from 'react'
import useStore from '../store'
import ReactMarkdown from 'react-markdown'
import { Check, X, Undo2, RefreshCw } from 'lucide-react'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'
import { useDiff } from '../hooks/useDiff'

export default function StructurePane() {
    const { structure, prevStructure, updateStructure, memos, updateMemoStatus, startStructureGeneration, endStructureGeneration, updateStructureStream } = useStore()
    const [isEditing, setIsEditing] = useState(false)
    const [localStructure, setLocalStructure] = useState(structure)

    // useDiff hook implementation
    const { diffHtml, hasDiff } = useDiff(structure, prevStructure)

    // 最新のPENDINGメモを取得
    const pendingMemo = memos.findLast(m => m.status === 'PENDING')

    useEffect(() => {
        if (!isEditing) {
            setLocalStructure(structure)
        }
    }, [structure, isEditing])

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
            startStructureGeneration(prevStructure)
            await fetchSSE('/api/structure/update', {
                method: 'POST',
                body: JSON.stringify({
                    current_structure: prevStructure, // 元の状態をベースにする
                    new_memo: pendingMemo // 再度同じメモを送る
                })
            }, (data) => {
                fullStructure += data.content
                updateStructureStream(fullStructure)
            }, () => {
                console.log('Reload done')
                endStructureGeneration()
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
        <div className="pane bg-background flex flex-col h-full border-r border-border/50">
            <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10 shrink-0 flex justify-between items-center h-[57px]">
                <h2 className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2">Structure Draft</h2>

                {/* Action Buttons for Diff */}
                {hasDiff && !isEditing && (
                    <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-4 duration-300">
                        <button
                            onClick={handleReload}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                            title="再生成 (Reload)"
                        >
                            <RefreshCw size={16} />
                        </button>
                        <button
                            onClick={handleUndo}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="取り消し (Undo)"
                        >
                            <Undo2 size={16} />
                        </button>
                        <div className="w-px h-4 bg-border mx-1"></div>
                        <button
                            onClick={handleConfirm}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                            title="確定 (Confirm)"
                        >
                            <Check size={14} /> 確定
                        </button>
                    </div>
                )}

                {/* Editing Save/Cancel */}
                {isEditing && (
                    <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-4 duration-200">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                            title="キャンセル"
                        >
                            <X size={16} />
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                            title="保存"
                        >
                            <Check size={14} /> 保存
                        </button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="flex-1 overflow-hidden p-0 relative">
                    <textarea
                        value={localStructure}
                        onChange={(e) => setLocalStructure(e.target.value)}
                        className="w-full h-full p-6 text-sm font-mono text-foreground bg-background border-none outline-none resize-none leading-relaxed"
                        placeholder="Markdown形式で構成を入力..."
                        onBlur={() => setIsEditing(false)}
                        autoFocus
                    />
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <div
                        className="p-6 min-h-full cursor-text group"
                        onClick={handlePreviewClick}
                    >
                        {structure ? (
                            hasDiff ? (
                                <div
                                    className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: diffHtml }}
                                />
                            ) : (
                                <article className="prose prose-zinc prose-sm dark:prose-invert max-w-none group-hover:bg-accent/10 transition-colors p-2 -m-2 rounded-md">
                                    <ReactMarkdown>{structure}</ReactMarkdown>
                                </article>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg">
                                <p className="text-sm">構成案がここに表示されます</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}
