'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp, getDocs, query, orderBy, where } from '@/firebase/firestore-override';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  ChevronLeft, Plus, Minus, Loader2, Package, Truck, FileText,
  ImagePlus, X, CheckCircle2, Layers, Calendar, Hash, User, Thermometer, Weight,
  Scissors, ArrowUp, ArrowDown, Trash2, Edit, Upload
} from 'lucide-react';

// ─────────────────────────────
// Types
// ─────────────────────────────
interface PalletForm {
  id: string;
  productionOutputId: string;
  productVariety: string;
  size: string;
  class: string;
  packaging: string;
  numberOfBoxes: string;
  palletBarcode: string;
  labelConformity: string;
  temperature: string;
  sampleWeight: string;
  boxNetWeight: string;
  lotNumber: string;
  palletisation: string;
  countryOfOrigin: string;
  images: (File | string)[];
  imagePreviews: string[];
}

const emptyPallet = (num: number): PalletForm => ({
  id: `pallet-${Date.now()}-${num}`,
  productionOutputId: '',
  productVariety: '',
  size: '',
  class: '',
  packaging: '',
  numberOfBoxes: '',
  palletBarcode: '',
  labelConformity: 'CONFORM',
  temperature: '',
  sampleWeight: '',
  boxNetWeight: '',
  lotNumber: '',
  palletisation: 'CONFORM',
  countryOfOrigin: 'Morocco',
  images: [],
  imagePreviews: [],
});

// ─────────────────────────────
// Main Component
// ─────────────────────────────
export default function AddQualityReportPage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();

  // Header form state
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [transport, setTransport] = useState('');
  const [transportNumber, setTransportNumber] = useState('');
  const [sender, setSender] = useState('Export Optimuum SARL');
  const [product, setProduct] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedPoNumber, setSelectedPoNumber] = useState('');

  const [pallets, setPallets] = useState<PalletForm[]>([emptyPallet(1)]);
  const [loading, setLoading] = useState(false);

  // Image Editor Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPalletId, setEditingPalletId] = useState<string | null>(null);
  const [editingImageIdx, setEditingImageIdx] = useState<number | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Data fetching
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const productionOutputsQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedPoNumber) return null;
    return query(collection(db, 'production_output'), where('orderPoNumber', '==', selectedPoNumber));
  }, [db, user, selectedPoNumber]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: productionOutputs } = useCollection(productionOutputsQuery);

  // Validate pallets when order/outputs change
  React.useEffect(() => {
    if (!orderId || !productionOutputs) return;
    
    setPallets(prev => {
      let changed = false;
      const newPallets = prev.map(p => {
        if (p.productionOutputId) {
          const isValid = productionOutputs.some(out => out.id === p.productionOutputId);
          if (!isValid) {
            changed = true;
            return {
              ...p,
              productionOutputId: '',
              palletBarcode: '',
              lotNumber: '',
            };
          }
        }
        return p;
      });
      if (changed) {
        toast({ title: 'Order Changed', description: 'Pallet barcode list updated for selected order.' });
        return newPallets;
      }
      return prev;
    });
  }, [orderId, productionOutputs, toast]);

  // When an order is selected, auto-fill fields
  const handleOrderSelect = async (selectedOrderId: string) => {
    const order = orders?.find(o => o.id === selectedOrderId);
    if (!order) return;
    setOrderId(selectedOrderId);
    setSelectedPoNumber(order.poNumber || '');
    setCustomerName(order.customerName || '');
    const firstItemProduct = order.items?.[0]?.productName;
    if (firstItemProduct) setProduct(firstItemProduct);
    if (order.shippingMethod) setTransport(order.shippingMethod);

    // Fetch the truck number from the packingLists collection where poNumber matches the order's poNumber
    if (db && order.poNumber) {
      try {
        const plSnap = await getDocs(
          query(collection(db, 'packingLists'), where('poNumber', '==', order.poNumber))
        );
        if (!plSnap.empty) {
          const plDoc = plSnap.docs[0].data();
          if (plDoc.truckNumber) {
            setTransportNumber(plDoc.truckNumber);
          }
        }
      } catch (err) {
        console.error('Error fetching packing list truck number:', err);
      }
    }

    // Clear all pallet barcode selections and auto-filled data
    setPallets(prev => prev.map(p => ({
      ...p,
      productionOutputId: '',
      palletBarcode: '',
      lotNumber: '',
    })));
  };

  // Pallet management
  const addPallet = () => {
    setPallets(prev => {
      const lastPallet = prev[prev.length - 1];
      const newNum = prev.length + 1;
      
      let labelConformity = 'CONFORM';
      if (lastPallet) {
        labelConformity = lastPallet.labelConformity || 'CONFORM';
      }
      
      const newPallet: PalletForm = {
        id: `pallet-${Date.now()}-${newNum}`,
        productionOutputId: '',
        palletBarcode: '',
        productVariety: lastPallet ? lastPallet.productVariety : '',
        temperature: lastPallet ? lastPallet.temperature : '',
        size: lastPallet ? lastPallet.size : '',
        sampleWeight: lastPallet ? lastPallet.sampleWeight : '',
        class: lastPallet ? lastPallet.class : '',
        boxNetWeight: lastPallet ? lastPallet.boxNetWeight : '',
        packaging: lastPallet ? lastPallet.packaging : '',
        numberOfBoxes: lastPallet ? lastPallet.numberOfBoxes : '',
        lotNumber: lastPallet ? lastPallet.lotNumber : '',
        palletisation: lastPallet ? lastPallet.palletisation : 'CONFORM',
        countryOfOrigin: lastPallet ? lastPallet.countryOfOrigin : 'Morocco',
        labelConformity: labelConformity,
        images: [],
        imagePreviews: [],
      };
      
      return [...prev, newPallet];
    });
  };

  const removePallet = (id: string) => {
    if (pallets.length === 1) return;
    setPallets(prev => prev.filter(p => p.id !== id));
  };

  const updatePallet = (id: string, field: keyof PalletForm, value: any) => {
    setPallets(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleBarcodeSelect = (palletId: string, outputId: string) => {
    if (outputId === 'clear') {
      setPallets(prev => prev.map(p => {
        if (p.id === palletId) {
          return {
            ...p,
            productionOutputId: '',
            palletBarcode: '',
            lotNumber: '',
          };
        }
        return p;
      }));
      return;
    }

    const output = productionOutputs?.find(o => o.id === outputId);
    if (!output) return;

    const firstItem = output.items?.[0] || {};
    const resolvedLotNumber = output.lotNumber || firstItem.lotNumber || '';

    setPallets(prev => prev.map(p => {
      if (p.id === palletId) {
        return {
          ...p,
          productionOutputId: output.id,
          palletBarcode: output.barcodeNumber || output.barcode || '',
          lotNumber: resolvedLotNumber,
        };
      }
      return p;
    }));
  };

  // Image Editor actions
  const openImageEditor = (palletId: string, idx: number, source: File | string) => {
    let url = '';
    if (typeof source === 'string') {
      url = source;
    } else {
      url = URL.createObjectURL(source);
    }
    setEditingPalletId(palletId);
    setEditingImageIdx(idx);
    setEditingImageUrl(url);
    setZoom(1);
    setRotation(0);
    setEditorOpen(true);
  };

  const handleSaveEditedImage = async () => {
    if (editingPalletId === null || editingImageIdx === null || !editingImageUrl) return;

    try {
      const img = new Image();
      if (!editingImageUrl.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      
      const loadedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        
        img.src = editingImageUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 800;
      canvas.width = size;
      canvas.height = size;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      const imgRatio = loadedImg.width / loadedImg.height;
      let drawWidth = size;
      let drawHeight = size;
      if (imgRatio > 1) {
        drawWidth = size * imgRatio;
      } else {
        drawHeight = size / imgRatio;
      }

      ctx.drawImage(loadedImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const fileName = `edited_${Date.now()}.jpg`;
        const editedFile = new File([blob], fileName, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(editedFile);

        setPallets(prev => prev.map(p => {
          if (p.id !== editingPalletId) return p;
          const newImages = [...p.images];
          const newPreviews = [...p.imagePreviews];
          newImages[editingImageIdx] = editedFile;
          newPreviews[editingImageIdx] = previewUrl;
          return { ...p, images: newImages, imagePreviews: newPreviews };
        }));

        setEditorOpen(false);
        setEditingPalletId(null);
        setEditingImageIdx(null);
        setEditingImageUrl(null);
        setZoom(1);
        setRotation(0);
      }, 'image/jpeg', 0.9);
    } catch (err: any) {
      console.warn('Image Edit Warning:', err);
      toast({ variant: 'destructive', title: 'Edit Failed', description: `Failed: ${err?.message || err}` });
    }
  };

  const handleImageDrop = useCallback((id: string, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    
    setPallets(prev => prev.map(p => {
      if (p.id !== id) return p;
      const currentCount = p.images.length;
      if (currentCount >= 6) {
        toast({ variant: 'destructive', title: 'Limit Reached', description: 'Maximum 6 images reached.' });
        return p;
      }
      
      const spaceLeft = 6 - currentCount;
      const filesToAdd = fileArray.slice(0, spaceLeft);
      if (fileArray.length > spaceLeft) {
        toast({ title: 'Images Truncated', description: `Only added ${spaceLeft} images to reach the limit of 6.` });
      }
      
      const previews = filesToAdd.map(f => URL.createObjectURL(f));
      return {
        ...p,
        images: [...p.images, ...filesToAdd],
        imagePreviews: [...p.imagePreviews, ...previews]
      };
    }));
  }, [toast]);

  const removeImage = (palletId: string, idx: number) => {
    setPallets(prev => prev.map(p => {
      if (p.id !== palletId) return p;
      const newImages = p.images.filter((_, i) => i !== idx);
      const newPreviews = p.imagePreviews.filter((_, i) => i !== idx);
      return { ...p, images: newImages, imagePreviews: newPreviews };
    }));
  };

  const moveImageUp = (palletId: string, idx: number) => {
    if (idx === 0) return;
    setPallets(prev => prev.map(p => {
      if (p.id !== palletId) return p;
      const newImages = [...p.images];
      const newPreviews = [...p.imagePreviews];
      
      const tempImg = newImages[idx];
      newImages[idx] = newImages[idx - 1];
      newImages[idx - 1] = tempImg;
      
      const tempPrev = newPreviews[idx];
      newPreviews[idx] = newPreviews[idx - 1];
      newPreviews[idx - 1] = tempPrev;
      
      return { ...p, images: newImages, imagePreviews: newPreviews };
    }));
  };

  const moveImageDown = (palletId: string, idx: number) => {
    setPallets(prev => prev.map(p => {
      if (p.id !== palletId) return p;
      if (idx === p.images.length - 1) return p;
      const newImages = [...p.images];
      const newPreviews = [...p.imagePreviews];
      
      const tempImg = newImages[idx];
      newImages[idx] = newImages[idx + 1];
      newImages[idx + 1] = tempImg;
      
      const tempPrev = newPreviews[idx];
      newPreviews[idx] = newPreviews[idx + 1];
      newPreviews[idx + 1] = tempPrev;
      
      return { ...p, images: newImages, imagePreviews: newPreviews };
    }));
  };

  // Submit
  const handleSubmit = async () => {
    if (!db || !user || !orderId) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please select an order before saving.' });
      return;
    }

    // Validation
    const invalidPallets = pallets.filter(p => p.productionOutputId && !productionOutputs?.some(out => out.id === p.productionOutputId));
    if (invalidPallets.length > 0) {
       toast({ variant: 'destructive', title: 'Invalid Barcode', description: 'One or more pallet barcodes do not belong to the selected PO Number.' });
       return;
    }

    const barcodeIds = pallets.map(p => p.productionOutputId).filter(Boolean);
    const hasDuplicates = barcodeIds.some((id, index) => barcodeIds.indexOf(id) !== index);
    if (hasDuplicates) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Barcodes',
        description: 'Each Pallet Barcode Number can be used only once in the same Quality Report.'
      });
      return;
    }

    const palletsWithIncorrectImages = pallets.filter(p => p.images.length !== 6);
    if (palletsWithIncorrectImages.length > 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Validation Error', 
        description: 'Exactly 6 images are required for each pallet.' 
      });
      return;
    }

    setLoading(true);
    try {
      // Upload all images
      const palletsData = await Promise.all(pallets.map(async (pallet, idx) => {
        const imageUrls: string[] = [];
        if (storage) {
          for (const img of pallet.images) {
            const fileImg = img as File;
            const storageRef = ref(storage, `quality_reports/${orderId}/pallet-${idx + 1}/${Date.now()}-${fileImg.name || 'image.jpg'}`);
            const snap = await uploadBytes(storageRef, fileImg);
            const url = await getDownloadURL(snap.ref);
            imageUrls.push(url);
          }
        }
        const { images, imagePreviews, id, ...rest } = pallet;
        return { ...rest, palletNumber: idx + 1, images: imageUrls };
      }));

      const reportDoc = {
        orderId,
        poNumber: selectedPoNumber,
        customerName,
        sender,
        transport,
        transportNumber,
        product,
        date,
        pallets: palletsData,
        totalPallets: palletsData.length,
        createdAt: serverTimestamp(),
        createdBy: user.email,
      };

      await addDoc(collection(db, 'quality_reports'), reportDoc);
      toast({ title: 'Quality Report Saved', description: `Report for ${selectedPoNumber} has been created.` });
      router.push('/quality/reports');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'An error occurred while saving the report.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/quality/reports')} className="rounded-full hover:bg-primary/10">
          <ChevronLeft className="h-5 w-5 text-emerald-700" />
        </Button>
        <div>
          <nav className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 mb-1">
            Quality Report / <span className="text-primary">Add Quality Report</span>
          </nav>
          <h1 className="text-2xl font-black text-primary uppercase tracking-tight">Add Quality Report</h1>
        </div>
      </div>

      {/* Header Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <FileText size={14} /> Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Order PO Number</Label>
              <Select onValueChange={handleOrderSelect}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="Select an order..." />
                </SelectTrigger>
                <SelectContent>
                  {orders?.filter(o => {
                    const st = (o.status || '').toLowerCase().replace(/[-_]/g, ' ').trim();
                    return ['in production', 'produced', 'shipped', 'delivered'].includes(st);
                  }).map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.poNumber} — {o.customerName} ({o.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Customer</Label>
              <div className="h-11 rounded-xl bg-primary/5 border border-primary/10 px-4 flex items-center">
                <span className="font-black text-sm text-primary uppercase tracking-tight">{customerName || '— Auto-filled —'}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Transport Number</Label>
              <Input value={transportNumber} onChange={e => setTransportNumber(e.target.value)} placeholder="e.g. TRN-2026-0042" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
            </div>
          </CardContent>
        </Card>

        {/* Right */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <Truck size={14} /> Logistics & Context
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Sender</Label>
              <Input value={sender} onChange={e => setSender(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Transport</Label>
              <Input value={transport} onChange={e => setTransport(e.target.value)} placeholder="e.g. Road / Sea" className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Product</Label>
              <div className="h-11 rounded-xl bg-primary/5 border border-primary/10 px-4 flex items-center">
                <span className="font-black text-sm text-primary uppercase tracking-tight">{product || '— Auto-filled from order —'}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-tight text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-none font-bold" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pallets Section */}
      <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
            <Package size={14} /> Pallets ({pallets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {pallets.map((pallet, idx) => {
            const selectedIdsInOtherPallets = pallets
              .filter((_, pIdx) => pIdx !== idx)
              .map(p => p.productionOutputId)
              .filter(Boolean);
            const availableOutputs = (productionOutputs || []).filter(out => 
              !selectedIdsInOtherPallets.includes(out.id) || out.id === pallet.productionOutputId
            );

            return (
              <PalletBlock
                key={pallet.id}
                pallet={pallet}
                index={idx}
                isFirst={idx === 0}
                isLast={idx === pallets.length - 1}
                onUpdate={updatePallet}
                onRemove={removePallet}
                onAdd={addPallet}
                onImageDrop={handleImageDrop}
                onRemoveImage={removeImage}
                onEditImage={openImageEditor}
                onMoveImageUp={moveImageUp}
                onMoveImageDown={moveImageDown}
                canRemove={pallets.length > 1}
                productionOutputs={availableOutputs}
                orderId={orderId}
                onBarcodeSelect={handleBarcodeSelect}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-6 bg-primary/5 rounded-3xl border border-primary/10 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-primary h-5 w-5" />
          <div>
            <p className="text-sm font-black text-primary uppercase tracking-tight">Ready to Submit</p>
            <p className="text-[10px] text-primary/50 font-bold">{pallets.length} pallet(s) configured</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={() => router.push('/quality/reports')}
            className="font-black text-muted-foreground uppercase tracking-widest hover:bg-primary/5">
            Discard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-black shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest min-w-[240px]"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Report...</>
            ) : 'Add Quality Report'}
          </Button>
        </div>
      </div>

      {/* Image Editor Modal */}
      <Dialog open={editorOpen} onOpenChange={(open) => { if (!open) setEditorOpen(false); }}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-primary uppercase tracking-tight">Edit Image</DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            {/* Real-time Preview */}
            <div className="w-72 h-72 mx-auto relative overflow-hidden border-2 border-dashed border-primary/20 rounded-2xl bg-muted/10 flex items-center justify-center">
              {editingImageUrl && (
                <img 
                  src={editingImageUrl} 
                  alt="Edit preview" 
                  className="w-full h-full object-cover transition-all"
                  style={{
                    transform: `rotate(${rotation}deg) scale(${zoom})`,
                  }}
                />
              )}
              {/* Crop Box Overlay */}
              <div className="absolute inset-4 border border-white/50 pointer-events-none rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
            
            {/* Rotation Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                <span>Rotation</span>
                <span className="font-mono">{rotation}°</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="360" 
                value={rotation} 
                onChange={(e) => setRotation(Number(e.target.value))} 
                className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Zoom Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                <span>Zoom</span>
                <span className="font-mono">{zoom.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.1" 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))} 
                className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => {
                setEditorOpen(false);
                setEditingPalletId(null);
                setEditingImageIdx(null);
                setEditingImageUrl(null);
              }}
              className="font-black uppercase tracking-widest text-xs h-12 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSaveEditedImage}
              className="font-black uppercase tracking-widest text-xs h-12 rounded-xl bg-primary text-white hover:bg-primary/90"
            >
              Save Cropped Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────
// Pallet Block Component
// ─────────────────────────────
function PalletBlock({
  pallet, index, isFirst, isLast, onUpdate, onRemove, onAdd, onImageDrop, onRemoveImage, onEditImage, onMoveImageUp, onMoveImageDown, canRemove, productionOutputs, orderId, onBarcodeSelect
}: {
  pallet: PalletForm;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, field: keyof PalletForm, value: any) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onImageDrop: (id: string, files: FileList | null) => void;
  onRemoveImage: (palletId: string, imgIdx: number) => void;
  onEditImage: (palletId: string, idx: number, source: File | string) => void;
  onMoveImageUp: (palletId: string, idx: number) => void;
  onMoveImageDown: (palletId: string, idx: number) => void;
  canRemove: boolean;
  productionOutputs: any[];
  orderId: string;
  onBarcodeSelect: (palletId: string, outputId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const field = (key: keyof PalletForm) => ({
    value: pallet[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(pallet.id, key, e.target.value),
  });

  return (
    <div className="border-2 border-primary/10 rounded-3xl overflow-hidden group hover:border-primary/20 transition-all">
      {/* Pallet Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="font-black text-white text-sm">{index + 1}</span>
          </div>
          <span className="font-black text-white uppercase tracking-widest text-sm">Pallet #{index + 1}</span>
        </div>
        {canRemove && (
          <Button type="button" size="icon" variant="ghost"
            onClick={() => onRemove(pallet.id)}
            className="h-8 w-8 rounded-full hover:bg-white/20 text-white/70 hover:text-white">
            <X size={16} />
          </Button>
        )}
      </div>

      {/* Pallet Fields */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50 mb-3">Product Details</h4>
          {[
            { label: 'Product / Variety', key: 'productVariety' as keyof PalletForm, placeholder: 'e.g. Strawberry' },
            { label: 'Size', key: 'size' as keyof PalletForm, placeholder: 'e.g. Medium' },
            { label: 'Class', key: 'class' as keyof PalletForm, placeholder: 'Category I / Extra' },
            { label: 'Packaging', key: 'packaging' as keyof PalletForm, placeholder: 'e.g. Carton 2kg' },
            { label: 'Number of Boxes', key: 'numberOfBoxes' as keyof PalletForm, placeholder: '0' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
              <Input {...field(key)} placeholder={placeholder} className="h-10 rounded-xl bg-muted/20 border-none font-medium" />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex justify-between">
              Pallet Barcode Number
              {pallet.productionOutputId && !productionOutputs.some(out => out.id === pallet.productionOutputId) && (
                <span className="text-rose-500">Invalid for this PO</span>
              )}
            </Label>
            <Select 
              disabled={!orderId}
              value={pallet.productionOutputId || ''} 
              onValueChange={(val) => onBarcodeSelect(pallet.id, val)}
            >
              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none font-medium">
                <SelectValue placeholder={orderId ? "Select Barcode..." : "Select Order PO Number first"} />
              </SelectTrigger>
              <SelectContent>
                {pallet.productionOutputId && (
                  <SelectItem value="clear">-- Clear Selection --</SelectItem>
                )}
                {productionOutputs.length === 0 && orderId && (
                   <SelectItem value="empty" disabled>No barcodes found for this order</SelectItem>
                )}
                {productionOutputs.map(out => (
                   <SelectItem key={out.id} value={out.id}>{out.barcode || out.barcodeNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pallet.productionOutputId && !productionOutputs.some(out => out.id === pallet.productionOutputId) && (
              <p className="text-[10px] text-rose-500 font-bold mt-1">Pallet barcode must belong to the selected PO Number.</p>
            )}
          </div>

          {[
            { label: 'Label Conformity', key: 'labelConformity' as keyof PalletForm, placeholder: 'Compliant / Non-compliant' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
              <Input {...field(key)} placeholder={placeholder} className="h-10 rounded-xl bg-muted/20 border-none font-medium" />
            </div>
          ))}
        </div>

        {/* Right */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50 mb-3">Quality Measurements</h4>
          {[
            { label: 'Temperature (°C)', key: 'temperature' as keyof PalletForm, placeholder: 'e.g. 4' },
            { label: 'Sample Weight (g)', key: 'sampleWeight' as keyof PalletForm, placeholder: 'e.g. 250' },
            { label: 'Box Net Weight (g)', key: 'boxNetWeight' as keyof PalletForm, placeholder: 'e.g. 2000' },
            { label: 'Lot Number', key: 'lotNumber' as keyof PalletForm, placeholder: 'LOT-2026-...' },
            { label: 'Palletisation', key: 'palletisation' as keyof PalletForm, placeholder: 'e.g. Wrapped / Strapped' },
            { label: 'Country of Origin', key: 'countryOfOrigin' as keyof PalletForm, placeholder: 'Morocco' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
              <Input {...field(key)} placeholder={placeholder} className="h-10 rounded-xl bg-muted/20 border-none font-medium" />
            </div>
          ))}
        </div>
      </div>

      {/* Image Upload */}
      <div className="px-6 pb-0 space-y-4">
        <div className="flex items-center justify-between border-b border-primary/5 pb-2">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50">Photos / Evidence</h4>
            <p className="text-[9px] text-muted-foreground/60">Exactly 6 images are required per pallet.</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pallet.images.length === 6 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            {pallet.images.length}/6 Images
          </span>
        </div>

        {/* 6 Slots Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => {
            const visualGuidance = [
              "1. Label image",
              "2. Logo image",
              "3. Front pallet",
              "4. Back pallet",
              "5. Side pallet",
              "6. Additional image"
            ];
            
            const hasImage = i < pallet.images.length;
            const src = hasImage ? pallet.imagePreviews[i] : null;

            if (hasImage && src) {
              return (
                <div key={i} className="relative group/img aspect-square rounded-2xl overflow-hidden border-2 border-primary/10 flex flex-col justify-between bg-muted/5">
                  <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  
                  {/* Visual slot guidance overlay on image */}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[8px] font-black text-white/90 truncate text-center uppercase tracking-wider">
                    {visualGuidance[i]}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                    <button
                      type="button"
                      onClick={() => onEditImage(pallet.id, i, pallet.images[i])}
                      title="Edit / Crop"
                      className="h-8 w-8 rounded-xl bg-white/95 text-primary hover:bg-white flex items-center justify-center transition-all shadow-md"
                    >
                      <Scissors size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => onMoveImageUp(pallet.id, i)}
                      title="Move Up"
                      className="h-8 w-8 rounded-xl bg-white/95 text-primary hover:bg-white flex items-center justify-center transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={i === pallet.images.length - 1}
                      onClick={() => onMoveImageDown(pallet.id, i)}
                      title="Move Down"
                      className="h-8 w-8 rounded-xl bg-white/95 text-primary hover:bg-white flex items-center justify-center transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveImage(pallet.id, i)}
                      title="Delete"
                      className="h-8 w-8 rounded-xl bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center transition-all shadow-md"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={i} className="aspect-square rounded-2xl border-2 border-dashed border-primary/20 bg-muted/5 flex flex-col items-center justify-center p-3 text-center relative hover:bg-primary/5 transition-all">
                  <span className="text-[9px] font-black uppercase text-primary/40 leading-tight mb-2">
                    {visualGuidance[i]}
                  </span>
                  
                  {/* Only show upload button on the very next available empty slot */}
                  {i === pallet.images.length ? (
                    <label className="cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={e => onImageDrop(pallet.id, e.target.files)} 
                      />
                      <div className="p-2 bg-primary/10 rounded-xl text-primary hover:scale-105 active:scale-95 transition-all">
                        <Upload size={14} />
                      </div>
                    </label>
                  ) : (
                    <div className="p-2 rounded-xl text-muted-foreground/20">
                      <X size={14} />
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>

        {/* General Dropzone (only visible when less than 6 images) */}
        {pallet.images.length < 6 ? (
          <label
            className={`flex flex-col items-center justify-center h-28 border-2 ${dragOver ? 'border-primary bg-primary/5' : 'border-dashed border-primary/20 bg-muted/10'} rounded-2xl cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onImageDrop(pallet.id, e.dataTransfer.files); }}
          >
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => onImageDrop(pallet.id, e.target.files)} />
            <ImagePlus size={20} className="text-primary/40 mb-1.5" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/50">Drag & drop or click to upload</span>
            <span className="text-[8px] text-muted-foreground/50 mt-0.5">Need exactly 6 images (currently {pallet.images.length}/6)</span>
          </label>
        ) : (
          <div className="flex flex-col items-center justify-center h-28 border-2 border-emerald-500/20 bg-emerald-500/[0.02] rounded-2xl text-emerald-600 font-bold p-4">
             <CheckCircle2 size={24} className="mb-1 text-emerald-500" />
             <span className="text-[10px] uppercase tracking-wider">Maximum 6 images reached.</span>
             <span className="text-[8px] text-emerald-600/60 font-medium">Please edit or delete existing photos to modify.</span>
          </div>
        )}

        {/* Validation message under image section */}
        {pallet.images.length !== 6 && (
          <p className="text-[10px] text-rose-500 font-black uppercase tracking-wide">
            Exactly 6 images are required for this pallet.
          </p>
        )}
      </div>

      {/* Add / Remove Pallet — shown on all pallets EXCEPT the first */}
      {!isFirst && (
        <div className="px-6 pb-6 pt-5 flex items-center gap-3 border-t border-primary/5 mt-6">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAdd}
            className="h-9 px-5 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-black text-[10px] uppercase gap-1.5 transition-all"
          >
            <Plus size={14} /> Add Pallet
          </Button>
          {canRemove && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRemove(pallet.id)}
              className="h-9 px-4 rounded-xl text-rose-500 hover:bg-rose-50 font-black text-[10px] uppercase gap-1.5"
            >
              <Minus size={14} /> Remove This
            </Button>
          )}
        </div>
      )}

      {/* Add Pallet button at the bottom of the first (and only) pallet, only when it IS the last */}
      {isFirst && isLast && (
        <div className="px-6 pb-6 pt-5 flex items-center gap-3 border-t border-primary/5 mt-6">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAdd}
            className="h-9 px-5 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-black text-[10px] uppercase gap-1.5"
          >
            <Plus size={14} /> Add Pallet
          </Button>
        </div>
      )}
    </div>
  );
}
