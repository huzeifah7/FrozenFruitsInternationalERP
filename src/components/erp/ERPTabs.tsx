import React from 'react';
import { cn } from '@/lib/utils';

interface ERPTabItem {
  id: string;
  label: string;
}

interface ERPTabsProps {
  tabs: ERPTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ERPTabs({ tabs, activeTab, onChange, className }: ERPTabsProps) {
  return (
    <div className={cn("flex items-center gap-2 px-6 border-b border-slate-100 overflow-x-auto custom-scrollbar bg-white", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 h-14 flex items-center justify-center select-none",
              isActive
                ? "border-[#0284C7] text-[#0284C7]"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
