'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from '@/firebase/firestore-override';
import { ChevronLeft, Download } from 'lucide-react';

export default function CustomerFarmViewPage() {
  const params = useParams();
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomerAuth();
  const db = useFirestore();

  const [farmData, setFarmData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const farmId = params?.id as string | undefined;

  // Fetch the farm data directly from main_farms
  useEffect(() => {
    if (!db || !farmId) return;
    
    const fetchFarm = async () => {
      try {
        const docRef = doc(db, 'main_farms', farmId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFarmData({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error("Failed to fetch farm", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFarm();
  }, [db, farmId]);

  // Fetch lab analysis for this farm
  const labQuery = useMemoFirebase(() => {
    if (!db || !farmData?.name) return null;
    return query(collection(db, 'lab_analysis'), orderBy('date', 'desc'));
  }, [db, farmData?.name]);

  const { data: allLabs } = useCollection<any>(labQuery);

  const farmLabs = useMemo(() => {
    if (!allLabs || !farmData?.name) return [];
    return allLabs.filter(lab => 
      lab.farmName?.toLowerCase() === farmData.name.toLowerCase()
    );
  }, [allLabs, farmData?.name]);

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!farmData) {
    return (
      <div className="p-8 text-center text-slate-500">
        Farm not found.
      </div>
    );
  }

  // Find the farm in the customer's assigned farms to get customer-specific data (like GGN if overridden)
  const assignedFarm = customer?.farms?.find((f: any) => 
    String(f.farmId).trim() === String(farmData.id).trim() || 
    String(f).trim() === String(farmData.id).trim()
  );

  return (
    <div className="p-2 md:p-4 space-y-4 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-0.5 mb-4">
        <h1 className="text-2xl font-bold text-[#709506]">Farm View</h1>
        <div className="text-sm text-slate-500 flex items-center gap-1">
          Profile / <span className="cursor-pointer hover:underline" onClick={() => router.push('/customer-portal/farms')}>Farms</span> / <span className="text-slate-400">View Farm</span>
        </div>
      </div>

      {/* Farm Details */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Farm Details</h2>
        <div className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">Name</span>
            <span className="text-[#709506] font-semibold">{farmData.name || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">GPS Location</span>
            <span className="text-slate-600">{farmData.gpsLocation || farmData.location || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[200px_1fr] items-center text-sm">
            <span className="font-semibold text-slate-800">GGN Number</span>
            <span className="text-slate-600">{assignedFarm?.ggnNumber || farmData.ggnNumber || farmData.code || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Farm Certificates */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Farm Certificates</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-800 font-semibold border-b border-slate-100">
              <tr>
                <th className="pb-4 pt-2">File Name</th>
                <th className="pb-4 pt-2">File Type</th>
                <th className="pb-4 pt-2">File Link</th>
                <th className="pb-4 pt-2">File Extension</th>
                <th className="pb-4 pt-2">Expire Date</th>
                <th className="pb-4 pt-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {(!farmData.certificates || farmData.certificates.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No certificates found.</td>
                </tr>
              ) : (
                farmData.certificates.map((cert: any, i: number) => (
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
                    <td className="py-4">{cert.expiryDate || 'N/A'}</td>
                    <td className="py-4">{cert.note || 'Valide'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lab Analysis */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <h2 className="text-[#3b2164] font-semibold text-xl mb-6">Lab Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-800 font-semibold border-b border-slate-100">
              <tr>
                <th className="pb-4 pt-2">Date</th>
                <th className="pb-4 pt-2">Analysis name</th>
                <th className="pb-4 pt-2">Lab Name</th>
                <th className="pb-4 pt-2">Product Name</th>
                <th className="pb-4 pt-2">Farm</th>
                <th className="pb-4 pt-2">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {farmLabs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No lab analysis found.</td>
                </tr>
              ) : (
                farmLabs.map((lab: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-4">{lab.date || 'N/A'}</td>
                    <td className="py-4">{lab.analysisName || 'N/A'}</td>
                    <td className="py-4">{lab.labName || 'N/A'}</td>
                    <td className="py-4">{lab.productName || 'N/A'}</td>
                    <td className="py-4">{lab.farmName || 'N/A'}</td>
                    <td className="py-4">
                      {lab.fileUrl || lab.reportUrl ? (
                        <a href={lab.fileUrl || lab.reportUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 underline underline-offset-2">Download</a>
                      ) : (
                        '-'
                      )}
                    </td>
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
