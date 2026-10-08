'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Plus, 
  Trash2, 
  Camera, 
  Check,
  Search,
  Building2,
  MapPin,
  Briefcase,
  Users,
  FileText,
  ShieldCheck,
  Factory
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: string;
}

// Minimalist Portal-based Select Dropdown (Never Clipped)
interface SelectInputProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  error,
  disabled = false,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("w-full flex flex-col gap-1.5 font-sans", className)}>
      {label && (
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-left text-sm flex items-center justify-between shadow-2xs transition-all duration-150 font-sans cursor-pointer",
              "hover:border-slate-300",
              "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900",
              open && "border-slate-900 ring-2 ring-slate-900/10",
              disabled && "bg-slate-50 text-slate-400 cursor-not-allowed",
              error && "border-rose-500 focus:ring-rose-500/20"
            )}
          >
            <span className={cn("truncate font-medium text-slate-800", !selectedOption && "text-slate-400 font-normal")}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200", open && "rotate-180 text-slate-700")} />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="p-1.5 rounded-xl border border-slate-200 shadow-xl bg-white z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[200px] max-h-64 overflow-hidden flex flex-col font-sans"
        >
          {options.length > 6 && (
            <div className="flex items-center px-2 py-1.5 border-b border-slate-100 mb-1 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-400"
              />
            </div>
          )}

          <div className="overflow-y-auto max-h-52 space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-slate-400 italic text-center">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange?.(opt.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs md:text-sm flex items-center justify-between rounded-lg transition-colors cursor-pointer",
                      isSelected ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && <span className="text-[11px] text-rose-500 font-medium">{error}</span>}
    </div>
  );
};

// Input Field component
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full flex flex-col gap-1.5 font-sans">
      {label && (
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={cn(
          "w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-medium shadow-2xs transition-all duration-150 font-sans",
          "placeholder:text-slate-400 placeholder:font-normal",
          "hover:border-slate-300",
          "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900",
          "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          error && "border-rose-500 focus:ring-rose-500/20",
          className
        )}
        {...props}
      />
      {error && <span className="text-[11px] text-rose-500 font-medium">{error}</span>}
    </div>
  );
};

// Minimalist Add Button (+)
export const MinimalAddButton: React.FC<{ 
  label: string; 
  onClick?: () => void; 
  className?: string;
  icon?: React.ReactNode;
}> = ({ label, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer font-sans active:scale-95",
      className
    )}
  >
    <Plus className="w-4 h-4 stroke-[2.5]" />
    <span>{label}</span>
  </button>
);

// Minimalist Trash/Remove Button
export const MinimalDeleteButton: React.FC<{ onClick?: () => void; className?: string }> = ({ onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title="Remove Row"
    className={cn(
      "w-9 h-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0",
      className
    )}
  >
    <Trash2 className="w-4 h-4" />
  </button>
);

// Minimal Form Card Wrapper
export const FormCard: React.FC<{ 
  title: string; 
  icon?: React.ReactNode;
  children: React.ReactNode; 
  className?: string;
}> = ({
  title,
  icon,
  children,
  className = ''
}) => {
  return (
    <div className={cn("bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 md:p-8 space-y-6 font-sans", className)}>
      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
        {icon && <div className="text-slate-700">{icon}</div>}
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
};

// Minimalist Circular Logo Upload
export const LogoAvatarUpload: React.FC<{
  previewUrl?: string | null;
  onFileSelect?: (file: File) => void;
}> = ({ previewUrl, onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-4 font-sans">
      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner relative group-hover:border-slate-400 transition-all">
          {previewUrl ? (
            <img src={previewUrl} alt="Company Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-400">
              <Camera className="w-7 h-7 stroke-[1.5]" />
              <span className="text-[11px] font-medium tracking-wide">300 x 300</span>
            </div>
          )}
        </div>
        <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-slate-900 text-white shadow-md flex items-center justify-center group-hover:scale-105 transition-all">
          <Camera className="w-4 h-4" />
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </div>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-3">Company Logo</span>
    </div>
  );
};
