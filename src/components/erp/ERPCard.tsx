import React from 'react';
import { cn } from '@/lib/utils';

interface ERPCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ERPCard({ children, className, ...props }: ERPCardProps) {
  return (
    <div 
      className={cn(
        "bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 relative overflow-hidden",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
