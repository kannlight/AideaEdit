import React, { useRef, useState, useEffect } from 'react'

export default function ScrollArea({ children, className = '' }) {
    const scrollRef = useRef(null)
    const [canScrollTop, setCanScrollTop] = useState(false)
    const [canScrollBottom, setCanScrollBottom] = useState(false)

    const checkScroll = () => {
        const el = scrollRef.current
        if (!el) return
        const { scrollTop, scrollHeight, clientHeight } = el
        setCanScrollTop(scrollTop > 0)
        // 1pxの遊びを持たせる
        setCanScrollBottom(scrollTop + clientHeight < scrollHeight - 1)
    }

    useEffect(() => {
        checkScroll()
        window.addEventListener('resize', checkScroll)
        return () => window.removeEventListener('resize', checkScroll)
    }, [children])

    return (
        <div className={`relative flex-1 overflow-hidden flex flex-col ${className}`}>
            {/* Top Fade */}
            <div
                className={`absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollTop ? 'opacity-100' : 'opacity-0'
                    }`}
            />

            <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex-1 overflow-y-auto custom-scrollbar"
            >
                {children}
            </div>

            {/* Bottom Fade */}
            <div
                className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none transition-opacity duration-300 ${canScrollBottom ? 'opacity-100' : 'opacity-0'
                    }`}
            />
        </div>
    )
}
