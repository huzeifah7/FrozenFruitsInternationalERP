import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ERPActionButtonProps extends ButtonProps {
  children: React.ReactNode;
  variantType?: 'green' | 'blue' | 'gray' | 'red';
}

export function ERPActionButton({ children, className, variantType = 'green', ...props }: ERPActionButtonProps) {
  const variantClasses = {
    green: "bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-md shadow-[#7a9800]/10",
    blue: "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10",
    gray: "bg-slate-500 hover:bg-slate-600 text-white shadow-md shadow-slate-500/10",
    red: "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10"
  };

  return (
    <Button
      size="sm"
      className={cn(
        "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95",
        variantClasses[variantType],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
