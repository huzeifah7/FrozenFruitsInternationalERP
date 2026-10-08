'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, runTransaction } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, MapPin, Globe, Truck, Map, Hash, CalendarDays, Factory, Box, FileText, Scale, ShieldCheck, Ship, Printer, FileSpreadsheet, Download, FileDigit } from 'lucide-react';
import { PackingListHeader } from '@/components/packing-list/PackingListHeader';
import { PackingListPDF } from '@/components/packing-list/PackingListPDF';
import { pdf } from '@react-pdf/renderer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PackingListTable } from '@/components/packing-list/PackingListTable';
import { SummarySection } from '@/components/packing-list/SummarySection';
import { ActionButtons } from '@/components/packing-list/ActionButtons';
import { generatePackingListExcel } from '@/lib/packingListExcel';
import { generateInvoicePDF } from '@/lib/export-invoice-pdf';
import { extractWeightFromPackaging } from '@/lib/utils';

import { generateNextInvoiceNumber } from '@/lib/invoice-generator';

export default function PackingListDetailPage() {
  const router = useRouter();
  const { id } = useParams(); 
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [packingList, setPackingList] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [mainFarmGgn, setMainFarmGgn] = useState<string>('—');
  const [loading, setLoading] = useState(true);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [poMap, setPoMap] = useState<Record<string, any>>({});
  const [productsList, setProductsList] = useState<any[]>([]);

  useEffect(() => {
    if (!db || !id) return;
    const fetchAll = async () => {
      try {
        const docRef = doc(db, 'packingLists', id as string);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          toast({ title: 'Not Found', description: 'Packing list not found.', variant: 'destructive' });
          router.push('/supply-chain/packing-lists');
          return;
        }
        const plData: any = { id: snap.id, ...snap.data() };
        
        let order: any = null;
        let customer: any = null;

        // Fetch Order
        if (plData.orderId) {
          const oSnap = await getDoc(doc(db, 'orders', plData.orderId));
          if (oSnap.exists()) order = { id: oSnap.id, ...oSnap.data() };
        } else if (plData.poNumber) {
          const oq = query(collection(db, 'orders'), where('poNumber', '==', plData.poNumber));
          const oSnap = await getDocs(oq);
          if (!oSnap.empty) order = { id: oSnap.docs[0].id, ...oSnap.docs[0].data() };
        }

        // Fetch Customer
        if (order && (order.customerId || order.customerName || order.customer)) {
          const custName = order.customerName || order.customer;
          let cData: any = null;
          if (order.customerId) {
            const cSnap = await getDoc(doc(db, 'customers', order.customerId));
            if (cSnap.exists()) cData = cSnap.data();
          }
          if (!cData && custName) {
            const cq = query(collection(db, 'customers'), where('companyName', '==', custName));
            const cSnap = await getDocs(cq);
            if (!cSnap.empty) cData = cSnap.docs[0].data();
          }

          if (cData) {
            const billing = cData.addresses?.find((a: any) => a.type === 'Billing') || cData.addresses?.[0];
            const delivery = cData.addresses?.find((a: any) => a.type === 'Delivery') || cData.addresses?.[0];
            const formatAddr = (a: any) => a ? `${a.street || ''}, ${a.city || ''} ${a.zipCode || ''}, ${a.country || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/, ,/g, ',') : '';
            
            customer = {
              name: custName || cData.companyName || '—',
              address: formatAddr(billing),
              deliveryAddress: formatAddr(delivery) || formatAddr(billing),
              country: billing?.country || '',
              city: billing?.city || '',
              farms: cData.farms || [],
              paymentTerms: cData.payment_term_name || cData.paymentTerms || cData.payment_terms || '',
              incoterm: cData.incoterm || ''
            };
          }
        }

        // Resolve Main Farm GGN Number
        let resolvedGgn = order?.ggnNumber || '—';
        if (resolvedGgn === '—' && order && customer) {
          const farmId = order.farmId;
          if (farmId) {
            try {
              const mfSnap = await getDoc(doc(db, 'main_farms', farmId));
              if (mfSnap.exists()) {
                resolvedGgn = mfSnap.data().ggnNumber || '—';
              }
            } catch (e) {
              console.error('Error fetching main farm GGN:', e);
            }
          }
          
          if (resolvedGgn === '—' && customer.farms && Array.isArray(customer.farms)) {
            const targetFarm = customer.farms.find((f: any) => f.farmId === farmId) || customer.farms[0];
            if (targetFarm?.ggnNumber) {
              resolvedGgn = targetFarm.ggnNumber;
            }
          }
        }

        // Fetch production outputs to resolve packaging names for internal production
        const poMapData: Record<string, any> = {};
        if (plData.productionType === 'Internal Production' && plData.orderId) {
          try {
            const poSnap = await getDocs(query(collection(db, 'production_output'), where('orderPoId', '==', plData.orderId)));
            poSnap.forEach(poDoc => {
              const poVal = poDoc.data();
              if (poVal.barcode) {
                poMapData[poVal.barcode] = poVal;
              }
            });
          } catch (poErr) {
            console.error('Error fetching production outputs:', poErr);
          }
        }

        // Fetch Products
        let prods: any[] = [];
        try {
          const prodSnap = await getDocs(collection(db, 'products'));
          prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (prodErr) {
          console.error('Error fetching products:', prodErr);
        }

        setPackingList(plData);
        setOrderData(order);
        setCustomerData(customer);
        setMainFarmGgn(resolvedGgn);
        setPoMap(poMapData);
        setProductsList(prods);

      } catch (e) {
        console.error(e);
        toast({ title: 'Error', description: 'Failed to load packing list details.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [db, id]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-[#7a9800]" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">Loading Packing List...</p>
      </div>
    );
  }

  if (!packingList) return null;

  const dataList = packingList.productionType === 'Internal Production' 
    ? (packingList.contents || []) 
    : (packingList.items || []);

  const rows = dataList.map((item: any, index: number) => {
    const barcode = item.barcode || item.productionOutput || '—';
    const matchedPo = poMap[barcode];
    const packagingTypeName = item.packagingTypeName || matchedPo?.packagingTypeName || '';
    const parsedWeight = extractWeightFromPackaging(packagingTypeName);
    
    if (parsedWeight === null && packagingTypeName) {
      console.warn(`Packaging weight not found for ${packagingTypeName}`);
    }
    
    const boxes = Number(item.boxes || item.numberOfBoxes || 0);
    const calculatedNet = parsedWeight !== null ? parsedWeight * boxes : 0;

    // Resolve productId
    let productId = item.productId || '';
    if (!productId && matchedPo?.items) {
      const poItem = matchedPo.items.find((pi: any) => 
        (pi.caliber === item.caliber || (!pi.caliber && !item.caliber)) &&
        (pi.lotNumber === item.lotNumber || pi.rawMaterialLotNumber === item.lotNumber)
      ) || matchedPo.items[0];
      productId = poItem?.productId || '';
    }

    // Resolve product details from productsList
    const matchedProd = productsList.find((p: any) => 
      (productId && p.id === productId) || 
      (p.productName?.toLowerCase() === (item.productName || item.product || '').toLowerCase())
    );

    return {
      palletNumber: index + 1,
      productionOutput: barcode,
      ggnNumber: item.ggnNumber || '—',
      product: [matchedProd?.productName || item.productName || item.product, matchedProd?.category || item.category, matchedProd?.type || item.type].filter(Boolean).join(' - ') || '—',
      category: matchedProd?.category || item.category || '',
      type: matchedProd?.type || item.type || '',
      lotNumber: item.lotNumber || '—',
      caliber: item.caliber || item.calibre || '—',
      packagingType: packagingTypeName,
      boxes: boxes,
      netWeight: calculatedNet,
      grossWeight: Number(item.grossWeight || 0),
    };
  });

  const totalPallets = rows.length;
  const totalBoxes = rows.reduce((sum: number, r: any) => sum + (r.boxes || 0), 0);
  const totalNetWeight = rows.reduce((sum: number, r: any) => sum + (r.netWeight || 0), 0);
  const totalGrossWeight = rows.reduce((sum: number, r: any) => sum + (r.grossWeight || 0), 0);

  const handleGenerateInvoice = async () => {
    if (!db || isGeneratingInvoice) return;
    setIsGeneratingInvoice(true);
    try {
      const year = new Date().getFullYear();
      const generatedNum = await generateNextInvoiceNumber(db, {
        invoiceType: 'Produce Invoice',
        source: 'sales_invoice',
        year
      });

      const batch = writeBatch(db);
      const plRef = doc(db, 'packingLists', packingList.id);
      batch.update(plRef, {
        invoiceGenerated: true,
        invoiceNumber: generatedNum
      });

      const formattedItems = (rows || []).map((r: any) => {
        const qty = Number(r.netWeight || r.boxes || 0);
        const price = Number(r.unitPrice || orderData?.price || 3.5);
        return {
          item_code: r.itemCode || 'A2',
          itemCode: r.itemCode || 'A2',
          description: r.product || '—',
          product: r.product || '—',
          calibre: r.caliber || '—',
          quantity: qty,
          price: price,
          amount: qty * price
        };
      });

      const calculatedTotal = formattedItems.reduce((sum: number, i: any) => sum + i.amount, 0);

      const invoiceRef = doc(collection(db, 'invoices'));
      batch.set(invoiceRef, {
        invoiceNumber: generatedNum,
        invoice_number: generatedNum,
        invoice_type: 'produce',
        invoice_type_display: 'Produce Invoice',
        currency: customerData?.currency || orderData?.currency || 'EUR',
        packingListId: packingList.id,
        orderId: packingList.orderId || null,
        po_order_id: packingList.orderId || null,
        po_order_number: packingList.poNumber || null,
        poNumber: packingList.poNumber || null,
        customer_id: orderData?.customerId || orderData?.customer_id || customerData?.id || null,
        customer_detail: {
          id: customerData?.id || null,
          companyName: customerData?.name || customerData?.companyName || orderData?.customerName || '—',
          invoicing_address: customerData?.address || '—',
          shipping_address: customerData?.deliveryAddress || customerData?.address || '—',
          city: customerData?.city || '—',
          country: customerData?.country || '—',
          vat_number: customerData?.vatNumber || customerData?.vat_number || '-',
          incoterms: orderData?.incoterm || customerData?.incoterm || '—',
          payment_terms: orderData?.paymentTerms || customerData?.paymentTerms || '—'
        },
        customer: customerData?.name || customerData?.companyName || orderData?.customerName || orderData?.customer || '—',
        invoicing_address: customerData?.address || '—',
        shipping_address: customerData?.deliveryAddress || customerData?.address || '—',
        vat_number: customerData?.vatNumber || customerData?.vat_number || '-',
        incoterm: orderData?.incoterm || customerData?.incoterm || '—',
        incoterms: orderData?.incoterm || customerData?.incoterm || '—',
        payment_terms: orderData?.paymentTerms || customerData?.paymentTerms || '—',
        truck_number: packingList.truckNumber || '—',
        total_gross_weight: totalGrossWeight,
        total_number_of_boxes: totalBoxes,
        date: packingList.expeditionDate || packingList.dateOfLoading || new Date().toISOString().split('T')[0],
        season_id: packingList.season_id || packingList.seasonId || null,
        total_amount: calculatedTotal,
        items: formattedItems,
        sourceType: 'supply_chain_packing_list',
        createdAt: new Date().toISOString(),
        createdBy: user?.email || 'system'
      });

      await batch.commit();

      const newInvoiceNumber = generatedNum;
      setPackingList((prev: any) => ({ ...prev, invoiceGenerated: true, invoiceNumber: newInvoiceNumber }));
      toast({ title: 'Invoice Generated', description: `Generated invoice: ${newInvoiceNumber}` });
      
      const invoiceDate = new Date().toLocaleDateString();
      const updatedPackingList = {
        ...packingList,
        totalNetWeight,
        totalGrossWeight,
        totalBoxes
      };
      await generateInvoicePDF(newInvoiceNumber, invoiceDate, updatedPackingList, orderData, customerData, mainFarmGgn, rows);
      
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not generate invoice', variant: 'destructive' });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };
 
  const handleDownloadExistingInvoice = async () => {
    if (!packingList.invoiceNumber) return;
    setIsGeneratingInvoice(true);
    try {
      const invoiceDate = packingList.expeditionDate 
        ? new Date(packingList.expeditionDate).toLocaleDateString() 
        : new Date().toLocaleDateString();
      const updatedPackingList = {
        ...packingList,
        totalNetWeight,
        totalGrossWeight,
        totalBoxes
      };
      await generateInvoicePDF(packingList.invoiceNumber, invoiceDate, updatedPackingList, orderData, customerData, mainFarmGgn, rows);
      toast({ title: 'Success', description: 'Invoice downloaded successfully.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to download invoice.', variant: 'destructive' });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };
 
  const handleDownloadPDF = async () => {
    try {
      const updatedPackingList = {
        ...packingList,
        totalNetWeight,
        totalGrossWeight,
        totalBoxes
      };
      const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/FFI_main.png` : '/FFI_main.png';
      const blob = await pdf(<PackingListPDF packingList={updatedPackingList} orderData={orderData} customerData={customerData} rows={rows} logoUrl={logoUrl} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Packing_List_${packingList.poNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: 'PDF generated successfully.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to generate PDF file.', variant: 'destructive' });
    }
  };
 
  const handleDownloadExcel = async () => {
    try {
      const updatedPackingList = {
        ...packingList,
        totalNetWeight,
        totalGrossWeight,
        totalBoxes
      };
      await generatePackingListExcel(
        updatedPackingList,
        orderData,
        customerData,
        mainFarmGgn,
        rows,
        { totalNetWeight, totalGrossWeight }
      );
      toast({ title: 'Success', description: 'Excel generated successfully.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to generate Excel file.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete packing list ${packingList.packingListNumber}?`)) return;
    if (!db) return;
    try {
      // 1. Fetch other packing lists with same poNumber (or orderId)
      let remainingCount = 0;
      if (packingList.poNumber) {
        const q = query(collection(db, 'packingLists'), where('poNumber', '==', packingList.poNumber));
        const snap = await getDocs(q);
        remainingCount = snap.docs.filter(d => d.id !== id).length;
      } else if (packingList.orderId) {
        const q = query(collection(db, 'packingLists'), where('orderId', '==', packingList.orderId));
        const snap = await getDocs(q);
        remainingCount = snap.docs.filter(d => d.id !== id).length;
      }

      // 2. Resolve order reference
      let targetOrderRef = null;
      if (packingList.orderId) {
        targetOrderRef = doc(db, 'orders', packingList.orderId);
      } else {
        const poVal = packingList.poNumber || '';
        if (poVal) {
          const q = query(collection(db, 'orders'), where('poNumber', '==', poVal));
          const snap = await getDocs(q);
          if (!snap.empty) {
            targetOrderRef = doc(db, 'orders', snap.docs[0].id);
          }
        }
      }

      // 3. Perform batch write
      const batch = writeBatch(db);
      batch.delete(doc(db, 'packingLists', id as string));

      if (targetOrderRef) {
        if (remainingCount === 0) {
          batch.update(targetOrderRef, {
            packingListGenerated: false,
            status: 'Confirmed'
          });
        } else {
          batch.update(targetOrderRef, {
            packingListGenerated: true,
            status: 'Produced'
          });
        }
      }

      await batch.commit();

      if (remainingCount === 0) {
        toast({ 
          title: 'Deleted', 
          description: 'Packing List deleted and order status restored to Confirmed.' 
        });
      } else {
        toast({ 
          title: 'Deleted', 
          description: 'Packing List deleted. Order remains Produced because another packing list exists for this PO.' 
        });
      }
      
      router.push('/supply-chain/packing-lists');
    } catch (err) {
      console.error('Error deleting packing list:', err);
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    }
  };

  const customerName = customerData?.name || orderData?.customerName || orderData?.customer || packingList.customer || '—';
  const customerAddress = customerData?.address || packingList.customerAddress || '—';
  const deliveryAddress = customerData?.deliveryAddress || packingList.deliveryAddress || '—';

  const InfoItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/50 hover:bg-white border border-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] group">
      <div className="p-3 bg-indigo-50/50 rounded-lg group-hover:bg-indigo-100/50 group-hover:scale-110 transition-all text-indigo-500">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</span>
        <span className="text-sm font-semibold text-slate-700 mt-0.5">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 animate-in fade-in zoom-in-95 duration-500">
      <div className="px-4 sm:px-8 max-w-[1400px] mx-auto space-y-6 pt-6">
        
        {/* Top Header & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Packing List Details</h1>
            <p className="text-xs font-medium text-slate-500">Profile / Supply Chain / Packing Lists / {packingList.packingListNumber || id}</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => packingList.invoiceGenerated ? handleDownloadExistingInvoice() : handleGenerateInvoice()} 
              disabled={isGeneratingInvoice}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#729A1A] hover:bg-[#5D7E14] text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isGeneratingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Download Invoice
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-all">
                  <Download className="w-4 h-4 text-[#729A1A]" /> Download Packing List
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 rounded-xl p-2 shadow-xl">
                <DropdownMenuItem onClick={handleDownloadExcel} className="cursor-pointer font-bold text-slate-600 hover:text-emerald-700 focus:text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50 rounded-lg p-2.5 text-xs">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" /> Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer font-bold text-slate-600 hover:text-red-700 focus:text-red-700 hover:bg-red-50 focus:bg-red-50 rounded-lg p-2.5 text-xs">
                  <FileText className="w-4 h-4 mr-2 text-red-600" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Header Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80">
          <PackingListHeader
            logoUrl="/FFI_main.png"
            companyName="Export Optimum Sarl"
            companyAddress="Douar Mouaraa Teyara Laouamra - Morocco"
            rcNumber="52747"
            expeditionDate={packingList.expeditionDate}
          />
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Customer Info */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 text-blue-500 rounded-xl shadow-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Customer Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={Building2} label="Customer Name" value={customerName} />
              <InfoItem icon={Globe} label="Country" value={customerData?.country || '—'} />
              <div className="sm:col-span-2">
                <InfoItem icon={MapPin} label="Customer Address" value={customerAddress} />
              </div>
              <div className="sm:col-span-2">
                <InfoItem icon={Map} label="Delivery Address" value={deliveryAddress} />
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Order Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={Hash} label="PO Number" value={orderData?.poNumber || packingList.poNumber || '—'} />
              <InfoItem icon={CalendarDays} label="ETA Week" value={orderData?.etaWeek || '—'} />
              <div className="sm:col-span-2">
                <InfoItem icon={Factory} label="Production Location" value={orderData?.productionLocationName || orderData?.productionLocationId || '—'} />
              </div>
              <div className="sm:col-span-2">
                <InfoItem icon={Ship} label="Shipping Method" value={orderData?.shippingMethod || '—'} />
              </div>
            </div>
          </div>
        </div>

        {/* Shipment Details */}
        <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-50 text-purple-500 rounded-xl shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Packing List Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <InfoItem icon={Box} label="Packing List Number" value={packingList.packingListNumber || '—'} />
            <InfoItem icon={CalendarDays} label="Expedition Date" value={packingList.expeditionDate || '—'} />
            <InfoItem icon={Factory} label="Production Type" value={packingList.productionType || '—'} />
            <InfoItem icon={ShieldCheck} label="GGN Number" value={packingList.ggnNumber || '—'} />
            <InfoItem icon={CalendarDays} label="ETD" value={packingList.etd || '—'} />
            <InfoItem icon={Hash} label="Seal Number" value={packingList.sealNumber || '—'} />
            <InfoItem icon={Truck} label="Truck Number" value={packingList.truckNumber || '—'} />
            <InfoItem icon={Building2} label="Transport Company" value={packingList.transportCompany || '—'} />
            <InfoItem icon={Scale} label="Total Net Weight" value={`${totalNetWeight} KG`} />
            <InfoItem icon={Scale} label="Total Brut Weight" value={`${totalGrossWeight} KG`} />
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-2">
              <InfoItem icon={FileText} label="Remarks" value={packingList.remarks || '—'} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <PackingListTable rows={rows} onExportExcel={handleDownloadExcel} onExportPDF={() => {}} />
        </div>

        <div className="mt-8 pb-8">
          <SummarySection
            totalPallets={totalPallets}
            totalBoxes={totalBoxes}
            totalNetWeight={totalNetWeight}
            totalGrossWeight={totalGrossWeight}
          />
        </div>
      </div>
    </div>
  );
}
