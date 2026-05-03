interface Props {
  current: number
  total: number
  labels?: string[]
}

export function StepIndicator({ current, total, labels }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < current ? 'bg-blue-500' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Paso {current} de {total}
        {labels?.[current - 1] && <> — {labels[current - 1]}</>}
      </p>
    </div>
  )
}
