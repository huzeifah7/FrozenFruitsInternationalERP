import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface ERPBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function ERPBreadcrumb({ items, className }: ERPBreadcrumbProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-slate-500 mb-1.5 select-none", className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const isHighlight = item.active || isLast;

        return (
          <React.Fragment key={idx}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-slate-600 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isHighlight ? "text-[#0284C7]" : "text-slate-500")}>
                {item.label}
              </span>
            )}
            {!isLast && <span className="text-slate-400 px-0.5">/</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}
