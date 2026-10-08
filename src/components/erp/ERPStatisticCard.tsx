import React from 'react';
import { cn } from '@/lib/utils';

interface ERPStatisticCardProps {
  label?: string;
  title?: string;
  value: string | number;
  className?: string;
  icon?: React.ReactNode;
  description?: string;
}

export function ERPStatisticCard({ label, title, value, className, icon, description }: ERPStatisticCardProps) {
  const displayLabel = label || title || '';
  
  return (
    <div 
      className={cn(
        "bg-white p-5 rounded-[1.25rem] shadow-md shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between max-w-sm w-full",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{displayLabel}</p>
        <p className="text-xl font-black text-[#0F172A]">{value}</p>
        {description && (
          <p className="text-[9px] font-medium text-slate-400/90">{description}</p>
        )}
      </div>
      {icon && (
        <div className="h-10 w-10 rounded-xl bg-[#0284C7]/10 flex items-center justify-center text-[#0284C7] shrink-0 ml-3">
          {icon}
        </div>
      )}
    </div>
  );
}
