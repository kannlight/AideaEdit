import { useState, useEffect } from 'react'
import DiffMatchPatch from 'diff-match-patch'

export const useDiff = (currentText, previousText) => {
    const [diffHtml, setDiffHtml] = useState('')
    const [diffs, setDiffs] = useState([])
    const hasDiff = previousText && currentText && previousText !== currentText

    useEffect(() => {
        if (hasDiff) {
            const dmp = new DiffMatchPatch()
            const diffsResult = dmp.diff_main(previousText, currentText)
            dmp.diff_cleanupSemantic(diffsResult)

            setDiffs(diffsResult)

            const html = diffsResult.map(([op, text]) => {
                const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                if (op === 1) { // Insert
                    return `<span class="bg-green-500/20 text-green-700 dark:text-green-300 px-1 rounded mx-0.5">${safeText}</span>`
                } else if (op === -1) { // Delete
                    return `<span class="bg-destructive/10 text-destructive px-1 rounded line-through opacity-60 text-xs mx-0.5">${safeText}</span>`
                }
                return safeText
            }).join('')

            setDiffHtml(html)
        } else {
            setDiffHtml('')
            setDiffs([])
        }
    }, [currentText, previousText, hasDiff])

    return { diffHtml, hasDiff, diffs }
}

export default useDiff
