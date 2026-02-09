import React, { useState, useEffect, useRef } from 'react'
import useStore from '../store'
import ReactMarkdown from 'react-markdown'
import { Check, X, Undo2, RefreshCw } from 'lucide-react'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'
import { useDiff } from '../hooks/useDiff'

export default function StructurePane() {
    const {
        structure,
        prevStructure,
        updateStructure,
        memos,
        updateMemoStatus,
        startStructureGeneration,
        endStructureGeneration,
        updateStructureStream,
        revertStructure,
        confirmStructure
    } = useStore()

    // Local state for block-based editing
    const [lines, setLines] = useState([])
    const [editingIndex, setEditingIndex] = useState(null)
    const inputRefs = useRef({})

    // Initialize lines from structure
    useEffect(() => {
        if (structure) {
            setLines(structure.split('\n'))
        } else {
            setLines([])
        }
    }, [structure])

    // Focus management when editing index changes
    useEffect(() => {
        if (editingIndex !== null && inputRefs.current[editingIndex]) {
            inputRefs.current[editingIndex].focus()
        }
    }, [editingIndex])

    // useDiff hook implementation
    const { diffHtml, hasDiff } = useDiff(structure, prevStructure)

    // 最新のPENDINGメモを取得
    const pendingMemo = memos.findLast(m => m.status === 'PENDING')

    const syncToStore = (newLines) => {
        updateStructure(newLines.join('\n'))
    }

    const handleLineChange = (index, value) => {
        const newLines = [...lines]
        newLines[index] = value
        setLines(newLines)
        // Note: We don't sync to store on every keystroke to avoid perf issues, 
        // but for now let's sync on blur or explicit save.
        // Actually, for immediate feedback if we had other views, we might want to sync.
        // But here local state is king while editing.
    }

    const handleKeyDown = (e, index) => {
        // IME composition check
        if (e.nativeEvent.isComposing) {
            return
        }

        if (e.key === 'Enter') {
            e.preventDefault()
            const newLines = [...lines]
            const currentLine = newLines[index]

            // Split line at cursor position if possible (simplified here to just append new line)
            // Ideally we'd need cursor position. For now, let's just insert after.
            // If text selection is supported later, we can split.

            newLines.splice(index + 1, 0, '')
            setLines(newLines)
            setEditingIndex(index + 1)
            syncToStore(newLines)
        } else if (e.key === 'Backspace') {
            if (lines[index] === '' && lines.length > 1) {
                e.preventDefault()
                const newLines = [...lines]
                newLines.splice(index, 1)
                setLines(newLines)
                setEditingIndex(Math.max(0, index - 1))
                syncToStore(newLines)
            } else if (e.target.selectionStart === 0 && e.target.selectionEnd === 0 && index > 0) {
                // Merge with previous line
                e.preventDefault()
                const newLines = [...lines]
                const currentContent = newLines[index]
                const prevContent = newLines[index - 1]

                newLines[index - 1] = prevContent + currentContent
                newLines.splice(index, 1)
                setLines(newLines)
                setEditingIndex(index - 1)
                // TODO: Set cursor position needs more complex ref handling
                syncToStore(newLines)
            }
        } else if (e.key === 'Tab') {
            e.preventDefault()
            const newLines = [...lines]
            if (e.shiftKey) {
                // Outdent
                newLines[index] = newLines[index].replace(/^  /, '')
            } else {
                // Indent
                newLines[index] = '  ' + newLines[index]
            }
            setLines(newLines)
            syncToStore(newLines)
        } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
            // Allow default behavior if modifiers are pressed with ArrowUp (e.g. Cmd+Up, Alt+Up)
            // But intercept Ctrl+P explicitly
            if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey || e.altKey)) {
                return
            }

            if (index > 0) {
                e.preventDefault()
                setEditingIndex(index - 1)
            }
        } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
            // Allow default behavior if modifiers are pressed with ArrowDown (e.g. Cmd+Down, Alt+Down)
            // But intercept Ctrl+N explicitly
            if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey || e.altKey)) {
                return
            }

            if (index < lines.length - 1) {
                e.preventDefault()
                setEditingIndex(index + 1)
            }
        }
    }

    const handleBlur = () => {
        // When blurring, we save. 
        // But we need to be careful not to close edit mode if we just clicked another input.
        // The simple way is: onBlur simply syncs.
        syncToStore(lines)
        setEditingIndex(null)
    }

    // Handlers for Toolbar
    const handleConfirm = () => {
        confirmStructure()
    }

    const handleUndo = () => {
        revertStructure()
    }

    const handleReload = async () => {
        handleUndo() // Revert first

        if (pendingMemo) {
            updateMemoStatus(pendingMemo.id, 'PENDING') // Re-queue the pending memo

            let fullStructure = ''
            startStructureGeneration(prevStructure) // Use the *reverted* (original) structure as base
            await fetchSSE('/api/structure/update', {
                method: 'POST',
                body: JSON.stringify({
                    current_structure: prevStructure,
                    new_memo: pendingMemo
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

    return (
        <div className="pane bg-background flex flex-col h-full border-r border-border/50">
            <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10 shrink-0 flex justify-between items-center h-[57px]">
                <h2 className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2">Structure Draft</h2>

                {/* Action Buttons for Diff */}
                {hasDiff && (
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
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6 min-h-full">
                    {hasDiff ? (
                        <div
                            className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: diffHtml }}
                        />
                    ) : (
                        <div className="flex flex-col gap-1">
                            {lines.length > 0 ? lines.map((line, index) => (
                                <div
                                    key={index}
                                    className="min-h-[1.5em] relative group"
                                    onClick={() => setEditingIndex(index)}
                                >
                                    {editingIndex === index ? (
                                        <input
                                            ref={el => inputRefs.current[index] = el}
                                            value={line}
                                            onChange={(e) => handleLineChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, index)}
                                            onBlur={handleBlur}
                                            className="w-full bg-accent/20 outline-none font-mono text-sm py-1 px-2 rounded -ml-2"
                                            autoFocus
                                        />
                                    ) : (
                                        <div
                                            className="group/line py-0.5 relative hover:bg-accent/10 rounded cursor-text transition-colors min-h-[1.5em] -ml-2 pl-2"
                                        >
                                            {/* Render indentation as padding */}
                                            <div
                                                style={{ paddingLeft: `${(line.match(/^ */)?.[0].length || 0) * 0.6}em` }}
                                                className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                            >
                                                {line.trim() === '' ? (
                                                    <span className="text-muted-foreground/30 italic text-sm">&nbsp;</span>
                                                ) : (
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({ node, ...props }) => <p {...props} className="my-0 leading-relaxed" />,
                                                            ul: ({ node, ...props }) => <ul {...props} className="my-0 pl-4 list-disc marker:text-foreground/60" />,
                                                            ol: ({ node, ...props }) => <ol {...props} className="my-0 pl-4 list-decimal marker:text-foreground/60" />,
                                                            li: ({ node, ...props }) => <li {...props} className="my-0 pl-1" />,
                                                            h1: ({ node, ...props }) => <h1 {...props} className="text-lg font-bold mt-4 mb-2 first:mt-0" />,
                                                            h2: ({ node, ...props }) => <h2 {...props} className="text-base font-bold mt-3 mb-1.5" />,
                                                            h3: ({ node, ...props }) => <h3 {...props} className="text-sm font-bold mt-2 mb-1" />,
                                                            blockquote: ({ node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-2 my-1 italic text-muted-foreground" />,
                                                            code: ({ node, inline, ...props }) => (
                                                                <code {...props} className="bg-muted px-1 py-0.5 rounded text-xs font-mono" />
                                                            ),
                                                        }}
                                                    >
                                                        {line.trim()}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div
                                    className="flex flex-col items-center justify-center h-40 text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-accent/5"
                                    onClick={() => {
                                        setLines(['# New Structure'])
                                        setEditingIndex(0)
                                    }}
                                >
                                    <p className="text-sm">Click to start editing</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
