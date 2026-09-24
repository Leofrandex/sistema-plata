import type { PhysicalInventory, PhysicalInventoryRow } from '@hospiwaste/shared/lib/data/dashboard-analytics'

function Group({ title, rows }: { title: string; rows: PhysicalInventoryRow[] }) {
  return (
    <>
      <tr>
        <th scope="rowgroup" colSpan={3} className="pt-2 text-left text-xs font-medium text-muted-foreground">
          {title}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={`${title}-${r.label}`}>
          <th scope="row" className="py-0.5 pl-3 text-left font-normal text-foreground/80">{r.label}</th>
          <td className="py-0.5 text-right font-semibold tabular-nums text-foreground">{r.clean}</td>
          <td className="py-0.5 text-right font-semibold tabular-nums text-foreground">{r.inProcess}</td>
        </tr>
      ))}
    </>
  )
}

/** Inventario físico de planta: llantas (240 L) y color (Yaris) × limpio / en proceso en vivo. */
export function PhysicalInventoryBlock({ inventory }: { inventory: PhysicalInventory }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inventario físico
            </th>
            <th scope="col" className="w-20 text-right text-xs font-medium text-muted-foreground">Limpios</th>
            <th scope="col" className="w-24 text-right text-xs font-medium text-muted-foreground">En proceso</th>
          </tr>
        </thead>
        <tbody>
          <Group title="240 L" rows={inventory.tachos} />
          <Group title="1100 L (Yaris)" rows={inventory.yaris} />
        </tbody>
      </table>
    </div>
  )
}
