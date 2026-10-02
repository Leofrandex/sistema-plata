'use client'

import { Suspense } from 'react'
import { ReportEditor } from '@/components/reports/editor/report-editor'

// useSearchParams necesita un Suspense en export estático.
export default function ReportEditorPage() {
  return (
    <Suspense fallback={null}>
      <ReportEditor />
    </Suspense>
  )
}
