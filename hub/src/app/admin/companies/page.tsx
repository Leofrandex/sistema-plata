'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@hospiwaste/shared/components/ui/card'
import { Badge } from '@hospiwaste/shared/components/ui/badge'
import { CompanyForm } from '@/components/admin/company-form'
import { useStore } from '@hospiwaste/shared/lib/store'
import type { Company } from '@hospiwaste/shared/lib/types'

export default function AdminCompaniesPage() {
  const { clients, companies, addCompany } = useStore()
  const [showForm, setShowForm] = useState(false)

  function handleAdd(data: Omit<Company, 'id'>) {
    addCompany({ id: `company-${Date.now()}`, ...data })
    setShowForm(false)
  }

  const clientNameMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Administrar Empresas</h1>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nueva empresa
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar nueva empresa</CardTitle></CardHeader>
          <CardContent>
            <CompanyForm clients={clients} onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {companies.map((company) => {
          return (
            <div
              key={company.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">{company.name}</p>
                  <Badge variant="outline" className="font-mono">{company.code_letter}</Badge>
                </div>
                <p className="text-sm text-slate-500">
                  Cliente: {clientNameMap[company.client_id] ?? '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
