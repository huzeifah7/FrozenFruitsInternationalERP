'use client';

import React, { useState } from 'react';
import { Calendar, Download, ChevronDown, Check, LayoutDashboard, Maximize2, Minimize2, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth-provider';
import { useSeason } from '@/contexts/SeasonContext';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  dateRange: string;
  onRangeSelect: (range: string) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  onExportPDF: () => void;
}

const RANGE_LABELS: Record<string, string> = {
  'today': 'Today',
  'this-week': 'This Week',
  'this-month': 'This Month',
  'season-2025-2026': 'This Season',
  'all-time': 'All Time',
};

export function DashboardHeader({
  title = "Enterprise Overview",
  subtitle = "Real-time analytics and operational performance",
  dateRange,
  onRangeSelect,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  onExportPDF,
}: DashboardHeaderProps) {
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { profile } = useAuthContext();
  const { currentSeason } = useSeason();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleRangeSelect = (key: string) => {
    onRangeSelect(key);
    setIsRangeOpen(false);
  };

  const handleClearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRangeSelect('season-2025-2026');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : (profile?.email || 'User');
  const userRole = profile?.role || 'Admin';

  return (
    <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 no-print px-6 py-4 md:px-10 transition-all duration-300 shadow-xs">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#193A7B]/10 text-[#193A7B] flex items-center justify-center shrink-0 shadow-2xs">
            <LayoutDashboard className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-0.5">
              <span>Main Menu</span>
              <span>/</span>
              <span className="text-[#0284C7] font-black">Dashboard</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#0F172A] tracking-tight">
              {title}
            </h1>
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Season Badge */}
          {currentSeason && (
            <div className="h-10 px-3.5 bg-slate-100/80 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/60 flex items-center gap-1.5 shadow-2xs">
              <span className="text-[10px] text-[#64748B] font-extrabold uppercase">Season:</span>
              <span className="text-[#0284C7] font-extrabold">{currentSeason.name}</span>
            </div>
          )}

          {/* Date Filter Dropdown */}
          <div className="relative">
            <Button
              onClick={() => setIsRangeOpen(!isRangeOpen)}
              className="h-10 px-4 bg-white border border-slate-200/80 text-[#0F172A] hover:bg-slate-50 rounded-xl font-bold flex items-center gap-2.5 shadow-2xs text-xs transition-all duration-200"
            >
              <Calendar className="h-4 w-4 text-[#193A7B]" />
              <span className="font-bold">{RANGE_LABELS[dateRange] || (dateRange === 'custom' ? 'Custom Range' : 'This Season')}</span>
              
              {dateRange !== 'season-2025-2026' && (
                <span 
                  onClick={handleClearFilter} 
                  title="Clear filter"
                  className="ml-1 p-0.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="h-3 w-3" />
                </span>
              )}

              <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-300", isRangeOpen && "rotate-180")} />
            </Button>

            {isRangeOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsRangeOpen(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-3 z-40 animate-in fade-in slide-in-from-top-3 duration-200 space-y-2">
                  <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase text-[#64748B] tracking-widest">Date Range Preset</span>
                    {dateRange !== 'season-2025-2026' && (
                      <button 
                        onClick={handleClearFilter}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(RANGE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => handleRangeSelect(key)}
                        className={cn(
                          "px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-between transition-all duration-200 text-left",
                          dateRange === key ? "bg-[#193A7B]/15 text-[#193A7B]" : "text-slate-600 hover:bg-slate-100/70"
                        )}
                      >
                        <span className="truncate">{label}</span>
                        {dateRange === key && <Check className="h-3.5 w-3.5 text-[#193A7B] shrink-0" />}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-2">
                    <span className="text-[10px] font-black uppercase text-[#64748B] tracking-widest px-2 block">Custom Date Range</span>
                    <div className="grid grid-cols-2 gap-2 px-1">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-[#64748B] uppercase">From</Label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => {
                            setCustomStartDate(e.target.value);
                            onRangeSelect('custom');
                          }}
                          className="h-8 rounded-lg text-xs font-bold bg-slate-50 border-slate-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-[#64748B] uppercase">To</Label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => {
                            setCustomEndDate(e.target.value);
                            onRangeSelect('custom');
                          }}
                          className="h-8 rounded-lg text-xs font-bold bg-slate-50 border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Fullscreen Button */}
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border border-slate-200/80 text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>

          {/* PDF Export Button */}
          <Button
            onClick={onExportPDF}
            className="h-10 px-4 bg-[#193A7B] hover:bg-[#0F2552] text-white font-extrabold rounded-xl shadow-md shadow-[#193A7B]/20 tracking-wider text-[11px] uppercase gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            <Download className="h-4 w-4" />
            <span>Export PDF</span>
          </Button>

          {/* User Profile Badge */}
          <div className="hidden lg:flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="h-9 w-9 rounded-xl bg-[#193A7B] text-white font-black text-xs flex items-center justify-center shadow-2xs uppercase">
              {userName.substring(0, 2)}
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-[#0F172A] truncate max-w-[120px]">{userName}</p>
              <p className="text-[10px] font-bold text-[#0284C7] uppercase tracking-wider">{userRole}</p>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
