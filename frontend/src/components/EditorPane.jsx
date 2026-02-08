import React, { useState, useRef } from 'react'
import useStore from '../store'
import { Sparkles, Wand2, Copy, Check } from 'lucide-react'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'

export default function EditorPane() {
    const { structure, prose, updateProse } = useStore()
    const [format, setFormat] = useState('Plain')
    const [instruction, setInstruction] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isRefining, setIsRefining] = useState(false)
    const [copied, setCopied] = useState(false)

    const [selection, setSelection] = useState({ start: 0, end: 0 })
    const [selectionMenu, setSelectionMenu] = useState({ show: false, x: 0, y: 0 })
    const textareaRef = useRef(null)
    const inputRef = useRef(null)

    const [showHighlight, setShowHighlight] = useState(false)
    const highlightRef = useRef(null)

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
        setIsGenerating(true)
        let fullProse = ''

        await fetchSSE('/api/prose/generate', {
            method: 'POST',
            body: JSON.stringify({ structure, format })
        }, (data) => {
            fullProse += data.content
            updateProse(fullProse)
        }, () => {
            setIsGenerating(false)
        })
    }

    const handleRefine = async () => {
        if (!prose || !instruction) return
        setIsRefining(true)

        try {
            const response = await fetch('/api/prose/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_text: prose,
                    instruction: instruction,
                    selected_start: selection.start,
                    selected_end: selection.end
                })
            })
            const data = await response.json()
            updateProse(data.refined_content)
            setInstruction('')
            setSelectionMenu({ ...selectionMenu, show: false })
            setShowHighlight(false) // Clear highlight after sending
        } catch (err) {
            console.error('Refine failed', err)
        } finally {
            setIsRefining(false)
        }
    }

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
            const rect = textareaRef.current.getBoundingClientRect()
            // paneのrect
            const paneRect = e.currentTarget.closest('.pane').getBoundingClientRect()

            setSelectionMenu({
                show: true,
                x: e.clientX - paneRect.left,
                y: e.clientY - paneRect.top + 10 // 少し下にずらす
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

    // Determine the content parts for the overlay
    const beforeHighlight = prose ? prose.substring(0, selection.start) : ''
    const highlightedText = prose ? prose.substring(selection.start, selection.end) : ''
    const afterHighlight = prose ? prose.substring(selection.end) : ''

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
                    <button
                        onClick={handleCopy}
                        disabled={!prose}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-30"
                        title="コピー"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!structure || isGenerating}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Sparkles size={14} />
                        {isGenerating ? '生成中...' : '構成から生成'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
                {prose ? (
                    <ScrollArea className="flex-1">
                        <div className="max-w-3xl mx-auto w-full p-8 min-h-full relative">
                            {/* Highlight Overlay */}
                            {showHighlight && (
                                <div
                                    className="absolute inset-0 p-0 pointer-events-none whitespace-pre-wrap text-lg leading-relaxed font-serif text-transparent"
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
                                onChange={(e) => updateProse(e.target.value)}
                                onSelect={handleSelect}
                                onMouseUp={handleMouseUp}
                                onFocus={handleTextAreaFocus}
                                className="w-full h-full min-h-[calc(100vh-200px)] p-0 border-none focus:ring-0 resize-none bg-transparent outline-none text-foreground text-lg leading-relaxed font-serif transition-colors relative z-10"
                                spellCheck="false"
                                placeholder="ここに文章が生成されます..."
                            />
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

                {/* Selection Menu Popup */}
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
