import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'

export default function BrandingDemoPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-10">

      {/* Logo placeholder */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Logo (placeholder — pendiente archivo definitivo)</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://hospimed.com.pa/wp-content/uploads/2025/04/hospimed-equipos-medicos.png"
          alt="Hospimed Equipos Médicos"
          className="h-12 object-contain"
        />
      </div>

      {/* Tipografía */}
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Sistema de Trazabilidad de Desechos Clínicos</h1>
        <h2 className="text-xl font-semibold text-foreground">Gestión de Contenedores</h2>
        <h3 className="text-lg font-semibold text-foreground">Registro de Intercambio</h3>
        <p className="text-sm text-muted-foreground">
          Plataforma de seguimiento del ciclo de vida de contenedores de desechos clínicos.
          Diseñada para operadores en campo y supervisores en planta.
        </p>
      </section>

      {/* Colores */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Paleta de colores</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Primary', cls: 'bg-primary', hex: '#0B1A48' },
            { label: 'Secondary', cls: 'bg-secondary', hex: '#E4F0F8' },
            { label: 'Accent', cls: 'bg-accent', hex: '#2A27E9' },
            { label: 'Background', cls: 'bg-background border border-border', hex: '#F7F7F7' },
          ].map(({ label, cls, hex }) => (
            <div key={label} className="space-y-1">
              <div className={`h-12 rounded-md ${cls}`} />
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs text-muted-foreground font-mono">{hex}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Botones */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Botones</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Registrar intercambio</Button>
          <Button variant="secondary">Ver detalle</Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="default" disabled>Deshabilitado</Button>
        </div>
      </section>

      {/* Inputs */}
      <section className="space-y-4 max-w-sm">
        <h3 className="text-base font-semibold">Inputs</h3>
        <InputField label="Número de contenedor" placeholder="HOS-0001" />
        <InputField label="Cliente" placeholder="Hospital Nacional" />
        <InputField label="Campo con error" error="Este campo es requerido" />
      </section>

    </div>
  )
}
