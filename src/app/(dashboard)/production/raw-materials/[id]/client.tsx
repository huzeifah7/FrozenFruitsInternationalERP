'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where 
} from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { generateRawMaterialDetailPDF } from '@/lib/export-raw-material-detail-pdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Printer,
  Scale,
  Calendar,
  User,
  MapPin,
  Truck,
  Package,
  ClipboardCheck,
  Tag,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ViewRawMaterialPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const [rm, setRm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!db || !id) return;

    const fetchData = async () => {
      try {
        // Fetch Reference Data
        const [locSnap, supSnap, prodSnap] = await Promise.all([
          getDocs(collection(db, 'processing_lines')),
          getDocs(collection(db, 'procurement_suppliers')),
          getDocs(collection(db, 'products'))
        ]);

        setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSuppliers(supSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Raw Material
        const docRef = doc(db, 'raw_materials', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const rmData = { id: docSnap.id, ...docSnap.data() };
          
          // Fetch Pallets from flat collection
          const palletQuery = query(
            collection(db, 'palletizations'),
            where('rawMaterialId', '==', id)
          );
          const palletSnap = await getDocs(palletQuery);
          const pallets = palletSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => (a.barcode || '').localeCompare(b.barcode || ''));
          
          setRm({ ...rmData, pallets });
        } else {
          console.error("No such document!");
        }
      } catch (err) {
        console.error("Error fetching raw material:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, id]);

  const groupedPallets = React.useMemo(() => {
    if (!rm || !rm.pallets) return {};
    
    const groups: Record<string, {
      productName: string;
      palletType: string;
      totalNetWeight: number;
      items: any[];
    }> = {};
    
    rm.pallets.forEach((pallet: any) => {
      const prod = products.find(p => p.id === pallet.productId);
      const cat = prod?.category || 'Unknown Product';
      const pType = prod?.type || '';
      const groupKey = `${pallet.productId}_${pallet.type}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          productName: pType ? `${cat} - ${pType}` : cat,
          palletType: pallet.type,
          totalNetWeight: 0,
          items: []
        };
      }
      
      groups[groupKey].totalNetWeight += Number(pallet.netWeight || 0);
      groups[groupKey].items.push(pallet);
    });
    
    return groups;
  }, [rm, products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FB]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!rm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FB] gap-4">
        <AlertCircle size={48} className="text-slate-300" />
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Record Not Found</h2>
        <Button onClick={() => router.back()} variant="outline">Go Back</Button>
      </div>
    );
  }

  const handlePrintPallet = (pallet: any) => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) {
      alert('Please allow popups to print ticket.');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === rm.supplierId);
    const supplierName = supplierObj ? (supplierObj.name || supplierObj.supplierName) : '—';

    const prodObj = products.find(p => p.id === pallet.productId);
    const productName = prodObj ? (prodObj.type ? `${prodObj.category} - ${prodObj.type}` : prodObj.category) : '—';

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label ${pallet.barcode}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              width: 80mm;
              margin: 0;
              padding: 4mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
              box-sizing: border-box;
            }
            .ticket-container {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: stretch;
            }
            .title {
              text-align: center;
              font-weight: bold;
              font-size: 15px;
              margin-bottom: 8px;
              text-transform: uppercase;
              border-bottom: 1px dashed #000;
              padding-bottom: 4px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .row-label {
              font-weight: bold;
            }
            .row-value {
              text-align: right;
              max-width: 55%;
              word-wrap: break-word;
            }
            .barcode-container {
              margin-top: 12px;
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 100%;
              border-top: 1px dashed #000;
              padding-top: 6px;
            }
            #barcode {
              width: 100%;
              max-height: 55px;
            }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            <div class="title">Palletization Ticket</div>
            <div class="row">
              <span class="row-label">Lot Number#</span>
              <span class="row-value">${rm.lotNumber || '—'}</span>
            </div>
            <div class="row">
              <span class="row-label">Date And Time#</span>
              <span class="row-value">${rm.dateTime ? rm.dateTime.replace('T', ' ') : '—'}</span>
            </div>
            <div class="row">
              <span class="row-label">Supplier</span>
              <span class="row-value">${supplierName || '—'}</span>
            </div>
            <div class="row">
              <span class="row-label">Product</span>
              <span class="row-value">${productName || '—'}</span>
            </div>
            <div class="row">
              <span class="row-label">Gross Weight</span>
              <span class="row-value">${pallet.grossWeight || 0} KG</span>
            </div>
            <div class="row">
              <span class="row-label">Net Weight</span>
              <span class="row-value">${pallet.netWeight || 0} KG</span>
            </div>
            <div class="row">
              <span class="row-label">Boxes#</span>
              <span class="row-value">${pallet.boxes || 0}</span>
            </div>
            <div class="row">
              <span class="row-label">Barcode#</span>
              <span class="row-value">${pallet.barcode || '—'}</span>
            </div>
            <div class="barcode-container">
              <svg id="barcode"></svg>
            </div>
          </div>
          <script>
            window.onload = function() {
              try {
                JsBarcode("#barcode", "${pallet.barcode}", {
                  format: "CODE128",
                  width: 2,
                  height: 40,
                  displayValue: true,
                  fontSize: 11,
                  margin: 0
                });
              } catch (e) {
                console.error("Barcode generation failed", e);
              }
              setTimeout(function() {
                window.print();
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintRawMaterial = async () => {
    try {
      const supplierName = getSupName(rm.supplierId);
      const locationName = getLocName(rm.locationId);
      const totalBoxes = (rm.pallets || []).reduce((sum: number, p: any) => sum + (Number(p.boxes) || 0), 0);
      const emptyBoxes = (rm.emptyBoxes !== undefined) ? rm.emptyBoxes : (Number(rm.boxesIn || 0) - totalBoxes);

      await generateRawMaterialDetailPDF({
        ...rm,
        supplierName,
        locationName,
        emptyBoxes,
        totalNetWeight: rm.totalNetWeight || 0,
        blNetWeight: rm.blNetWeight || 0,
        blGrossWeight: rm.blGrossWeight || 0,
        boxesIn: rm.boxesIn || 0,
        boxesOut: rm.boxesOut || 0,
        products: products,
        pallets: rm.pallets || []
      });
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Failed to generate PDF");
    }
  };

  const getLocName = (id: string) => locations.find(l => l.id === id)?.title || id || 'Unknown';
  const getSupName = (id: string) => {
    const s = suppliers.find(s => s.id === id);
    if (!s) return id || 'Unknown';
    return s.name || s.supplierName || id || 'Unknown';
  };
  const getProductName = (id: string) => {
    const p = products.find(prod => prod.id === id);
    if (!p) return id || 'Unknown';
    return `${p.category} ${p.type}`;
  };

  const formatDateTime = (val: any) => {
    if (!val) return '-';
    try {
      if (val.seconds) {
        return format(val.toDate(), 'PPP p');
      }
      return format(new Date(val), 'PPP p');
    } catch (e) {
      return String(val);
    }
  };

  const formatDateOnly = (val: any) => {
    if (!val) return '-';
    try {
      if (val.seconds) {
        return format(val.toDate(), 'PPP');
      }
      const parsedDate = val.includes('T') ? new Date(val) : new Date(val + 'T00:00:00');
      return format(parsedDate, 'PPP');
    } catch (e) {
      return String(val);
    }
  };

  return (
    <div className="w-full p-6 lg:p-8 bg-[#F5F7FA] min-h-screen animate-in fade-in duration-300">
      
      {/* 1. Sleek Navigation & Header */}
      <div className="max-w-[1280px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/production/raw-materials')}>ERP</span>
            <span className="opacity-40">/</span>
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/production/raw-materials')}>Raw Materials</span>
            <span className="opacity-40">/</span>
            <span className="text-[#708238] font-black uppercase">View Details</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => router.back()} 
              className="h-10 w-10 rounded-xl border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
            >
              <ChevronLeft size={18} className="text-slate-500" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase flex items-center gap-3">
                Lot Details
                <span className="bg-[#708238]/10 text-[#708238] border border-[#708238]/20 px-3 py-1 text-sm font-black rounded-lg tracking-normal uppercase">
                  {rm.lotNumber}
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Button 
            className="bg-[#708238] hover:bg-[#5b6a2e] text-white gap-2 font-bold px-6 py-2.5 h-11 rounded-xl transition-all shadow-md shadow-[#708238]/10 hover:shadow-lg flex items-center uppercase tracking-wider text-xs"
            onClick={handlePrintRawMaterial}
          >
            <Printer size={16} /> Print Raw Material
          </Button>
        </div>
      </div>

      {/* 2. Glassmorphic Hero Summary Banner */}
      <div className="max-w-[1280px] mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric A: Total Net Weight */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
            <Scale size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Net Weight</p>
            <h3 className="text-lg font-black text-slate-800">{rm.totalNetWeight?.toLocaleString() || '0'} KG</h3>
          </div>
        </div>

        {/* Metric B: Boxes In */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Boxes Received</p>
            <h3 className="text-lg font-black text-slate-800">{rm.boxesIn?.toLocaleString() || '0'} Crt</h3>
          </div>
        </div>

        {/* Metric C: Supplier Code */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/50">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier Name</p>
            <h3 className="text-xs font-black text-slate-700 truncate max-w-[150px] uppercase">{getSupName(rm.supplierId)}</h3>
          </div>
        </div>

        {/* Metric D: Line Assignment */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md transition-all flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/50">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location Line</p>
            <h3 className="text-xs font-black text-[#708238] uppercase bg-[#708238]/5 px-2 py-0.5 rounded border border-[#708238]/10 w-fit">
              {getLocName(rm.locationId)}
            </h3>
          </div>
        </div>

      </div>

      {/* 3. Main Details Grid */}
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns: Delivery Details & Palletization */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Card: View Raw Material Info */}
          <Card className="border-none shadow-[0_12px_40px_rgba(0,0,0,0.03)] rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-[#708238] rounded-full inline-block"></span>
                Intake & Origin Specifications
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Block A: Origin & Product */}
                <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Commercial Origin
                  </h3>
                  
                  <div className="space-y-5">
                    {/* Supplier */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Supplier Name</p>
                        <p className="text-sm font-bold text-slate-700 uppercase">{getSupName(rm.supplierId)}</p>
                      </div>
                    </div>

                    {/* Farm */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Farm Name</p>
                        <p className="text-sm font-bold text-slate-700 uppercase">{rm.farmName || 'Unknown Farm'}</p>
                        {rm.farmCodification && (
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5 font-mono">{rm.farmCodification}</p>
                        )}
                      </div>
                    </div>

                    {/* Product */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <Package size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Product Family</p>
                        <p className="text-sm font-bold text-slate-700 uppercase">{rm.productFamily || 'Avocado'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block B: Delivery & Logistics */}
                <div className="space-y-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Logistics & Reception
                  </h3>
                  
                  <div className="space-y-5">
                    {/* Date */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift Date</p>
                        <p className="text-sm font-bold text-slate-700">{formatDateOnly(rm.date || rm.dateTime?.split('T')[0])}</p>
                      </div>
                    </div>

                    {/* Logistics */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <Truck size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivery Vehicle</p>
                        <p className="text-sm font-bold text-slate-700 uppercase">{rm.driverName || 'No Driver Named'}</p>
                        <p className="text-[10px] text-[#708238] font-black tracking-widest uppercase mt-0.5">
                          Plate: <span className="bg-[#708238]/5 px-2 py-0.5 border border-[#708238]/10 rounded font-mono">{rm.plateNumber}</span>
                        </p>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</p>
                        <p className="text-xs font-semibold text-slate-600">{formatDateTime(rm.dateTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Weight Comparison Chart-Bar */}
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Weight Audit (BL vs Actual)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100/50">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Waybill Net Weight (BL)</span>
                    <span className="text-base font-black text-slate-700">{rm.blNetWeight?.toLocaleString() || '0'} KG</span>
                  </div>
                  
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actual Grouped Weight</span>
                    <span className="text-base font-black text-emerald-600">{rm.totalNetWeight?.toLocaleString() || '0'} KG</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Variance</span>
                    {(() => {
                      const blNet = Number(rm.blNetWeight || 0);
                      const actNet = Number(rm.totalNetWeight || 0);
                      const variance = actNet - blNet;
                      const sign = variance >= 0 ? '+' : '';
                      const color = variance >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100';
                      return (
                        <span className={`text-xs font-black px-2 py-0.5 border rounded-lg w-fit ${color}`}>
                          {sign}{variance.toLocaleString()} KG
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Grouped Palletization Tables */}
          <div className="space-y-6">
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#708238] rounded-full inline-block"></span>
              Palletization breakdown
            </h2>
            
            {Object.keys(groupedPallets).length === 0 ? (
              <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2rem] bg-white p-8 text-center text-slate-400 italic">
                No palletization breakdowns created yet for this intake.
              </Card>
            ) : (
              Object.entries(groupedPallets).map(([groupKey, group]: [string, any]) => (
                <Card key={groupKey} className="border-none shadow-[0_12px_40px_rgba(0,0,0,0.03)] rounded-[1.8rem] bg-white overflow-hidden border border-slate-100/50">
                  <div className="bg-gradient-to-r from-slate-50 to-white px-8 py-5 border-b border-slate-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        group.palletType === 'Farm Decay' ? 'text-rose-600 bg-rose-50 border border-rose-100' : 'text-[#708238] bg-[#708238]/10'
                      }`}>
                        {group.palletType}
                      </span>
                      <h3 className="font-black text-slate-850 uppercase tracking-wide text-xs">
                        {group.productName}
                      </h3>
                    </div>
                    <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100/50">
                      Total Net: {group.totalNetWeight.toLocaleString()} KG
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/20">
                        <TableRow className="border-b border-slate-100">
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4.5 pl-8">Barcode Tag</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4.5">Product Variety</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4.5 text-center">Gross Weight</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4.5 text-center">Net Weight</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4.5 text-center">Boxes (Crt)</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4.5 pr-8 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((pallet: any) => (
                          <TableRow key={pallet.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                            <TableCell className="pl-8 py-4">
                              <span className="inline-flex items-center gap-1 text-xs font-black bg-slate-100 text-[#708238] px-3 py-1 rounded-xl border border-slate-200/50 font-mono shadow-sm">
                                <Tag size={12} className="opacity-75" />
                                {pallet.barcode}
                              </span>
                            </TableCell>
                            <TableCell className="py-4 font-bold text-xs text-slate-700">
                              {group.productName}
                            </TableCell>
                            <TableCell className="py-4 text-center font-bold text-xs text-slate-500">
                              {pallet.grossWeight?.toLocaleString()} KG
                            </TableCell>
                            <TableCell className="py-4 text-center font-black text-xs text-slate-800">
                              {pallet.netWeight?.toLocaleString()} KG
                            </TableCell>
                            <TableCell className="py-4 text-center font-bold text-xs text-slate-600">
                              {pallet.boxes}
                            </TableCell>
                            <TableCell className="py-4 pr-8 text-right">
                              <Button 
                                className="bg-[#708238] hover:bg-[#5b6a2e] text-white font-bold h-8 px-4 rounded-xl transition-all hover:shadow-md hover:shadow-[#708238]/10 text-[10px] uppercase tracking-wider flex items-center gap-1.5 ml-auto border border-none shadow-sm"
                                onClick={() => handlePrintPallet(pallet)}
                              >
                                <Printer size={12} /> Print Label
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Specification widgets & analytics */}
        <div className="space-y-8">
          
          {/* Card: Quality Metrics */}
          <Card className="border-none shadow-[0_12px_40px_rgba(0,0,0,0.03)] rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-8">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-[#708238] rounded-full inline-block"></span>
                Quality Audit Check
              </h2>
              
              <div className="space-y-6">
                {/* Status indicator row */}
                <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-[#708238]" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audit Decision</span>
                  </div>
                  <Badge className={`h-8 px-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-sm ${
                    rm.status === 'Normal' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 
                    rm.status === 'Avec Statistique' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                    'bg-rose-100 text-rose-700 border border-rose-200'
                  }`}>
                    {rm.status}
                  </Badge>
                </div>

                {/* Calibre Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Calibre Dominant</p>
                    <p className="text-base font-black text-slate-800">{rm.calibreDominant || 'Not Assigned'}</p>
                  </div>
                  
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/50 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Crates Box Type</p>
                    <p className="text-[11px] font-black text-[#708238] uppercase truncate px-2.5 py-1 rounded bg-[#708238]/5 w-fit mx-auto mt-0.5 border border-[#708238]/10">
                      {rm.boxType === 'EXPORT_OPTIMUM' ? 'Optimum' : rm.boxType === 'AGRICENTER' ? 'Agricenter' : rm.boxType || 'Optimum'}
                    </p>
                  </div>
                </div>

                {/* Petit Calibre and Dechet Visual Sliders */}
                <div className="space-y-4 pt-2">
                  {/* Petit Calibre Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Petit Calibre Ratio</span>
                      <span className="font-black text-slate-700">{rm.petitCalibre || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(rm.petitCalibre || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Dechet Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dechet (Decay Ratio)</span>
                      <span className="font-black text-rose-600">{rm.dechet || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(rm.dechet || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Remarks Quote Box */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                    <FileText size={12} />
                    <span>Audit Notes / Remarks</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-semibold text-slate-650 italic min-h-[90px] leading-relaxed flex items-center justify-center text-center">
                    {rm.remarks ? `"${rm.remarks}"` : 'No custom remarks recorded for this lot entry.'}
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Card: Crate Follow Up Summary Card */}
          <Card className="border-none shadow-[0_12px_40px_rgba(0,0,0,0.03)] rounded-[2rem] bg-white overflow-hidden bg-gradient-to-br from-white to-slate-50/50">
            <CardContent className="p-8">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-[#708238] rounded-full inline-block"></span>
                Intake Crates Summary
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-sm text-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Boxes In</span>
                  <span className="text-2xl font-black text-[#708238] bg-[#708238]/5 px-3.5 py-1.5 rounded-2xl border border-[#708238]/10 inline-block font-mono mt-1">
                    {rm.boxesIn?.toLocaleString() || '0'}
                  </span>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-sm text-center flex flex-col justify-center items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Standard Box Code</span>
                  <span className="text-xs font-black text-slate-700 bg-slate-50 border border-slate-200/50 px-2.5 py-1.5 rounded-xl block truncate uppercase tracking-widest mt-1 font-mono">
                    {rm.boxType || 'Optimum'}
                  </span>
                </div>
              </div>

              {/* Box Flow Summary Tag */}
              <div className="mt-5 p-4.5 bg-[#708238]/5 border border-[#708238]/10 rounded-2xl flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-[#708238]/10 text-[#708238] flex items-center justify-center">
                  <Package size={16} />
                </div>
                <div className="text-xs font-semibold text-slate-650 leading-snug">
                  Crates follow-up assigns these incoming empty boxes directly into inventory for lot sorting.
                </div>
              </div>

            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
