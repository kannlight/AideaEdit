import React, { useState, useRef, useEffect } from 'react'
import useStore from '../store'
import { Sparkles, Wand2, Copy, Check, Undo2, RefreshCw, X, Pencil } from 'lucide-react'
import { useDiff } from '../hooks/useDiff'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'

export default function EditorPane() {
    const {
        structure,
        prose,
        prevProse,
        updateProse,
        startProseGeneration,
        endProseGeneration,
        revertProse,
        confirmProse,
        updatePrevProse,
        activeServiceId
    } = useStore()

    const [format, setFormat] = useState('Plain')
    const [instruction, setInstruction] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isRefining, setIsRefining] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isDiffMode, setIsDiffMode] = useState(false)

    const [selection, setSelection] = useState({ start: 0, end: 0 })
    const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0 })
    const [diffSelection, setDiffSelection] = useState(null) // { indices: Set<number>, x, y }
    const [editingChunk, setEditingChunk] = useState(null)   // { start, end, beforeText, editedText }

    const textareaRef = useRef(null)
    const inputRef = useRef(null)
    const [showHighlight, setShowHighlight] = useState(false)
    const contentRef = useRef(null)
    const lastGenerationRef = useRef(null)

    const { hasDiff, diffs } = useDiff(prose, prevProse)

    // ---- Generation handlers ----

    const handleGenerate = async () => {
        if (!structure) return
        lastGenerationRef.current = { type: 'create', args: { structure, format } }
        setIsGenerating(true)
        setIsDiffMode(true)
        startProseGeneration()
        let fullProse = ''
        await fetchSSE('/api/prose/generate', {
            method: 'POST',
            body: JSON.stringify({ structure, format, service_id: activeServiceId })
        }, (data) => {
            fullProse += data.content
            updateProse(fullProse, true)
        }, () => {
            setIsGenerating(false)
            endProseGeneration()
        })
    }

    const handleRefine = async () => {
        if (!prose || !instruction) return
        lastGenerationRef.current = {
            type: 'refine',
            args: {
                full_text: prose,
                instruction,
                selected_start: selection.start,
                selected_end: selection.end
            }
        }
        setIsRefining(true)
        setIsDiffMode(true)
        startProseGeneration()
        try {
            const response = await fetch('/api/prose/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_text: prose,
                    instruction,
                    selected_start: selection.start,
                    selected_end: selection.end,
                    service_id: activeServiceId
                })
            })
            const data = await response.json()
            updateProse(data.refined_content, true)
            setInstruction('')
            setSelectionMenu({ ...selectionMenu, show: false })
            setShowHighlight(false)
        } catch (err) {
            console.error('Refine failed', err)
        } finally {
            setIsRefining(false)
            endProseGeneration()
        }
    }

    const handleRetry = async () => {
        if (!lastGenerationRef.current) return
        // revertProse のみ呼ぶ（isDiffMode は維持したまま再生成）
        revertProse()
        setEditingChunk(null)
        const { type, args } = lastGenerationRef.current
        if (type === 'create') {
            setIsGenerating(true)
            startProseGeneration()
            let fullProse = ''
            await fetchSSE('/api/prose/generate', {
                method: 'POST',
                body: JSON.stringify({ structure: args.structure, format: args.format, service_id: activeServiceId })
            }, (data) => {
                fullProse += data.content
                updateProse(fullProse, true)
            }, () => {
                setIsGenerating(false)
                endProseGeneration()
            })
        } else if (type === 'refine') {
            setIsRefining(true)
            startProseGeneration()
            try {
                const response = await fetch('/api/prose/refine', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_text: args.full_text,
                        instruction: args.instruction,
                        selected_start: args.selected_start,
                        selected_end: args.selected_end,
                        service_id: activeServiceId
                    })
                })
                const data = await response.json()
                updateProse(data.refined_content, true)
            } catch (err) {
                console.error('Retry Refine failed', err)
            } finally {
                setIsRefining(false)
                endProseGeneration()
            }
        }
    }

    const handleUndo = () => {
        revertProse()
        setIsDiffMode(false)
        setEditingChunk(null)
        setDiffSelection(null)
    }

    const handleConfirm = () => {
        confirmProse()
        setIsDiffMode(false)
        setEditingChunk(null)
        setDiffSelection(null)
    }

    // ---- Partial diff logic ----

    const getSubstitutionPairs = (indices, currentDiffs) => {
        const newIndices = new Set(indices)
        indices.forEach(index => {
            const currentOp = currentDiffs[index][0]
            if (currentOp === -1) {
                const nextDiff = currentDiffs[index + 1]
                if (nextDiff && nextDiff[0] === 1) newIndices.add(index + 1)
            }
            if (currentOp === 1) {
                const prevDiff = currentDiffs[index - 1]
                if (prevDiff && prevDiff[0] === -1) newIndices.add(index - 1)
            }
        })
        return newIndices
    }

    const getSelectionPosition = (indices) => {
        if (!contentRef.current || indices.size === 0) return null
        let minTop = Infinity
        let maxRight = -Infinity
        indices.forEach(index => {
            const span = contentRef.current.querySelector(`[data-diff-index="${index}"]`)
            if (span) {
                const rect = span.getBoundingClientRect()
                if (rect.top < minTop) minTop = rect.top
                if (rect.right > maxRight) maxRight = rect.right
            }
        })
        if (minTop === Infinity) return null
        const containerRect = contentRef.current.getBoundingClientRect()
        return { x: maxRight - containerRect.left + 5, y: minTop - containerRect.top }
    }

    const handleDiffClick = (e, index) => {
        e.stopPropagation()
        const initialIndices = new Set([index])
        const expandedIndices = getSubstitutionPairs(initialIndices, diffs)
        const pos = getSelectionPosition(expandedIndices)
        if (pos) setDiffSelection({ indices: expandedIndices, x: pos.x, y: pos.y })
    }

    const handleDiffSelection = (e) => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
        const pane = e.currentTarget.closest('.pane')
        if (!pane) return
        const diffSpans = pane.querySelectorAll('[data-diff-index]')
        const selectedIndices = new Set()
        diffSpans.forEach(span => {
            if (sel.containsNode(span, true)) {
                const op = parseInt(span.getAttribute('data-diff-op'))
                if (op !== 0) selectedIndices.add(parseInt(span.getAttribute('data-diff-index')))
            }
        })
        if (selectedIndices.size > 0) {
            const expandedIndices = getSubstitutionPairs(selectedIndices, diffs)
            const pos = getSelectionPosition(expandedIndices)
            if (pos) setDiffSelection({ indices: expandedIndices, x: pos.x, y: pos.y })
        }
    }

    const handlePartialConfirm = () => {
        if (!diffSelection) return
        let newPrevProse = ''
        diffs.forEach((d, i) => {
            const [op, text] = d
            if (diffSelection.indices.has(i)) {
                if (op === 1) newPrevProse += text
            } else {
                if (op === 0 || op === -1) newPrevProse += text
            }
        })
        updatePrevProse(newPrevProse)
        setDiffSelection(null)
        window.getSelection()?.removeAllRanges()
    }

    const handlePartialReject = () => {
        if (!diffSelection) return
        let newProse = ''
        diffs.forEach((d, i) => {
            const [op, text] = d
            if (diffSelection.indices.has(i)) {
                if (op === -1) newProse += text
            } else {
                if (op === 0 || op === 1) newProse += text
            }
        })
        updateProse(newProse, true)
        setDiffSelection(null)
        window.getSelection()?.removeAllRanges()
    }

    // ---- Chunk editing ----

    // diffSelection内のop=1チャンクのproseオフセットを計算してポップアップを開く
    const handleEditChunk = () => {
        if (!diffSelection) return
        let proseOffset = 0
        let insertStart = null
        let insertEnd = null
        let beforeText = ''
        let editedText = ''
        diffs.forEach(([op, text], i) => {
            if (diffSelection.indices.has(i)) {
                if (op === -1) {
                    beforeText += text
                } else if (op === 1) {
                    if (insertStart === null) insertStart = proseOffset
                    editedText += text
                    insertEnd = proseOffset + text.length
                }
            }
            if (op !== -1) proseOffset += text.length
        })
        if (insertStart === null) return  // op=1 がなければ開かない
        setEditingChunk({ start: insertStart, end: insertEnd, beforeText, editedText })
        setDiffSelection(null)
    }

    const handleEditingChunkChange = (newText) => {
        const { start, end } = editingChunk
        const newProse = prose.slice(0, start) + newText + prose.slice(end)
        updateProse(newProse, true)
        setEditingChunk(prev => ({ ...prev, editedText: newText, end: start + newText.length }))
    }

    // Editボタンを表示するか：選択中にop=1が含まれる場合のみ
    const selectionHasInsert = diffSelection &&
        [...diffSelection.indices].some(i => diffs[i]?.[0] === 1)

    // ---- Click outside handlers ----

    useEffect(() => {
        if (!diffSelection) return
        const handleClickOutside = (e) => {
            if (e.target.closest('[data-diff-action-menu]') || e.target.closest('[data-diff-index]')) return
            setDiffSelection(null)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [diffSelection])

    // ---- Text selection / highlight ----

    const beforeHighlight = prose ? prose.substring(0, selection.start) : ''
    const highlightedText = prose ? prose.substring(selection.start, selection.end) : ''
    const afterHighlight = prose ? prose.substring(selection.end) : ''

    const handleSelect = (e) => {
        const start = e.target.selectionStart
        const end = e.target.selectionEnd
        setSelection({ start, end })
        if (start === end) {
            setSelectionMenu({ ...selectionMenu, show: false })
            setShowHighlight(false)
        }
    }

    const handleMouseUp = (e) => {
        const start = textareaRef.current.selectionStart
        const end = textareaRef.current.selectionEnd
        if (start !== end) {
            const containerRect = contentRef.current.getBoundingClientRect()
            setSelectionMenu({
                show: true,
                x: e.clientX - containerRect.left,
                y: e.clientY - containerRect.top + 10
            })
        } else {
            setSelectionMenu({ ...selectionMenu, show: false })
        }
    }

    const focusInputForRefining = () => {
        if (inputRef.current) {
            inputRef.current.focus()
            setShowHighlight(true)
        }
    }

    const handleTextAreaFocus = () => {
        setShowHighlight(false)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(prose)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ---- Render ----

    return (
        <div className="pane bg-background flex flex-col h-full relative">
            {/* Header */}
            <div className="px-6 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10 shrink-0 flex justify-between items-center h-[57px]">
                <div className="flex items-center gap-4">
                    <h2 className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2">Final Prose</h2>
                    <div className="h-4 w-px bg-border"></div>
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="text-xs bg-muted/50 border border-input rounded shadow-sm px-2 py-1 outline-none focus:ring-1 focus:ring-ring text-foreground transition-all hover:bg-muted"
                    >
                        <option>Plain Text</option>
                        <option>Markdown</option>
                        <option>LaTeX</option>
                    </select>
                </div>
                <div className="flex gap-2 items-center">
                    {isDiffMode && (
                        <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-4 duration-300 mr-2">
                            <button
                                onClick={handleRetry}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                title="再生成"
                            >
                                <RefreshCw size={16} />
                            </button>
                            <button
                                onClick={handleUndo}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                title="取り消し"
                            >
                                <Undo2 size={16} />
                            </button>
                            <div className="w-px h-4 bg-border mx-1"></div>
                            <button
                                onClick={handleConfirm}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                                title="確定"
                            >
                                <Check size={14} /> 確定
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleCopy}
                        disabled={!prose}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-30"
                        title="コピー"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                    {!isDiffMode && (
                        <button
                            onClick={handleGenerate}
                            disabled={!structure || isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Sparkles size={14} />
                            {isGenerating ? '生成中...' : '構成から生成'}
                        </button>
                    )}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {prose ? (
                    <ScrollArea className="flex-1">
                        <div ref={contentRef} className="max-w-3xl mx-auto w-full p-8 min-h-full relative">
                            {hasDiff ? (
                                <>
                                    {/* 部分操作ポップオーバー */}
                                    {diffSelection && (
                                        <div
                                            data-diff-action-menu
                                            className="absolute z-50 animate-in fade-in zoom-in-95 duration-100 bg-popover border border-border rounded-lg shadow-lg p-1.5 flex gap-1"
                                            style={{ top: diffSelection.y, left: diffSelection.x }}
                                        >
                                            <button
                                                onClick={handlePartialConfirm}
                                                className="p-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-md transition-colors"
                                                title="選択した変更を確定"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={handlePartialReject}
                                                className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                                                title="選択した変更を取り消し"
                                            >
                                                <X size={16} />
                                            </button>
                                            {selectionHasInsert && (
                                                <button
                                                    onClick={handleEditChunk}
                                                    className="p-1.5 bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors"
                                                    title="この差分を編集"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {/* 差分スパン表示 */}
                                    <div
                                        className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-foreground"
                                        onMouseUp={handleDiffSelection}
                                    >
                                        {diffs.map(([op, text], index) => {
                                            const isDiff = op !== 0
                                            const isInsert = op === 1
                                            return (
                                                <span
                                                    key={index}
                                                    data-diff-index={index}
                                                    data-diff-op={op}
                                                    onClick={isDiff ? (e) => handleDiffClick(e, index) : undefined}
                                                    className={`
                                                        ${isDiff ? 'cursor-pointer px-1 rounded mx-0.5 transition-colors' : ''}
                                                        ${isInsert
                                                            ? 'bg-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/30'
                                                            : op === -1 ? 'bg-destructive/10 text-destructive line-through opacity-60 hover:bg-destructive/20 hover:opacity-100' : ''
                                                        }
                                                        ${diffSelection?.indices.has(index) ? 'ring-2 ring-primary ring-offset-1' : ''}
                                                    `}
                                                    title={isDiff ? (isInsert ? '追加箇所' : '削除箇所') : undefined}
                                                >
                                                    {text}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {showHighlight && (
                                        <div
                                            className="absolute inset-0 p-0 pointer-events-none whitespace-pre-wrap text-lg leading-relaxed font-sans text-transparent"
                                            style={{ top: 32, left: 32, right: 32, bottom: 32 }}
                                        >
                                            <span>{beforeHighlight}</span>
                                            <span className="bg-primary/20">{highlightedText}</span>
                                            <span>{afterHighlight}</span>
                                        </div>
                                    )}
                                    <textarea
                                        ref={textareaRef}
                                        value={prose}
                                        onChange={(e) => updateProse(e.target.value)}
                                        onSelect={handleSelect}
                                        onMouseUp={handleMouseUp}
                                        onFocus={handleTextAreaFocus}
                                        className="w-full h-full min-h-[calc(100vh-200px)] p-0 border-none focus:ring-0 resize-none bg-transparent outline-none text-foreground text-lg leading-relaxed font-sans transition-colors relative z-10"
                                        spellCheck="false"
                                        placeholder="ここに文章が生成されます..."
                                    />
                                </>
                            )}

                            {/* テキスト選択後の修正メニュー */}
                            {selectionMenu.show && (
                                <div
                                    className="absolute z-50 animate-in fade-in zoom-in-95 duration-100"
                                    style={{ top: selectionMenu.y, left: selectionMenu.x }}
                                >
                                    <button
                                        onClick={focusInputForRefining}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-lg hover:scale-105 transition-transform"
                                    >
                                        <Sparkles size={12} />
                                        この部分を修正
                                    </button>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-muted-foreground/40">
                        <div className="p-4 bg-muted/30 rounded-full mb-4">
                            <Wand2 size={32} />
                        </div>
                        <p className="text-sm font-medium">構成案を作成して「構成から生成」ボタンを押してください</p>
                    </div>
                )}
            </div>

            {/* 差分チャンク編集ボックス（右側に常駐） */}
            {editingChunk && (
                <div className="absolute top-[65px] right-4 w-72 z-40 bg-popover border border-border rounded-lg shadow-lg flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="flex justify-between items-center px-3 py-2 border-b border-border shrink-0">
                        <span className="text-xs text-muted-foreground">差分を編集</span>
                        <button
                            onClick={() => setEditingChunk(null)}
                            className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="p-3 flex flex-col gap-2 overflow-y-auto">
                        {editingChunk.beforeText && (
                            <p className="text-sm text-destructive line-through leading-relaxed select-none opacity-70 whitespace-pre-wrap">
                                {editingChunk.beforeText}
                            </p>
                        )}
                        <textarea
                            value={editingChunk.editedText}
                            onChange={(e) => handleEditingChunkChange(e.target.value)}
                            className="w-full text-sm text-foreground bg-transparent outline-none resize-none leading-relaxed min-h-[80px]"
                            autoFocus
                            spellCheck="false"
                        />
                    </div>
                </div>
            )}

            {/* 下部：修正指示入力 */}
            <div className="p-4 border-t border-border bg-background/95 backdrop-blur z-20">
                <div className="max-w-3xl mx-auto flex gap-2 relative">
                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleRefine()
                            }}
                            placeholder="AIに修正を依頼する (範囲選択をすれば修正箇所を指定可能です)"
                            className="w-full pl-4 pr-12 py-2.5 text-sm bg-muted/40 text-foreground border border-input rounded-full focus:bg-background focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all shadow-sm"
                        />
                        <div className="absolute right-1.5 top-1.5">
                            <button
                                onClick={handleRefine}
                                disabled={!prose || !instruction || isRefining}
                                className="p-1.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-all"
                            >
                                <Sparkles size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
