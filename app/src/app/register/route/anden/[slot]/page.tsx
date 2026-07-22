import RegisterRouteSlotClient from './register-route-slot-client'
import { ROUTE_SLOTS, slotToParam } from '@hospiwaste/shared/lib/constants'

// Export estático: enumerar los 6 horarios fijos como token de URL SIN ":".
// Un ":" en el segmento rompe el ruteo servido por el WebView del APK.
export function generateStaticParams() {
  return ROUTE_SLOTS.map((s) => ({ slot: slotToParam(s.id) }))
}

interface Props {
  params: Promise<{ slot: string }>
}

export default function RegisterRouteSlotPage({ params }: Props) {
  return <RegisterRouteSlotClient params={params} />
}
