import Image from 'next/image'
import type { Photo, PhotoEventType } from '@/lib/types'

const SECTION_LABELS: Record<PhotoEventType, string> = {
  exchange: 'Intercambio en punto de encuentro',
  weighing: 'Pesaje en planta',
  storage: 'Cámara fría',
  treatment: 'Tratamiento',
  other: 'Otros',
}

interface Props {
  photos: Photo[]
}

export function PhasePhotoGallery({ photos }: Props) {
  if (photos.length === 0) {
    return <p className="text-sm text-slate-400">Sin registro fotográfico.</p>
  }

  const grouped = photos.reduce<Record<string, Photo[]>>((acc, photo) => {
    const key = photo.event_type
    if (!acc[key]) acc[key] = []
    acc[key].push(photo)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {(Object.entries(grouped) as [PhotoEventType, Photo[]][]).map(([eventType, eventPhotos]) => (
        <div key={eventType}>
          <h4 className="text-sm font-semibold text-slate-600 mb-3">
            {SECTION_LABELS[eventType]}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {eventPhotos.map((photo) => (
              <div key={photo.id} className="space-y-1">
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-slate-100">
                  <Image
                    src={photo.url}
                    alt={photo.label}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                <p className="text-xs text-slate-400 truncate">{photo.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
