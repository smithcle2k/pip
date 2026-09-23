import { useEffect } from 'react'

/** Refresh teacher views when the window regains focus or the tab becomes visible. */
export function useRefreshOnReturn(refresh: () => void) {
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', refresh) }
  }, [refresh])
}
