'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  doc,
  getDoc,
  updateDoc, 
  serverTimestamp 
} from '@/firebase/firestore-override';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  useFirestore, 
  useStorage, 
  useUser 
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  UploadCloud, 
  ChevronLeft, 
  Building2, 
  ShieldCheck, 
  Loader2,
  CheckCircle2,
  MapPin,
  Hash,
  Scale,
  Wheat,
  Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const certificateSchema = z.object({
  fileName: z.string().optional().default(''),
  fileUrl: z.string().optional().default(''),
  fileType: z.string().optional().default(''),
  fileExtension: z.string().optional().default(''),
  expiryDate: z.string().optional().default(''),
  note: z.string().optional().default(''),
});

const mainFarmSchema = z.object({
  name: z.string().min(1, "Farm name is required"),
  gpsLocation: z.string().optional().default(''),
  ggnNumber: z.string().optional().default(''),
  farmSize: z.coerce.number().optional().default(0),
  estimatedCrops: z.coerce.number().optional().default(0),
  farmCodification: z.string().optional().default(''),
  certificates: z.array(certificateSchema).default([]),
});

type MainFarmFormValues = z.infer<typeof mainFarmSchema>;

export default function EditMainFarmPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const form = useForm<MainFarmFormValues>({
    resolver: zodResolver(mainFarmSchema),
    defaultValues: {
      name: '',
      gpsLocation: '',
      ggnNumber: '',
      farmSize: undefined,
      estimatedCrops: undefined,
      farmCodification: '',
      certificates: [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'certificates'
  });

  useEffect(() => {
    if (!db || !id) return;
    const fetchFarm = async () => {
      try {
        const docRef = doc(db, 'main_farms', id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          form.reset({
            name: data.name || '',
            gpsLocation: data.gpsLocation === '-' ? '' : (data.gpsLocation || ''),
            ggnNumber: data.ggnNumber === '-' ? '' : (data.ggnNumber || ''),
            farmSize: data.farmSize || undefined,
            estimatedCrops: data.estimatedCrops || undefined,
            farmCodification: data.farmCodification === '-' ? '' : (data.farmCodification || ''),
            certificates: data.certificates || [],
          });
        } else {
          toast({
            variant: "destructive",
            title: "Not Found",
            description: "Main farm document could not be located.",
          });
          router.push('/quality/main-farms');
        }
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Fetch Error",
          description: e.message || "Failed to load farm details.",
        });
      } finally {
        setFetching(false);
      }
    };
    fetchFarm();
  }, [db, id, form, router, toast]);

  const uploadFile = async (file: File, index: number) => {
    setUploadingIndex(index);
    try {
      const ext = file.name.split('.').pop() || '';
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      
      let downloadUrl = '';
      if (storage) {
        try {
          const path = `main_farms/certificates/${Date.now()}_${file.name}`;
          const fileRef = ref(storage, path);
          await uploadBytes(fileRef, file);
          downloadUrl = await getDownloadURL(fileRef);
        } catch (storageErr) {
          console.warn("Storage upload failed, falling back to data URL:", storageErr);
        }
      }

      if (!downloadUrl) {
        downloadUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      form.setValue(`certificates.${index}.fileUrl`, downloadUrl);
      form.setValue(`certificates.${index}.fileExtension`, ext);
      
      if (!form.getValues(`certificates.${index}.fileName`)) {
        form.setValue(`certificates.${index}.fileName`, baseName);
      }

      toast({
        title: "File Attached",
        description: `Successfully attached ${file.name}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error.message || "Failed to process file.",
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const onSubmit = async (values: MainFarmFormValues) => {
    if (!db || !id || !user) return;
    setLoading(true);

    try {
      const cleanCertificates = (values.certificates || []).filter(
        c => c.fileName || c.fileUrl || c.fileType || c.expiryDate || c.note
      );

      const updateData = {
        name: values.name,
        gpsLocation: values.gpsLocation || '-',
        ggnNumber: values.ggnNumber || '-',
        farmSize: Number(values.farmSize) || 0,
        estimatedCrops: Number(values.estimatedCrops) || 0,
        farmCodification: values.farmCodification || '-',
        certificates: cleanCertificates,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByDisplayName: user.displayName || user.email || 'Zakariaa El Yamlahi',
      };

      await updateDoc(doc(db, 'main_farms', id as string), updateData);

      toast({
        title: "Farm Updated",
        description: `Changes to "${values.name}" have been saved.`,
      });
      router.push('/quality/main-farms');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to save farm modifications.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto font-sans">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto font-sans">
      {/* Modern Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link href="/profile" className="hover:text-slate-600 transition-colors">Profile</Link>
            <span>/</span>
            <Link href="/quality/main-farms" className="hover:text-slate-600 transition-colors">Main Farms</Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Edit Main Farm</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Edit Main Farm
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Update farm parameters, harvest estimates, and compliance documentation.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => router.push('/quality/main-farms')}
          className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-2 self-start sm:self-auto cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Farms</span>
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Card 1: Main Farms Information */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#193A7B] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Main Farms Information</h2>
              <p className="text-xs text-slate-400">Core operational identifiers and geographic location</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>Name</span>
                <span className="text-rose-500">*</span>
              </label>
              <Input
                {...form.register('name')}
                placeholder="e.g. Younes Nasria"
                className="h-11 rounded-xl border-slate-200 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15 bg-white placeholder:text-slate-400"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-rose-500 font-medium">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* GPS Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>GPS Location</span>
              </label>
              <Input
                {...form.register('gpsLocation')}
                placeholder="e.g. 34.813317, -6.260924"
                className="h-11 rounded-xl border-slate-200 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15 bg-white placeholder:text-slate-400"
              />
            </div>

            {/* GGN Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>GGN Number</span>
              </label>
              <Input
                {...form.register('ggnNumber')}
                placeholder="e.g. 4069453113084"
                className="h-11 rounded-xl border-slate-200 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15 bg-white placeholder:text-slate-400 font-mono"
              />
            </div>

            {/* Farm Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5 text-slate-400" />
                <span>Farm Size</span>
              </label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-[#0284C7] focus-within:ring-2 focus-within:ring-[#0284C7]/15 bg-white h-11 transition-all">
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 1000"
                  {...form.register('farmSize')}
                  className="flex-1 h-full border-0 rounded-none focus-visible:ring-0 shadow-none text-sm px-3.5 placeholder:text-slate-400"
                />
                <div className="bg-slate-50 border-l border-slate-200 px-4 flex items-center justify-center text-xs font-semibold text-slate-600 select-none">
                  Hectares
                </div>
              </div>
            </div>

            {/* Estimated Crops */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Crops</span>
              </label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:border-[#0284C7] focus-within:ring-2 focus-within:ring-[#0284C7]/15 bg-white h-11 transition-all">
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 29000"
                  {...form.register('estimatedCrops')}
                  className="flex-1 h-full border-0 rounded-none focus-visible:ring-0 shadow-none text-sm px-3.5 placeholder:text-slate-400"
                />
                <div className="bg-slate-50 border-l border-slate-200 px-4 flex items-center justify-center text-xs font-semibold text-slate-600 select-none">
                  Tonnes
                </div>
              </div>
            </div>

            {/* Farm Codification */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Farm Codification</span>
              </label>
              <Input
                {...form.register('farmCodification')}
                placeholder="e.g. NAS or A01"
                className="h-11 rounded-xl border-slate-200 text-sm focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/15 bg-white placeholder:text-slate-400 uppercase"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Add Certificates */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Farm Certificates</h2>
                <p className="text-xs text-slate-400">Manage valid compliance accreditations and documentation</p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => append({ fileName: '', fileUrl: '', fileType: 'Global GAP', fileExtension: '', expiryDate: '', note: '' })}
              className="h-9 px-3.5 rounded-xl bg-blue-50 text-[#0284C7] hover:bg-blue-100 font-semibold text-xs gap-1.5 transition-colors cursor-pointer border border-blue-200/60"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Certificate</span>
            </Button>
          </div>

          {/* Certificate Rows */}
          <div className="space-y-4">
            {fields.map((field, index) => {
              const currentFileName = form.watch(`certificates.${index}.fileName`);
              const currentExt = form.watch(`certificates.${index}.fileExtension`);
              const displayName = currentFileName 
                ? (currentExt ? `${currentFileName}.${currentExt}` : currentFileName)
                : 'No file attached';

              return (
                <div 
                  key={field.id} 
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_1.3fr_1.2fr_1.5fr_auto] gap-3.5 items-end">
                    {/* Upload File */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Upload File</label>
                      <div className="flex items-center gap-2 h-10">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-[#193A7B] hover:bg-[#132d61] text-white text-xs font-semibold rounded-lg shadow-2xs whitespace-nowrap transition-colors">
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Choose File</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadFile(file, index);
                            }}
                          />
                        </label>
                        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[120px]" title={displayName}>
                          {uploadingIndex === index ? 'Uploading...' : displayName}
                        </span>
                      </div>
                    </div>

                    {/* File Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">File Name</label>
                      <Input
                        {...form.register(`certificates.${index}.fileName`)}
                        placeholder="e.g. GG-Younes Nasria"
                        className="h-10 rounded-lg border-slate-200 text-xs bg-white focus:border-[#0284C7]"
                      />
                    </div>

                    {/* File Type */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">File Type</label>
                      <Select
                        value={form.watch(`certificates.${index}.fileType`) || ''}
                        onValueChange={(val) => form.setValue(`certificates.${index}.fileType`, val)}
                      >
                        <SelectTrigger className="h-10 rounded-lg border-slate-200 text-xs bg-white focus:ring-0">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          <SelectItem value="Global GAP">Global GAP</SelectItem>
                          <SelectItem value="BRC">BRC</SelectItem>
                          <SelectItem value="COC">COC</SelectItem>
                          <SelectItem value="SMETA">SMETA</SelectItem>
                          <SelectItem value="ORGANIC">ORGANIC</SelectItem>
                          <SelectItem value="SPRING">SPRING</SelectItem>
                          <SelectItem value="GRASP">GRASP</SelectItem>
                          <SelectItem value="OTHER DOCUMENT">OTHER DOCUMENT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Expiry Date</label>
                      <Input
                        type="date"
                        {...form.register(`certificates.${index}.expiryDate`)}
                        className="h-10 rounded-lg border-slate-200 text-xs bg-white focus:border-[#0284C7]"
                      />
                    </div>

                    {/* Note */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Note</label>
                      <Input
                        {...form.register(`certificates.${index}.note`)}
                        placeholder="e.g. Valide or In Review"
                        className="h-10 rounded-lg border-slate-200 text-xs bg-white focus:border-[#0284C7]"
                      />
                    </div>

                    {/* Remove button */}
                    <div className="flex items-center pb-0.5">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="w-9 h-9 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove Certificate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/quality/main-farms')}
              className="h-11 px-5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 px-7 rounded-xl bg-[#193A7B] hover:bg-[#132d61] text-white font-semibold text-xs shadow-sm shadow-[#193A7B]/20 transition-all hover:shadow-md cursor-pointer flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Update Farm</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
