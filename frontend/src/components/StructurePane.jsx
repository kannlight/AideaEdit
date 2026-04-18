import React, { useState, useEffect, useRef, useMemo } from 'react'
import useStore from '../store'
import ReactMarkdown from 'react-markdown'
import { Check, Undo2, RefreshCw } from 'lucide-react'
import DiffMatchPatch from 'diff-match-patch'
import { fetchSSE } from '../utils/sse'
import ScrollArea from './ui/ScrollArea'

const markdownComponents = {
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
}

const computeLineDiffs = (prevText, currText) => {
    const dmp = new DiffMatchPatch()
    const lineArray = ['']
    const lineHash = {}

    const linesToChars = (text) => {
        return (text || '').split('\n').map(line => {
            if (!(line in lineHash)) {
                lineHash[line] = String.fromCodePoint(lineArray.length)
                lineArray.push(line)
            }
            return lineHash[line]
        }).join('')
    }

    const diffs = dmp.diff_main(linesToChars(prevText), linesToChars(currText), false)

    return diffs.map(([op, chars]) => ({
        op,
        lines: [...chars].map(c => lineArray[c.codePointAt(0)])
    }))
}

export default function StructurePane() {
    const {
        structure,
        prevStructure,
        updateStructure,
        memos,
        startStructureGeneration,
        endStructureGeneration,
        updateStructureStream,
        revertStructure,
        confirmStructure,
        activeServiceId,
        isGeneratingStructure,
    } = useStore()

    // lines は structure から常に同期的に派生させる（useEffect による遅延なし）
    const lines = useMemo(() => structure ? structure.split('\n') : [], [structure])

    const [editingIndex, setEditingIndex] = useState(null)
    const [editingValue, setEditingValue] = useState('')
    const [isDiffMode, setIsDiffMode] = useState(false)
    const inputRefs = useRef({})
    const prevIsGenerating = useRef(false)

    useEffect(() => {
        if (editingIndex !== null && inputRefs.current[editingIndex]) {
            inputRefs.current[editingIndex].focus()
        }
    }, [editingIndex])

    // 生成開始でdiffモードに入り、生成完了時に差分がなければ自動で抜ける
    useEffect(() => {
        if (!prevIsGenerating.current && isGeneratingStructure) {
            setIsDiffMode(true)
        } else if (prevIsGenerating.current && !isGeneratingStructure) {
            const hasDiff = prevStructure && structure && prevStructure !== structure
            if (!hasDiff) {
                setIsDiffMode(false)
            }
        }
        prevIsGenerating.current = isGeneratingStructure
    }, [isGeneratingStructure, prevStructure, structure])

    const lineDiffs = useMemo(() => {
        if (!isDiffMode) return []
        return computeLineDiffs(prevStructure, structure)
    }, [isDiffMode, prevStructure, structure])

    const renderedItems = useMemo(() => {
        if (!isDiffMode) return []
        const items = []
        let structureLineIndex = 0
        for (const { op, lines: diffLines } of lineDiffs) {
            for (const text of diffLines) {
                if (op === -1) {
                    items.push({ type: 'deleted', text, key: `del-${items.length}` })
                } else {
                    items.push({
                        type: op === 1 ? 'added' : 'unchanged',
                        lineIndex: structureLineIndex,
                        key: `line-${structureLineIndex}`
                    })
                    structureLineIndex++
                }
            }
        }
        return items
    }, [isDiffMode, lineDiffs])

    const pendingMemo = memos.findLast(m => m.status === 'PENDING')

    const syncToStore = (newLines) => {
        updateStructure(newLines.join('\n'))
    }

    const startEditing = (index) => {
        setEditingIndex(index)
        setEditingValue(lines[index] ?? '')
    }

    // 現在の編集をストアに保存しつつ別の行に移動する
    const commitAndMove = (newLines, newIndex) => {
        syncToStore(newLines)
        setEditingIndex(newIndex)
        setEditingValue(newLines[newIndex] ?? '')
    }

    const handleLineChange = (value) => {
        setEditingValue(value)
    }

    const handleKeyDown = (e, index) => {
        if (e.nativeEvent.isComposing) return

        if (e.key === 'Enter') {
            e.preventDefault()
            const newLines = [...lines]
            newLines[index] = editingValue
            newLines.splice(index + 1, 0, '')
            commitAndMove(newLines, index + 1)
        } else if (e.key === 'Backspace') {
            if (editingValue === '' && lines.length > 1) {
                e.preventDefault()
                const newLines = [...lines]
                newLines.splice(index, 1)
                commitAndMove(newLines, Math.max(0, index - 1))
            } else if (e.target.selectionStart === 0 && e.target.selectionEnd === 0 && index > 0) {
                e.preventDefault()
                const newLines = [...lines]
                const mergedLine = newLines[index - 1] + editingValue
                newLines[index - 1] = mergedLine
                newLines.splice(index, 1)
                syncToStore(newLines)
                setEditingIndex(index - 1)
                setEditingValue(mergedLine)
            }
        } else if (e.key === 'Tab') {
            e.preventDefault()
            const newValue = e.shiftKey
                ? editingValue.replace(/^  /, '')
                : '  ' + editingValue
            setEditingValue(newValue)
            const newLines = [...lines]
            newLines[index] = newValue
            syncToStore(newLines)
        } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
            if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey || e.altKey)) return
            if (index > 0) {
                e.preventDefault()
                const newLines = [...lines]
                newLines[index] = editingValue
                commitAndMove(newLines, index - 1)
            }
        } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
            if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey || e.altKey)) return
            if (index < lines.length - 1) {
                e.preventDefault()
                const newLines = [...lines]
                newLines[index] = editingValue
                commitAndMove(newLines, index + 1)
            }
        }
    }

    const handleBlur = () => {
        if (editingIndex !== null) {
            const newLines = [...lines]
            newLines[editingIndex] = editingValue
            syncToStore(newLines)
        }
        setEditingIndex(null)
        setEditingValue('')
    }

    const handleConfirm = () => {
        confirmStructure()
        setIsDiffMode(false)
    }

    const handleUndo = () => {
        revertStructure()
        setIsDiffMode(false)
    }

    const handleReload = async () => {
        if (!pendingMemo) return
        let fullStructure = ''
        startStructureGeneration(prevStructure)
        await fetchSSE('/api/structure/update', {
            method: 'POST',
            body: JSON.stringify({
                current_structure: prevStructure,
                new_memo: pendingMemo,
                service_id: activeServiceId
            })
        }, (data) => {
            fullStructure += data.content
            updateStructureStream(fullStructure)
        }, () => {
            endStructureGeneration()
        })
    }

    const renderLineView = (line, index, isAdded = false) => (
        <div
            key={index}
            className={`min-h-[1.5em] relative group ${isAdded ? 'bg-green-500/10 rounded' : ''}`}
            onClick={() => startEditing(index)}
        >
            {editingIndex === index ? (
                <input
                    ref={el => inputRefs.current[index] = el}
                    value={editingValue}
                    onChange={(e) => handleLineChange(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onBlur={handleBlur}
                    className={`w-full outline-none font-mono text-sm py-1 px-2 rounded -ml-2 ${isAdded ? 'bg-green-500/20' : 'bg-accent/20'}`}
                    autoFocus
                />
            ) : (
                <div className={`group/line py-0.5 relative hover:bg-accent/10 rounded cursor-text transition-colors min-h-[1.5em] -ml-2 pl-2 ${isAdded ? 'text-green-700 dark:text-green-300' : ''}`}>
                    <div
                        style={{ paddingLeft: `${(line.match(/^ */)?.[0].length || 0) * 0.6}em` }}
                        className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    >
                        {line.trim() === '' ? (
                            <span className="text-muted-foreground/30 italic text-sm">&nbsp;</span>
                        ) : (
                            <ReactMarkdown components={markdownComponents}>
                                {line.trim()}
                            </ReactMarkdown>
                        )}
                    </div>
                </div>
            )}
        </div>
    )

    return (
        <div className="pane bg-background flex flex-col h-full border-r border-border/50">
            <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10 shrink-0 flex justify-between items-center h-[57px]">
                <h2 className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2">Structure Draft</h2>

                {isDiffMode && (
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
                    {isDiffMode ? (
                        <div className="flex flex-col gap-1">
                            {renderedItems.map(item => {
                                if (item.type === 'deleted') {
                                    return (
                                        <div
                                            key={item.key}
                                            className="line-through text-destructive opacity-60 text-sm py-0.5 px-2 -ml-2 bg-destructive/10 rounded select-none min-h-[1.5em]"
                                        >
                                            {item.text || '\u00A0'}
                                        </div>
                                    )
                                }
                                return renderLineView(lines[item.lineIndex], item.lineIndex, item.type === 'added')
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {lines.length > 0 ? lines.map((line, index) =>
                                renderLineView(line, index)
                            ) : (
                                <div
                                    className="flex flex-col items-center justify-center h-40 text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:bg-accent/5"
                                    onClick={() => {
                                        updateStructure('# New Structure')
                                        startEditing(0)
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
