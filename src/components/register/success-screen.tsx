'use client'

import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatTachoNumber } from '@/lib/data/containers'

interface Props {
  title: string
  containerId: string
  onRegisterAnother: () => void
}

export function SuccessScreen({ title, containerId, onRegisterAnother }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      <p className="text-slate-500">Tacho {formatTachoNumber(containerId)} registrado correctamente.</p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button onClick={onRegisterAnother}>Registrar otro tacho</Button>
        <Link href={`/containers/detail?id=${containerId}`}>
          <Button variant="outline" className="w-full">Ver tacho</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" className="w-full">Ir al dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
