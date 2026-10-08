'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  ChevronLeft, Loader2, Package2, CheckCircle2,
  AlertTriangle, BarChart2, Layers, FileText, AlertCircle
} from 'lucide-react';

const SECTIONS = [
  'EPI',
  'Matériel et outils',
  'Médicaments',
  "Hygiène et produits d'hygiène",
];

export default function EditQualityConsumablePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [name, setName] = useState('');
  const [criticalLevel, setCriticalLevel] = useState('');
  const [averageLevel, setAverageLevel] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch existing data
  useEffect(() => {
    if (!db || !id) return;
    const fetch = async () => {
      setFetching(true);
      try {
        const snap = await getDoc(doc(db, 'quality_consumables', id));
        if (!snap.exists()) { setFetchError(true); return; }
        const data = snap.data();
        setName(data.name || '');
        setCriticalLevel(data.criticalLevel != null ? String(data.criticalLevel) : '');
        setAverageLevel(data.averageLevel != null ? String(data.averageLevel) : '');
        setSection(data.section || '');
        setDescription(data.description || '');
      } catch {
        setFetchError(true);
      } finally {
        setFetching(false);
      }
    };
    fetch();
  }, [db, id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Consumable name is required';
    if (!section) e.section = 'Section is required';
    if (criticalLevel !== '' && isNaN(Number(criticalLevel))) e.criticalLevel = 'Must be a number';
    if (averageLevel !== '' && isNaN(Number(averageLevel))) e.averageLevel = 'Must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!db || !user) return;
    if (!validate()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the highlighted fields.' });
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'quality_consumables', id), {
        name: name.trim(),
        criticalLevel: criticalLevel !== '' ? Number(criticalLevel) : null,
        averageLevel: averageLevel !== '' ? Number(averageLevel) : null,
        section,
        description: description.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });
      toast({ title: 'Consumable Updated', description: `"${name}" has been updated successfully.` });
      router.push('/quality/consumables');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'An error occurred while saving.' });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (key: string) =>
    `h-11 rounded-xl bg-muted/30 border-none font-medium ${errors[key] ? 'ring-2 ring-rose-500' : ''}`;

  if (fetchError) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-16 w-16 text-rose-400" />
        <h2 className="text-xl font-bold text-primary">Consumable Not Found</h2>
        <p className="text-muted-foreground">This record does not exist or has been deleted.</p>
        <Button onClick={() => router.push('/quality/consumables')} className="mt-4">Back to Consumables</Button>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-2xl" />
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/quality/consumables')}
          className="rounded-full hover:bg-primary/10"
        >
          <ChevronLeft className="h-5 w-5 text-primary" />
        </Button>
        <div>
          <nav className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 mb-1">
            Quality Consumables / <span className="text-primary">Edit Consumable</span>
          </nav>
          <h1 className="text-2xl font-black text-primary uppercase tracking-tight">
            Edit — <span className="text-primary/50">{name}</span>
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
            <Package2 size={14} /> Consumable Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-8 px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Consumable Name */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Consumable Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                placeholder="e.g. Gants nitrile, Gel hydroalcoolique..."
                className={fieldClass('name')}
              />
              {errors.name && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.name}</p>}
            </div>

            {/* Critical Level */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-rose-500" /> Critical Level
              </Label>
              <Input
                type="number"
                value={criticalLevel}
                onChange={e => { setCriticalLevel(e.target.value); setErrors(p => ({ ...p, criticalLevel: '' })); }}
                placeholder="e.g. 10"
                className={fieldClass('criticalLevel')}
              />
              {errors.criticalLevel && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.criticalLevel}</p>}
            </div>

            {/* Average Level */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <BarChart2 size={10} className="text-amber-500" /> Average Level
              </Label>
              <Input
                type="number"
                value={averageLevel}
                onChange={e => { setAverageLevel(e.target.value); setErrors(p => ({ ...p, averageLevel: '' })); }}
                placeholder="e.g. 50"
                className={fieldClass('averageLevel')}
              />
              {errors.averageLevel && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.averageLevel}</p>}
            </div>

            {/* Section */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Layers size={10} className="text-primary/60" /> Section <span className="text-rose-500">*</span>
              </Label>
              <Select value={section} onValueChange={val => { setSection(val); setErrors(p => ({ ...p, section: '' })); }}>
                <SelectTrigger className={fieldClass('section')}>
                  <SelectValue placeholder="Select a section..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.section && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.section}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <FileText size={10} className="text-primary/40" /> Description
              </Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief notes or usage details..."
                className="h-11 rounded-xl bg-muted/30 border-none font-medium"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-6 bg-primary/5 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-primary h-5 w-5" />
          <div>
            <p className="text-sm font-black text-primary uppercase tracking-tight">Save Changes</p>
            <p className="text-[10px] text-primary/50 font-bold">Updates will be reflected immediately.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/quality/consumables')}
            className="font-black text-muted-foreground uppercase tracking-widest hover:bg-primary/5"
          >
            Discard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-black shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest min-w-[200px]"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
            ) : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
