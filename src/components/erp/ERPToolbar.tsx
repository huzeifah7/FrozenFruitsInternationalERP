import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  Maximize2, 
  Minimize2,
  Filter,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ERPToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  density: 'compact' | 'normal' | 'tall';
  onDensityChange: (density: 'compact' | 'normal' | 'tall') => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onFilterClick?: () => void;
  onColumnsClick?: () => void;
}

export function ERPToolbar({
  searchTerm,
  onSearchChange,
  density,
  onDensityChange,
  isFullscreen,
  onToggleFullscreen,
  onFilterClick,
  onColumnsClick
}: ERPToolbarProps) {
  return (
    <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shrink-0">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search..."
          className="h-10 pl-10 pr-10 rounded-xl border-slate-200 bg-white focus-visible:ring-[#0284C7] font-medium placeholder-slate-400 text-slate-700 text-xs w-full shadow-sm"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <button 
            type="button"
            onClick={() => onSearchChange('')} 
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Toolbar Controls */}
      <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
        {onFilterClick && (
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            onClick={onFilterClick}
            title="Filter"
          >
            <Filter size={15} className="text-slate-500" />
          </Button>
        )}

        {onColumnsClick && (
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            onClick={onColumnsClick}
            title="Column Visibility"
          >
            <Eye size={15} className="text-slate-500" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs px-3 hover:bg-slate-50">
              <Filter size={14} className="text-slate-500" /> Filter: <span className="capitalize text-[#0284C7]">{density}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white">
            <DropdownMenuItem onClick={() => onDensityChange('compact')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer hover:bg-slate-50">Compact</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDensityChange('normal')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer hover:bg-slate-50">Normal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDensityChange('tall')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer hover:bg-slate-50">Tall</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="outline" 
          size="icon" 
          className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50" 
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
        </Button>
      </div>
    </div>
  );
}
