import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles with iOS zoom prevention (min 16px font on mobile)
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        // Mobile: 16px font (prevents iOS zoom), larger touch target
        'h-12 px-4 py-3 text-base',
        // Desktop: smaller size
        'sm:h-10 sm:px-3 sm:py-2 sm:text-sm',
        // Focus states
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        // Error states
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        // Touch optimization
        'touch-manipulation',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
