'use client';

import React, { useState } from 'react';
import { useFirestore } from '@/firebase';
import { runInvoiceBackfill } from '@/lib/invoice-generator';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BackfillPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleBackfill = async () => {
    if (!db) {
      toast({ title: 'Error', description: 'DB not connected', variant: 'destructive' });
      return;
    }
    
    if (confirm('Run safe backfill for missing supply chain loading invoice numbers?')) {
      setIsBackfilling(true);
      try {
        const res = await runInvoiceBackfill(db, new Date().getFullYear());
        setResults(res);
        toast({ title: 'Success', description: `Fixed ${res.fixedLoadingsCount} invoices.` });
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setIsBackfilling(false);
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Backfill Loading Invoices</h1>
      <p className="mb-4">This page is a temporary utility to backfill missing "-" invoice numbers in Supply Chain Loadings.</p>
      <Button onClick={handleBackfill} disabled={isBackfilling || !db}>
        {isBackfilling ? <Loader2 className="animate-spin mr-2" /> : null}
        Run Backfill
      </Button>
      {results && (
        <pre className="mt-4 p-4 bg-slate-100 rounded">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </div>
  );
}
