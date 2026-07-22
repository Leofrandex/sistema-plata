'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hospiwaste/shared/components/ui/tabs'
import { RouteHistory } from '@hospiwaste/shared/components/history/route-history'
import { WeighingHistory } from '@hospiwaste/shared/components/history/weighing-history'

export default function HistoryPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recorridos y pesajes registrados. Puedes editar campos o anular con motivo.
        </p>
      </div>
      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes">Recorridos</TabsTrigger>
          <TabsTrigger value="weighings">Pesajes</TabsTrigger>
        </TabsList>
        <TabsContent value="routes" className="mt-4">
          <RouteHistory />
        </TabsContent>
        <TabsContent value="weighings" className="mt-4">
          <WeighingHistory />
        </TabsContent>
      </Tabs>
    </div>
  )
}
