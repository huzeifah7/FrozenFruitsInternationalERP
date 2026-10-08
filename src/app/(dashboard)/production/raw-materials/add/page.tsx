'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import {
  collection, doc, writeBatch, getDocs, query, orderBy, serverTimestamp, where, setDoc, updateDoc, deleteDoc
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
  ChevronLeft, PackagePlus, Plus, Printer, Trash2, AlertCircle,
  Truck, LeafyGreen, Scale, PackageCheck, Loader2, Save,
} from 'lucide-react';
import { format } from 'date-fns';
import { sortProductFamilies, sortProducts } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function AddRawMaterialPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const { toast } = useToast();

  // --- Form State ---
  const [dateTime, setDateTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [locationId, setLocationId] = useState('');
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

  // Pallets — always start empty
  const [pallets, setPallets] = useState<any[]>([]);
  const [rawMaterialId, setRawMaterialId] = useState<string>('');

  useEffect(() => {
    if (!db) return;
    let savedId = localStorage.getItem('current_raw_material_add_id');
    if (!savedId) {
      savedId = doc(collection(db, 'raw_materials')).id;
      localStorage.setItem('current_raw_material_add_id', savedId);
    }
    setRawMaterialId(savedId);
  }, [db]);

  useEffect(() => {
    if (!db || !rawMaterialId) return;
    const fetchDraftPallets = async () => {
      try {
        const q = query(
          collection(db, 'palletizations'),
          where('rawMaterialId', '==', rawMaterialId)
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        loaded.sort((a: any, b: any) => (a.barcode || '').localeCompare(b.barcode || ''));
        setPallets(loaded);
      } catch (err) {
        console.error('Error loading draft pallets:', err);
      }
    };
    fetchDraftPallets();
  }, [db, rawMaterialId]);

  useEffect(() => {
    if (!db || !lotNumber || pallets.length === 0) return;
    const sync = async () => {
      const promises = pallets
        .filter(p => p.lotNumber !== lotNumber)
        .map(async (p) => {
          try {
            await updateDoc(doc(db, 'palletizations', p.id), { lotNumber });
            p.lotNumber = lotNumber;
          } catch (e) {
            console.error(e);
          }
        });
      await Promise.all(promises);
    };
    sync();
  }, [db, lotNumber, pallets]);

  // dailyCount     → ONLY for lot number (counts RM documents for specific day)
  // lastPalletNumRef → ONLY for barcode generation (max barcode num in DB)
  const [dailyCount, setDailyCount] = useState(0);
  const lastPalletNumRef = useRef(0);

  // --- Reference Data ---
  const [locations, setLocations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allFarms, setAllFarms] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const productFamilies = useMemo(() => {
    const families = new Set(products.map(p => p.productName).filter(Boolean));
    return sortProductFamilies(Array.from(families));
  }, [products]);

  const availableVarieties = useMemo(() => {
    const filtered = products.filter(p => (p.productName || p.name) === productFamily);
    return sortProducts(filtered);
  }, [products, productFamily]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!db) return;
    const fetchData = async () => {
      try {
        const farmSnap = await getDocs(query(collection(db, 'main_farms'), orderBy('name')));
        setAllFarms(farmSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const locSnap = await getDocs(query(collection(db, 'processing_lines'), orderBy('title')));
        const supSnap = await getDocs(query(collection(db, 'procurement_suppliers'), orderBy('name')));
        const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('productName')));
        setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSuppliers(supSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [db]);


  useEffect(() => {
    async function fetchCounts() {
      if (!db) return;
      try {
        const rmSnap = await getDocs(collection(db, 'raw_materials'));
        
        let allBarcodeNums: number[] = [];
        try {
          const topSnap = await getDocs(collection(db, 'palletizations'));
          for (const pDoc of topSnap.docs) {
            const data = pDoc.data();
            const num = parseInt((data.barcode || data.palletBarcode || '').replace('RM', '') || '0');
            if (num > 0) allBarcodeNums.push(num);
          }
        } catch (e) { }

        for (const rmDoc of rmSnap.docs) {
          try {
            const palletSnap = await getDocs(collection(db, `raw_materials/${rmDoc.id}/palletizations`));
            for (const pDoc of palletSnap.docs) {
              const data = pDoc.data();
              const num = parseInt((data.barcode || data.palletBarcode || '').replace('RM', '') || '0');
              if (num > 0) allBarcodeNums.push(num);
            }
          } catch (e) { }
        }

        lastPalletNumRef.current = allBarcodeNums.length > 0 ? Math.max(...allBarcodeNums) : 0;
        console.log('[Counts] Max pallet barcode:', lastPalletNumRef.current);
      } catch (err) {
        console.error('Count fetch error:', err);
      }
    }
    fetchCounts();
  }, [db]);

  useEffect(() => {
    if (!db || !dateTime) return;
    
    const d = new Date(dateTime);
    const hours = d.getHours();
    
    // Calculate operational date
    const opDate = new Date(d);
    if (hours < 12) {
      opDate.setDate(opDate.getDate() - 1);
    }
    
    const opDateStr = format(opDate, 'yyyy-MM-dd');
    const nextDate = new Date(opDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = format(nextDate, 'yyyy-MM-dd');

    const startWindow = `${opDateStr}T12:00`;
    const endWindow = `${nextDateStr}T12:00`;

    const q = query(collection(db, 'raw_materials'), 
      where('dateTime', '>=', startWindow),
      where('dateTime', '<', endWindow),
      where('locationId', '==', locationId)
    );
    
    getDocs(q).then(snap => {
      setDailyCount(snap.size);
    }).catch(err => {
      console.error("Failed to query raw materials for daily count:", err);
    });
  }, [db, dateTime, locationId]);

  // --- Orchestrated Initialization & Auto-assignment ---
  const initializedRef = useRef(false);

  useEffect(() => {
    if (allFarms.length === 0 || locations.length === 0 || !profile) return;
    if (initializedRef.current) return;

    let hasUpdated = false;

    // 1. Default Farm → EOF
    if (!farmId) {
      const eofFarm = allFarms.find(f =>
        f.farmCodification?.toUpperCase() === 'EOF' ||
        f.name?.toLowerCase().includes('export optimum')
      );
      if (eofFarm) {
        setFarmId(eofFarm.id);
        setBoxType('EXPORT_OPTIMUM');
        hasUpdated = true;
      }
    }

    // 2. Default Location
    if (!locationId) {
      const profileLocName = profile?.location;
      const profileLocId = profile?.locationId;
      
      let matchedLoc = null;
      if (profileLocId) {
        matchedLoc = locations.find(l => l.id === profileLocId);
      }
      if (!matchedLoc && profileLocName) {
        matchedLoc = locations.find(l => l.title === profileLocName || l.name === profileLocName);
      }
      
      if (matchedLoc) {
        setLocationId(matchedLoc.id);
        hasUpdated = true;
      }
    }

    if (hasUpdated) {
      initializedRef.current = true;
    }
  }, [allFarms, locations, profile, farmId, locationId]);

  // Sync Box Type when Farm changes manually
  useEffect(() => {
    if (!farmId || allFarms.length === 0) return;
    const farm = allFarms.find(f => f.id === farmId);
    if (farm) {
      const isEOF = farm.farmCodification?.toUpperCase() === 'EOF' || 
                    farm.name?.toLowerCase().includes('export optimum');
      const newType = isEOF ? 'EXPORT_OPTIMUM' : 'AGRICENTER';
      setBoxType(newType);
    }
  }, [farmId, allFarms]);

  // Sync Box Type when Location changes to Berries For You
  useEffect(() => {
    if (!locationId || locations.length === 0) return;
    const loc = locations.find(l => l.id === locationId);
    if (loc && (loc.title?.toLowerCase() === 'berries for you' || loc.name?.toLowerCase() === 'berries for you')) {
      setBoxType('AGRICENTER');
    }
  }, [locationId, locations]);

  // --- Computed ---
  const farmCode = useMemo(() => {
    if (!farmId || allFarms.length === 0) return 'EOF';
    const farm = allFarms.find(f => f.id === farmId);
    if (!farm) return 'EOF';
    if (farm.farmCodification) return farm.farmCodification.toUpperCase();
    return farm.name ? farm.name.substring(0, 3).toUpperCase() : 'EOF';
  }, [farmId, allFarms]);

  const selectedLocation = useMemo(() => locations.find(l => l.id === locationId), [locations, locationId]);
  const currentTare = useMemo(() => selectedLocation?.title === 'Berries For You' ? 24 : 22, [selectedLocation]);




  useEffect(() => {
    const d = new Date(dateTime);
    const hours = d.getHours();
    const opDate = new Date(d);
    if (hours < 12) {
      opDate.setDate(opDate.getDate() - 1);
    }

    const tag = selectedLocation?.locationTag ? `-${selectedLocation.locationTag.toUpperCase()}` : '';
    const generated = `${String(dailyCount + 1).padStart(2, '0')}-${format(opDate, 'dd')}${format(opDate, 'MM')}${farmCode}${format(opDate, 'yy')}${tag}`;
    setLotNumber(generated);
  }, [dailyCount, dateTime, farmCode, selectedLocation]);

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

    if (!db || !rawMaterialId) return;

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
      const hassInFamily = availableVarieties.find(p => 
        p.category?.toLowerCase() === 'hass'
      ) || availableVarieties[0] || products[0];
      
      if (hassInFamily) {
        defaultProdId = hassInFamily.id;
        defaultProductText = hassInFamily.type ? `${hassInFamily.category} - ${hassInFamily.type}` : hassInFamily.category;
      }
    }

    const palletRef = doc(collection(db, 'palletizations'));
    const newPallet = {
      rawMaterialId,
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

  const updatePallet = async (id: string, field: string, value: any) => {
    let updatedPallet: any = null;
    setPallets(prev => prev.map(p => {
      if (p.id !== id) return p;
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
      const ref = doc(db, 'palletizations', id);
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

  const removePallet = async (id: string) => {
    if (!db) return;
    if (!confirm('Are you sure you want to delete this pallet row?')) return;
    
    try {
      await deleteDoc(doc(db, 'palletizations', id));
      setPallets(prev => prev.filter(p => p.id !== id));
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
    if (!db || !user || !rawMaterialId) return;
    
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

      let finalLotNumber = lotNumber;
      let checkSnap = await getDocs(query(collection(db, 'raw_materials'), where('lotNumber', '==', finalLotNumber)));
      
      if (!checkSnap.empty) {
        const d = new Date(dateTime);
        const hours = d.getHours();
        const opDate = new Date(d);
        if (hours < 12) { opDate.setDate(opDate.getDate() - 1); }
        const tag = selectedLocation?.locationTag ? `-${selectedLocation.locationTag.toUpperCase()}` : '';
        
        let offset = dailyCount + 1;
        while (!checkSnap.empty) {
          offset++;
          finalLotNumber = `${String(offset).padStart(2, '0')}-${format(opDate, 'dd')}${format(opDate, 'MM')}${farmCode}${format(opDate, 'yy')}${tag}`;
          checkSnap = await getDocs(query(collection(db, 'raw_materials'), where('lotNumber', '==', finalLotNumber)));
        }
      }

      const selectedFarm = allFarms?.find(f => f.id === farmId);
      const rmRef = doc(db, 'raw_materials', rawMaterialId);

      await setDoc(rmRef, {
        lotNumber: finalLotNumber, dateTime,
        date: dateTime.split('T')[0],
        farmId,
        farmName: selectedFarm?.farmName || selectedFarm?.name || 'Unknown',
        farmCodification: farmCode, driverName, plateNumber, locationId, supplierId,
        blGrossWeight: Number(blGrossWeight || 0), blNetWeight: Number(blNetWeight || 0),
        productFamily, calibreDominant: Number(calibreDominant || 0),
        petitCalibre: Number(petitCalibre || 0), dechet: Number(dechet || 0),
        status, remarks, 
        boxesIn: Number(boxesIn || 0),
        boxType,
        totalNetWeight: Math.round(totalNetWeight * 100) / 100,
        totalDecayNetWeight: Math.round(totalDecayNetWeight * 100) / 100,
        createdAt: serverTimestamp(), createdBy: user.email,
        updatedAt: serverTimestamp(), updatedBy: user.email,
      });

      // Clear draft storage
      localStorage.removeItem('current_raw_material_add_id');

      router.push('/production/raw-materials');
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error saving document', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationChange = (val: string) => {
    setLocationId(val);
    const loc = locations.find(l => l.id === val);
    if (loc?.title?.toLowerCase().includes('berries for you')) {
      setBoxType('AGRICENTER');
    } else {
      setBoxType('EXPORT_OPTIMUM');
    }
  };

  return (
    <div className="w-full p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">

      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 hover:bg-slate-200">
          <ChevronLeft size={20} className="text-slate-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            <span>Production</span><span className="opacity-40">/</span>
            <span className="text-primary/60">Raw Materials</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">Intake Reception</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── SECTION 1: GENERAL INFORMATION ── */}
        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <div className="grid grid-cols-2 gap-6">
            {/* Row 1 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Date Time <span className="text-rose-500">*</span></Label>
              <Input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} required error={!!errors.dateTime} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700 focus:ring-primary/20" />
              <FieldError message={errors.dateTime} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Farm <span className="text-rose-500">*</span></Label>
              <Select value={farmId} onValueChange={setFarmId} required>
                <SelectTrigger error={!!errors.farmId} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue placeholder="Select Farm" />
                </SelectTrigger>
                <SelectContent>
                  {allFarms.map(f => <SelectItem key={f.id} value={f.id} className="font-bold">{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.farmId} />
            </div>

            {/* Row 2 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Lot Number <span className="text-rose-500">*</span></Label>
              <Input value={lotNumber} onChange={e => setLotNumber(e.target.value.toUpperCase())} required error={!!errors.lotNumber} className="h-11 rounded-xl bg-white border-slate-200 font-black text-primary uppercase tracking-widest focus:ring-primary/20" />
              <FieldError message={errors.lotNumber} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Driver Name <span className="text-rose-500">*</span></Label>
              <Input value={driverName} onChange={e => setDriverName(e.target.value)} required error={!!errors.driverName} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700 uppercase" />
              <FieldError message={errors.driverName} />
            </div>

            {/* Row 3 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Plate Number <span className="text-rose-500">*</span></Label>
              <Input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} required error={!!errors.plateNumber} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700 uppercase" />
              <FieldError message={errors.plateNumber} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Location (Processing Line) <span className="text-rose-500">*</span></Label>
              <Select value={locationId} onValueChange={handleLocationChange} required>
                <SelectTrigger error={!!errors.locationId} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue placeholder="Select Line" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id} className="font-bold">{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.locationId} />
            </div>

            {/* Row 4 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Supplier Name <span className="text-rose-500">*</span></Label>
              <SearchableSelect 
                value={supplierId} 
                onValueChange={setSupplierId}
                options={suppliers.map(s => ({ value: s.id, label: s.name || s.supplierName }))}
                placeholder="Select Supplier"
                triggerClassName="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700"
              />
              <FieldError message={errors.supplierId} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">BL Net Weight (KG) <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Input type="number" step="0.01" value={blNetWeight} onChange={e => setBlNetWeight(e.target.value)} required error={!!errors.blNetWeight} className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700 pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">KG</span>
              </div>
              <FieldError message={errors.blNetWeight} />
            </div>

            {/* Row 5 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">BL Gross Weight (KG) <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Input type="number" step="0.01" value={blGrossWeight} onChange={e => setBlGrossWeight(e.target.value)} required error={!!errors.blGrossWeight} className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700 pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">KG</span>
              </div>
              <FieldError message={errors.blGrossWeight} />
            </div>
            <div className="invisible h-11" /> {/* Empty right to maintain spacing */}

            {/* Row 6 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Product Family <span className="text-rose-500">*</span></Label>
              <Select value={productFamily} onValueChange={setProductFamily} required>
                <SelectTrigger error={!!errors.productFamily} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue placeholder="Select Product Family" />
                </SelectTrigger>
                <SelectContent>
                  {productFamilies.map(f => <SelectItem key={f} value={f} className="font-bold">{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.productFamily} />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: PALLETIZATION ── */}
        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Add Palletization</h3>
          </div>
          
          <Button 
            type="button" 
            onClick={addPallet} 
            variant="outline" 
            className="h-9 px-4 rounded-lg bg-white border-slate-200 text-primary font-black text-[10px] uppercase tracking-widest gap-2 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={14} /> Add Pallet Row
          </Button>

          <div className="space-y-3">
            {pallets.map((p, idx) => (
              <div key={p.id} className="flex flex-row items-end gap-3 animate-in slide-in-from-left-2 duration-300">
                <div className="flex-1 grid grid-cols-[140px_1.5fr_1fr_100px_80px_100px] gap-3 items-end bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Barcode</Label>
                    <Input readOnly value={p.barcode} className="h-9 rounded-lg bg-slate-50 border-none font-mono font-bold text-[11px] text-center pointer-events-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Product</Label>
                    <SearchableSelect 
                      value={p.productId} 
                      onValueChange={v => updatePallet(p.id, 'productId', v)}
                      options={availableVarieties.map(prod => ({ 
                        value: prod.id, 
                        label: `${prod.productName} - ${prod.category} - ${prod.type}` 
                      }))}
                      placeholder="Product"
                      triggerClassName="h-9 rounded-lg bg-slate-50 border-none font-bold text-[11px]"
                    />
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
                    <Input 
                      type="number"
                      step="0.01"
                      value={p.netWeight}
                      onChange={e => updatePallet(p.id, 'netWeight', e.target.value)}
                      className="h-9 rounded-lg bg-emerald-50 border-none font-black text-[11px] text-emerald-700 text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handlePrintPallet(p)} className="h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                    <Printer size={18} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePallet(p.id)} className="h-10 w-10 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </Button>
                  {idx === pallets.length - 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={addPallet} className="h-10 w-10 text-primary hover:bg-primary/10 rounded-xl transition-all">
                      <Plus size={20} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {pallets.length === 0 && (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-white/50">
                <PackageCheck size={32} className="text-slate-300 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pallets added</p>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 3: QUALITY CHECK ── */}
        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Quality Check</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Calibre Dominant</Label>
              <Input type="number" value={calibreDominant} onChange={e => setCalibreDominant(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Petit Calibre (%)</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={petitCalibre} onChange={e => setPetitCalibre(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700 pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Dechet (%)</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={dechet} onChange={e => setDechet(e.target.value)} className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700 pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal" className="font-bold text-slate-600">Normal</SelectItem>
                  <SelectItem value="Avec Statistique" className="font-bold text-emerald-600">Avec Statistique</SelectItem>
                  <SelectItem value="Rejeter" className="font-bold text-rose-600">Rejeter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Remarks</Label>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="min-h-[100px] rounded-2xl bg-white border-slate-200 font-medium resize-none p-4" placeholder="Enter quality notes or observations..." />
          </div>
        </div>

        {/* ── SECTION 4: CRATES FOLLOW UP ── */}
        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Crates Follow Up</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Boxes IN <span className="text-rose-500">*</span></Label>
              <Input 
                type="number" 
                value={boxesIn} 
                onChange={e => setBoxesIn(e.target.value)} 
                required
                error={!!errors.boxesIn}
                placeholder="0"
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
        </div>

        {/* ── FINAL SUBMISSION ── */}
        <div className="flex justify-end pt-6">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-3"
          >
            {isSubmitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Saving Intake...</>
            ) : (
              <><Save size={20} /> Submit Final Intake</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}