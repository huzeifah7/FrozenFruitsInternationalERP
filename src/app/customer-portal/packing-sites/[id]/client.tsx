'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from '@/firebase/firestore-override';

export default function CustomerPackingSiteViewPage() {
  const params = useParams();
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomerAuth();
  const db = useFirestore();

  const [lineData, setLineData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch line data from processing_lines collection
  useEffect(() => {
    if (!db || !params.id) return;
    
    const fetchLine = async () => {
      try {
        const docRef = doc(db, 'processing_lines', params.id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLineData({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error("Failed to fetch packing site", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLine();
  }, [db, params.id]);

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lineData) {
    return (
      <div className="p-8 text-center text-slate-500">
        Packing site not found.
      </div>
    );
  }

  // Find customer-assigned specific details if available
  const assignedLine = customer?.processingLines?.find((pl: any) => 
    String(pl.locationId).trim() === String(lineData.id).trim() || 
    String(pl).trim() === String(lineData.id).trim()
  );

  return (
    <div className="p-2 md:p-4 space-y-4 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-0.5 mb-4">
        <h1 className="text-2xl font-bold text-[#709506]">View Packaging Site</h1>
        <div className="text-sm text-slate-500 flex items-center gap-1">
          Profile / <span className="cursor-pointer hover:underline" onClick={() => router.push('/customer-portal/packing-sites')}>View Packing Sites</span> / <span className="text-slate-400">View</span>
        </div>
      </div>

      {/* Packaging Site Details */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Packaging Site Details</h2>
        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Title</span>
            <span className="text-[#709506] font-semibold">{lineData.title || lineData.name || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">GPS Location</span>
            <span className="text-slate-600">{assignedLine?.gpsLocation || lineData.gpsLocation || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Description</span>
            <span className="text-slate-600">{assignedLine?.description || lineData.description || '-'}</span>
          </div>
        </div>
      </div>

      {/* Location Certificates */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Location Certificates</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-800 font-semibold border-b border-slate-100">
              <tr>
                <th className="pb-4 pt-2">File Name</th>
                <th className="pb-4 pt-2">File Type</th>
                <th className="pb-4 pt-2">File Link</th>
                <th className="pb-4 pt-2">File Extension</th>
                <th className="pb-4 pt-2">Expiry Date</th>
                <th className="pb-4 pt-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {(!lineData.certificates || lineData.certificates.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No certificates found.</td>
                </tr>
              ) : (
                lineData.certificates.map((cert: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-4">{cert.fileName || 'N/A'}</td>
                    <td className="py-4">{cert.fileType || 'N/A'}</td>
                    <td className="py-4">
                      {cert.fileUrl ? (
                        <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 underline underline-offset-2">Download</a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-4">{cert.fileExtension || 'pdf'}</td>
                    <td className="py-4">{cert.expiryDate || cert.expireDate || 'N/A'}</td>
                    <td className="py-4">{cert.note || 'Valide'}</td>
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
