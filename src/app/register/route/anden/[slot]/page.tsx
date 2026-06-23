import RegisterRouteSlotClient from './register-route-slot-client'

// Export estático: enumerar los 6 horarios fijos de la ruta.
// Los colons (:) se codifican porque Windows no admite ":" en nombres de carpeta.
export function generateStaticParams() {
  return ['06:30', '10:30', '13:20', '14:30', '18:30', '21:00'].map((slot) => ({
    slot: encodeURIComponent(slot),
  }))
}

interface Props {
  params: Promise<{ slot: string }>
}

export default function RegisterRouteSlotPage({ params }: Props) {
  return <RegisterRouteSlotClient params={params} />
}
