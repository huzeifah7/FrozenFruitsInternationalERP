import React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ERPButtonProps extends ButtonProps {
  fullWidth?: boolean;
}

export const ERPButton = React.forwardRef<HTMLButtonElement, ERPButtonProps>(
  ({ className, fullWidth, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "bg-[#193A7B] hover:bg-[#0F2552] text-white font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-xl shadow-lg shadow-[#193A7B]/10 transition-transform active:scale-95 flex items-center gap-2",
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

ERPButton.displayName = "ERPButton";
