'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from '@/firebase/firestore-override';
import { useFirestore, useDoc } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { useAuthContext } from '@/components/auth-provider';
import { canList } from '@/lib/permissions';
import { Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatAmount = (value: any, symbol = 'MAD') => `${Number(value || 0).toFixed(2)} ${symbol}`.trim();

const CURRENCIES = [
  { id: '1', symbol: '€', label: 'EUR' },
  { id: '2', symbol: '$', label: 'USD' },
  { id: '3', symbol: '£', label: 'GBP' },
  { id: '4', symbol: 'dh', label: 'MAD' },
];

export default function ViewExpensePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const { profile } = useAuthContext();

  const expenseDocRef = useMemo(() => {
    return db && id ? doc(db, 'expenses', id as string) : null;
  }, [db, id]);
  const { data: expense, isLoading } = useDoc(expenseDocRef);

  if (!canList(profile, 'finance.expenses')) {
    if (typeof window !== 'undefined') router.push('/unauthorized');
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-[#7a9800]" />
      </div>
    );
  }

  if (!expense) {
    return <div className="p-8 text-center text-rose-500 font-bold">Expense not found.</div>;
  }

  const currencySymbol = CURRENCIES.find(c => c.id === expense.currency)?.symbol || 'dh';
  const isCreditNote = String(expense.type) === '2';

  const downloadAttachment = () => {
    if (!expense.invoice_attachment) return;

    // If it's a data URL, construct a link and download it
    if (expense.invoice_attachment.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = expense.invoice_attachment;
      a.download = `attachment-${expense.invoice_number || 'expense'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // It's a standard URL, open in new tab
      window.open(expense.invoice_attachment, '_blank');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Expense"
        subtitle="View financial expense details"
        breadcrumbItems={[{ label: 'Profile' }, { label: 'Expenses', href: '/finance/expenses' }, { label: 'View', active: true }]}
      />

      <div className="max-w-[1200px] mx-auto space-y-8">

        {/* EXPENSE INFORMATION TABLE */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider">Expense Information</h2>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500 w-1/3">Type</th>
                  <td className="p-4 font-semibold text-slate-700">{isCreditNote ? 'Credit Note' : 'Invoice'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">{isCreditNote ? 'Credit Note Number' : 'Invoice Number'}</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.invoice_number || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Invoice Date</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.invoice_date || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Invoice Due Date</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.invoice_due_date || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Supplier's Name</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.supplier_detail?.name || expense.supplier || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">IF</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.if || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">ICE</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.ice || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Amount HT</th>
                  <td className="p-4 font-semibold text-slate-700">{formatAmount(expense.amount_ht, currencySymbol)}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Total Amount TTC</th>
                  <td className="p-4 font-black text-[#2e1d52]">
                    {isCreditNote && expense.total_amount_ttc ? '-' : ''}
                    {formatAmount(expense.total_amount_ttc, currencySymbol)}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Expense Type</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.expense_type || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Expense Type Extention</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.expense_type_extention || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Payment Method</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.payment_method || '—'}</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Payment Status</th>
                  <td className="p-4 font-semibold text-slate-700">
                    <span className={expense.payment_status?.toLowerCase() === 'paid' ? 'text-green-600 font-bold' : ''}>
                      {expense.payment_status || 'UNPAID'}
                    </span>
                  </td>
                </tr>
                {expense.invoice_attachment && (
                  <tr className="hover:bg-slate-50/50">
                    <th className="p-4 font-bold text-slate-500">Invoice Attachment</th>
                    <td className="p-4 font-semibold text-slate-700">
                      <Button variant="outline" size="sm" onClick={downloadAttachment} className="gap-2 h-9 rounded-lg font-bold text-blue-600 border-blue-200 hover:bg-blue-50">
                        <Download size={14} />
                        Download
                      </Button>
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-slate-50/50">
                  <th className="p-4 font-bold text-slate-500">Payment Note</th>
                  <td className="p-4 font-semibold text-slate-700">{expense.payment_note || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TVA TABLE */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider">TVA Elements</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">TVA Rate</th>
                  <th className="p-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">TVA Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expense.contents && expense.contents.length > 0 ? expense.contents.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-semibold text-slate-700">{row.tva_rate}%</td>
                    <td className="p-4 font-bold text-[#7a9800]">
                      {isCreditNote && row.tva_amount ? '-' : ''}
                      {formatAmount(row.tva_amount, currencySymbol)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={2} className="p-8 text-center font-bold text-slate-400">No TVA elements recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
