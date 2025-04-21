import { useEffect, useRef, useState } from "react"

export const useChatScroll = () => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const observer = new MutationObserver(() => {
      if (shouldAutoScroll) {
        requestAnimationFrame(() => {
          if (shouldAutoScroll) {
            element.scrollTop = element.scrollHeight
          }
        })
      }
    })

    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    if (shouldAutoScroll) {
      requestAnimationFrame(() => {
        if (shouldAutoScroll) {
          element.scrollTop = element.scrollHeight
        }
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [shouldAutoScroll])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 5
    const manualScrollThreshold = 50
    const isManuallyScrolledUp = element.scrollHeight - element.scrollTop - element.clientHeight > manualScrollThreshold

    if (isManuallyScrolledUp) {
      if (shouldAutoScroll) setShouldAutoScroll(false)
    } else if (isAtBottom) {
      if (!shouldAutoScroll) setShouldAutoScroll(true)
    }
  }

  return {
    handleScroll,
    scrollRef,
    setShouldAutoScroll,
    shouldAutoScroll,
  }
}
