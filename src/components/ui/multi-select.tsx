'use client';

import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface MultiSelectProps {
  selected: string[];
  onChange: (value: string[]) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
}

export function MultiSelect({
  selected = [],
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search..."
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleSelect = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-12 h-auto flex items-center justify-between text-left font-bold rounded-xl border-none bg-muted/30 hover:bg-muted/40 text-primary transition-all px-4 py-2"
        >
          <div className="flex flex-wrap gap-1.5 max-w-[90%]">
            {selected.length === 0 ? (
              <span className="text-muted-foreground font-medium">{placeholder}</span>
            ) : (
              selected.map(val => {
                const option = options.find(o => o.value === val);
                return (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="bg-primary/10 text-primary hover:bg-primary/20 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <span>{option ? option.label : val}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(selected.filter(item => item !== val));
                      }}
                      className="cursor-pointer text-primary/60 hover:text-primary rounded-full"
                    >
                      <X className="size-3" />
                    </span>
                  </Badge>
                );
              })
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 rounded-2xl border-primary/5 shadow-2xl overflow-hidden bg-white w-[var(--radix-popover-trigger-width)]" align="start">
        <div className="flex items-center border-b px-3 bg-muted/10">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <ScrollArea className="max-h-[250px] p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground font-medium">No results found.</div>
          ) : (
            <div className="space-y-0.5">
              {filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm font-bold text-primary/80 hover:bg-muted/30 transition-all text-left",
                      isSelected && "bg-primary/5 text-primary"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
