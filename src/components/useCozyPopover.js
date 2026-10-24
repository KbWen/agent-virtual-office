import { useEffect, useRef } from 'react'

// These panels are deliberately non-modal: attention and footer controls stay operable.
export const cozyPopoverClass = 'fixed right-3 bottom-[100px] z-[80] max-h-[calc(100dvh-180px)] overflow-y-auto rounded-2xl border border-stone-300 bg-[#FFF9ED] p-4 text-stone-700 shadow-xl dark:border-stone-600 dark:bg-[#302C28] dark:text-stone-100'
export const cozyButtonClass = 'rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-stone-600 dark:hover:bg-stone-700'

export function useCozyPopover(onClose) {
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    const onKey = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  return closeRef
}
