'use client';

import React, { useState, useMemo } from 'react';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from '@/firebase/firestore-override';
import { Search, Filter, Columns, Menu, Maximize, ArrowUpDown, MoreVertical, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

export default function CustomerFarmsPage() {
  const router = useRouter();
  const { customer, loading: authLoading, refreshUser } = useCustomerAuth();
  const { currentSeason } = useSeason();

  React.useEffect(() => {
    refreshUser();
  }, []);

  console.log("Customer Object:", customer);
  console.log("Customer Farms:", customer?.farms);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const db = useFirestore();

  const farmsQuery = useMemoFirebase(() => {
    if (!db || !customer?.id) return null;
    return query(collection(db, 'main_farms'));
  }, [db, customer?.id]);

  const { data: allFarms, isLoading } = useCollection<any>(farmsQuery);

  const filteredFarms = useMemo(() => {
    if (!customer?.farms) return [];
    
    // Map directly from customer.farms so they ALWAYS show up!
    let list = customer.farms.map((f: any) => {
      const farmId = typeof f === 'string' ? f : f.farmId;
      // Look up the full farm details if available
      const farmObj = allFarms?.find((farm: any) => String(farm.id).trim() === String(farmId).trim());
      
      return {
        id: farmId || Math.random().toString(),
        name: farmObj?.name || 'Assigned Farm',
        location: farmObj?.location || farmObj?.gpsLocation || farmObj?.address || '-',
        ggn: f.ggnNumber || f.ggn || farmObj?.ggn || farmObj?.code || '-'
      };
    });

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((f: any) => 
        (f.name || '').toLowerCase().includes(term) ||
        (f.ggn || '').toLowerCase().includes(term) ||
        (f.location || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [allFarms, customer?.farms, currentSeason, searchTerm]);

  const totalPages = Math.ceil(filteredFarms.length / itemsPerPage) || 1;
  const paginatedFarms = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFarms.slice(start, start + itemsPerPage);
  }, [filteredFarms, currentPage, itemsPerPage]);

  if (authLoading || isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 space-y-4 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="space-y-0.5 mb-4">
        <h1 className="text-2xl font-bold text-[#709506]">Farms</h1>
        <div className="text-sm text-slate-500">
          Profile / <span className="text-slate-400">Farms</span>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-slate-200">
        <div className="flex justify-end p-2 border-b border-slate-100 gap-2 text-slate-400">
          <Button variant="ghost" size="icon" className="h-8 w-8"><Search size={16} /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Filter size={16} /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Columns size={16} /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Menu size={16} /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize size={16} /></Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 hover:bg-transparent">
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Farm Name <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">GPS Location <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">GGN Number <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFarms.length > 0 ? paginatedFarms.map((farm: any) => (
              <TableRow 
                key={farm.id} 
                className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                onClick={() => router.push(`/customer-portal/farms/${farm.id}`)}
              >
                <TableCell className="text-[#709506] font-medium text-xs py-4">{farm.name || 'Unknown'}</TableCell>
                <TableCell className="text-slate-600 text-xs py-4">{farm.location || farm.gpsLocation || farm.address || '-'}</TableCell>
                <TableCell className="text-slate-600 text-xs py-4">{farm.ggn || farm.code || '-'}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-slate-500">No farms found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-3 flex items-center justify-end text-xs text-slate-500 border-t border-slate-100 gap-4">
          <span className="flex items-center gap-1">Rows per page 10 <ChevronDown size={14} /></span>
          <span>1-{paginatedFarms.length} of {filteredFarms.length}</span>
          <div className="flex items-center gap-1">
            <ChevronLeft size={16} className="text-slate-300" />
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
