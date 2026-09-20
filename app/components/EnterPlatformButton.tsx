'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getLoginDestination } from '@/app/actions/getLoginDestination'

type Props = {
  className?: string
  children: React.ReactNode
  ariaLabel?: string
  onBeforeNavigate?: () => void
}

export function EnterPlatformButton({ className, children, ariaLabel, onBeforeNavigate }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      onBeforeNavigate?.()
      const destination = await getLoginDestination(null)
      router.push(destination)
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={handleClick} aria-label={ariaLabel} disabled={loading} className={className}>
      {children}
    </button>
  )
}
