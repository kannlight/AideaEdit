import React, { useState, useRef, useEffect } from 'react'
import useStore from '../store'
import { Sparkles, Wand2, Copy, Check, Undo2, RefreshCw, X } from 'lucide-react'
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

    const [selection, setSelection] = useState({ start: 0, end: 0 })
    const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0 })

    // Partial Diff Logic
    const [diffSelection, setDiffSelection] = useState(null) // { indices: Set<number>, x, y }

    const textareaRef = useRef(null)
    const inputRef = useRef(null)

    const [showHighlight, setShowHighlight] = useState(false)
    const highlightRef = useRef(null)
    const contentRef = useRef(null)
    const lastGenerationRef = useRef(null) // Stores context for retry: { type: 'create' | 'refine', args: {} }

    const { diffHtml, hasDiff, diffs } = useDiff(prose, prevProse)

    // Scroll synchronization is not needed if check Overlay is inside the same scroll container
    // However, if textarea scrolls independently, we need it. 
    // In this code, textarea is inside ScrollArea -> div relative. 
    // If text is long, the div grows? 
    // ScrollArea usually limits height and scrolls content.
    // So the 'div' inside ScrollArea scrolls? 
    // Textarea has h-full. 
    // Let's assume the div grows and ScrollArea scrolls the div.
    // In that case, absolute overlay on the div will move with it.

    const handleGenerate = async () => {
        if (!structure) return

        lastGenerationRef.current = { type: 'create', args: { structure, format } }

        setIsGenerating(true)
        startProseGeneration() // Snapshot current prose
        let fullProse = ''

        await fetchSSE('/api/prose/generate', {
            method: 'POST',
            body: JSON.stringify({ structure, format, service_id: activeServiceId })
        }, (data) => {
            fullProse += data.content
            updateProse(fullProse, true) // isAuto = true
        }, () => {
            setIsGenerating(false)
            endProseGeneration()
        })
    }

    const handleRefine = async () => {
        if (!prose || !instruction) return

        // Ensure we capture parameters relative to the *current* state (which will become prevProse)
        lastGenerationRef.current = {
            type: 'refine',
            args: {
                full_text: prose, // This will be prevProse after startProseGeneration? No, start snapshots it.
                // Actually, if we retry, we revert. So 'prose' becomes what it was.
                // So storing 'prose' here is correct for the initial call.
                // For retry, we need to re-use this context.
                instruction,
                selected_start: selection.start,
                selected_end: selection.end
            }
        }

        setIsRefining(true)
        startProseGeneration()

        try {
            const response = await fetch('/api/prose/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_text: prose,
                    instruction: instruction,
                    selected_start: selection.start,
                    selected_end: selection.end,
                    service_id: activeServiceId
                })
            })
            const data = await response.json()
            updateProse(data.refined_content, true) // isAuto = true
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

    const getSubstitutionPairs = (indices, currentDiffs) => {
        const newIndices = new Set(indices)

        // Loop through all selected indices to find pairs
        indices.forEach(index => {
            const currentOp = currentDiffs[index][0]

            // If current is Delete (-1), look for next Insert (1)
            if (currentOp === -1) {
                const nextDiff = currentDiffs[index + 1]
                if (nextDiff && nextDiff[0] === 1) {
                    newIndices.add(index + 1)
                }
            }

            // If current is Insert (1), look for prev Delete (-1)
            if (currentOp === 1) {
                const prevDiff = currentDiffs[index - 1]
                if (prevDiff && prevDiff[0] === -1) {
                    newIndices.add(index - 1)
                }
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

        return {
            x: maxRight - containerRect.left + 5,
            y: minTop - containerRect.top
        }
    }

    const handleDiffClick = (e, index) => {
        e.stopPropagation()
        // Determine position relative to the scrollable container (parent of spans' wrapper)
        // Spans are in the div with handleDiffSelection. Its parent is the .relative container (p-8).
        const container = e.currentTarget.closest('.relative')
        if (!container) return

        // Check for substitution pairs
        const initialIndices = new Set([index])
        const expandedIndices = getSubstitutionPairs(initialIndices, diffs)

        const pos = getSelectionPosition(expandedIndices)
        if (pos) {
            setDiffSelection({
                indices: expandedIndices,
                x: pos.x,
                y: pos.y
            })
        }
    }

    const handleDiffSelection = (e) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

        const range = selection.getRangeAt(0)
        const pane = e.currentTarget.closest('.pane')
        if (!pane) return

        const diffSpans = pane.querySelectorAll('[data-diff-index]')
        const selectedIndices = new Set()

        // Find all diff spans that intersect with the selection
        diffSpans.forEach(span => {
            if (selection.containsNode(span, true)) {
                // Check if it's actually a diff (indices are on all spans, even equal ones?)
                // Our implementation adds data-diff-index to ONLY diff spans (colorized ones) or all?
                // Logic below renders all with data-diff-index.
                // We only care about diffs (op !== 0).
                const op = parseInt(span.getAttribute('data-diff-op'))
                if (op !== 0) {
                    selectedIndices.add(parseInt(span.getAttribute('data-diff-index')))
                }
            }
        })

        if (selectedIndices.size > 0) {
            // Expand selection to include substitution pairs
            const expandedIndices = getSubstitutionPairs(selectedIndices, diffs)

            const pos = getSelectionPosition(expandedIndices)

            if (pos) {
                setDiffSelection({
                    indices: expandedIndices,
                    x: pos.x,
                    y: pos.y
                })
            }

            // Clear browser selection slightly to avoid UI clutter? 
            // Or keep it to show what is selected? Better keep it.
        } else {
            // If clicked but no diffs selected (e.g. only normal text selected), do nothing or clear?
            // Existing click handler handles click.
            // This is for range selection.
        }
    }

    const handlePartialConfirm = () => {
        if (!diffSelection) return

        let newPrevProse = ''
        diffs.forEach((d, i) => {
            const [op, text] = d

            // If this chunk is in the selection...
            if (diffSelection.indices.has(i)) {
                if (op === 1) { // Confirm Insertion: Add to prevProse
                    newPrevProse += text
                }
                // If op === -1: Confirm Deletion: Skip adding to prevProse
            } else {
                // Not selected. Keep history (prevProse) structure.
                // But wait. 'prevProse' structure depends on whether the chunk WAS in it.
                // If op === 0: In prevProse. Add.
                // If op === 1: Inserted. Not in prevProse. Skip.
                // If op === -1: Deleted. Was in prevProse. Add.

                if (op === 0 || op === -1) {
                    newPrevProse += text
                }
            }
        })

        updatePrevProse(newPrevProse)
        setDiffSelection(null)
        window.getSelection()?.removeAllRanges() // Clear selection
    }

    const handlePartialReject = () => {
        if (!diffSelection) return

        let newProse = ''
        diffs.forEach((d, i) => {
            const [op, text] = d

            if (diffSelection.indices.has(i)) {
                if (op === -1) { // Reject Deletion: Add back to prose
                    newProse += text
                }
                // If op === 1: Reject Insertion: Skip adding to prose
            } else {
                // Not selected. Keep current prose structure.
                if (op === 0 || op === 1) {
                    newProse += text
                }
            }
        })

        updateProse(newProse, true)
        setDiffSelection(null)
        window.getSelection()?.removeAllRanges() // Clear selection
    }

    useEffect(() => {
        if (!diffSelection) return

        const handleClickOutside = (e) => {
            // Ignore clicks inside the popover or on diff spans
            if (e.target.closest('[data-diff-action-menu]') || e.target.closest('[data-diff-index]')) return
            setDiffSelection(null)
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [diffSelection])

    // Determine the content parts for the overlay
    const beforeHighlight = prose ? prose.substring(0, selection.start) : ''
    const highlightedText = prose ? prose.substring(selection.start, selection.end) : ''
    const afterHighlight = prose ? prose.substring(selection.end) : ''

    const handleSelect = (e) => {
        const start = e.target.selectionStart
        const end = e.target.selectionEnd
        setSelection({ start, end })

        // If user manually selects, we accept that as the new selection
        // If they are just clicking around, highlight should probably clear if it was showing?
        // Current requirement: "highlight until instruction sent or cursor moves"
        // If cursor moves (selection changes), we might want to keep highlight IF it's the SAME selection?
        // But usually cursor move means new selection/caret.
        // So we should probably clear showHighlight if the user interacts with the textarea.
        // HOWEVER, handleSelect is called simply when selection changes. 
        // If we want to persist the highlight WHILE typing in the input, we must NOT clear it here.
        // But we DO want to clear it if the user clicks back into the textarea and moves the cursor.
        // We can use onMouseDown or onFocus on the textarea to clear it?

        if (start !== end) {
            // Logic for menu position...
        } else {
            setSelectionMenu({ ...selectionMenu, show: false })
            // If selection is cleared (cursor click), also clear highlight
            setShowHighlight(false)
        }
    }

    // マウス操作での選択終了を検知してメニュー位置を決定
    const handleMouseUp = (e) => {
        const start = textareaRef.current.selectionStart
        const end = textareaRef.current.selectionEnd

        if (start !== end) {
            // マウスカーソルの位置に表示
            const containerRect = contentRef.current.getBoundingClientRect()

            setSelectionMenu({
                show: true,
                x: e.clientX - containerRect.left,
                y: e.clientY - containerRect.top + 10 // 少し下にずらす
            })
        } else {
            setSelectionMenu({ ...selectionMenu, show: false })
        }
    }

    const focusInputForRefining = () => {
        if (inputRef.current) {
            inputRef.current.focus()
            setShowHighlight(true) // Enable custom highlight
        }
    }

    const handleTextAreaFocus = () => {
        // If user focuses back on textarea, clear the custom highlight so native selection takes over (or valid cursor movement)
        setShowHighlight(false)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(prose)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleUndo = () => {
        revertProse()
    }

    const handleConfirm = () => {
        confirmProse()
    }

    const handleRetry = async () => {
        if (!lastGenerationRef.current) return

        handleUndo() // Revert first to restore original state

        // Wait for state update? In React batching, state updates might not be immediate for read, 
        // but since we dispatch the fetch in the same event loop (or async), we need to be careful.
        // Actually, 'revertProse' updates store. 'prose' variable in this scope is stale.
        // We should use the args stored in ref.

        const { type, args } = lastGenerationRef.current

        if (type === 'create') {
            // Re-run create
            // We need to re-trigger handleGenerate logic but bypass the 'if (!structure)' check if structure is in args
            // But handleGenerate uses state 'structure'. 
            // args.structure should be correct.

            setIsGenerating(true)
            startProseGeneration() // Snapshot (effectively prev=prev)
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
                // For refine, args.full_text was the text BEFORE the *last* refinement.
                // Since we reverted, 'prose' in store is now that text.
                // We use args.full_text to be safe.

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
                // Note: instruction is already cleared in UI, but we don't need to restore it to input
            } catch (err) {
                console.error('Retry Refine failed', err)
            } finally {
                setIsRefining(false)
                endProseGeneration()
            }
        }
    }

    // Actually I can't update store without tool call.
    // I will use a trick: 
    // If I want to update prevProse, I can calculate the new prevProse AND new structure? No.
    // I MUST ADD updatePrevProse to store. 

    // RE-PLAN: I will add 'updatePrevProse' to store.js in the next step or right now if possible?
    // I can't do two files in one step properly if functionality depends on it.
    // But wait, the previous plan didn't explicitly say "add updatePrevProse". 
    // It said "handlePartialConfirm updating prevProse".

    // Let's implement the logic assuming the function exists, then I will add it to store.js.
    // Or I can pause and add it to store.js now.

    // Let's do store.js modification in a separate turn? 
    // No, I can do multi_replace on store.js too? 
    // Yes, I can do multiple calls.

    // Wait, let's look at handlePartialReject.
    // Reject Insertion: Remove from 'prose'.
    // Reject Deletion: Add back to 'prose'.
    // behavior: updateProse(newProse, isAuto=true).
    // usage of isAuto=true keeps prevProse AS IS.
    // So 'prose' changes, 'prevProse' stays same. This effectively "Undo"s the diff.
    // Logic:
    // Insert (1) -> Reject -> Remove from prose. prevProse didn't have it. Result: Equal.
    // Delete (-1) -> Reject -> Add to prose. prevProse had it. Result: Equal.

    // So Rejecting CAN be done with existing `updateProse`.

    // Confirming REQUIRES updating `prevProse`.
    // Existing actions: `confirmProse` (all), `updateProse` (all or prose only).
    // `revertProse` (prose = prev).

    // I DO NOT have a way to update `prevProse` arbitrarily.
    // I must add `updatePrevProse` to store.js.

    // I will invoke the store update tool first in this turn? No, I am already committed to this tool call.
    // I will write the code here assuming `updatePrevProse` is passed from store.
    // And I will add it to `useStore` destructuring.
    // And I will update store.js in the next step.

    // Wait, let's keep it clean.
    // I'll render the UI first.


    return (
        <div className="pane bg-background flex flex-col h-full relative">
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
                    {/* Diff Actions */}
                    {hasDiff && (
                        <div className="flex gap-1 items-center animate-in fade-in slide-in-from-right-4 duration-300 mr-2">
                            <button
                                onClick={handleRetry}
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

                    <button
                        onClick={handleCopy}
                        disabled={!prose}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-30"
                        title="コピー"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                    {!hasDiff && (
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

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {prose ? (
                    <ScrollArea className="flex-1">
                        <div ref={contentRef} className="max-w-3xl mx-auto w-full p-8 min-h-full relative">
                            {hasDiff ? (
                                <>
                                    {diffSelection && (
                                        <div
                                            data-diff-action-menu
                                            className="absolute z-50 animate-in fade-in zoom-in-95 duration-100 bg-popover border border-border rounded-lg shadow-lg p-1.5 flex gap-1"
                                            style={{ top: diffSelection.y, left: diffSelection.x }}
                                        >
                                            <button
                                                onClick={handlePartialConfirm}
                                                className="p-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-md transition-colors"
                                                title="選択した変更を確定 (Confirm)"
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={handlePartialReject}
                                                className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors"
                                                title="選択した変更を取り消し (Undo)"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
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
                                                    title={isDiff ? (isInsert ? "クリックして操作: 追加箇所" : "クリックして操作: 削除箇所") : undefined}
                                                >
                                                    {text}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Highlight Overlay */}
                                    {showHighlight && (
                                        <div
                                            className="absolute inset-0 p-0 pointer-events-none whitespace-pre-wrap text-lg leading-relaxed font-sans text-transparent"
                                            style={{ top: 32, left: 32, right: 32, bottom: 32 }} // Match padding p-8 (32px)
                                        >
                                            <span>{beforeHighlight}</span>
                                            <span className="bg-primary/20">{highlightedText}</span>
                                            <span>{afterHighlight}</span>
                                        </div>
                                    )}

                                    <textarea
                                        ref={textareaRef}
                                        value={prose}
                                        onChange={(e) => updateProse(e.target.value)} // Manual edit -> isAuto = false (default)
                                        onSelect={handleSelect}
                                        onMouseUp={handleMouseUp}
                                        onFocus={handleTextAreaFocus}
                                        className="w-full h-full min-h-[calc(100vh-200px)] p-0 border-none focus:ring-0 resize-none bg-transparent outline-none text-foreground text-lg leading-relaxed font-sans transition-colors relative z-10"
                                        spellCheck="false"
                                        placeholder="ここに文章が生成されます..."
                                    />
                                </>
                            )}

                            {/* Selection Menu Popup for Refine */}
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

            <div className="p-4 border-t border-border bg-background/95 backdrop-blur z-20">
                <div className="max-w-3xl mx-auto flex gap-2 relative">
                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                    handleRefine()
                                }
                            }}
                            placeholder="AIに修正を依頼する (範囲選択をすれば修正箇所を指定可能です)"
                            className="w-full pl-4 pr-12 py-2.5 text-sm bg-muted/40 text-foreground border border-input rounded-full focus:bg-background focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all shadow-sm"
                        />
                        <div className="absolute right-1.5 top-1.5 ">
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
