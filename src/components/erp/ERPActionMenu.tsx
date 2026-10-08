import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Eye, CreditCard, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ERPActionMenuProps {
  onView?: () => void;
  onPayment?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function ERPActionMenu({ onView, onPayment, onDelete, className }: ERPActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-8 px-3 rounded-lg border-slate-200 bg-white gap-1.5 font-black text-[10px] text-slate-500 uppercase tracking-widest shadow-sm hover:bg-slate-50 active:scale-95 transition-all",
            className
          )}
        >
          Actions <ChevronDown size={12} className="stroke-[2.5]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white min-w-[120px] z-50">
        {onView && (
          <DropdownMenuItem 
            onClick={onView} 
            className="font-bold text-[10px] uppercase tracking-widest py-2 px-3 rounded-lg cursor-pointer flex items-center gap-2 text-slate-600 hover:text-[#193A7B] hover:bg-slate-50 transition-colors"
          >
            <Eye size={12} className="text-[#193A7B]" /> View
          </DropdownMenuItem>
        )}
        {onPayment && (
          <DropdownMenuItem 
            onClick={onPayment} 
            className="font-bold text-[10px] uppercase tracking-widest py-2 px-3 rounded-lg cursor-pointer flex items-center gap-2 text-slate-600 hover:text-[#0284C7] hover:bg-slate-50 transition-colors"
          >
            <CreditCard size={12} className="text-[#0284C7]" /> Payment
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem 
            onClick={onDelete} 
            className="font-bold text-[10px] uppercase tracking-widest py-2 px-3 rounded-lg cursor-pointer flex items-center gap-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={12} className="text-rose-500" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
