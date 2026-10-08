import React from 'react';
import { ERPBreadcrumb, BreadcrumbItem } from './ERPBreadcrumb';
import { cn } from '@/lib/utils';

interface ERPPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbItems: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function ERPPageHeader({ title, subtitle, breadcrumbItems, actions, className }: ERPPageHeaderProps) {
  return (
    <div className={cn("max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] md:text-2xl font-medium text-[#2e1d52]">
            {title}
          </h1>
        </div>
        <ERPBreadcrumb items={breadcrumbItems} />
        {subtitle && (
          <p className="text-xs font-semibold text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
