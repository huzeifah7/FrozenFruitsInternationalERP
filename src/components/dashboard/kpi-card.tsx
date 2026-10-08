'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { AnimatedCounter } from './animated-counter';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface KpiCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColorClass?: string;
  iconBgClass?: string;
  accentColor?: string;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
  formatter?: (val: number) => string;
  subtitle?: string;
  actionHref?: string;
  actionText?: string;
  onClick?: () => void;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  iconColorClass = "text-[#193A7B]",
  iconBgClass = "bg-[#193A7B]/10",
  accentColor = "#0284C7",
  trend,
  trendUp = true,
  loading = false,
  formatter,
  subtitle,
  actionHref,
  actionText,
  onClick,
}: KpiCardProps) {
  const content = (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="h-full"
    >
      <Card 
        onClick={onClick}
        className={cn(
          "rounded-2xl border border-slate-200/80 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-slate-300 print-card bg-white/95 backdrop-blur-md overflow-hidden relative group h-full flex flex-col justify-between cursor-pointer",
          actionHref || onClick ? "hover:border-[#193A7B]/40" : ""
        )}
      >
        {/* Top colored accent bar */}
        <div 
          className="h-1 w-full transition-all duration-300 group-hover:h-1.5" 
          style={{ backgroundColor: accentColor || '#0284C7' }} 
        />
        
        {/* Soft background radial glow */}
        <div 
          className={cn(
            "absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-0 group-hover:opacity-20 transition-all duration-500 blur-2xl pointer-events-none",
            iconBgClass
          )} 
        />

        <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider transition-colors group-hover:text-[#0F172A]">
                {title}
              </p>
              {subtitle && (
                <p className="text-[10px] font-medium text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>

            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-xs",
              iconBgClass,
              iconColorClass
            )}>
              <Icon size={20} className="stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {loading ? (
                <div className="h-8 w-32 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <AnimatedCounter value={value} formatter={formatter} />
              )}
            </h3>

            <div className="flex items-center justify-between gap-2 pt-1">
              {trend && !loading ? (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs",
                  trendUp 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                    : "bg-rose-50 text-rose-700 border border-rose-200/60"
                )}>
                  {trendUp ? <ArrowUpRight size={12} className="stroke-[3]" /> : <ArrowDownRight size={12} className="stroke-[3]" />}
                  {trend}
                </span>
              ) : (
                <span />
              )}

              {actionText && (
                <span className="text-[11px] font-bold text-[#0284C7] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  {actionText}
                  <ChevronRight size={12} className="stroke-[3]" />
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (actionHref) {
    return <Link href={actionHref} className="block h-full">{content}</Link>;
  }

  return content;
}

interface DualKpiStatItem {
  label: string;
  value: number;
  icon: LucideIcon;
  iconBgClass?: string;
  formatter?: (val: number) => string;
}

interface DualKpiCardProps {
  cardTitle: string;
  cardIcon: LucideIcon;
  leftStat: DualKpiStatItem;
  rightStat: DualKpiStatItem;
  loading?: boolean;
}

export function DualKpiCard({
  cardTitle,
  cardIcon: CardIcon,
  leftStat,
  rightStat,
  loading = false,
}: DualKpiCardProps) {
  const LeftIcon = leftStat.icon;
  const RightIcon = rightStat.icon;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="h-full"
    >
      <Card className="rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 bg-white overflow-hidden h-full flex flex-col justify-between">
        {/* Card Header */}
        <div className="px-5 py-3 border-b border-slate-100/90 flex items-center gap-2.5 bg-slate-50/50">
          <CardIcon className="h-4 w-4 text-[#193A7B]" />
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{cardTitle}</h3>
        </div>

        {/* Card Content - 2 in 1 Grid */}
        <CardContent className="p-5 grid grid-cols-2 gap-4 items-center">
          {/* Left Stat */}
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs",
              leftStat.iconBgClass || "bg-[#193A7B]"
            )}>
              <LeftIcon className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#64748B] truncate">{leftStat.label}</p>
              <h4 className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight truncate">
                {loading ? (
                  <div className="h-6 w-24 bg-slate-100 animate-pulse rounded-md mt-1" />
                ) : (
                  <AnimatedCounter value={leftStat.value} formatter={leftStat.formatter} />
                )}
              </h4>
            </div>
          </div>

          {/* Right Stat */}
          <div className="flex items-center gap-3.5 border-l border-slate-100 pl-4">
            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs",
              rightStat.iconBgClass || "bg-[#0284C7]"
            )}>
              <RightIcon className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#64748B] truncate">{rightStat.label}</p>
              <h4 className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight truncate">
                {loading ? (
                  <div className="h-6 w-24 bg-slate-100 animate-pulse rounded-md mt-1" />
                ) : (
                  <AnimatedCounter value={rightStat.value} formatter={rightStat.formatter} />
                )}
              </h4>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface SingleSummaryCardProps {
  cardTitle: string;
  cardIcon: LucideIcon;
  statIcon: LucideIcon;
  statIconBgClass?: string;
  value: number;
  formatter?: (val: number) => string;
  actionHref: string;
  actionText: string;
  loading?: boolean;
}

export function SingleSummaryCard({
  cardTitle,
  cardIcon: CardIcon,
  statIcon: StatIcon,
  statIconBgClass = "bg-[#0284C7]",
  value,
  formatter,
  actionHref,
  actionText,
  loading = false,
}: SingleSummaryCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="h-full"
    >
      <Card className="rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 bg-white overflow-hidden h-full flex flex-col justify-between">
        {/* Card Header */}
        <div className="px-5 py-3 border-b border-slate-100/90 flex items-center gap-2.5 bg-slate-50/50">
          <CardIcon className="h-4 w-4 text-[#193A7B]" />
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{cardTitle}</h3>
        </div>

        {/* Card Main Stat */}
        <CardContent className="p-5 flex flex-col justify-between flex-1 space-y-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs",
              statIconBgClass
            )}>
              <StatIcon className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h4 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              {loading ? (
                <div className="h-7 w-32 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <AnimatedCounter value={value} formatter={formatter} />
              )}
            </h4>
          </div>

          <div className="pt-2 border-t border-slate-100/80">
            <Link 
              href={actionHref} 
              className="text-xs font-bold text-[#0284C7] hover:underline underline-offset-4 flex items-center gap-1 transition-all"
            >
              {actionText}
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
