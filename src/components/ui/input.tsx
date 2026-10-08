import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[#dc2626] ring-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626] input-error",
          className
        )}
        ref={ref}
        onWheel={(e) => {
          if (type === 'number') {
            e.currentTarget.blur();
          }
          props.onWheel?.(e);
        }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
