'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useUser 
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { 
  ChevronLeft, 
  MapPin, 
  Hash, 
  Info,
  Loader2,
  User,
  Map,
  Phone,
  FileCode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const smallFarmSchema = z.object({
  name: z.string().min(2, "Farm name is required"),
  farmerName: z.string().min(2, "Farmer name is required"),
  region: z.string().min(2, "Region is required"),
  phone: z.string().min(5, "Phone number is required"),
  ggnNumber: z.string().min(2, "GGN Number is required"),
  gpsLocation: z.string().optional(),
  farmCodification: z.string().min(2, "Farm codification is required"),
});

type SmallFarmFormValues = z.infer<typeof smallFarmSchema>;

export default function AddSmallFarmPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<SmallFarmFormValues>({
    resolver: zodResolver(smallFarmSchema),
    defaultValues: {
      name: '',
      farmerName: '',
      region: '',
      phone: '',
      ggnNumber: '',
      gpsLocation: '',
      farmCodification: '',
    }
  });

  const onSubmit = async (values: SmallFarmFormValues) => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const data = {
        ...values,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByDisplayName: user.displayName || user.email || 'Unknown User',
      };

      await addDoc(collection(db, 'small_farms'), data);

      toast({
        title: "Success",
        description: "Small farm has been created successfully.",
      });
      router.push('/quality/small-farms');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save small farm.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/quality/small-farms')} className="rounded-full hover:bg-primary/5 text-primary">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-1" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li className="flex items-center">Profile</li>
              <li className="flex items-center">
                <span className="mx-2">/</span>
                <span>Small Farms</span>
              </li>
              <li className="flex items-center">
                <span className="mx-2">/</span>
                <span className="text-primary truncate max-w-[150px]">Add Small Farms</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Register Small Farm</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
            <div className="flex items-center gap-3 text-primary">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Info size={20} className="font-bold" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold uppercase tracking-wider">Producer Information</CardTitle>
                <CardDescription className="text-xs font-medium text-primary/60">Identification and contact data for individual producers.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* LEFT COLUMN */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <Map size={14} /> Farm Name
                  </Label>
                  <Input 
                    {...form.register('name')} 
                    error={!!form.formState.errors.name}
                    placeholder="e.g. Green Valley" 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white focus:ring-primary/20 transition-all font-medium" 
                  />
                  <FieldError message={form.formState.errors.name?.message} />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <User size={14} /> Farmer Name
                  </Label>
                  <Input 
                    {...form.register('farmerName')} 
                    error={!!form.formState.errors.farmerName}
                    placeholder="Full Name" 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
                  />
                  <FieldError message={form.formState.errors.farmerName?.message} />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <MapPin size={14} /> Region
                  </Label>
                  <Input 
                    {...form.register('region')} 
                    error={!!form.formState.errors.region}
                    placeholder="Region / Area" 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
                  />
                  <FieldError message={form.formState.errors.region?.message} />
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <Phone size={14} /> Phone Number
                  </Label>
                  <Input 
                    {...form.register('phone')} 
                    error={!!form.formState.errors.phone}
                    placeholder="+212 ..." 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
                  />
                  <FieldError message={form.formState.errors.phone?.message} />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <Hash size={14} /> GGN Number
                  </Label>
                  <Input 
                    {...form.register('ggnNumber')} 
                    error={!!form.formState.errors.ggnNumber}
                    placeholder="GGN Number" 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
                  />
                  <FieldError message={form.formState.errors.ggnNumber?.message} />
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <FileCode size={14} /> Farm Codification
                  </Label>
                  <Input 
                    {...form.register('farmCodification')} 
                    error={!!form.formState.errors.farmCodification}
                    placeholder="Codification Code" 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
                  />
                  <FieldError message={form.formState.errors.farmCodification?.message} />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-primary/5">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                    <MapPin size={14} /> GPS Location (Optional)
                  </Label>
                  <Input 
                    {...form.register('gpsLocation')} 
                    placeholder="Coordinates (Lat, Long)" 
                    className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
                  />
                </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-6 pt-4 pb-20">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.push('/quality/small-farms')} 
            className="h-14 px-8 font-bold text-primary/60 hover:text-primary hover:bg-primary/5 uppercase tracking-widest text-xs"
          >
            DISCARD
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="h-14 px-16 bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/30 rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-sm flex items-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Wait...
              </>
            ) : (
              'Save Small Farm'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
