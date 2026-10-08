'use client';

import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  triggerClassName,
  contentClassName
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const visibleOptions = useMemo(() => {
    const sliced = filteredOptions.slice(0, 30);
    if (value && !sliced.some(opt => opt.value === value)) {
      const selectedOpt = options.find(opt => opt.value === value);
      if (selectedOpt) {
        sliced.unshift(selectedOpt);
      }
    }
    return sliced;
  }, [filteredOptions, options, value]);

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value);
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-11 justify-between text-left font-medium rounded-xl border-none bg-muted/30 hover:bg-muted/40 text-primary transition-all px-4",
            !value && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("p-0 rounded-2xl border-primary/5 shadow-2xl overflow-hidden bg-white w-[var(--radix-popover-trigger-width)]", contentClassName)} 
        align="start"
      >
        <div className="flex items-center border-b px-3 bg-muted/10">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <ScrollArea className="max-h-[250px] overflow-y-auto p-1">
          {visibleOptions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground font-medium">{emptyMessage}</div>
          ) : (
            <div className="space-y-0.5">
              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm font-bold text-primary/80 hover:bg-muted/30 transition-all text-left",
                    option.value === value && "bg-primary/5 text-primary"
                  )}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
