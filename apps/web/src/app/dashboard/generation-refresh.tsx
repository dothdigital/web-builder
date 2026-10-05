'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function GenerationRefresh({ active }: { active: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const refresh = () => { if (!document.hidden) router.refresh() }
    const timer = setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [active, router])
  return null
}
