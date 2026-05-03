import { useId } from 'react'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface InputFieldProps extends React.ComponentProps<'input'> {
  label: string
  error?: string
}

export function InputField({ label, error, className, ...rest }: InputFieldProps) {
  const id = useId()
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
        className={cn(className)}
        {...rest}
      />
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  )
}
