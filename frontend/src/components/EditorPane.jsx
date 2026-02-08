import React, { useState } from 'react'
import useStore from '../store'
import { Sparkles, Wand2, Copy, Check } from 'lucide-react'
import { fetchSSE } from '../utils/sse'

export default function EditorPane() {
    const { structure, prose, updateProse } = useStore()
    const [format, setFormat] = useState('Plain')
    const [instruction, setInstruction] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isRefining, setIsRefining] = useState(false)
    const [copied, setCopied] = useState(false)

    const [selection, setSelection] = useState({ start: 0, end: 0 })

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
        } catch (err) {
            console.error('Refine failed', err)
        } finally {
            setIsRefining(false)
        }
    }

    const handleSelect = (e) => {
        setSelection({
            start: e.target.selectionStart,
            end: e.target.selectionEnd
        })
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(prose)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="pane bg-white dark:bg-card shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-foreground">Final Prose</h2>
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value)}
                        className="text-xs border border-border rounded px-2 py-1 outline-none bg-background text-foreground"
                    >
                        <option>Plain Text</option>
                        <option>Markdown</option>
                        <option>LaTeX</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleCopy}
                        disabled={!prose}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                        title="コピー"
                    >
                        {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!structure || isGenerating}
                        className="flex items-center gap-2 px-4 py-1.5 bg-accent text-accent-foreground text-sm font-medium rounded-md hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Sparkles size={16} />
                        {isGenerating ? '生成中...' : '構成から生成'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-8 max-w-3xl mx-auto w-full">
                {prose ? (
                    <textarea
                        value={prose}
                        onChange={(e) => updateProse(e.target.value)}
                        onSelect={handleSelect}
                        className="flex-1 w-full p-4 border-none focus:ring-0 whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground outline-none resize-none bg-transparent"
                        spellCheck="false"
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                        <Wand2 size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">ここに文章が生成されます</p>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-border bg-secondary/30">
                <div className="max-w-3xl mx-auto flex gap-2">
                    <input
                        type="text"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                        placeholder="文章をどのように修正しますか？ (例: もっと専門的な表現にして)"
                        className="flex-1 p-2.5 text-sm bg-background text-foreground border border-border rounded-md focus:ring-2 focus:ring-accent/20 outline-none shadow-inner"
                    />
                    <button
                        onClick={handleRefine}
                        disabled={!prose || !instruction || isRefining}
                        className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isRefining ? '修正中...' : '修正'}
                    </button>
                </div>
            </div>
        </div>
    )
}
