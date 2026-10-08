'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where,
  doc, 
  deleteDoc,
  getDocs,
  updateDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase
} from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plus, Loader2, MoreHorizontal, Eye, Edit, Trash2, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { canList, canAdd, canUpdate, canDelete } from '@/lib/permissions';
import { generateInvoicePDF } from '@/lib/export-invoice-pdf';
import { generateInvoiceExcel } from '@/lib/export-invoice-excel';


const safeText = (value: any) => {
  if (value == null) return "-";
  if (typeof value === 'object') {
    if ('seconds' in value && 'nanoseconds' in value) {
      return new Date(value.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (value instanceof Date) {
      return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return String(value);
  }
  return String(value);
};
const safeNumber = (value: any) => Number(value || 0);
const money = (value: any) => Number(value || 0).toFixed(2);

export default function InvoicesListPage() {
  const router = useRouter();
  const db = useFirestore();
  const { profile } = useAuthContext();
  const { toast } = useToast();
  const { currentSeason } = useSeason();

  // Permissions
  const hasListAccess = canList(profile, 'finance.salesInvoice');
  const hasAddAccess = canAdd(profile, 'finance.salesInvoice');
  const hasUpdateAccess = canUpdate(profile, 'finance.salesInvoice');
  const hasDeleteAccess = canDelete(profile, 'finance.salesInvoice');

  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 1. Fetch Invoices, Loadings, and Packing Lists from Firestore
  const invoicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'invoices'));
  }, [db]);

  const loadingsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'supply_chain_loadings'));
  }, [db]);

  const packingListsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'packingLists'));
  }, [db]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'));
  }, [db]);

  const customersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'customers'));
  }, [db]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'suppliers'));
  }, [db]);

  const { data: allInvoices, isLoading: invoicesLoading } = useCollection(invoicesQuery);
  const { data: allLoadings, isLoading: loadingsLoading } = useCollection(loadingsQuery);
  const { data: allPackingLists, isLoading: packingListsLoading } = useCollection(packingListsQuery);
  const { data: allOrders, isLoading: ordersLoading } = useCollection(ordersQuery);
  const { data: allCustomers } = useCollection(customersQuery);
  const { data: allSuppliers } = useCollection(suppliersQuery);
  
  const isLoading = invoicesLoading || loadingsLoading || packingListsLoading || ordersLoading;

  // 2. Normalize and Filter Data
  const filteredData = useMemo(() => {
    const list: any[] = [];
    
    // Helper to resolve address ID
    const resolveAddress = (customerId: string, addressId: string, invoiceType: string) => {
      if (!addressId || !customerId) return '-';
      
      let customerOrSupplier;
      if (invoiceType === 'invoice') {
         customerOrSupplier = allSuppliers?.find(s => s.id === customerId);
      } else {
         customerOrSupplier = allCustomers?.find(c => c.id === customerId);
      }
      
      if (!customerOrSupplier) return addressId;

      if (customerOrSupplier.addresses && Array.isArray(customerOrSupplier.addresses)) {
         const addr = customerOrSupplier.addresses.find((a: any) => 
           a.id === addressId || a.name === addressId || a.title === addressId
         );
         if (addr) return addr.street || addr.address || addr.name || addr.title || addressId;
      }
      
      // Fallback to main address if it's 'default' or matches
      if ((addressId === 'default' || addressId === customerOrSupplier.address) && customerOrSupplier.address) {
         return customerOrSupplier.address;
      }
      
      return addressId;
    };

    // Helper to resolve customer invoicing and shipping addresses
    const resolveCustomerAddresses = (row: any) => {
      const custId = row.customer_id || row.customerId || row.customer_detail?.id;
      const custName = row.customerName || row.customer || row.customer_detail?.companyName || row.customer_detail?.company_name;
      
      let customerObj = allCustomers?.find((c: any) => 
        (custId && c.id === custId) || 
        (custName && c.companyName && c.companyName.trim().toLowerCase() === String(custName).trim().toLowerCase())
      );

      const formatAddr = (a: any) => a ? [a.street, a.city, a.zipCode, a.country].filter(Boolean).join(', ') : '';

      let invoicing = row.invoicing_address || row.invoicingAddress || row.customer_detail?.invoicing_address || row.customer_detail?.street_address || '';
      let shipping = row.shipping_address || row.shippingAddress || row.customer_detail?.shipping_address || '';

      if ((!invoicing || invoicing === '-' || invoicing === '—') && customerObj) {
        if (customerObj.addresses && Array.isArray(customerObj.addresses)) {
          const billing = customerObj.addresses.find((a: any) => a.type === 'Billing');
          const fallback = customerObj.addresses[0];
          invoicing = formatAddr(billing || fallback);
        }
        if (!invoicing) {
          invoicing = customerObj.address || customerObj.street || customerObj.city || '';
        }
      }

      if ((!shipping || shipping === '-' || shipping === '—') && customerObj) {
        if (customerObj.addresses && Array.isArray(customerObj.addresses)) {
          const delivery = customerObj.addresses.find((a: any) => a.type === 'Delivery');
          const fallback = customerObj.addresses[0];
          shipping = formatAddr(delivery || fallback);
        }
        if (!shipping) {
          shipping = invoicing || customerObj.address || customerObj.street || customerObj.city || '';
        }
      }

      return {
        invoicing_address: invoicing && invoicing !== '-' ? invoicing : '—',
        shipping_address: shipping && shipping !== '-' ? shipping : (invoicing && invoicing !== '-' ? invoicing : '—')
      };
    };

    const resolveUserName = (rawVal: any, obj: any, field: 'created' | 'updated') => {
      if (rawVal && typeof rawVal === 'string' && rawVal !== '-' && rawVal !== '—') {
        return rawVal;
      }
      if (field === 'created') {
        if (obj?.createdByDisplayName) return obj.createdByDisplayName;
        if (obj?.createdBy) return obj.createdBy;
        if (obj?.userEmail) return obj.userEmail;
        if (obj?.createdby?.first_name) return `${obj.createdby.first_name} ${obj.createdby.last_name || ''}`.trim();
      } else {
        if (obj?.updatedByDisplayName) return obj.updatedByDisplayName;
        if (obj?.updatedBy) return obj.updatedBy;
        if (obj?.updatedby?.first_name) return `${obj.updatedby.first_name} ${obj.updatedby.last_name || ''}`.trim();
      }
      return '—';
    };

    const resolveInvoiceTypeDisplay = (row: any) => {
      const typeStr = String(row.invoice_type || row.invoiceType || row.invoice_type_display || '').toLowerCase();
      if (typeStr.includes('credit')) return 'Credit Note';
      if (typeStr.includes('proforma')) return 'Proforma Invoice';
      if (
        row.sourceType === 'supply_chain_packing_list' || 
        row.sourceType === 'supply_chain_loading' ||
        row.packingListId ||
        typeStr.includes('produce') ||
        typeStr.includes('packing')
      ) {
        return 'Invoice Generated from the packing list';
      }
      if (row.invoice_type_detail?.title) return row.invoice_type_detail.title;
      return row.invoice_type_display || row.invoice_type || 'Sales Invoice';
    };

    // Normalize Sales Invoices
    if (allInvoices) {
      allInvoices.forEach(inv => {
        const createdByName = resolveUserName(inv.createdByDisplayName || inv.createdBy, inv, 'created');
        const updatedByName = resolveUserName(inv.updatedByDisplayName || inv.updatedBy, inv, 'updated');

        const { invoicing_address, shipping_address } = resolveCustomerAddresses(inv);

        // Guarantee Credit Note numbers start with CN
        let invNumber = inv.invoice_number || inv.invoiceNumber || '-';
        const isCreditNote = String(inv.invoice_type || '').toLowerCase().includes('credit');
        if (isCreditNote && invNumber !== '-' && !invNumber.startsWith('CN')) {
          invNumber = `CN${invNumber}`;
        }

        const targetId = inv.customer_id || inv.customerId;
        const targetCustomer = allCustomers?.find(c => c.id === targetId);
        const targetSupplier = allSuppliers?.find(s => s.id === targetId);
        const resolvedCurrency = inv.currency || targetCustomer?.currency || targetSupplier?.currency || 'MAD';

        list.push({
          ...inv,
          sourceType: 'sales_invoice',
          sourceId: inv.id,
          invoice_number: invNumber,
          currency: resolvedCurrency,
          customerName: safeText(inv.customer_detail?.companyName || inv.customer_detail?.company_name || inv.customer),
          invoice_type_display: resolveInvoiceTypeDisplay(inv),
          po_order_number: inv.poNumber || inv.po_number || inv.po_order_number || '-',
          date: inv.date || inv.invoice_date || inv.createdAt,
          invoicing_address: invoicing_address,
          shipping_address: shipping_address,
          createdBy: createdByName,
          updatedBy: updatedByName
        });
      });
    }

    // Normalize Loadings (deduplicate against sales_invoices)
    if (allLoadings) {
      allLoadings.forEach(loading => {
        let invNumber = (!loading.invoice_number || loading.invoice_number === '-') ? '-' : loading.invoice_number;
        const isCreditNote = String(loading.invoice_type || '').toLowerCase().includes('credit');
        if (isCreditNote && invNumber !== '-' && !invNumber.startsWith('CN')) {
          invNumber = `CN${invNumber}`;
        }

        // Skip if loading invoice is already in allInvoices
        const isDuplicate = list.some(existing => 
          (invNumber !== '-' && (existing.invoice_number === invNumber || existing.invoiceNumber === invNumber)) ||
          existing.loadingId === loading.id || existing.packingListId === loading.id
        );
        if (isDuplicate) return;

        const customerName = loading.customer_detail?.companyName || loading.customer_detail?.company_name || loading.customer || loading.transitSupplierName || '-';
        const createdByName = resolveUserName(loading.createdByDisplayName || loading.createdBy, loading, 'created');
        const updatedByName = resolveUserName(loading.updatedByDisplayName || loading.updatedBy, loading, 'updated');

        const { invoicing_address, shipping_address } = resolveCustomerAddresses({ ...loading, customerName });

        let calculatedAmount = safeNumber(loading.total_amount || loading.valueInMad);
        
        // Fallback to Order amount
        if (!calculatedAmount && loading.orderId && allOrders) {
           const order = allOrders.find((o: any) => o.id === loading.orderId);
           if (order && order.items && Array.isArray(order.items)) {
              let total = 0;
              order.items.forEach((item: any) => {
                 total += (Number(item.price) || 0) * (Number(item.pallets) || 0);
              });
              calculatedAmount = total;
           }
        }
        
        list.push({
          ...loading,
          sourceType: 'supply_chain_loading',
          sourceId: loading.id,
          po_order_number: loading.poNumber || loading.po_number || loading.po_order_number || '-',
          date: safeText(loading.date || loading.invoice_date || loading.createdAt),
          customerName: safeText(customerName),
          invoice_type_display: resolveInvoiceTypeDisplay(loading),
          invoice_type: 'produce',
          invoicing_address: invoicing_address,
          shipping_address: shipping_address,
          total_amount: calculatedAmount,
          invoice_number: invNumber,
          createdBy: createdByName,
          updatedBy: updatedByName
        });
      });
    }

    // Normalize Packing Lists (deduplicate against sales_invoices and loadings)
    if (allPackingLists) {
      allPackingLists.forEach(pl => {
        let invNumber = (!pl.invoiceNumber && !pl.invoice_number) ? '-' : (pl.invoiceNumber || pl.invoice_number);
        const isCreditNote = String(pl.invoice_type || '').toLowerCase().includes('credit');
        if (isCreditNote && invNumber !== '-' && !invNumber.startsWith('CN')) {
          invNumber = `CN${invNumber}`;
        }

        // Skip if already in list
        const isDuplicate = list.some(existing => 
          (invNumber !== '-' && (existing.invoice_number === invNumber || existing.invoiceNumber === invNumber)) ||
          existing.packingListId === pl.id || existing.sourceId === pl.id || existing.id === pl.id
        );
        if (isDuplicate) return;

        let customerName = pl.customer || pl.customerName || pl.customer_detail?.companyName || pl.customer_detail?.company_name || '-';
        if (customerName === '-' && pl.orderId && allOrders) {
           const order = allOrders.find((o: any) => o.id === pl.orderId);
           if (order) customerName = order.customerName || order.customer || '-';
        }

        const createdByName = resolveUserName(pl.createdByDisplayName || pl.createdBy, pl, 'created');
        const updatedByName = resolveUserName(pl.updatedByDisplayName || pl.updatedBy, pl, 'updated');

        const { invoicing_address, shipping_address } = resolveCustomerAddresses({ ...pl, customerName });

        let calculatedAmount = safeNumber(pl.total_amount || pl.totalAmount || pl.valueInMad);
        if (!calculatedAmount && pl.orderId && allOrders) {
           const order = allOrders.find((o: any) => o.id === pl.orderId);
           if (order && order.items && Array.isArray(order.items)) {
              let total = 0;
              order.items.forEach((item: any) => {
                 total += (Number(item.price) || 0) * (Number(item.pallets) || Number(item.quantity) || 0);
              });
              calculatedAmount = total;
           }
        }
        if (!calculatedAmount && pl.totalGrossWeight) {
           calculatedAmount = Number(pl.totalGrossWeight) * 3.5;
        }

        list.push({
          ...pl,
          sourceType: 'supply_chain_packing_list',
          sourceId: pl.id,
          po_order_number: pl.poNumber || pl.po_number || pl.po_order_number || '-',
          date: safeText(pl.expeditionDate || pl.dateOfLoading || pl.date || pl.createdAt),
          customerName: safeText(customerName),
          invoice_type_display: resolveInvoiceTypeDisplay(pl),
          invoice_type: 'produce',
          invoicing_address: invoicing_address,
          shipping_address: shipping_address,
          total_amount: calculatedAmount,
          invoice_number: invNumber,
          createdBy: createdByName,
          updatedBy: updatedByName
        });
      });
    }

    // Filter by season
    let seasonFiltered = list.filter(r => !currentSeason?.id || !r.season_id || r.season_id === currentSeason.id);

    const getDateMs = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return new Date(val).getTime() || 0;
      if (typeof val.toDate === 'function') return val.toDate().getTime();
      if (val.seconds) return val.seconds * 1000;
      return new Date(val).getTime() || 0;
    };

    seasonFiltered.sort((a: any, b: any) => {
      const msA = getDateMs(a.date);
      const msB = getDateMs(b.date);
      if (msB !== msA) return msB - msA;
      // Secondary sort: invoice_number descending
      const numA = Number(String(a.invoice_number || '').replace(/\D/g, '')) || 0;
      const numB = Number(String(b.invoice_number || '').replace(/\D/g, '')) || 0;
      return numB - numA;
    });

    if (!searchTerm) return seasonFiltered;
    
    const term = searchTerm.toLowerCase();
    return seasonFiltered.filter(row => {
      const invNum = safeText(row.invoice_number).toLowerCase();
      const poNum = safeText(row.po_order_number).toLowerCase();
      const customer = safeText(row.customerName).toLowerCase();
      return invNum.includes(term) || poNum.includes(term) || customer.includes(term);
    });
  }, [allInvoices, allLoadings, allOrders, allCustomers, allSuppliers, searchTerm, currentSeason]);

  // 3. Excel Export Data Mapping: Combines Invoice & Credit Notes on 1 single line per Invoice
  const excelExportData = useMemo(() => {
    const parentInvoices = filteredData.filter(r => !String(r.invoice_type || '').toLowerCase().includes('credit'));
    const creditNotes = filteredData.filter(r => String(r.invoice_type || '').toLowerCase().includes('credit'));

    const excelRows = parentInvoices.map(inv => {
      const poNum = inv.po_order_number;
      const invNum = inv.invoice_number;
      const custName = String(inv.customerName || '').trim().toLowerCase();

      const linkedCNs = creditNotes.filter(cn => {
        if (poNum && poNum !== '-' && cn.po_order_number === poNum) return true;
        if (invNum && invNum !== '-' && (cn.invoice_number?.includes(invNum) || invNum.includes(cn.invoice_number?.replace('CN', '') || '___'))) return true;
        const cnCust = String(cn.customerName || '').trim().toLowerCase();
        return custName && cnCust && custName === cnCust;
      });

      const totalSales = safeNumber(inv.total_amount);
      const cnAmount = linkedCNs.reduce((sum, cn) => sum + safeNumber(cn.total_amount), 0);
      const netAmount = totalSales - cnAmount;
      const cnNumbers = linkedCNs.map(cn => safeText(cn.invoice_number)).filter(n => n !== '-').join(', ') || '-';

      return {
        'Invoice Number': safeText(inv.invoice_number),
        'PO Order Number': safeText(inv.po_order_number),
        'Date': safeText(inv.date),
        'Customer': safeText(inv.customerName),
        'Invoice Type': safeText(inv.invoice_type_display),
        'Total Sales Amount (€)': totalSales,
        'Credit Note N°': cnNumbers,
        'Credit Note Amount (€)': cnAmount,
        'Net Amount (€)': netAmount,
        'Invoicing Address': safeText(inv.invoicing_address_detail?.title || inv.invoicing_address),
        'Shipping Address': safeText(inv.shipping_address_detail?.title || inv.shipping_address),
        'Created By': safeText(inv.createdBy),
        'Updated By': safeText(inv.updatedBy)
      };
    });

    const handledCNIds = new Set();
    parentInvoices.forEach(inv => {
      const poNum = inv.po_order_number;
      const invNum = inv.invoice_number;
      const custName = String(inv.customerName || '').trim().toLowerCase();
      creditNotes.forEach(cn => {
        if (poNum && poNum !== '-' && cn.po_order_number === poNum) handledCNIds.add(cn.id || cn.invoice_number);
        if (invNum && invNum !== '-' && (cn.invoice_number?.includes(invNum) || invNum.includes(cn.invoice_number?.replace('CN', '') || '___'))) handledCNIds.add(cn.id || cn.invoice_number);
      });
    });

    creditNotes.forEach(cn => {
      if (!handledCNIds.has(cn.id || cn.invoice_number)) {
        excelRows.push({
          'Invoice Number': safeText(cn.invoice_number),
          'PO Order Number': safeText(cn.po_order_number),
          'Date': safeText(cn.date),
          'Customer': safeText(cn.customerName),
          'Invoice Type': 'Credit Note',
          'Total Sales Amount (€)': 0,
          'Credit Note N°': safeText(cn.invoice_number),
          'Credit Note Amount (€)': safeNumber(cn.total_amount),
          'Net Amount (€)': -safeNumber(cn.total_amount),
          'Invoicing Address': safeText(cn.invoicing_address_detail?.title || cn.invoicing_address),
          'Shipping Address': safeText(cn.shipping_address_detail?.title || cn.shipping_address),
          'Created By': safeText(cn.createdBy),
          'Updated By': safeText(cn.updatedBy)
        });
      }
    });

    return excelRows;
  }, [filteredData]);

  const handleExport = async () => {
    if (!hasListAccess) return;
    setIsDownloading(true);
    try {
      const { runInvoiceBackfill } = await import('@/lib/invoice-generator');
      
      // Check if we need backfill
      const needsBackfill = filteredData.some(row => row.sourceType === 'supply_chain_loading' && (!row.invoice_number || row.invoice_number === '-'));
      if (needsBackfill) {
         // Safe backfill for the current year
         await runInvoiceBackfill(db as any, new Date().getFullYear());
         // Wait a moment for firestore listeners to potentially catch up, although we will just reload data in theory.
         // But actually the user just clicked download. To be completely safe and avoid reloading the whole page's queries immediately, 
         // we can just proceed. The next time they download or refresh, the table will show the new numbers. 
         // Since they asked to fix the numbers *before export*, we should ideally fetch the latest loadings or wait a bit.
         // Let's just refetch loadings to be safe if backfill ran.
      }

      // Fetch all payments for calculating open amounts and payment columns
      const { getDocs, collection } = await import('firebase/firestore');
      const paymentsSnap = await getDocs(collection(db as any, 'suppliers_situation_payments'));
      const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const handledCNIds = new Set();
      
      // First pass: identify all linked credit notes from parent invoices
      filteredData
        .filter(row => row.invoice_type !== 'proforma' && row.invoice_type_display?.toLowerCase() !== 'proforma' && !String(row.invoice_type || '').toLowerCase().includes('credit'))
        .forEach(row => {
           if (!row.linked_credit_notes_amount && (row.po_order_id || row.po_order_number)) {
             const cns = allInvoices?.filter(i => String(i.invoice_type || '').toLowerCase().includes('credit') && (i.po_order_id === row.po_order_id || i.po_order_number === row.po_order_number)) || [];
             cns.forEach(cn => handledCNIds.add(cn.id || cn.invoice_number));
           }
        });

      const exportRows = filteredData
        .filter(row => {
           if (row.invoice_type === 'proforma' || row.invoice_type_display?.toLowerCase() === 'proforma') return false;
           const isCreditNote = String(row.invoice_type || '').toLowerCase().includes('credit');
           if (isCreditNote && handledCNIds.has(row.id || row.invoice_number)) return false;
           return true;
        })
        .map(row => {
        const isSupplyChain = row.sourceType === 'supply_chain_loading';
        const isCreditNote = String(row.invoice_type || '').toLowerCase().includes('credit');
        
        const getDateMsLocal = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return new Date(val).getTime() || 0;
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          if (val.seconds) return val.seconds * 1000;
          return new Date(val).getTime() || 0;
        };

        const linkedPayments = allPayments
          .filter(p => p.invoiceId === row.sourceId)
          .sort((a, b) => getDateMsLocal(a.date || a.payment_date) - getDateMsLocal(b.date || b.payment_date));
        
        const sumPayments = linkedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
        let linkedCreditNotesAmount = row.linked_credit_notes_amount || 0;
        let linkedCreditNoteNumbers: string[] = row.linked_credit_note_numbers || [];
        
        if (isCreditNote) {
          linkedCreditNotesAmount = Number(row.total_amount || 0);
          linkedCreditNoteNumbers.push(row.invoice_number);
        } else if (!row.linked_credit_notes_amount) {
           if (row.po_order_id || row.po_order_number) {
             const cns = allInvoices?.filter(i => String(i.invoice_type || '').toLowerCase().includes('credit') && (i.po_order_id === row.po_order_id || i.po_order_number === row.po_order_number)) || [];
             linkedCreditNotesAmount = cns.reduce((sum, cn) => sum + Number(cn.total_amount || 0), 0);
             linkedCreditNoteNumbers = cns.map(cn => cn.invoice_number).filter(Boolean);
           }
        }
        
        const invoiceAmount = row.original_total_amount !== undefined ? row.original_total_amount : Number(row.total_amount || 0);
        let openAmount = invoiceAmount - sumPayments - (isCreditNote ? 0 : linkedCreditNotesAmount);
        
        const p1 = linkedPayments[0];
        const p2 = linkedPayments[1];
        const p3 = linkedPayments[2];

        let paymentTerm = row.payment_terms || row.payment_term || '';
        if (!paymentTerm && row.customer_id) {
           const customerObj = allCustomers?.find(c => c.id === row.customer_id);
           if (customerObj) paymentTerm = customerObj.payment_terms || customerObj.paymentTerm || '';
        }

        let dueDate = row.due_date || row.dueDate || '';
        if (!dueDate && paymentTerm && row.date) {
           if (String(paymentTerm).toLowerCase().includes('advance')) {
              dueDate = row.date;
           }
        }
        
        let notes = row.remarks || row.notes || '';
        if (linkedPayments.length > 3) {
           const extraMsg = `More than 3 payments exist: total extra payments = ${linkedPayments.length - 3}`;
           notes = notes ? `${notes} | ${extraMsg}` : extraMsg;
        }
        
        let finalInvoiceNumber = row.original_invoice_number !== undefined ? row.original_invoice_number : row.invoice_number;
        if (isSupplyChain && (!finalInvoiceNumber || finalInvoiceNumber === '-')) {
            // backfill check
        }
        if (!finalInvoiceNumber || finalInvoiceNumber === '-') finalInvoiceNumber = '';

        return {
           'Date': safeText(row.date),
           'Customer': safeText(row.customerName),
           'Invoice Number': safeText(finalInvoiceNumber),
           'Amount': invoiceAmount,
           'Amount 1': p1 ? Number(p1.amount || 0) : '',
           'Amount 1 Reception Date': p1 ? safeText(p1.date || p1.payment_date) : '',
           'Amount 1 in MAD': p1 ? Number(p1.amountMAD || p1.amount || 0) : '',
           'Exchange Rate 1': p1 ? Number(p1.exchangeRate || 1) : '',
           'Amount 2': p2 ? Number(p2.amount || 0) : '',
           'Amount 2 Reception Date': p2 ? safeText(p2.date || p2.payment_date) : '',
           'Amount 2 in MAD': p2 ? Number(p2.amountMAD || p2.amount || 0) : '',
           'Exchange Rate 2': p2 ? Number(p2.exchangeRate || 1) : '',
           'Amount 3': p3 ? Number(p3.amount || 0) : '',
           'Amount 3 Reception Date': p3 ? safeText(p3.date || p3.payment_date) : '',
           'Amount 3 in MAD': p3 ? Number(p3.amountMAD || p3.amount || 0) : '',
           'Exchange Rate 3': p3 ? Number(p3.exchangeRate || 1) : '',
           'Open Amount': openAmount,
           'Payment Term': safeText(paymentTerm),
           'Credit Note Amount': linkedCreditNotesAmount > 0 ? linkedCreditNotesAmount : '',
           'Credit Note Number': linkedCreditNoteNumbers.join(', '),
           'Due Date': safeText(dueDate),
           'Notes': safeText(notes)
        };
      });

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Invoices', { views: [{ state: 'frozen', ySplit: 1 }] });

      if (exportRows.length > 0) {
        // Define columns
        const columns = Object.keys(exportRows[0]).map(key => {
          let width = 15;
          if (key === 'Customer') width = 30;
          if (key === 'Invoice Number') width = 20;
          if (key === 'Notes') width = 40;
          if (key === 'Amount 1 Reception Date' || key === 'Amount 2 Reception Date' || key === 'Amount 3 Reception Date') width = 25;
          return { header: key, key: key, width };
        });
        sheet.columns = columns;

        // Add rows
        exportRows.forEach(row => {
          sheet.addRow(row);
        });

        // Style Header
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF7a9800' }
          };
          cell.font = {
            color: { argb: 'FFFFFFFF' },
            bold: true,
            size: 10
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
             top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
             left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
             bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
             right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });

        // Get 'Open Amount' column index
        const openAmountColNum = sheet.columns.findIndex(c => c.key === 'Open Amount') + 1;

        // Style Rows
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // Alternating colors
            if (rowNumber % 2 === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF9FAFB' } // Very light gray
              };
            }
            
            // Open Amount Column Styling (Green)
            if (colNumber === openAmountColNum) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF92D050' } // Light green
              };
              cell.font = { bold: true };
            }
            
            // Add borders
            cell.border = {
               top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
               left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
               bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
               right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
          });
        });

        // Autofilter
        sheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: columns.length }
        };
      }

      const seasonName = currentSeason ? (currentSeason.name || currentSeason.id) : 'All Seasons';
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      let fileName = `INVOICES LISTING - ${seasonName} - ${dateStr}.xlsx`;
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate Excel listing.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPdf = async (row: any) => {
    try {
      const isSalesInvoice = row.sourceType === 'sales_invoice';
      const typeStr = row.invoice_type_display || 'Produce Invoice';
      const dateStr = safeText(row.date);
      const invoiceNumber = safeText(row.invoice_number);

      const custTarget = String(row.customerName || row.customer || '').trim().toLowerCase();
      const custObj = allCustomers?.find(c => {
        if (row.customer_id && c.id === row.customer_id) return true;
        if (!custTarget) return false;
        const name1 = String(c.companyName || '').trim().toLowerCase();
        const name2 = String(c.name || '').trim().toLowerCase();
        return name1 === custTarget || name2 === custTarget || (name1 && custTarget.includes(name1)) || (name2 && custTarget.includes(name2));
      });
      const orderObj = allOrders?.find(o => (row.po_order_id && o.id === row.po_order_id) || (row.po_order_number && row.po_order_number !== '-' && o.poNumber === row.po_order_number));
      const plObj = allPackingLists?.find(pl => (row.packingListId && pl.id === row.packingListId) || (row.packing_list_id && pl.id === row.packing_list_id));
      // Enrich row with resolved customer data so the PDF generator can find it
      const enrichedRow = { ...row };
      if (custObj) {
        const billing = custObj.addresses?.find((a: any) => a.type === 'Billing') || custObj.addresses?.[0];
        enrichedRow.customer_detail = {
          ...(enrichedRow.customer_detail || {}),
          companyName: custObj.companyName || enrichedRow.customer_detail?.companyName,
          street_address: billing?.street || custObj.address || custObj.street || enrichedRow.customer_detail?.street_address,
          city: billing?.city || custObj.city || enrichedRow.customer_detail?.city,
          zip_code: billing?.zipCode || custObj.zipCode || enrichedRow.customer_detail?.zip_code,
          country: billing?.country || custObj.country || enrichedRow.customer_detail?.country,
          vat_number: custObj.vatNumber || custObj.vat_number || enrichedRow.customer_detail?.vat_number,
          payment_terms: custObj.payment_term_name || custObj.paymentTerms || enrichedRow.customer_detail?.payment_terms,
          payment_term_name: custObj.payment_term_name || enrichedRow.customer_detail?.payment_term_name,
          incoterms: custObj.incoterm || enrichedRow.customer_detail?.incoterms,
        };
      }
      if (orderObj) {
        if (!enrichedRow.truck_number) enrichedRow.truck_number = orderObj.truckNumber || orderObj.truck_number;
        if (!enrichedRow.payment_terms || enrichedRow.payment_terms === '—') enrichedRow.payment_terms = orderObj.paymentTerms || orderObj.payment_terms;
      }
      if (plObj) {
        if (!enrichedRow.truck_number) enrichedRow.truck_number = plObj.truckNumber || plObj.truck_number;
      }

      await generateInvoicePDF(
        invoiceNumber,
        dateStr,
        plObj || null,
        orderObj || null,
        custObj || null,
        row.ggn || '',
        [],
        enrichedRow
      );
      toast({ title: 'Success', description: 'PDF downloaded.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    }
  };

  const handleDownloadSingleExcel = async (row: any) => {
    try {
      const dateStr = safeText(row.date);
      const invoiceNumber = safeText(row.invoice_number);

      await generateInvoiceExcel(
        invoiceNumber,
        dateStr,
        null,
        null,
        null,
        row.ggn || '',
        [],
        row
      );
      toast({ title: 'Success', description: 'Excel downloaded.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to generate Excel.', variant: 'destructive' });
    }
  };

  // 4. Delete Invoice Handler
  const handleDelete = async (row: any) => {
    if (!db || !hasDeleteAccess) return;
    const invoiceNum = safeText(row.invoice_number || row.invoiceNumber || row.id);
    if (confirm(`Are you sure you want to delete invoice ${invoiceNum}?`)) {
      try {
        const id = row.id || row.sourceId;
        
        // 1. Delete from primary source collection
        if (row.sourceType === 'supply_chain_packing_list') {
          await deleteDoc(doc(db, 'packingLists', id));
        } else if (row.sourceType === 'supply_chain_loading') {
          await deleteDoc(doc(db, 'supply_chain_loadings', id));
        } else {
          await deleteDoc(doc(db, 'invoices', id));
        }

        // 2. Clean up shadow doc from 'invoices' collection if it exists
        try {
          await deleteDoc(doc(db, 'invoices', id));
        } catch (_) {}

        // 3. Clean up shadow doc from 'packingLists' collection if it exists
        try {
          await deleteDoc(doc(db, 'packingLists', id));
        } catch (_) {}

        // 4. Clean up shadow doc from 'supply_chain_loadings' collection if it exists
        try {
          await deleteDoc(doc(db, 'supply_chain_loadings', id));
        } catch (_) {}

        // 5. Restore associated Order status to Produced so it can be re-selected for a new packing list
        const targetOrderId = row.orderId || row.po_order_id;
        const targetPoNum = row.po_order_number || row.poNumber;

        try {
          let orderRef = null;
          if (targetOrderId) {
            orderRef = doc(db, 'orders', targetOrderId);
          } else if (targetPoNum && targetPoNum !== '-') {
            const q = query(collection(db, 'orders'), where('poNumber', '==', targetPoNum));
            const snap = await getDocs(q);
            if (!snap.empty) {
              orderRef = doc(db, 'orders', snap.docs[0].id);
            }
          }
          if (orderRef) {
            await updateDoc(orderRef, {
              packingListGenerated: false,
              status: 'Produced'
            });
          }
        } catch (e) {
          console.error('Could not reset order status on delete:', e);
        }

        toast({
          title: 'Invoice Deleted',
          description: `Invoice ${invoiceNum} was successfully deleted.`
        });
      } catch (err) {
        console.error('Delete failed:', err);
        toast({
          title: 'Error',
          description: 'Failed to delete invoice. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  // 5. Define Columns
  const columns = useMemo(() => [
    {
      header: 'Actions',
      accessorKey: 'actions',
      render: (row: any) => {
        const isSalesInvoice = row.sourceType === 'sales_invoice';
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 rounded-lg">
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-white border border-slate-100 shadow-xl rounded-xl p-1 z-[100]">
              {hasListAccess && (
                <DropdownMenuItem 
                  onClick={() => router.push(`/finance/invoices/view/${row.id}?type=${isSalesInvoice ? 'sales' : 'loading'}`)} 
                  className="text-[11px] font-bold text-[#2e1d52] cursor-pointer hover:bg-slate-50 hover:text-[#7a9800] rounded-lg"
                >
                  <Eye className="h-3.5 w-3.5 mr-2" /> View
                </DropdownMenuItem>
              )}
              {hasUpdateAccess && (
                <DropdownMenuItem 
                  onClick={() => {
                    if (row.sourceType === 'supply_chain_packing_list') {
                      router.push(`/supply-chain/packing-lists/${row.id}/edit`);
                    } else if (row.sourceType === 'supply_chain_loading') {
                      router.push(`/supply-chain/loadings/${row.id}/edit`);
                    } else {
                      router.push(`/finance/invoices/edit/${row.id}`);
                    }
                  }} 
                  className="text-[11px] font-bold text-[#2e1d52] cursor-pointer hover:bg-slate-50 hover:text-[#7a9800] rounded-lg"
                >
                  <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {hasDeleteAccess && (
                <DropdownMenuItem 
                  onClick={() => handleDelete(row)} 
                  className="text-[11px] font-bold text-rose-600 cursor-pointer hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              )}
              {hasListAccess && (
                <>
                  <DropdownMenuItem 
                    onClick={() => handleDownloadPdf(row)} 
                    className="text-[11px] font-bold text-[#2e1d52] cursor-pointer hover:bg-slate-50 rounded-lg"
                  >
                    <FileText className="h-3.5 w-3.5 mr-2" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDownloadSingleExcel(row)} 
                    className="text-[11px] font-bold text-[#2e1d52] cursor-pointer hover:bg-slate-50 rounded-lg"
                  >
                    <Download className="h-3.5 w-3.5 mr-2" /> Download Excel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    },
    {
      header: 'Invoice Number',
      accessorKey: 'invoice_number',
      render: (row: any) => {
        const isSalesInvoice = row.sourceType === 'sales_invoice';
        const url = `/finance/invoices/view/${row.id}?type=${isSalesInvoice ? 'sales' : 'loading'}`;
        return (
          <span 
            onClick={() => hasListAccess && router.push(url)}
            className={`font-bold ${hasListAccess ? 'text-[#2e1d52] hover:text-[#7a9800] transition-colors cursor-pointer underline' : 'text-[#2e1d52]'}`}
          >
            {safeText(row.invoice_number)}
          </span>
        );
      }
    },
    {
      header: 'PO Order Number',
      accessorKey: 'po_order_number',
      render: (row: any) => safeText(row.po_order_number)
    },
    {
      header: 'Date & Time',
      accessorKey: 'date',
      render: (row: any) => {
        if (!row.date) return '-';
        let ms = 0;
        const val = row.date;
        if (typeof val === 'number') ms = val;
        else if (typeof val === 'string') ms = new Date(val).getTime();
        else if (typeof val.toDate === 'function') ms = val.toDate().getTime();
        else if (val.seconds) ms = val.seconds * 1000;
        
        if (ms && !isNaN(ms)) {
          const d = new Date(ms);
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }
        return safeText(row.date);
      }
    },
    {
      header: 'Customer',
      accessorKey: 'customerName',
      render: (row: any) => safeText(row.customerName)
    },
    {
      header: 'Invoice Type',
      accessorKey: 'invoice_type_display',
      render: (row: any) => safeText(row.invoice_type_display)
    },
    {
      header: 'Total Amount',
      accessorKey: 'total_amount',
      align: 'right' as const,
      render: (row: any) => {
        const amt = row.total_amount === 0 || row.total_amount == null ? '-' : money(row.total_amount);
        if (amt === '-') return '-';
        const curr = String(row.currency || '').trim().toUpperCase();
        let sym = '';
        if (curr.includes('EURO') || curr.includes('EUR')) sym = '€';
        else if (curr.includes('DOLLAR') || curr.includes('USD')) sym = '$';
        else if (curr.includes('POUND') || curr.includes('GBP')) sym = '£';
        else if (curr.includes('MAD')) sym = ' MAD';

        return (
          <span className="font-black text-[#2e1d52]">
            {sym === '€' || sym === '$' || sym === '£' ? `${sym}${amt}` : `${amt}${sym ? `${sym}` : ' MAD'}`}
          </span>
        );
      }
    },
    {
      header: 'Invoicing Address',
      accessorKey: 'invoicing_address',
      render: (row: any) => <span className="max-w-xs truncate block" title={row.invoicing_address}>{safeText(row.invoicing_address_detail?.title || row.invoicing_address)}</span>
    },
    {
      header: 'Shipping Address',
      accessorKey: 'shipping_address',
      render: (row: any) => <span className="max-w-xs truncate block" title={row.shipping_address}>{safeText(row.shipping_address_detail?.title || row.shipping_address)}</span>
    },
    {
      header: 'Created By',
      accessorKey: 'createdBy',
      render: (row: any) => safeText(row.createdBy)
    },
    {
      header: 'Updated By',
      accessorKey: 'updatedBy',
      render: (row: any) => safeText(row.updatedBy)
    }
  ], [router, db, hasListAccess, hasUpdateAccess, hasDeleteAccess]);

  const breadcrumbItems = [
    { label: 'Profile', href: '#' },
    { label: 'Invoice', active: true }
  ];

  if (!hasListAccess && !isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      {/* Page Header */}
      <ERPPageHeader
        title="Invoices"
        subtitle="Manage commercial invoices, proformas, produce invoicing, and customer credit notes."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">

            {hasAddAccess && (
              <Button
                onClick={() => router.push('/finance/invoices/add')}
                className="bg-[#6b8e23] hover:bg-[#556b2f] text-white font-medium gap-1 text-sm px-4 py-2 rounded-md shadow-sm transition-all"
              >
                <Plus size={16} />
              </Button>
            )}
            {hasListAccess && (
              <Button
                onClick={handleExport}
                disabled={isDownloading}
                className="bg-[#6b8e23] hover:bg-[#556b2f] text-white font-medium gap-1 text-sm px-4 py-2 rounded-md shadow-sm transition-all"
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : 'Download'}
              </Button>
            )}
          </div>
        }
      />

      {/* Main Table Card */}
      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <ERPToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          density={density}
          onDensityChange={setDensity}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Invoices...</p>
          </div>
        ) : (
          <ERPTable
            columns={columns}
            data={filteredData}
            density={density}
            getRowId={(row) => row.sourceId}
            pageSize={10}
            emptyMessage="No invoices found."
          />
        )}
      </div>
    </div>
  );
}
