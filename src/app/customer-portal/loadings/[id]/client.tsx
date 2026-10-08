'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from '@/firebase/firestore-override';

export default function CustomerSupplyChainLoadingViewPage() {
  const params = useParams();
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomerAuth();
  const db = useFirestore();

  const [loadingData, setLoadingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadingId = params?.id as string | undefined;

  useEffect(() => {
    if (!db || !loadingId) return;
    
    const fetchLoading = async () => {
      try {
        const docRef = doc(db, 'supply_chain_loadings', loadingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLoadingData({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error("Failed to fetch loading details", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLoading();
  }, [db, loadingId]);

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!loadingData) {
    return (
      <div className="p-8 text-center text-slate-500">
        Supply Chain Loading not found.
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 space-y-4 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-0.5 mb-4">
        <h1 className="text-2xl font-bold text-[#709506]">View Supply Chain Loading</h1>
        <div className="text-sm text-slate-500 flex items-center gap-1">
          Profile / <span className="cursor-pointer hover:underline" onClick={() => router.push('/customer-portal/loadings')}>Supply Chain Loadings</span> / <span className="text-slate-400">View Supply Chain Loading</span>
        </div>
      </div>

      {/* Customer Loadings Details */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Customer Loadings Details</h2>
        <div className="space-y-6 max-w-3xl">
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Order</span>
            <span className="text-[#709506] font-semibold">{loadingData.poNumber || loadingData.po_number || loadingData.dum || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Location</span>
            <span className="text-slate-600">{loadingData.locationName || loadingData.location || loadingData.port_of_loading || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Transit Supplier</span>
            <span className="text-slate-600">{loadingData.transitSupplierName || loadingData.supplierName || loadingData.transporter || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Transport Cost</span>
            <span className="text-slate-600">{loadingData.transportCost ? Number(loadingData.transportCost).toFixed(2) : '0.00'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Sous Dum</span>
            <span className="text-slate-600">{loadingData.sousDum || loadingData.sous_dum || '1'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Temp Tale</span>
            <span className="text-slate-600 truncate">
              {loadingData.tempTale || loadingData.temp_tale ? (
                <a 
                  href={loadingData.tempTale || loadingData.temp_tale} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 hover:underline underline-offset-2 truncate block"
                >
                  {loadingData.tempTale || loadingData.temp_tale}
                </a>
              ) : (
                '-'
              )}
            </span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Loading Status</span>
            <span className="text-slate-600">{loadingData.loadingStatus || loadingData.status || 'In Transit'}</span>
          </div>
        </div>
      </div>

      {/* Supply Chain Loading Files */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Supply Chain Loading Files</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-800 font-semibold border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">File Type</th>
                <th className="py-3 px-4">File Link</th>
                <th className="py-3 px-4">File Extension</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {(!loadingData.files || loadingData.files.length === 0) ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">No files uploaded for this loading.</td>
                </tr>
              ) : (
                loadingData.files.map((file: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-4 px-4 font-medium text-slate-700">{file.fileName || file.name || 'N/A'}</td>
                    <td className="py-4 px-4">{file.fileType || file.type || 'Other documents'}</td>
                    <td className="py-4 px-4">
                      {file.fileUrl || file.url ? (
                        <a 
                          href={file.fileUrl || file.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="bg-[#709506] hover:bg-[#5f7e05] text-white px-4 py-1.5 rounded text-xs font-semibold inline-block shadow-xs transition-colors"
                        >
                          Download
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-4 px-4 lowercase text-slate-500">{file.fileExtension || file.fileName?.split('.').pop() || 'pdf'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
