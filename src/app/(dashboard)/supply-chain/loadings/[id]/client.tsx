'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from '@/firebase/firestore-override';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Download } from 'lucide-react';

export default function ViewSupplyChainLoadingPage() {
  const router = useRouter();
  const { id: loadingId } = useParams();
  const db = useFirestore();
  const { user } = useUser();

  const [loading, setLoading] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !loadingId) return;
      try {
        const docRef = doc(db, 'supply_chain_loadings', loadingId as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const loadingData = { id: docSnap.id, ...(docSnap.data() as any) };
          setLoading(loadingData);
          
          if (loadingData.orderId) {
            const orderDocRef = doc(db, 'orders', loadingData.orderId);
            const orderSnap = await getDoc(orderDocRef);
            if (orderSnap.exists()) {
              setOrder({ id: orderSnap.id, ...orderSnap.data() });
            }
          }
        }
      } catch (err) {
        console.error("Error fetching loading:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [db, loadingId]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  }

  if (!loading) {
    return <div className="p-8 text-center text-red-500">Loading not found.</div>;
  }

  const createdAtDate = loading.createdAt?.toDate ? loading.createdAt.toDate() : (loading.createdAt ? new Date(loading.createdAt) : null);

  const renderField = (label: string, value: any) => (
    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="font-bold text-gray-700 text-[13px]">{label}</span>
      <span className="text-gray-500 text-[13px] sm:text-right break-words max-w-[500px]">
        {value || '—'}
      </span>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 bg-[#fafafa] min-h-screen animate-in fade-in duration-700">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[#333]">Supply Chain Loading</h1>
            <div className="text-[13px] text-gray-500 font-medium">Profile / Supply Chain Loading / View Supply Chain Loading</div>
          </div>
          <Button 
            onClick={() => router.push('/supply-chain/loadings')}
            variant="outline"
            className="h-9 gap-2 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Loadings
          </Button>
        </div>

        {/* Details Card */}
        <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-white border-b border-gray-100 pb-4">
            <CardTitle className="text-xl font-bold text-[#4c3575]">Supply Chain Loading Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-1">
              {renderField('Date', createdAtDate ? createdAtDate.toLocaleDateString() : '—')}
              {renderField('PO Order', loading.poNumber)}
              {renderField('Invoice Number', loading.invoice_number)}
              {renderField('ETA Date', order?.etaWeek ? `Wk ${order.etaWeek}` : '—')}
              {renderField('Location', loading.locationName)}
              {renderField('Customer', order?.customerName)}
              {renderField('Transit Supplier', loading.transitSupplierName)}
              {renderField('Loading Status', loading.loadingStatus)}
              {renderField('Truck Number', loading.numeroChauffeur)}
              {renderField('Weight', order?.totalWeight ? `${order.totalWeight} kg` : '—')}
              {renderField('Invoice Amount', loading.valueInMad ? Number(loading.valueInMad).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—')}
              {renderField('Packaging', loading.produit)}
              {renderField('Transport Cost', loading.transportCost ? Number(loading.transportCost).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0')}
              {renderField('Sous Dum', loading.sousDum)}
              {renderField('Temp Tale', loading.tempTale)}
              {renderField('Value In MAD', loading.valueInMad)}
              {renderField('Exchange Rate', loading.exchangeRate)}
              {renderField('Dum', loading.dum)}
              {renderField('Facture Trans', loading.factureTrans)}
              {renderField('Facture Transitaire', loading.factureTransitaire)}
              {renderField('Num Expédition DHL', loading.numExpeditionDhl)}
              {renderField('Facture DHL', loading.factureDhl)}
              {renderField('Produit', loading.produit)}
              {renderField('T1 and Phyto', loading.t1AndPhyto)}
              {renderField('Numero du Chauffeur', loading.numeroChauffeur)}
            </div>
          </CardContent>
        </Card>

        {/* Files Card */}
        <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-white border-b border-gray-100 pb-4">
            <CardTitle className="text-xl font-bold text-[#4c3575]">Supply Chain Loading Files</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading.files && loading.files.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px] whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-700 font-bold bg-gray-50/50">
                      <th className="py-4 px-6">File Name</th>
                      <th className="py-4 px-6">File Type</th>
                      <th className="py-4 px-6">File Link</th>
                      <th className="py-4 px-6">File Extension</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600">
                    {loading.files.map((file: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50/30 transition-colors">
                        <td className="py-4 px-6">{file.fileName || '—'}</td>
                        <td className="py-4 px-6">{file.fileType || '—'}</td>
                        <td className="py-4 px-6">
                          {file.fileUrl ? (
                            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-semibold">
                              <Download className="h-4 w-4" /> Download
                            </a>
                          ) : '—'}
                        </td>
                        <td className="py-4 px-6 uppercase text-xs font-bold text-gray-400">{file.fileExtension || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 font-medium">
                <FileText className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                No files uploaded for this loading.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
