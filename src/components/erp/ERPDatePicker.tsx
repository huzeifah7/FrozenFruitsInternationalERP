import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';

interface ERPDatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const ERPDatePicker = React.forwardRef<HTMLInputElement, ERPDatePickerProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            {label}
          </Label>
        )}
        <input
          type="date"
          className={cn(
            "flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284C7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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

ERPDatePicker.displayName = "ERPDatePicker";
