'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ComparativeReportRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/analytics')
  }, [router])

  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      Redirigiendo a Analíticas…
    </div>
  )
}
