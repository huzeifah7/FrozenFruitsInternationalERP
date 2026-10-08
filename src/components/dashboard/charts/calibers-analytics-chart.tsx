'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';

interface CalibersAnalyticsChartProps {
  data: any[];
  loading?: boolean;
}

export function CalibersAnalyticsChart({ data, loading }: CalibersAnalyticsChartProps) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print-card bg-white transition-all duration-300 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="bg-slate-50/60 px-6 py-4 border-b border-slate-200/80 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A] flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center">
              <Activity size={16} className="stroke-[2.5]" />
            </div>
            <span>Calibers Analytics</span>
          </CardTitle>
          <CardDescription className="font-semibold text-[11px] text-slate-400 mt-1">
            Production yield percentage by caliber YTD
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[360px] p-6">
        {loading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -15, right: 15, bottom: 25, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                unit="%"
              />
              <Tooltip 
                cursor={{ fill: 'rgba(2, 132, 199, 0.04)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const pd = payload[0].payload;
                    const label = pd.name === 'Sans calibre' ? 'Sans calibre' : `Caliber ${pd.name}`;
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl border border-slate-200/80 text-xs space-y-1">
                        <p className="font-black text-[#0284C7] uppercase tracking-wider">{label}</p>
                        <p className="font-extrabold text-[#0F172A]">{pd.weight.toLocaleString()} KG</p>
                        <p className="text-[10px] font-bold text-slate-400">Yield Share: {pd.percentage}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => {
                  let fill = '#0284C7'; // Default ice accent
                  if (entry.name === 'Decay') fill = '#f87171'; // Red
                  else if (entry.name === 'Usage Industriel') fill = '#f59e0b'; // Amber
                  else if (entry.name === 'Sans calibre') fill = '#94a3b8'; // Slate
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
