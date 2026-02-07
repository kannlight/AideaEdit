import React, { useState, useEffect } from 'react'
import useStore from '../store'
import ReactMarkdown from 'react-markdown'
import { Check, X, Edit3 } from 'lucide-react'

export default function StructurePane() {
    const { structure, updateStructure } = useStore()
    const [isEditing, setIsEditing] = useState(false)
    const [localStructure, setLocalStructure] = useState(structure)

    useEffect(() => {
        if (!isEditing) {
            setLocalStructure(structure)
        }
    }, [structure, isEditing])

    const handleSave = () => {
        updateStructure(localStructure)
        setIsEditing(false)
    }

    return (
        <div className="pane bg-white">
            <div className="p-4 border-b border-border flex justify-between items-center bg-white sticky top-0 z-10">
                <h2 className="font-semibold text-gray-700">Structure Draft</h2>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`p-1.5 rounded-md transition-colors ${isEditing ? 'text-primary bg-primary/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    <Edit3 size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isEditing ? (
                    <div className="flex flex-col h-full gap-3">
                        <textarea
                            value={localStructure}
                            onChange={(e) => setLocalStructure(e.target.value)}
                            className="flex-1 p-3 text-sm font-mono border border-border rounded-md focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                            placeholder="Markdown形式で構成を入力..."
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-white text-sm font-medium rounded-md"
                            >
                                <Check size={16} /> 保存
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 border border-border rounded-md"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-sm max-w-none">
                        {structure ? (
                            <ReactMarkdown>{structure}</ReactMarkdown>
                        ) : (
                            <div className="text-gray-400 italic text-center py-10">構成案がここに表示されます</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
