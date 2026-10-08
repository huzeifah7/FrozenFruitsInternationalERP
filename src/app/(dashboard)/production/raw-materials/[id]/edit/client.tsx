'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import {
  collection, doc, writeBatch, getDocs, getDoc, query, orderBy, serverTimestamp, where, deleteDoc, setDoc, updateDoc
} from '@/firebase/firestore-override';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, Plus, Printer, Trash2,
  PackageCheck, Loader2, Save,
} from 'lucide-react';
import { format } from 'date-fns';
import { sortProductFamilies, sortProducts } from '@/lib/utils';
import { generateRawMaterialDetailPDF } from '@/lib/export-raw-material-detail-pdf';
import { FieldError } from '@/components/ui/field-error';

export default function EditRawMaterialPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const { toast } = useToast();

  const [dateTime, setDateTime] = useState('');
  const [originalDateTime, setOriginalDateTime] = useState('');
  const [locationId, setLocationId] = useState('');
  const [originalLocationId, setOriginalLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [farmId, setFarmId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [blGrossWeight, setBlGrossWeight] = useState('');
  const [blNetWeight, setBlNetWeight] = useState('');
  const [productFamily, setProductFamily] = useState('Avocado');
  const [calibreDominant, setCalibreDominant] = useState('');
  const [petitCalibre, setPetitCalibre] = useState('');
  const [dechet, setDechet] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('Normal');
  const [lotNumber, setLotNumber] = useState('');
  const [boxesIn, setBoxesIn] = useState('');
  const [boxType, setBoxType] = useState('EXPORT_OPTIMUM');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [pallets, setPallets] = useState<any[]>([]);
  const lastPalletNumRef = useRef(0);

  // --- Reference Data ---
  const [locations, setLocations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allFarms, setAllFarms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const productFamilies = useMemo(() => {
    const families = new Set(products.map(p => p.productName).filter(Boolean));
    return sortProductFamilies(Array.from(families));
  }, [products]);

  const availableVarieties = useMemo(() => {
    const filtered = products.filter(p => (p.productName || p.name) === productFamily);
    return sortProducts(filtered);
  }, [products, productFamily]);

  const farmCode = useMemo(() => {
    if (!farmId || allFarms.length === 0) return 'EOF';
    const farm = allFarms.find(f => f.id === farmId);
    if (!farm) return 'EOF';
    if (farm.farmCodification) return farm.farmCodification.toUpperCase();
    return farm.name ? farm.name.substring(0, 3).toUpperCase() : 'EOF';
  }, [farmId, allFarms]);

  // --- Fetch Initial Data ---
  useEffect(() => {
    if (!db || !id) return;
    const fetchData = async () => {
      try {
        // Fetch Reference Data
        const farmSnap = await getDocs(query(collection(db, 'main_farms'), orderBy('name')));
        setAllFarms(farmSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const locSnap = await getDocs(query(collection(db, 'processing_lines'), orderBy('title')));
        const supSnap = await getDocs(query(collection(db, 'procurement_suppliers'), orderBy('name')));
        const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('productName')));
        setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSuppliers(supSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Raw Material
        const docRef = doc(db, 'raw_materials', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDateTime(data.dateTime || '');
          setOriginalDateTime(data.dateTime || '');
          setLocationId(data.locationId || '');
          setOriginalLocationId(data.locationId || '');
          setSupplierId(data.supplierId || '');
          setFarmId(data.farmId || '');
          setDriverName(data.driverName || '');
          setPlateNumber(data.plateNumber || '');
          setBlGrossWeight(String(data.blGrossWeight || ''));
          setBlNetWeight(String(data.blNetWeight || ''));
          setProductFamily(data.productFamily || 'Avocado');
          setCalibreDominant(String(data.calibreDominant || ''));
          setPetitCalibre(String(data.petitCalibre || ''));
          setDechet(String(data.dechet || ''));
          setRemarks(data.remarks || '');
          setStatus(data.status || 'Normal');
          setLotNumber(data.lotNumber || '');
          setBoxesIn(String(data.boxesIn || ''));
          setBoxType(data.boxType || 'EXPORT_OPTIMUM');

          // Fetch Pallets
          const palletQuery = query(
            collection(db, 'palletizations'),
            where('rawMaterialId', '==', id)
          );
          const palletSnap = await getDocs(palletQuery);
          const loadedPallets = palletSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          loadedPallets.sort((a: any, b: any) => (a.barcode || '').localeCompare(b.barcode || ''));
          setPallets(loadedPallets);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [db, id]);

  // Sync Box Type when Location changes to Berries For You
  useEffect(() => {
    if (!locationId || locations.length === 0) return;
    const loc = locations.find(l => l.id === locationId);
    if (loc && (loc.title?.toLowerCase() === 'berries for you' || loc.name?.toLowerCase() === 'berries for you')) {
      setBoxType('AGRICENTER');
    }
  }, [locationId, locations]);

  // Max Barcode Count for new pallets
  useEffect(() => {
    if (!db) return;
    const fetchCounts = async () => {
      try {
        let allBarcodeNums: number[] = [];
        const topPalletSnap = await getDocs(collection(db, 'palletizations'));
        topPalletSnap.forEach(p => {
          const num = parseInt((p.data().barcode || '').replace('RM', '') || '0');
          if (num > 0) allBarcodeNums.push(num);
        });
        lastPalletNumRef.current = allBarcodeNums.length > 0 ? Math.max(...allBarcodeNums) : 0;
      } catch (e) { }
    };
    fetchCounts();
  }, [db]);

  const selectedLocation = useMemo(() => locations.find(l => l.id === locationId), [locations, locationId]);
  const currentTare = useMemo(() => selectedLocation?.title === 'Berries For You' ? 24 : 22, [selectedLocation]);

  const regenerateLotNumber = async (newDateTime: string, newLocationId: string) => {
    if (!db || !newDateTime || !newLocationId) return;
    const d = new Date(newDateTime);
    const hours = d.getHours();
    const opDate = new Date(d);
    if (hours < 12) opDate.setDate(opDate.getDate() - 1);
    
    const opDateStr = format(opDate, 'yyyy-MM-dd');
    const nextDate = new Date(opDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = format(nextDate, 'yyyy-MM-dd');

    const startWindow = `${opDateStr}T12:00`;
    const endWindow = `${nextDateStr}T12:00`;

    const q = query(collection(db, 'raw_materials'), 
      where('dateTime', '>=', startWindow),
      where('dateTime', '<', endWindow),
      where('locationId', '==', newLocationId)
    );
    
    const snap = await getDocs(q);
    let size = snap.size;
    
    const loc = locations.find(l => l.id === newLocationId);
    const tag = loc?.locationTag ? `-${loc.locationTag.toUpperCase()}` : '';
    
    let generated = `${String(size + 1).padStart(2, '0')}-${format(opDate, 'dd')}${format(opDate, 'MM')}${farmCode}${format(opDate, 'yy')}${tag}`;
    
    let checkSnap = await getDocs(query(collection(db, 'raw_materials'), where('lotNumber', '==', generated)));
    while (!checkSnap.empty) {
      size++;
      generated = `${String(size + 1).padStart(2, '0')}-${format(opDate, 'dd')}${format(opDate, 'MM')}${farmCode}${format(opDate, 'yy')}${tag}`;
      checkSnap = await getDocs(query(collection(db, 'raw_materials'), where('lotNumber', '==', generated)));
    }

    setLotNumber(generated);
  };

  const handleDateTimeChange = async (val: string) => {
    if (originalDateTime && val !== originalDateTime) {
      if (confirm('Changing date or location will regenerate the lot number. Continue?')) {
        setDateTime(val);
        setOriginalDateTime(val);
        await regenerateLotNumber(val, locationId);
      }
    } else {
      setDateTime(val);
    }
  };

  const handleLocationChange = async (val: string) => {
    if (originalLocationId && val !== originalLocationId) {
      if (confirm('Changing date or location will regenerate the lot number. Continue?')) {
        setLocationId(val);
        setOriginalLocationId(val);
        await regenerateLotNumber(dateTime, val);
      }
    } else {
      setLocationId(val);
    }
  };

  // --- Pallet Printing ---
  const handlePrintPallet = (pallet: any) => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) {
      toast({ variant: 'destructive', title: 'Blocked Popup', description: 'Please allow popups to print ticket.' });
      return;
    }

    const supplierObj = suppliers.find(s => s.id === supplierId);
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
              <span class="row-value">${lotNumber || '—'}</span>
            </div>
            <div class="row">
              <span class="row-label">Date And Time#</span>
              <span class="row-value">${dateTime ? dateTime.replace('T', ' ') : '—'}</span>
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
      toast({ title: 'Generating PDF', description: 'Please wait...' });
      const supplierObj = suppliers.find(s => s.id === supplierId);
      const supplierName = supplierObj ? (supplierObj.name || supplierObj.supplierName) : '—';
      const locObj = locations.find(l => l.id === locationId);
      const locationName = locObj ? locObj.title : '—';
      
      const totalBoxes = pallets.reduce((sum: number, p: any) => sum + (Number(p.boxes) || 0), 0);
      const emptyBoxes = (Number(boxesIn || 0) - totalBoxes);

      // Compute totalNetWeight here for PDF output
      let totalNetWeight = 0;
      pallets.forEach(p => {
        totalNetWeight += Number(p.netWeight || 0);
      });

      await generateRawMaterialDetailPDF({
        lotNumber,
        dateTime,
        supplierName,
        locationName,
        driverName,
        plateNumber,
        productFamily,
        emptyBoxes,
        totalNetWeight,
        blNetWeight: Number(blNetWeight || 0),
        blGrossWeight: Number(blGrossWeight || 0),
        boxesIn: Number(boxesIn || 0),
        status,
        calibreDominant,
        petitCalibre: Number(petitCalibre || 0),
        dechet: Number(dechet || 0),
        remarks,
        products: products || [],
        pallets: pallets || []
      });
    } catch (e) {
      console.error("PDF generation failed", e);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  // --- Pallet Management ---
  const addPallet = async () => {
    const newErrors: Record<string, string> = {};
    if (!driverName) newErrors.driverName = 'Required before adding pallets';
    if (!plateNumber) newErrors.plateNumber = 'Required before adding pallets';
    if (!locationId) newErrors.locationId = 'Required before adding pallets';
    if (!supplierId) newErrors.supplierId = 'Required before adding pallets';
    if (!blNetWeight || Number(blNetWeight) <= 0) newErrors.blNetWeight = 'Required before adding pallets';
    if (!blGrossWeight || Number(blGrossWeight) <= 0) newErrors.blGrossWeight = 'Required before adding pallets';

    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill Driver Name, Plate Number, Location, Supplier Name, BL Net Weight and BL Gross Weight before adding palletization.',
      });
      return;
    }
    setErrors(prev => {
      const e = { ...prev };
      delete e.driverName; delete e.plateNumber; delete e.locationId; delete e.supplierId; delete e.blNetWeight; delete e.blGrossWeight;
      return e;
    });

    if (!db || !id) return;

    const nextNum = lastPalletNumRef.current + 1 + pallets.length;
    const brcd = `RM${String(nextNum).padStart(7, '0')}`;

    let defaultProdId = '';
    let defaultProductText = '';
    let defaultBoxes = 0;

    if (pallets.length > 0) {
      const lastPallet = pallets[pallets.length - 1];
      defaultProdId = lastPallet.productId || '';
      defaultProductText = lastPallet.product || '';
      defaultBoxes = lastPallet.boxes || 0;
    } else if (products.length > 0) {
      const hass = products.find(p => p.category?.toLowerCase() === 'hass') || products[0];
      if (hass) {
        defaultProdId = hass.id;
        defaultProductText = hass.type ? `${hass.category} - ${hass.type}` : hass.category;
      }
    }

    const palletRef = doc(collection(db, 'palletizations'));
    const newPallet = {
      rawMaterialId: id as string,
      lotNumber: lotNumber || '',
      barcode: brcd,
      productId: defaultProdId,
      product: defaultProductText,
      type: 'Raw Material',
      boxes: defaultBoxes,
      grossWeight: 0,
      netWeight: 0,
      createdAt: serverTimestamp(),
      createdBy: user?.email || '',
    };

    try {
      await setDoc(palletRef, newPallet);

      setPallets(prev => [...prev, {
        id: palletRef.id,
        ...newPallet,
      }]);
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Firestore Error', description: 'Failed to create pallet row.' });
    }
  };

  const updatePallet = async (palletId: string, field: string, value: any) => {
    let updatedPallet: any = null;
    setPallets(prev => prev.map(p => {
      if (p.id !== palletId) return p;
      const updated = { ...p, [field]: value };
      
      if (field === 'grossWeight' || field === 'boxes') {
        const gw = Number(field === 'grossWeight' ? value : p.grossWeight || 0);
        const bx = Number(field === 'boxes' ? value : p.boxes || 0);
        updated.netWeight = String(Math.round(Math.max(0, gw - bx * 2.8 - currentTare)));
      }

      if (field === 'productId') {
        const prod = products.find(prod => prod.id === value);
        if (prod) {
          updated.product = prod.type ? `${prod.category} - ${prod.type}` : prod.category;
        }
      }
      
      updatedPallet = updated;
      return updated;
    }));

    if (!db || !updatedPallet) return;
    try {
      const ref = doc(db, 'palletizations', palletId);
      await updateDoc(ref, {
        productId: updatedPallet.productId || '',
        product: updatedPallet.product || '',
        type: updatedPallet.type || 'Raw Material',
        grossWeight: Number(updatedPallet.grossWeight || 0),
        boxes: Number(updatedPallet.boxes || 0),
        netWeight: Number(updatedPallet.netWeight || 0),
        lotNumber: updatedPallet.lotNumber || lotNumber || '',
      });
    } catch (err) {
      console.error('Error auto-saving pallet field:', err);
    }
  };

  const removePallet = async (palletId: string) => {
    if (!db) return;
    if (!confirm('Are you sure you want to delete this pallet row?')) return;
    
    try {
      await deleteDoc(doc(db, 'palletizations', palletId));
      setPallets(prev => prev.filter(p => p.id !== palletId));
      toast({ title: 'Pallet Removed', description: 'Palletization row deleted from Firebase.' });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete pallet row.' });
    }
  };

  const isLowGrossWeight = (p: any) => {
    const gw = Number(p.grossWeight || 0);
    return gw > 0 && gw <= Number(p.boxes || 0) * 2.8 + currentTare;
  };

  // --- Submit ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !id) return;

    const newErrors: Record<string, string> = {};
    if (!locationId) newErrors.locationId = 'Location is required';
    if (!supplierId) newErrors.supplierId = 'Supplier is required';
    if (!farmId) newErrors.farmId = 'Farm is required';
    if (!productFamily) newErrors.productFamily = 'Product Family is required';
    if (!driverName) newErrors.driverName = 'Driver Name is required';
    if (!plateNumber) newErrors.plateNumber = 'Plate Number is required';
    if (!blNetWeight || Number(blNetWeight) <= 0) newErrors.blNetWeight = 'Valid BL Net Weight is required';
    if (!blGrossWeight || Number(blGrossWeight) <= 0) newErrors.blGrossWeight = 'Valid BL Gross Weight is required';
    if (!lotNumber) newErrors.lotNumber = 'Lot Number is required';
    if (!boxesIn || Number(boxesIn) <= 0) newErrors.boxesIn = 'Boxes IN is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setErrors({});
    if (pallets.length === 0) {
      toast({ title: 'No Pallets', description: 'You must add at least one palletization block.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      let totalNetWeight = 0, totalDecayNetWeight = 0;
      pallets.forEach(p => {
        const nw = Number(p.netWeight || 0);
        totalNetWeight += nw;
        if (p.type === 'Farm Decay') totalDecayNetWeight += nw;
      });

      const rmRef = doc(db, 'raw_materials', id as string);
      const selectedFarm = allFarms?.find(f => f.id === farmId);

      await updateDoc(rmRef, {
        dateTime,
        date: dateTime.split('T')[0],
        farmId,
        farmName: selectedFarm?.farmName || selectedFarm?.name || 'Unknown',
        driverName, plateNumber, locationId, supplierId,
        blGrossWeight: Number(blGrossWeight || 0), blNetWeight: Number(blNetWeight || 0),
        productFamily, calibreDominant: Number(calibreDominant || 0),
        petitCalibre: Number(petitCalibre || 0), dechet: Number(dechet || 0),
        status, remarks, 
        boxesIn: Number(boxesIn || 0),
        boxType,
        totalNetWeight: Math.round(totalNetWeight * 100) / 100,
        totalDecayNetWeight: Math.round(totalDecayNetWeight * 100) / 100,
        updatedAt: serverTimestamp(), updatedBy: user.email,
      });

      router.push('/production/raw-materials');
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error updating document', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 hover:bg-slate-200">
            <ChevronLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              <span>Production</span><span className="opacity-40">/</span>
              <span className="text-primary/60">Raw Materials</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">Edit Intake</h1>
          </div>
        </div>
        <Button 
          type="button"
          onClick={handlePrintRawMaterial}
          className="bg-[#708238] hover:bg-[#5b6a2e] text-white gap-2 font-bold px-6 py-2.5 h-11 rounded-xl transition-all shadow-md shadow-[#708238]/10 hover:shadow-lg flex items-center uppercase tracking-wider text-xs"
        >
          <Printer size={16} /> Print Raw Material
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Date Time</Label>
              <Input type="datetime-local" value={dateTime} onChange={e => handleDateTimeChange(e.target.value)} required error={!!errors.dateTime} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700" />
              <FieldError message={errors.dateTime} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Farm</Label>
              <Select value={farmId} onValueChange={setFarmId} required>
                <SelectTrigger error={!!errors.farmId} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allFarms.map(f => <SelectItem key={f.id} value={f.id} className="font-bold">{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.farmId} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Lot Number</Label>
              <Input value={lotNumber} readOnly error={!!errors.lotNumber} className="h-11 rounded-xl bg-slate-50 border-slate-200 font-black text-primary uppercase tracking-widest pointer-events-none" />
              <FieldError message={errors.lotNumber} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Driver Name</Label>
              <Input value={driverName} onChange={e => setDriverName(e.target.value)} required error={!!errors.driverName} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700 uppercase" />
              <FieldError message={errors.driverName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Plate Number</Label>
              <Input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} required error={!!errors.plateNumber} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700 uppercase" />
              <FieldError message={errors.plateNumber} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Location</Label>
              <Select value={locationId} onValueChange={handleLocationChange} required>
                <SelectTrigger error={!!errors.locationId} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id} className="font-bold">{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.locationId} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId} required>
                <SelectTrigger error={!!errors.supplierId} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.name || s.supplierName}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.supplierId} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">BL Net Weight (KG)</Label>
              <Input type="number" step="0.01" value={blNetWeight} onChange={e => setBlNetWeight(e.target.value)} required error={!!errors.blNetWeight} className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700" />
              <FieldError message={errors.blNetWeight} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">BL Gross Weight (KG)</Label>
              <Input type="number" step="0.01" value={blGrossWeight} onChange={e => setBlGrossWeight(e.target.value)} required className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700" />
            </div>
             <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Product Family</Label>
              <Select value={productFamily} onValueChange={setProductFamily} required>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {productFamilies.map(f => <SelectItem key={f} value={f} className="font-bold">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Add Palletization</h3>
            <Button 
              type="button" 
              onClick={addPallet} 
              disabled={!driverName || !plateNumber || !locationId || !supplierId || !blNetWeight || !blGrossWeight}
              variant="outline" 
              className="h-9 px-4 rounded-lg bg-white border-slate-200 text-primary font-black text-[10px] uppercase tracking-widest gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus size={14} /> Add Row
            </Button>
          </div>
          <div className="space-y-3">
            {pallets.map((p, idx) => (
              <div key={p.id} className="flex flex-row items-end gap-3">
                <div className="flex-1 grid grid-cols-[140px_1.5fr_1fr_100px_80px_100px] gap-3 items-end bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Barcode</Label>
                    <Input readOnly value={p.barcode} className="h-9 rounded-lg bg-slate-50 border-none font-mono font-bold text-[11px] text-center" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Product</Label>
                    <Select value={p.productId} onValueChange={v => updatePallet(p.id, 'productId', v)}>
                      <SelectTrigger className="h-9 rounded-lg bg-slate-50 border-none font-bold text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVarieties.map(prod => (
                          <SelectItem key={prod.id} value={prod.id} className="font-bold text-xs">
                            {prod.productName} - {prod.category} - {prod.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</Label>
                    <Select value={p.type} onValueChange={v => updatePallet(p.id, 'type', v)}>
                      <SelectTrigger className="h-9 rounded-lg bg-slate-50 border-none font-bold text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Raw Material" className="font-bold text-xs">Raw Material</SelectItem>
                        <SelectItem value="Farm Decay" className="font-bold text-xs text-rose-600">Farm Decay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Gross (KG)</Label>
                    <Input type="number" step="0.01" value={p.grossWeight} onChange={e => updatePallet(p.id, 'grossWeight', e.target.value)} className="h-9 rounded-lg bg-slate-50 border-none font-black text-[11px] text-center" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Boxes</Label>
                    <Input type="number" value={p.boxes} onChange={e => updatePallet(p.id, 'boxes', e.target.value)} className="h-9 rounded-lg bg-slate-50 border-none font-black text-[11px] text-center" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Net (KG)</Label>
                    <Input type="number" step="0.01" value={p.netWeight} onChange={e => updatePallet(p.id, 'netWeight', e.target.value)} className="h-9 rounded-lg bg-emerald-50 border-none font-black text-[11px] text-emerald-700 text-center" />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handlePrintPallet(p)} className="h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                    <Printer size={18} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePallet(p.id)} className="h-10 w-10 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl">
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Quality & Others</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Calibre Dominant</Label>
              <Input type="number" value={calibreDominant} onChange={e => setCalibreDominant(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200 font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal" className="font-bold text-slate-600">Normal</SelectItem>
                  <SelectItem value="Avec Statistique" className="font-bold text-emerald-600">Avec Statistique</SelectItem>
                  <SelectItem value="Rejeter" className="font-bold text-rose-600">Rejeter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Boxes IN <span className="text-rose-500">*</span></Label>
              <Input 
                type="number" 
                value={boxesIn} 
                onChange={e => setBoxesIn(e.target.value)} 
                required 
                error={!!errors.boxesIn}
                className="h-11 rounded-xl bg-white border-slate-200 font-black text-primary focus:ring-primary/20" 
              />
              <FieldError message={errors.boxesIn} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Box Type <span className="text-rose-500">*</span></Label>
              <Select value={boxType} onValueChange={setBoxType} required>
                <SelectTrigger error={!!errors.boxType} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                  <SelectItem value="EXPORT_OPTIMUM" className="font-bold py-3 cursor-pointer">Export Optimum Boxes</SelectItem>
                  <SelectItem value="AGRICENTER" className="font-bold py-3 cursor-pointer">Agricenter Boxes</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.boxType} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Remarks</Label>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="min-h-[100px] rounded-2xl bg-white border-slate-200 font-medium resize-none p-4" />
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <Button type="submit" disabled={isSubmitting} className="h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl gap-3">
            {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Updating...</> : <><Save size={20} /> Update Intake Record</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
