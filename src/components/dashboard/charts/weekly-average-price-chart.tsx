'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';

interface WeeklyAveragePriceChartProps {
  data: any[];
  loading?: boolean;
}

export function WeeklyAveragePriceChart({ data, loading }: WeeklyAveragePriceChartProps) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print-card bg-white transition-all duration-300 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="bg-slate-50/60 px-6 py-4 border-b border-slate-200/80 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A] flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center">
              <TrendingUp size={16} className="stroke-[2.5]" />
            </div>
            <span>Weekly Average Price</span>
          </CardTitle>
          <CardDescription className="font-semibold text-[11px] text-slate-400 mt-1">
            Average sale price per KG across all products (YTD)
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[360px] p-6">
        {loading ? (
          <Skeleton className="w-full h-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -15, right: 15, bottom: 25, top: 10 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284C7" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#0284C7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                angle={-45}
                textAnchor="end"
                height={65}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                tickFormatter={(v) => `${v} MAD`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const price = Number(payload[0]?.value || 0);
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl border border-slate-200/80 text-xs space-y-1">
                        <p className="font-extrabold text-[#0F172A]">{label}</p>
                        <p className="font-black text-[#0284C7]">
                          {price.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD / KG
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#0284C7" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorPrice)"
                dot={{ r: 4, fill: '#0284C7', strokeWidth: 2, stroke: 'white' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#193A7B' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
