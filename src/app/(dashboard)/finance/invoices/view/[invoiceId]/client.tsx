'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from '@/firebase/firestore-override';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPInvoicePreview, InvoicePreviewData } from '@/components/erp/ERPInvoicePreview';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Printer, FileText } from 'lucide-react';
import { generateInvoicePDF } from '@/lib/export-invoice-pdf';
import { useToast } from '@/hooks/use-toast';

const safeText = (value: any) => {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleDateString();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000).toLocaleDateString();
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'object' && value !== null) {
    // If it's still an object and we missed it, don't crash React.
    return JSON.stringify(value);
  }
  return value ?? "-";
};

import { generateInvoiceExcel } from '@/lib/export-invoice-excel';

export default function ViewInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.invoiceId as string;
  const searchParams = useSearchParams();
  const type = searchParams.get('type');
  const db = useFirestore();
  const { toast } = useToast();

  const isLoadingType = type === 'loading';

  // 1. Fetch Invoice Doc with Multi-Collection Fallback
  const [fetchedInvoice, setFetchedInvoice] = React.useState<any>(null);
  const [isDocLoading, setIsDocLoading] = React.useState(true);

  React.useEffect(() => {
    if (!db || !invoiceId) return;
    let active = true;
    setIsDocLoading(true);

    const fetchMainDoc = async () => {
      try {
        const collectionsToTry = isLoadingType 
          ? ['supply_chain_loadings', 'packingLists', 'invoices']
          : ['invoices', 'packingLists', 'supply_chain_loadings'];

        for (const colName of collectionsToTry) {
          const snap = await getDoc(doc(db, colName, invoiceId));
          if (snap.exists()) {
            if (active) setFetchedInvoice({ id: snap.id, ...snap.data() });
            return;
          }
        }
        if (active) setFetchedInvoice(null);
      } catch (e) {
        console.error('Error fetching main invoice doc:', e);
      } finally {
        if (active) setIsDocLoading(false);
      }
    };

    fetchMainDoc();
    return () => { active = false; };
  }, [db, invoiceId, isLoadingType]);

  // We need state for order data, customer data, packing list data, products map, & linked credit notes
  const [orderData, setOrderData] = React.useState<any>(null);
  const [customerData, setCustomerData] = React.useState<any>(null);
  const [packingListData, setPackingListData] = React.useState<any>(null);
  const [productsMap, setProductsMap] = React.useState<Record<string, any>>({});
  const [isExtraDataLoading, setIsExtraDataLoading] = React.useState(false);
  const [creditNotes, setCreditNotes] = React.useState<any[]>([]);
  const [paymentsList, setPaymentsList] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!db || !fetchedInvoice) return;
    let isMounted = true;
    setIsExtraDataLoading(true);

    const loadAllRelatedData = async () => {
      try {
        // 1. Fetch Products
        const prodSnap = await getDocs(collection(db, 'products'));
        const pMap: Record<string, any> = {};
        prodSnap.forEach(d => {
          pMap[d.id] = { id: d.id, ...d.data() };
        });

        // 2. Fetch Order
        let oData: any = null;
        const orderId = fetchedInvoice.orderId || fetchedInvoice.po_order_id;
        const poNum = fetchedInvoice.poNumber || fetchedInvoice.po_number || fetchedInvoice.po_order_number;

        if (orderId) {
          const oSnap = await getDoc(doc(db, 'orders', orderId));
          if (oSnap.exists()) oData = { id: oSnap.id, ...oSnap.data() };
        }
        if (!oData && poNum && poNum !== '-') {
          const oq = query(collection(db, 'orders'), where('poNumber', '==', poNum));
          const oSnap = await getDocs(oq);
          if (!oSnap.empty) oData = { id: oSnap.docs[0].id, ...oSnap.docs[0].data() };
        }

        // 3. Fetch Customer
        let cData: any = null;
        const custId = fetchedInvoice.customer_id || oData?.customerId || fetchedInvoice.customer_detail?.id;
        const custName = fetchedInvoice.customer || fetchedInvoice.customer_detail?.companyName || oData?.customerName || oData?.customer;

        if (custId) {
          const cSnap = await getDoc(doc(db, 'customers', custId));
          if (cSnap.exists()) cData = { id: cSnap.id, ...cSnap.data() };
        }
        if (!cData && custName) {
          const allCustSnap = await getDocs(collection(db, 'customers'));
          const cleanTarget = String(custName).trim().toLowerCase();
          const match = allCustSnap.docs.find(d => {
            const data = d.data();
            const name1 = String(data.companyName || '').trim().toLowerCase();
            const name2 = String(data.name || '').trim().toLowerCase();
            return name1 === cleanTarget || name2 === cleanTarget || (name1 && cleanTarget.includes(name1)) || (name2 && cleanTarget.includes(name2));
          });
          if (match) cData = { id: match.id, ...match.data() };
        }

        // 4. Fetch Packing List
        let plData: any = null;
        const plId = fetchedInvoice.packingListId || (isLoadingType ? fetchedInvoice.id : null);
        if (plId) {
          const plSnap = await getDoc(doc(db, 'packingLists', plId));
          if (plSnap.exists()) plData = { id: plSnap.id, ...plSnap.data() };
        }
        if (!plData && poNum && poNum !== '-') {
          const plq = query(collection(db, 'packingLists'), where('poNumber', '==', poNum));
          const plSnap = await getDocs(plq);
          if (!plSnap.empty) {
            plData = { id: plSnap.docs[0].id, ...plSnap.docs[0].data() };
          } else {
            const ldq = query(collection(db, 'supply_chain_loadings'), where('po_order_number', '==', poNum));
            const ldSnap = await getDocs(ldq);
            if (!ldSnap.empty) {
              plData = { id: ldSnap.docs[0].id, ...ldSnap.docs[0].data() };
            }
          }
        }

        // 5. Fetch Payments for this invoice
        const invNum = fetchedInvoice.invoice_number || fetchedInvoice.invoiceNumber;
        const [paySnap1, paySnap2] = await Promise.all([
          getDocs(collection(db, 'suppliers_situation_payments')),
          getDocs(collection(db, 'payments'))
        ]);
        
        const pList1 = paySnap1.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.invoiceId === invoiceId || (invNum && invNum !== '-' && (String(p.invoiceNumber).trim() === String(invNum).trim() || String(p.invoice_number).trim() === String(invNum).trim())));
        
        const pList2 = paySnap2.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.invoiceId === invoiceId || (invNum && invNum !== '-' && (String(p.invoiceNumber).trim() === String(invNum).trim() || String(p.invoice_number).trim() === String(invNum).trim())));

        const allInvoicePayments = [...pList1, ...pList2];

        if (isMounted) {
          setProductsMap(pMap);
          setOrderData(oData);
          setCustomerData(cData);
          setPackingListData(plData);
          setPaymentsList(allInvoicePayments);
        }
      } catch (e) {
        console.error('Error fetching related invoice data:', e);
      } finally {
        if (isMounted) setIsExtraDataLoading(false);
      }
    };

    loadAllRelatedData();
    return () => { isMounted = false; };
  }, [db, fetchedInvoice, invoiceId, isLoadingType]);

  const invoice = React.useMemo(() => {
    if (!fetchedInvoice) return null;

    // Helper to resolve product name from productsMap
    const resolveProductName = (prodRef: any) => {
      if (!prodRef) return '—';
      if (typeof prodRef === 'string') {
        if (productsMap[prodRef]) {
          const p = productsMap[prodRef];
          return p.productName || p.name || p.description || prodRef;
        }
        return prodRef;
      }
      if (typeof prodRef === 'object') {
        return prodRef.productName || prodRef.name || prodRef.description || '—';
      }
      return '—';
    };

    // Extract Billing address from customerData
    const billing = customerData?.addresses?.find((a: any) => a.type === 'Billing') || customerData?.addresses?.[0] || customerData?.registeredAddresses?.[0];
    const shipping = customerData?.addresses?.find((a: any) => a.type === 'Delivery') || customerData?.addresses?.[0];

    const cName = customerData?.companyName || customerData?.name || fetchedInvoice.customer_detail?.companyName || fetchedInvoice.customer || orderData?.customerName || orderData?.customer || '—';
    
    let streetAddress = billing?.street || billing?.address || customerData?.address || customerData?.street || fetchedInvoice.customer_detail?.street_address || fetchedInvoice.customer_detail?.invoicing_address || fetchedInvoice.invoicing_address || '—';
    let city = billing?.city || customerData?.city || fetchedInvoice.customer_detail?.city || '—';
    let zip = billing?.zipCode || billing?.zip || customerData?.zipCode || fetchedInvoice.customer_detail?.zip_code || '—';
    let country = billing?.country || customerData?.country || fetchedInvoice.customer_detail?.country || '—';

    // Smart address parsing for full comma-separated address strings
    if ((city === '—' || city === '') && streetAddress && streetAddress !== '—' && streetAddress.includes(',')) {
      const parts = streetAddress.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        if (country === '—' || !country) country = parts[parts.length - 1];
        const zipOrCityPart = parts[parts.length - 2];
        const cityPart = parts[parts.length - 3];
        const matchDigits = zipOrCityPart.match(/\b\d{4,5}\b/);
        if (matchDigits) {
          zip = matchDigits[0];
          city = zipOrCityPart.replace(/\b\d{4,5}\b/, '').trim() || cityPart;
        } else {
          city = zipOrCityPart;
        }
        streetAddress = parts.slice(0, parts.length - 2).join(', ');
      } else if (parts.length === 2) {
        if (country === '—' || !country) country = parts[1];
        streetAddress = parts[0];
      }
    }
    
    const invoicingAddressText = [streetAddress, city, zip, country].filter(x => x && x !== '—').join(', ') || streetAddress;
    const shippingAddressText = shipping ? [shipping.street, shipping.city, shipping.zipCode, shipping.country].filter(Boolean).join(', ') : invoicingAddressText;

    const getValidString = (...candidates: any[]) => {
      for (const c of candidates) {
        if (c && typeof c === 'string') {
          const trimmed = c.trim();
          if (trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed !== 'undefined' && trimmed !== 'null') {
            return trimmed;
          }
        }
      }
      return '—';
    };

    const vatNumber = customerData?.vatNumber || customerData?.vat_number || fetchedInvoice.customer_detail?.vat_number || fetchedInvoice.vat_number || '-';
    
    const incoterms = getValidString(
      fetchedInvoice.incoterms,
      fetchedInvoice.incoterm,
      fetchedInvoice.customer_detail?.incoterms,
      fetchedInvoice.customer_detail?.incoterm,
      orderData?.incoterm,
      orderData?.incoterms,
      customerData?.incoterm,
      customerData?.incoterms,
      'DAP'
    );

    const paymentTerms = getValidString(
      fetchedInvoice.payment_terms,
      fetchedInvoice.paymentTerms,
      fetchedInvoice.customer_detail?.payment_terms,
      fetchedInvoice.customer_detail?.paymentTerms,
      orderData?.paymentTerms,
      orderData?.payment_terms,
      customerData?.payment_term_name,
      customerData?.paymentTerms,
      customerData?.payment_terms,
      customerData?.paymentTerm,
      customerData?.payment_term_id,
      customerData?.paymentTermsId
    );

    const truckNumber = fetchedInvoice.truck_number || fetchedInvoice.truckNumber || packingListData?.truckNumber || orderData?.truckNumber || '—';
    const totalGrossWeight = fetchedInvoice.total_gross_weight || fetchedInvoice.grossWeight || packingListData?.totalGrossWeight || orderData?.grossWeight || 0;
    const totalBoxes = fetchedInvoice.total_number_of_boxes || fetchedInvoice.totalBoxes || packingListData?.totalBoxes || orderData?.numberOfBoxes || 0;

    // Items Resolution
    let rawItems = fetchedInvoice.items || packingListData?.contents || packingListData?.items || orderData?.items || [];
    let items: any[] = [];

    if (rawItems && Array.isArray(rawItems)) {
      items = rawItems.map((item: any) => {
        const rawProd = item.product || item.product_id || item.productId || item.description || '—';
        const name = resolveProductName(rawProd);
        const calibreStr = item.caliber || item.calibre ? ` ${item.caliber || item.calibre}` : '';
        const desc = (name !== '—' && !name.includes(calibreStr.trim())) ? `${name}${calibreStr}` : name;
        const qty = Number(item.quantity || item.netWeight || item.pallets || item.boxes || 0);
        const price = Number(item.price || item.unitPrice || orderData?.price || 3.5);
        const amount = qty * price;
        const code = item.itemCode || item.item_code || item.code || 'A2';

        return {
          itemCode: code,
          item_code: code,
          description: desc,
          product: name,
          calibre: item.caliber || item.calibre,
          quantity: qty,
          price: price,
          amount: amount
        };
      });
    }

    let calculatedAmount = fetchedInvoice.total_amount || fetchedInvoice.valueInMad;
    if (!calculatedAmount) {
      calculatedAmount = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    }

    return {
      ...fetchedInvoice,
      invoice_number: fetchedInvoice.invoice_number || fetchedInvoice.invoiceNumber || '-',
      po_order_number: fetchedInvoice.po_order_number || fetchedInvoice.poNumber || fetchedInvoice.po_number || orderData?.poNumber || '-',
      date: fetchedInvoice.date || fetchedInvoice.invoice_date || fetchedInvoice.createdAt || packingListData?.expeditionDate,
      invoice_type: fetchedInvoice.invoice_type || 'produce',
      invoice_type_display: (String(fetchedInvoice.invoice_type || '').toLowerCase().includes('produce') || fetchedInvoice.packingListId || packingListData) ? 'Invoice Generated from the packing list' : (fetchedInvoice.invoice_type_display || 'Sales Invoice'),
      customer_detail: {
        id: customerData?.id || fetchedInvoice.customer_id,
        companyName: cName,
        company_name: cName,
        invoicing_address: invoicingAddressText,
        shipping_address: shippingAddressText,
        street_address: streetAddress,
        city: city,
        country: country,
        zip_code: zip,
        vat_number: vatNumber,
        incoterms: incoterms,
        payment_terms: paymentTerms
      },
      customer: cName,
      invoicing_address: invoicingAddressText,
      shipping_address: shippingAddressText,
      vat_number: vatNumber,
      incoterm: incoterms,
      incoterms: incoterms,
      payment_terms: paymentTerms,
      truck_number: truckNumber,
      total_gross_weight: totalGrossWeight,
      total_number_of_boxes: totalBoxes,
      total_amount: calculatedAmount,
      items: items
    };
  }, [fetchedInvoice, customerData, orderData, packingListData, productsMap]);

  // Fetch linked Credit Notes if this is a parent invoice with a PO number
  React.useEffect(() => {
    if (!db || !invoice) return;
    const poNum = invoice.po_order_number || invoice.poNumber || invoice.po_number;
    const poId = invoice.po_order_id || invoice.orderId;
    const isCN = String(invoice.invoice_type || '').toLowerCase().includes('credit');
    
    if ((poNum && poNum !== '-') || poId) {
      if (!isCN) {
        const q = query(collection(db, 'invoices'));
        getDocs(q).then(snap => {
          const matchingCNs = snap.docs
            .map(d => ({ id: d.id, ...d.data() as any }))
            .filter(cn => {
              const cnType = String(cn.invoice_type || '').toLowerCase();
              if (!cnType.includes('credit')) return false;
              const matchesPoNum = poNum && poNum !== '-' && (cn.po_order_number === poNum || cn.poNumber === poNum);
              const matchesPoId = poId && (cn.po_order_id === poId || cn.orderId === poId);
              return matchesPoNum || matchesPoId;
            });
          setCreditNotes(matchingCNs);
        }).catch(console.error);
      }
    } else {
      setCreditNotes([]);
    }
  }, [db, invoice]);

  const isLoading = isDocLoading || isExtraDataLoading;

  // 2. Prepare export data
  const excelExportData = useMemo(() => {
    if (!invoice) return [];
    return (invoice.items || []).map((item: any) => ({
      Description: item.description || item.product_id || '—',
      Quantity: item.quantity,
      Price: item.price,
      Amount: Number(item.quantity || 0) * Number(item.price || 0)
    }));
  }, [invoice]);

  const breadcrumbItems = [
    { label: 'Profile', href: '#' },
    { label: 'Invoice', href: '/finance/invoices' },
    { label: 'View Invoice', active: true }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 bg-[#f3f3f3] min-h-screen">
        <Loader2 className="h-12 w-12 text-[#7a9800] animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Invoice Details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 bg-[#f3f3f3] min-h-screen">
        <p className="text-sm font-bold text-rose-500 uppercase tracking-widest">Invoice Not Found</p>
        <Button onClick={() => router.push('/finance/invoices')} variant="outline">
          Back to Invoices
        </Button>
      </div>
    );
  }

  const rawInvoiceTotal = Number(invoice.total_amount || 0);
  const creditNotesTotal = creditNotes.reduce((sum, cn) => sum + Number(cn.total_amount || 0), 0);
  const remainingTotal = rawInvoiceTotal - creditNotesTotal;

  // Cast Firestore data to preview shape safely
  const previewData: InvoicePreviewData = {
    invoiceNumber: safeText(invoice.invoice_number || invoice.invoiceNumber),
    poOrderNumber: invoice.po_order_number || invoice.poNumber || invoice.po_number,
    date: safeText(invoice.date),
    dueDate: invoice.dueDate, // if used
    invoiceType: invoice.invoice_type || 'invoice',
    customerName: safeText(invoice.customer_detail?.companyName || invoice.customer_detail?.company_name || invoice.customer),
    shippingAddress: safeText(invoice.shipping_address_detail?.title || invoice.shipping_address),
    invoicingAddress: safeText(invoice.invoicing_address_detail?.title || invoice.invoicing_address),
    ice: invoice.ice,
    iff: invoice.if_value,
    remarks: invoice.remarks,
    taxRate: invoice.tax,
    discount: invoice.discount,
    items: (invoice.items || []).map((item: any) => ({
      ...item,
      product: item.product_id || item.description
    })),
    countryOfOrigin: invoice.country_of_origin,
    totalGrossWeight: invoice.total_gross_weight,
    totalBoxes: invoice.total_number_of_boxes,
    totalAmount: rawInvoiceTotal,
    linkedCreditNotes: creditNotes.map(cn => {
      let num = safeText(cn.invoice_number || cn.invoiceNumber || 'CN');
      if (num !== '-' && !num.startsWith('CN')) {
        num = `CN${num}`;
      }
      return {
        id: cn.id,
        invoiceNumber: num,
        date: safeText(cn.date || cn.createdAt),
        amount: Number(cn.total_amount || 0),
        remarks: cn.remarks || ''
      };
    }),
    creditNotesTotal,
    remainingTotal,
    currency: customerData?.currency || invoice.currency || 'EUR'
  };

  const handleDownloadPdf = async () => {
    try {
      const dateStr = safeText(invoice.date);
      const invoiceNumber = safeText(invoice.invoice_number || invoice.invoiceNumber);

      await generateInvoicePDF(
        invoiceNumber,
        dateStr,
        packingListData,
        orderData,
        customerData,
        invoice.ggn || '',
        [],
        invoice
      );
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const dateStr = safeText(invoice.date);
      const invoiceNumber = safeText(invoice.invoice_number || invoice.invoiceNumber);

      await generateInvoiceExcel(
        invoiceNumber,
        dateStr,
        null,
        null,
        null,
        invoice.ggn || '',
        [],
        invoice
      );
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to generate Excel.', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      {/* Top Header */}
      <ERPPageHeader
        title="View Invoice"
        subtitle={`Review invoice details and preview printable commercial layout for #${invoice.invoice_number || invoice.invoiceNumber}.`}
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownloadPdf}
              className="bg-[#7a9800] hover:bg-[#688200] text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm gap-1.5 transition-all print:hidden"
            >
              Download PDF <Printer size={15} />
            </Button>
            <Button
              onClick={handleDownloadExcel}
              className="bg-[#7a9800] hover:bg-[#688200] text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm gap-1.5 transition-all print:hidden"
            >
              Download Excel
            </Button>
          </div>
        }
      />

      {/* Main Preview Container */}
      <div className="max-w-[1000px] mx-auto pb-20 space-y-6">
        <ERPInvoicePreview data={previewData} />

        {/* Payments Section */}
        {paymentsList.length > 0 && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 space-y-4 print:hidden">
            <h3 className="text-sm font-black text-[#2e1d52] uppercase tracking-widest">
              Registered Invoice Payments
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="bg-slate-50 uppercase text-[10px] font-black text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Operation Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount (€)</th>
                    <th className="px-4 py-3 text-right">Exchange Rate</th>
                    <th className="px-4 py-3 text-right">Amount (MAD)</th>
                    <th className="px-4 py-3">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paymentsList.map((p, idx) => (
                    <tr key={p.id || idx}>
                      <td className="px-4 py-3 uppercase font-bold text-[#2e1d52]">{p.operationType || p.opearation_type || 'PAYMENT'}</td>
                      <td className="px-4 py-3">{p.date || p.payment_date || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{(Number(p.amount || p.payment_amount || 0)).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-right">{p.exchangeRate || p.exchange_rate || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#2e1d52]">{(Number(p.amountMAD || p.amount_mad || p.amount || 0)).toFixed(2)} MAD</td>
                      <td className="px-4 py-3 text-slate-400">{p.createdBy || p.created_by || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
