import { useId } from 'react'
import { Input } from './input'
import { cn } from '@hospiwaste/shared/lib/utils'

interface InputFieldProps extends React.ComponentProps<'input'> {
  label: string
  error?: string
}

export function InputField({ label, error, className, ...rest }: InputFieldProps) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-medium text-foreground"
      >
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(className)}
        {...rest}
      />
      {error && (
        <span id={errorId} className="text-xs text-destructive">{error}</span>
      )}
    </div>
  )
}
