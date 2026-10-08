'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  addDoc, 
  collection, 
  serverTimestamp,
  getDocs,
  query,
  orderBy
} from '@/firebase/firestore-override';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  ChevronLeft, 
  Save, 
  Upload, 
  FileText, 
  X,
  Beaker,
  Calendar,
  Banknote,
  Globe,
  Tag,
  Factory,
} from 'lucide-react';
import { sortProducts } from '@/lib/utils';
export default function AddLabAnalysisPage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    analysisName: '',
    date: new Date().toISOString().split('T')[0],
    price: '',
    currency: 'MAD',
    labName: '',
    rmLotOrFarm: '',
    productId: '',
    productName: '',
    farmId: '',
    farmName: '',
    processingLineId: '',
    processingLineName: '',
    note: ''
  });

  const [products, setProducts] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [reportFile, setReportFile] = useState<File | null>(null);

  useEffect(() => {
    if (!db) return;

    const fetchData = async () => {
      try {
        const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('productName')));
        setProducts(sortProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]));

        const farmSnap = await getDocs(query(collection(db, 'main_farms'), orderBy('name')));
        const fetchedFarms = farmSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFarms(fetchedFarms);

        const lineSnap = await getDocs(collection(db, 'processing_lines'));
        const fetchedLines = lineSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => 
          (a.title || a.name || '').localeCompare(b.title || b.name || '')
        );
        setLines(fetchedLines);
      } catch (error) {
        console.error("Error fetching dependencies:", error);
      }
    };

    fetchData();
  }, [db]);

  // Auto-select default Farm (Export Optimum Farm) when farms load
  useEffect(() => {
    if (farms.length > 0 && !formData.farmId) {
      const defaultFarm = farms.find((f: any) => 
        (f.name || '').toLowerCase().includes('export optimum') || 
        (f.name || '').toLowerCase().includes('e.o')
      ) || farms[0];

      if (defaultFarm) {
        setFormData(prev => ({
          ...prev,
          farmId: defaultFarm.id,
          farmName: defaultFarm.name || ''
        }));
      }
    }
  }, [farms, formData.farmId]);

  // Auto-select default Processing Line (Export Optimum) when lines load
  useEffect(() => {
    if (lines.length > 0 && !formData.processingLineId) {
      const defaultLine = lines.find((l: any) => 
        (l.title || l.name || '').toLowerCase().includes('export optimum') || 
        (l.title || l.name || '').toLowerCase().includes('e.o')
      ) || lines[0];

      if (defaultLine) {
        setFormData(prev => ({
          ...prev,
          processingLineId: defaultLine.id,
          processingLineName: defaultLine.title || defaultLine.name || ''
        }));
      }
    }
  }, [lines, formData.processingLineId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string, collectionData?: any[], labelField?: string) => {
    if (collectionData && labelField) {
      const selectedItem = collectionData.find(item => item.id === value);
      const nameField = name.replace('Id', 'Name');
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        [nameField]: selectedItem ? selectedItem[labelField] : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReportFile(e.target.files[0]);
    }
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'MAD': return 'dh';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !storage || !user) return;

    setLoading(true);
    try {
      let fileUrl = '';
      let fileName = '';
      let fileExtension = '';

      if (reportFile) {
        fileName = reportFile.name;
        fileExtension = fileName.split('.').pop() || '';
        const storageRef = ref(storage, `lab_analysis/documents/${Date.now()}_${fileName}`);
        const snapshot = await uploadBytes(storageRef, reportFile);
        fileUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'lab_analysis'), {
        ...formData,
        price: parseFloat(formData.price) || 0,
        fileUrl,
        fileName,
        fileExtension,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email,
        updatedByEmail: user.email
      });

      toast({
        title: "Success",
        description: "Lab analysis saved successfully",
      });
      router.push('/quality/lab');
    } catch (error) {
      console.error('Error adding analysis:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save lab analysis",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-primary/5 text-primary">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <nav className="flex text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span>Lab Analysis</span>
                </li>
                <li className="flex items-center font-bold text-primary">
                  <span className="mx-2">/</span>
                  <span>Add New</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-4xl font-black text-primary tracking-tight">Add Lab Analysis</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl">
          <CardHeader className="bg-primary/5 border-b border-primary/10 p-10">
            <div className="flex items-center gap-4 text-primary">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Beaker size={24} className="font-bold" />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-wider">Analysis Information</CardTitle>
                <CardDescription className="text-sm font-medium text-primary/60">Technical details and laboratory configuration.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Analysis Name</Label>
                  <div className="relative group">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      name="analysisName"
                      value={formData.analysisName}
                      onChange={handleInputChange}
                      placeholder="e.g. Pesticide Residue Test"
                      className="h-14 pl-12 bg-muted/30 border-none rounded-2xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Date</Label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20 group-focus-within:text-primary transition-colors pointer-events-none" />
                    <Input 
                      name="date"
                      type="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="h-14 pl-12 bg-muted/30 border-none rounded-2xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Price</Label>
                  <div className="relative group">
                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      name="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="h-14 pl-12 pr-16 bg-muted/30 border-none rounded-2xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-primary/40 group-focus-within:text-primary/60 transition-colors uppercase">
                      {getCurrencySymbol(formData.currency)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1 text-emerald-600">Product Selection</Label>
                  <Select onValueChange={(val) => handleSelectChange('productId', val, products, 'productName')}>
                    <SelectTrigger className="h-14 bg-muted/30 border-none rounded-2xl px-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 shadow-inner">
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/10 shadow-2xl overflow-hidden font-bold">
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.productName} - {p.category} - {p.type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1 text-emerald-600">Farm Selection</Label>
                  <Select value={formData.farmId} onValueChange={(val) => handleSelectChange('farmId', val, farms, 'name')}>
                    <SelectTrigger className="h-14 bg-muted/30 border-none rounded-2xl px-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 shadow-inner">
                      <SelectValue placeholder="Select Farm" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/10 shadow-2xl overflow-hidden font-bold">
                      {farms.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Internal Note</Label>
                  <textarea 
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    className="w-full min-h-[120px] bg-muted/30 border-none rounded-3xl p-5 font-bold text-sm text-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none shadow-inner resize-none placeholder:text-primary/20"
                    placeholder="Add any specific observations or internal remarks..."
                  />
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Laboratory Name</Label>
                  <div className="relative group">
                    <Factory className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/20 group-focus-within:text-primary transition-colors" />
                    <Input 
                      name="labName"
                      value={formData.labName}
                      onChange={handleInputChange}
                      placeholder="e.g. Central Quality Labs"
                      className="h-14 pl-12 bg-muted/30 border-none rounded-2xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Select Currency</Label>
                  <Select value={formData.currency} onValueChange={(val) => handleSelectChange('currency', val)}>
                    <SelectTrigger className="h-14 bg-muted/30 border-none rounded-2xl px-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 opacity-40 shrink-0" />
                        <SelectValue placeholder="Currency" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/10 shadow-2xl overflow-hidden font-bold">
                      <SelectItem value="MAD">MAD (Dirham)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">RM Lot or Farm</Label>
                  <Input 
                    name="rmLotOrFarm"
                    value={formData.rmLotOrFarm}
                    onChange={handleInputChange}
                    placeholder="e.g. Lot 5 / North Sector"
                    className="h-14 bg-muted/30 border-none rounded-2xl font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Processing Line</Label>
                  <Select value={formData.processingLineId} onValueChange={(val) => {
                    const selectedItem = lines.find(l => l.id === val);
                    const lineName = selectedItem?.title || selectedItem?.name || '';
                    setFormData(prev => ({
                      ...prev,
                      processingLineId: val,
                      processingLineName: lineName
                    }));
                  }}>
                    <SelectTrigger className="h-14 bg-muted/30 border-none rounded-2xl px-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 shadow-inner">
                      <SelectValue placeholder="Select Processing Line" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/10 shadow-2xl overflow-hidden font-bold">
                      {lines.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.title || l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-primary/40 ml-1">Report Attachment (PDF/DOC)</Label>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/10 rounded-[2rem] p-8 bg-primary/[0.01] hover:bg-primary/[0.03] transition-all relative group shadow-inner">
                    {reportFile ? (
                      <div className="flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-300">
                        <div className="p-4 bg-emerald-500/10 text-emerald-600 rounded-3xl border border-emerald-500/20">
                          <FileText size={48} />
                        </div>
                        <div className="text-center">
                          <p className="font-black text-primary text-sm truncate max-w-[200px]">{reportFile.name}</p>
                          <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] pt-1">
                            {(reportFile.size / 1024 / 1024).toFixed(2)} MB • READY
                          </p>
                        </div>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setReportFile(null)}
                          className="rounded-full h-9 px-6 text-destructive hover:bg-destructive/5 font-black text-[10px] uppercase tracking-widest gap-2"
                        >
                          <X size={14} /> REMOVE
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer space-y-4 w-full">
                        <div className="p-5 bg-primary/10 text-primary rounded-3xl group-hover:scale-110 transition-transform duration-500">
                          <Upload size={32} />
                        </div>
                        <div className="text-center">
                          <p className="font-black text-primary text-lg tracking-tight">Drop analysis report here</p>
                          <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] pt-2">
                             PDF, DOCS • MAX 10MB
                          </p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={handleFileChange}
                          accept=".pdf,.doc,.docx"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-6 pt-4 pb-20">
          <Button 
            type="button"
            variant="ghost" 
            onClick={() => router.back()}
            className="rounded-2xl px-10 h-14 font-black text-primary/40 hover:text-primary hover:bg-primary/5 transition-all text-[11px] uppercase tracking-[0.2em]"
          >
            CANCEL
          </Button>
          <Button 
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white font-black h-16 px-12 rounded-2xl gap-3 shadow-[0_20px_40px_-15px_rgba(var(--primary-rgb),0.3)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-[0.3em]"
          >
            {loading ? (
               <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>SYNCHRONIZING...</span>
               </div>
            ) : (
               <div className="flex items-center gap-3">
                  <Save size={20} strokeWidth={3} />
                  <span>PUBLISH ANALYSIS</span>
               </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
