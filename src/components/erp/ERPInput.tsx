import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';

interface ERPInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const ERPInput = React.forwardRef<HTMLInputElement, ERPInputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            {label}
          </Label>
        )}
        <Input
          type={type}
          className={cn(
            "h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 focus-visible:ring-[#0284C7] placeholder:text-slate-400 placeholder:font-normal",
            error && "border-rose-500 focus-visible:ring-rose-500",
            className
          )}
          ref={ref}
          {...props}
        />
        <FieldError message={error} />
      </div>
    );
  }
);

ERPInput.displayName = "ERPInput";
