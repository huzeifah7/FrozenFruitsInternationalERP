'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface CustomersInvoicesChartProps {
  data: any[];
  loading?: boolean;
}

export function CustomersInvoicesChart({ data, loading }: CustomersInvoicesChartProps) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print-card bg-white transition-all duration-300 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="bg-slate-50/60 px-6 py-4 border-b border-slate-200/80 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A] flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center">
              <Users size={16} className="stroke-[2.5]" />
            </div>
            <span>Customers Invoices</span>
          </CardTitle>
          <CardDescription className="font-semibold text-[11px] text-slate-400 mt-1">
            Paid vs Open amounts by customer (Top 15)
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
                angle={-45}
                textAnchor="end"
                height={65}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(2, 132, 199, 0.04)' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const paid = Number(payload[0]?.value || 0);
                    const open = Number(payload[1]?.value || 0);
                    const total = paid + open;
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl border border-slate-200/80 text-xs space-y-1">
                        <p className="font-extrabold text-[#0F172A] border-b border-slate-100 pb-1">{label}</p>
                        <p className="font-bold text-[#0284C7] flex justify-between gap-4">
                          <span>Paid:</span> <span>{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD</span>
                        </p>
                        <p className="font-bold text-rose-500 flex justify-between gap-4">
                          <span>Open:</span> <span>{open.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD</span>
                        </p>
                        <p className="font-black text-slate-800 border-t border-slate-100 pt-1 flex justify-between gap-4">
                          <span>Total:</span> <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '15px' }} 
              />
              <Bar dataKey="paid" name="Paid Amount" stackId="a" fill="#0284C7" radius={[0, 0, 4, 4]} />
              <Bar dataKey="open" name="Open Amount" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
