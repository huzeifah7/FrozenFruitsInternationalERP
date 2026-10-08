import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ERPModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ERPModal({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className
}: ERPModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("w-[95vw] sm:max-w-[450px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white flex flex-col", className)}>
        {/* Title Header */}
        <div className="bg-[#2e1d52] p-6 text-white shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-widest text-white">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-slate-300 font-medium text-xs mt-1">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-white">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <DialogFooter className="bg-slate-50/50 p-6 border-t border-slate-100 shrink-0 flex flex-row justify-end gap-3">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
