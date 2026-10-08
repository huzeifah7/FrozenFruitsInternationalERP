import React, { useState, useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';
import { Search } from 'lucide-react';

export interface ERPSelectOption {
  label: string;
  value: string;
}

export interface ERPSelectProps {
  label?: string;
  placeholder?: string;
  options: ERPSelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  error?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export const ERPSelect = React.forwardRef<HTMLButtonElement, ERPSelectProps>(
  ({ label, placeholder = 'Select item', options = [], value, onValueChange, error, className, disabled, searchable = true }, ref) => {
    const [search, setSearch] = useState('');

    const filteredOptions = useMemo(() => {
      if (!search.trim()) return options;
      const q = search.toLowerCase().trim();
      return options.filter(opt => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q));
    }, [options, search]);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            {label}
          </Label>
        )}
        <Select 
          value={value} 
          onValueChange={onValueChange} 
          disabled={disabled}
          onOpenChange={(open) => {
            if (!open) setSearch('');
          }}
        >
          <SelectTrigger
            ref={ref}
            className={cn(
              "h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 focus:ring-[#0284C7] placeholder:text-slate-400 placeholder:font-normal",
              error && "border-rose-500 focus:ring-rose-500",
              className
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white max-h-72 p-1">
            {searchable && options.length > 3 && (
              <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 border-none outline-none focus:ring-2 focus:ring-[#0284C7]/50 text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
            <div className="py-1 max-h-52 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <SelectItem 
                    key={opt.value} 
                    value={opt.value}
                    className="font-bold text-xs py-2 px-3 rounded-lg cursor-pointer hover:bg-slate-50 focus:bg-slate-50 transition-colors"
                  >
                    {opt.label}
                  </SelectItem>
                ))
              ) : (
                <div className="py-3 px-4 text-center text-xs text-slate-400 font-medium">
                  No items found
                </div>
              )}
            </div>
          </SelectContent>
        </Select>
        <FieldError message={error} />
      </div>
    );
  }
);

ERPSelect.displayName = "ERPSelect";
