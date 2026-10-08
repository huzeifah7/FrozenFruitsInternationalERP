'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';

// Helper to resolve product names robustly
export const resolveProductName = (item: any, products: any[]) => {
  const pid = item?.product_id || item?.productId;
  
  if (pid) {
    const p = products.find(prod => prod.id === pid);
    if (p) {
      const name = p.productName || p.name || p.title || p.label;
      if (name) return name;
    }
  }

  const pObj = item?.product;
  if (pObj) {
    if (typeof pObj === 'object') {
      const name = pObj.productname || pObj.name || pObj.title || pObj.label;
      if (name) return name;
    } else if (typeof pObj === 'string') {
      const p = products.find(prod => prod.id === pObj || prod.productName === pObj || prod.name === pObj);
      if (p) {
        const name = p.productName || p.name || p.title || p.label;
        if (name) return name;
      }
      return pObj;
    }
  }

  const pName = item?.product_name || item?.productName;
  if (pName) return pName;

  if (item?.description) {
    const descLower = item.description.trim().toLowerCase();
    const p = products.find(prod => {
      const name = (prod.productName || prod.name || prod.title || '').trim().toLowerCase();
      return name && name === descLower;
    });
    if (p) {
      return p.productName || p.name || p.title || p.label;
    }
    return item.description;
  }

  return 'Unknown Product';
};

// Helper to resolve product - category - type
export const resolveProductCategoryType = (item: any, products: any[]) => {
  const pid = item?.product_id || item?.productId || item?.product;
  let p: any = null;

  if (pid) {
    if (typeof pid === 'object') {
      p = pid;
    } else if (typeof pid === 'string') {
      p = products.find(prod => prod.id === pid || prod.productName === pid || prod.name === pid);
    }
  }

  if (!p && item?.product) {
    if (typeof item.product === 'object') {
      p = item.product;
    } else if (typeof item.product === 'string') {
      p = products.find(prod => prod.id === item.product || prod.productName === item.product || prod.name === item.product);
    }
  }

  const rawName = p?.productName || p?.name || p?.title || p?.label || item?.productName || item?.product_name || item?.product || item?.description || '';
  const rawCategory = p?.category || p?.variety || item?.category || item?.variety || '';
  const rawType = p?.type || item?.type || '';

  const name = typeof rawName === 'string' ? rawName.trim().toUpperCase() : '';
  const category = typeof rawCategory === 'string' ? rawCategory.trim().toUpperCase() : '';
  const type = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';

  const parts = [name, category, type].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' - ');
  }

  return 'UNKNOWN PRODUCT';
};

// Helper to resolve customer names
export const resolveCustomerName = (cId: string, customers: any[], localCustomers: any[]) => {
  const c = customers.find(x => x.id === cId) || localCustomers.find(x => x.id === cId);
  if (!c) return cId || '-';
  return c.companyName || c.company_name || c.customer_name || c.name || (c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : cId);
};

// Helper to check if item is "Usage Industriel"
export const isUsageIndustriel = (item: any, products: any[]) => {
  const pid = item?.productId || item?.product_id || item?.product;
  let p: any = null;
  if (pid && typeof pid === 'string') {
    p = products.find(prod => prod.id === pid);
  }
  
  const name = (p?.productName || p?.name || p?.title || p?.label || item?.productName || item?.product_name || item?.name || '').trim().toLowerCase();
  
  if (name.includes('usage industriel') || name.includes('usage_industriel') || name === 'industriel' || name === 'industrial') {
    return true;
  }
  
  if (p) {
    const category = (p.category || '').trim().toLowerCase();
    const type = (p.type || '').trim().toLowerCase();
    const code = (p.code || '').trim().toLowerCase();
    if (category.includes('usage_industriel') || category.includes('usage industriel') ||
        type.includes('usage_industriel') || type.includes('usage industriel') ||
        code.includes('usage_industriel') || code.includes('usage industriel')) {
      return true;
    }
  }
  
  return false;
};

export function useDashboardData(seasonId: string | undefined, startDate: string, endDate: string) {
  const db = useFirestore();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [data, setData] = useState<any>({
    overview: { netWeight: 0, numberOfLoads: 0 },
    invoiceStats: { totalSales: 0, totalCreditNote: 0 },
    saleAnalytics: { totalReceived: 0, totalPending: 0 },
    receptions: 0,
    finalProduct: 0,
    decay: 0,
    customerInvoices: [],
    topSaleStatistics: [],
    customerBalances: [],
    calibersAnalytics: [],
    weeklyAveragePrice: [],
    topSuppliersOpenAmount: [],
    topDecayCustomersOpenAmount: [],
  });

  const cacheRef = useRef<Record<string, any[]>>({
    invoices: [],
    payments: [],
    credit_notes: [],
    customers: [],
    production_output: [],
    raw_materials: [],
    decay_loadings: [],
    decay_payments: [],
    supply_chain_loadings: [],
    supply_chain_packing_lists: [],
    finance_suppliers: [],
    expenses: [],
    suppliers_situation_payments: [],
    products: [],
    local_customers: [],
    orders: [],
  });

  const computeMetrics = () => {
    const {
      invoices,
      payments,
      credit_notes,
      customers,
      production_output,
      raw_materials,
      decay_loadings,
      decay_payments,
      supply_chain_loadings,
      supply_chain_packing_lists,
      finance_suppliers,
      expenses,
      suppliers_situation_payments,
      products,
      local_customers,
      orders,
    } = cacheRef.current;

    // Filtering helpers
    const isWithinDate = (itemDateStr: string | undefined) => {
      if (!itemDateStr) return true;
      const d = itemDateStr.substring(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    };
    
    const filterBySeason = (item: any) => seasonId ? item.season_id === seasonId || item.seasonId === seasonId : true;
    const safeNumber = (v: any) => Number(v || 0);

    // --- Group 1: Operations Overview ---
    const filteredScLoadings = (supply_chain_loadings || []).filter(l => filterBySeason(l) && isWithinDate(l.date || l.createdAt?.substring?.(0, 10)));
    const numberOfLoads = filteredScLoadings.length;
    
    const filteredOutputs = (production_output || []).filter(o => filterBySeason(o) && isWithinDate(o.shiftDate || o.createdAt?.substring?.(0, 10)));
    
    // Total net weight = total Production Output net weight
    const netWeight = filteredOutputs.reduce((sum, o) => {
      const palletWeight = o.items?.reduce((s: number, item: any) => s + safeNumber(item.netWeight), 0);
      if (palletWeight && palletWeight > 0) return sum + palletWeight;
      return sum + safeNumber(o.totalNetWeight || o.netWeight);
    }, 0);

    // --- Group 2 & 3: Invoices & Sale Analytics ---
    const filteredInvoices = (invoices || []).filter(i => filterBySeason(i) && isWithinDate(i.date || i.invoiceDate || i.createdAt?.substring?.(0, 10)));
    const filteredPayments = (payments || []).filter(p => filterBySeason(p) && isWithinDate(p.date || p.paymentDate || p.createdAt?.substring?.(0, 10)));
    const filteredCreditNotes = (credit_notes || []).filter(cn => filterBySeason(cn) && isWithinDate(cn.date || cn.createdAt?.substring?.(0, 10)));
    const filteredOrders = (orders || []).filter(o => filterBySeason(o) && isWithinDate(o.date || o.createdAt?.substring?.(0, 10)));

    const totalSales = filteredInvoices.reduce((sum, i) => sum + safeNumber(i.total_amount || i.invoice_amount), 0);
    const totalCreditNote = filteredCreditNotes.reduce((sum, cn) => sum + safeNumber(cn.amount || cn.total_amount), 0);
    
    // Total received = Total net of orders shipped + delivered
    const shippedDeliveredOrders = filteredOrders.filter(o => ['shipped', 'delivered'].includes((o.status || '').toLowerCase()));
    const totalReceivedFromOrders = shippedDeliveredOrders.reduce((sum, o) => {
      let orderW = safeNumber(o.totalNetWeight || o.netWeight || o.totalAmount || o.amount);
      if (!orderW && o.items) {
        orderW = o.items.reduce((s: number, item: any) => {
          const qty = safeNumber(item.quantity || item.qty || item.boxes);
          const boxW = safeNumber(item.netWeightPerBox || item.netWeight || 14);
          return s + (item.netWeight ? safeNumber(item.netWeight) : qty * boxW);
        }, 0);
      }
      return sum + orderW;
    }, 0);
    
    const totalReceivedPayments = filteredPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0);
    const totalReceived = totalReceivedFromOrders > 0 ? totalReceivedFromOrders : totalReceivedPayments;
    const totalPending = totalSales - totalReceived - totalCreditNote;

    // --- Group 4: Production Totals ---
    const filteredRaw = (raw_materials || []).filter(rm => filterBySeason(rm) && isWithinDate(rm.date || rm.dateTime?.substring?.(0, 10)));
    
    // Total Reception = Total net of raw materials
    const totalReceptions = filteredRaw.reduce((sum, rm) => sum + safeNumber(rm.totalNetWeight || rm.netWeight || rm.blNetWeight), 0);

    // Total final product = Total production output with type final product
    let totalFinalProduct = 0;
    
    const caliberMap: Record<string, number> = {
      '10': 0, '12': 0, '14': 0, '16': 0, '18': 0, '20': 0, '22': 0, '24': 0, '26': 0, '28': 0, '30': 0, '32': 0,
      'Usage Industriel': 0,
      'Decay': 0,
      'Sans calibre': 0
    };

    filteredOutputs.forEach(output => {
      const palletWeight = output.items?.reduce((sum: number, item: any) => sum + safeNumber(item.netWeight), 0) || safeNumber(output.totalNetWeight || output.netWeight);
      const type = (output.palletisationType || output.type || '').toLowerCase();

      if (type === 'final product' || type === 'final_product' || type === 'out of program') {
        totalFinalProduct += palletWeight;
      }

      if (type === 'decay') {
        caliberMap['Decay'] += palletWeight;
      } else {
        output.items?.forEach((item: any) => {
          const w = safeNumber(item.netWeight);
          if (isUsageIndustriel(item, products || [])) {
            caliberMap['Usage Industriel'] += w;
          } else {
            const cal = (item.caliber || '').trim();
            if (!cal || cal === '-' || cal.toLowerCase() === 'unspecified') {
              caliberMap['Sans calibre'] += w;
            } else {
              if (caliberMap[cal] === undefined) {
                caliberMap[cal] = 0;
              }
              caliberMap[cal] += w;
            }
          }
        });
      }
    });

    // Total decay = Total Decay on production Output + Total farm decay from raw materials
    const decayOnProduction = filteredOutputs.reduce((sum, o) => {
      const type = (o.palletisationType || o.type || '').toLowerCase();
      if (type === 'decay') {
        const palletWeight = o.items?.reduce((s: number, item: any) => s + safeNumber(item.netWeight), 0);
        return sum + (palletWeight && palletWeight > 0 ? palletWeight : safeNumber(o.totalNetWeight || o.netWeight));
      }
      const itemDecay = o.items?.reduce((s: number, item: any) => {
        const cal = (item.caliber || item.name || '').toLowerCase();
        if (cal === 'decay') return s + safeNumber(item.netWeight);
        return s;
      }, 0) || 0;
      return sum + itemDecay;
    }, 0);

    const farmDecayFromRaw = filteredRaw.reduce((sum, rm) => {
      return sum + safeNumber(rm.totalDecayNetWeight || rm.decayNetWeight || rm.decayWeight || rm.farmDecay || 0);
    }, 0);

    const totalDecay = decayOnProduction + farmDecayFromRaw;
    // --- Customer Balances & Paid Amounts ---
    const custBalancesMap: Record<string, any> = {};

    const registerCustomer = (cId: string, providedName?: string) => {
      if (!cId) return;
      const cleanName = providedName && providedName !== cId && !providedName.match(/^[a-zA-Z0-9]{20,}$/) ? providedName : resolveCustomerName(cId, customers || [], local_customers || []);
      if (!custBalancesMap[cId]) {
        custBalancesMap[cId] = {
          id: cId,
          name: cleanName && cleanName !== cId ? cleanName : cId,
          totalSale: 0,
          paid: 0,
          creditNote: 0,
          open: 0,
        };
      } else if (cleanName && cleanName !== cId && (custBalancesMap[cId].name === cId || custBalancesMap[cId].name.match(/^[a-zA-Z0-9]{20,}$/))) {
        custBalancesMap[cId].name = cleanName;
      }
    };

    (customers || []).forEach(c => {
      const name = c.companyName || c.company_name || c.customer_name || c.name || (c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : '');
      registerCustomer(c.id, name);
    });

    (local_customers || []).forEach(lc => {
      const name = lc.companyName || lc.company_name || lc.customer_name || lc.name || (lc.firstName ? `${lc.firstName} ${lc.lastName || ''}`.trim() : '');
      registerCustomer(lc.id, name);
    });

    const invToCustMap: Record<string, string> = {};

    filteredInvoices.forEach(inv => {
      const cid = typeof inv.customer_id === 'string' ? inv.customer_id : 
                  typeof inv.customerId === 'string' ? inv.customerId : 
                  typeof inv.customer === 'string' ? inv.customer : 
                  inv.customer_detail?.id || inv.client_id || inv.clientId;

      const cName = inv.customer_detail?.companyName || inv.customer_detail?.company_name || inv.customerName || inv.customer_name || (typeof inv.customer === 'object' ? (inv.customer?.companyName || inv.customer?.name) : undefined);

      if (cid) {
        registerCustomer(cid, cName);
        const sale = safeNumber(inv.total_amount || inv.invoice_amount || inv.totalAmount || inv.total_ttc);
        custBalancesMap[cid].totalSale += sale;

        const directPaid = safeNumber(inv.paid_amount || inv.paidAmount || inv.received_amount || inv.amount_paid);
        if (directPaid > 0) {
          custBalancesMap[cid].paid += directPaid;
        }

        if (inv.id) invToCustMap[inv.id] = cid;
        if (inv.invoice_number) invToCustMap[String(inv.invoice_number).trim()] = cid;
        if (inv.invoiceNumber) invToCustMap[String(inv.invoiceNumber).trim()] = cid;
      }
    });

    const allCustomerPayments = [...(payments || []), ...(suppliers_situation_payments || [])];
    allCustomerPayments.forEach(p => {
      if (!filterBySeason(p) || !isWithinDate(p.date || p.paymentDate || p.createdAt?.substring?.(0, 10))) return;

      const cid = typeof p.customer_id === 'string' ? p.customer_id :
                  typeof p.customerId === 'string' ? p.customerId :
                  typeof p.customer === 'string' ? p.customer :
                  p.client_id || p.clientId || p.customer_detail?.id;

      const invRef = p.invoice_id || p.invoiceId || p.invoice_number || p.invoiceNumber;
      const targetId = cid || (invRef ? invToCustMap[String(invRef).trim()] : undefined);

      if (targetId) {
        registerCustomer(targetId);
        const payAmt = safeNumber(p.amount || p.payment_amount || p.total_amount || p.total_amount_ttc);
        custBalancesMap[targetId].paid += payAmt;
      }
    });

    filteredCreditNotes.forEach(cn => {
      const cid = typeof cn.customer_id === 'string' ? cn.customer_id :
                  typeof cn.customerId === 'string' ? cn.customerId :
                  typeof cn.customer === 'string' ? cn.customer :
                  cn.client_id || cn.clientId;

      const invRef = cn.invoice_id || cn.invoiceId || cn.invoice_number || cn.invoiceNumber;
      const targetId = cid || (invRef ? invToCustMap[String(invRef).trim()] : undefined);

      if (targetId) {
        registerCustomer(targetId);
        const cnAmt = safeNumber(cn.amount || cn.total_amount);
        custBalancesMap[targetId].creditNote += cnAmt;
      }
    });

    const customerBalances = Object.values(custBalancesMap).map((c: any) => {
      c.open = c.totalSale - c.paid - c.creditNote;
      return c;
    });

    // Chart: Customers Invoices (paid vs open for top customers with sales)
    const customerInvoices = customerBalances
      .filter((c: any) => c.totalSale > 0 || Math.abs(c.open) > 0)
      .sort((a: any, b: any) => b.totalSale - a.totalSale)
      .slice(0, 15);

    // --- Top Sale Statistics (Donut) ---
    // Display product-category-type based on production output final product
    const finalProductOutputs = filteredOutputs.filter(o => {
      const type = (o.palletisationType || o.type || '').toLowerCase();
      return type === 'final product' || type === 'final_product' || type === 'out of program';
    });

    const productSalesMap: Record<string, number> = {};

    finalProductOutputs.forEach(output => {
      if (output.items && output.items.length > 0) {
        output.items.forEach((item: any) => {
          const resolvedName = resolveProductCategoryType(item, products || []);
          const weight = safeNumber(item.netWeight || item.weight || item.quantity);
          productSalesMap[resolvedName] = (productSalesMap[resolvedName] || 0) + weight;
        });
      } else {
        const resolvedName = resolveProductCategoryType(output, products || []);
        const weight = safeNumber(output.totalNetWeight || output.netWeight);
        productSalesMap[resolvedName] = (productSalesMap[resolvedName] || 0) + weight;
      }
    });

    if (Object.keys(productSalesMap).length === 0) {
      filteredInvoices.forEach(inv => {
        inv.items?.forEach((item: any) => {
          const resolvedName = resolveProductCategoryType(item, products || []);
          const lineTotal = safeNumber(item.quantity || item.qty) * safeNumber(item.unit_price || item.price);
          productSalesMap[resolvedName] = (productSalesMap[resolvedName] || 0) + lineTotal;
        });
      });
    }

    const allProductSales = Object.entries(productSalesMap)
      .map(([name, amount]) => ({ name, value: amount }))
      .sort((a, b) => b.value - a.value);
    
    let topSaleStatistics = allProductSales.slice(0, 5);
    const otherSales = allProductSales.slice(5).reduce((sum, item) => sum + item.value, 0);
    if (otherSales > 0) {
      topSaleStatistics.push({ name: 'Other', value: otherSales });
    }

    // --- Calibers Analytics ---
    const totalCalWeight = Object.values(caliberMap).reduce((s, w) => s + w, 0);
    const calibersAnalytics = Object.entries(caliberMap)
      .filter(([_, w]) => w > 0)
      .map(([name, weight]) => ({
        name, 
        weight, 
        percentage: totalCalWeight > 0 ? parseFloat(((weight / totalCalWeight) * 100).toFixed(2)) : 0
      }));

    // --- Top 10 Suppliers By Open Amount ---
    const filteredExpenses = (expenses || []).filter(e => filterBySeason(e) && isWithinDate(e.date || e.expense_date || e.createdAt?.substring?.(0, 10)));
    const filteredSSPayments = (suppliers_situation_payments || []).filter(p => filterBySeason(p) && isWithinDate(p.date || p.createdAt?.substring?.(0, 10)));
    
    const supplierMap: Record<string, any> = {};

    const registerSupplier = (sId: string, name?: string) => {
      if (!sId) return;
      const cleanName = name && name !== sId && !name.match(/^[a-zA-Z0-9]{20,}$/) ? name : undefined;
      if (!supplierMap[sId]) {
        supplierMap[sId] = {
          id: sId,
          name: cleanName || 'Unknown Supplier',
          totalAmount: 0,
          paidAmount: 0,
          openAmount: 0,
        };
      } else if (cleanName && supplierMap[sId].name === 'Unknown Supplier') {
        supplierMap[sId].name = cleanName;
      }
    };

    (finance_suppliers || []).forEach(s => {
      const name = s.company_name || s.name || s.companyName || s.supplier_name;
      if (s.id) registerSupplier(s.id, name);
    });

    (cacheRef.current['suppliers'] || []).forEach((s: any) => {
      const name = s.company_name || s.name || s.companyName || s.supplier_name;
      if (s.id) registerSupplier(s.id, name);
    });

    filteredExpenses.forEach(exp => {
      const sid = typeof exp.supplier_id === 'string' ? exp.supplier_id :
                  typeof exp.supplier === 'string' ? exp.supplier :
                  typeof exp.supplier === 'object' ? (exp.supplier?.id) :
                  exp.supplierId || exp.supplier_detail?.id;

      const sName = exp.supplier_name || exp.supplierName || exp.supplier_detail?.name || exp.supplier_detail?.company_name || exp.supplier_detail?.companyName || (typeof exp.supplier === 'object' ? (exp.supplier?.company_name || exp.supplier?.name) : undefined);

      if (sid) {
        registerSupplier(sid, sName);
        const amount = safeNumber(exp.total_amount_ttc || exp.total_amount || exp.amount);

        if (String(exp.type) === '2') {
          supplierMap[sid].totalAmount -= amount;
        } else {
          supplierMap[sid].totalAmount += amount;

          const isPaidStatus = (exp.payment_status || '').toLowerCase() === 'paid';
          const directPaid = safeNumber(exp.paid_amount || exp.paidAmount || exp.amount_paid);

          if (isPaidStatus) {
            supplierMap[sid].paidAmount += amount;
          } else if (directPaid > 0) {
            supplierMap[sid].paidAmount += directPaid;
          }
        }
      }
    });

    filteredSSPayments.forEach(p => {
      const sid = typeof p.supplier_id === 'string' ? p.supplier_id :
                  typeof p.supplier === 'string' ? p.supplier :
                  typeof p.supplier === 'object' ? (p.supplier?.id) :
                  p.supplierId || p.supplier_detail?.id;

      if (sid) {
        registerSupplier(sid);
        const payAmt = safeNumber(p.amount || p.payment_amount || p.total_amount || p.total_amount_ttc);
        supplierMap[sid].paidAmount += payAmt;
      }
    });

    const topSuppliersOpenAmount = Object.values(supplierMap)
      .map((s: any) => {
        s.openAmount = Math.max(0, s.totalAmount - s.paidAmount);
        return s;
      })
      .filter((s: any) => s.totalAmount > 0 || s.paidAmount > 0)
      .sort((a: any, b: any) => b.openAmount - a.openAmount)
      .slice(0, 10);

    // --- Top 10 Decay Customers ---
    const filteredDecayLoadings = (decay_loadings || []).filter(l => filterBySeason(l) && isWithinDate(l.date || l.createdAt?.substring?.(0, 10)));
    const filteredDecayPayments = (decay_payments || []).filter(p => filterBySeason(p) && isWithinDate(p.date || p.createdAt?.substring?.(0, 10)));
    
    let totalDecayLoadings = 0;
    const decayCustMap: Record<string, any> = {};

    const registerDecayCustomer = (cId: string, providedName?: string) => {
      if (!cId) return;
      const cleanName = providedName && providedName !== cId && !providedName.match(/^[a-zA-Z0-9]{20,}$/) ? providedName : resolveCustomerName(cId, customers || [], local_customers || []);
      if (!decayCustMap[cId]) {
        decayCustMap[cId] = {
          id: cId,
          name: cleanName && cleanName !== cId ? cleanName : cId,
          totalAmount: 0,
          paidAmount: 0,
          openAmount: 0,
        };
      } else if (cleanName && cleanName !== cId && (decayCustMap[cId].name === cId || decayCustMap[cId].name.match(/^[a-zA-Z0-9]{20,}$/))) {
        decayCustMap[cId].name = cleanName;
      }
    };
    
    (local_customers || []).forEach(lc => {
      const name = lc.companyName || lc.company_name || lc.customer_name || lc.name || (lc.firstName ? `${lc.firstName} ${lc.lastName || ''}`.trim() : '');
      registerDecayCustomer(lc.id, name);
    });

    (customers || []).forEach(c => {
      const name = c.companyName || c.company_name || c.customer_name || c.name || (c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : '');
      registerDecayCustomer(c.id, name);
    });

    filteredDecayLoadings.forEach(l => {
      const cid = typeof l.customerId === 'string' ? l.customerId :
                  typeof l.customer_id === 'string' ? l.customer_id :
                  typeof l.customer === 'string' ? l.customer :
                  typeof l.customer === 'object' ? (l.customer?.id) : undefined;

      const cName = l.customer_name || l.customerName || l.client_name || l.clientName || (typeof l.customer === 'object' ? (l.customer?.companyName || l.customer?.name) : undefined);

      if (cid) {
        registerDecayCustomer(cid, cName);

        const totalQty = l.items?.reduce((sum: number, i: any) => sum + safeNumber(i.netWeight), 0) || safeNumber(l.quantity);
        const price = safeNumber(l.price);
        const amt = safeNumber(l.total_amount || l.totalAmount) || (totalQty * price);
        totalDecayLoadings += amt;
        
        decayCustMap[cid].totalAmount += amt;

        const directPaid = safeNumber(l.paid_amount || l.paidAmount || l.paid);
        if (directPaid > 0) {
          decayCustMap[cid].paidAmount += directPaid;
        }
      }
    });

    filteredDecayPayments.forEach(p => {
      const cid = typeof p.customerId === 'string' ? p.customerId :
                  typeof p.customer_id === 'string' ? p.customer_id :
                  typeof p.customer === 'string' ? p.customer : undefined;

      if (cid) {
        registerDecayCustomer(cid);
        const payAmt = safeNumber(p.amount || p.payment_amount || p.total_amount);
        decayCustMap[cid].paidAmount += payAmt;
      }
    });

    const topDecayCustomersOpenAmount = Object.values(decayCustMap)
      .map((c: any) => {
        c.openAmount = Math.max(0, c.totalAmount - c.paidAmount);
        return c;
      })
      .filter((c: any) => c.totalAmount > 0 || c.paidAmount > 0)
      .sort((a: any, b: any) => b.openAmount - a.openAmount)
      .slice(0, 10);

    // --- Weekly Average Price ---
    const getWeek = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Unknown Week';
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
      const week1 = new Date(d.getFullYear(), 0, 4);
      return `${d.getFullYear()}-W${Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1}`;
    };

    const weeklyMap: Record<string, { totalAmount: number, totalWeight: number }> = {};
    filteredInvoices.forEach(inv => {
      const dateStr = inv.date || inv.invoiceDate || inv.createdAt?.substring?.(0, 10);
      if (!dateStr) return;
      const week = getWeek(dateStr);
      if (!weeklyMap[week]) weeklyMap[week] = { totalAmount: 0, totalWeight: 0 };
      
      let invWeight = 0;
      inv.items?.forEach((item: any) => {
        invWeight += safeNumber(item.quantity || item.qty);
      });
      
      weeklyMap[week].totalAmount += safeNumber(inv.total_amount || inv.invoice_amount);
      weeklyMap[week].totalWeight += invWeight;
    });

    const weeklyAveragePrice = Object.entries(weeklyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, stats]) => {
        return {
          name: week,
          price: stats.totalWeight > 0 ? parseFloat((stats.totalAmount / stats.totalWeight).toFixed(2)) : 0
        };
      });

    setData({
      overview: { netWeight, numberOfLoads },
      invoiceStats: { totalSales, totalCreditNote },
      saleAnalytics: { totalReceived, totalPending },
      receptions: totalReceptions,
      finalProduct: totalFinalProduct,
      decay: totalDecay,
      customerInvoices,
      topSaleStatistics,
      customerBalances: customerBalances.sort((a: any, b: any) => b.totalSale - a.totalSale),
      calibersAnalytics,
      weeklyAveragePrice,
      topSuppliersOpenAmount,
      topDecayCustomersOpenAmount,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (!db || !user) return;
    setLoading(true);
    setError(null);

    const collectionsToListen = [
      'invoices',
      'payments',
      'credit_notes',
      'customers',
      'production_output',
      'raw_materials',
      'decay_loadings',
      'decay_payments',
      'supply_chain_loadings',
      'supply_chain_packing_lists',
      'finance_suppliers',
      'suppliers',
      'expenses',
      'suppliers_situation_payments',
      'products',
      'local_customers',
      'orders',
    ];

    const unsubscribes: (() => void)[] = [];

    collectionsToListen.forEach((colName) => {
      try {
        const unsub = onSnapshot(
          query(collection(db, colName)),
          (snapshot) => {
            cacheRef.current[colName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            computeMetrics();
          },
          (err) => {
            console.error(`Live listener error on ${colName}:`, err);
            setError(err);
          }
        );
        unsubscribes.push(unsub);
      } catch (e: any) {
        console.error(`Failed to subscribe to ${colName}:`, e);
      }
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [seasonId, startDate, endDate, db, user]);

  return { loading, error, ...data, refetch: computeMetrics };
}
