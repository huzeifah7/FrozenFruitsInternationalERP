'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart } from 'lucide-react';

interface TopSaleDonutChartProps {
  data: any[];
  loading?: boolean;
}

const COLORS = ['#193A7B', '#0284C7', '#0F2552', '#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

export function TopSaleDonutChart({ data, loading }: TopSaleDonutChartProps) {
  const totalVal = React.useMemo(() => {
    return data.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [data]);

  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print-card bg-white transition-all duration-300 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="bg-slate-50/60 px-6 py-4 border-b border-slate-200/80 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A] flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center">
              <ShoppingCart size={16} className="stroke-[2.5]" />
            </div>
            <span>Top Sale Statistics</span>
          </CardTitle>
          <CardDescription className="font-semibold text-[11px] text-slate-400 mt-1">
            Product - Category - Type breakdown from Final Product Output
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[360px] p-6 flex justify-center items-center relative">
        {loading ? (
          <Skeleton className="w-48 h-48 rounded-full" />
        ) : (
          <>
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Total Output</span>
              <span className="text-lg font-black text-[#0F172A] block leading-none">
                {totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-[#0284C7] font-black uppercase tracking-wider block mt-1">KG / MAD</span>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="42%"
                  innerRadius={68}
                  outerRadius={98}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const pData = payload[0];
                      const val = Number(pData.value || 0);
                      const pct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0';
                      return (
                        <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-200/80 text-xs space-y-1">
                          <p className="font-extrabold text-[#0F172A]">{pData.name}</p>
                          <p className="font-black text-[#0284C7]">{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] font-bold text-slate-400">Share: {pct}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '10px' }}
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                />
              </PieChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
