'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  collection, 
  addDoc, 
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
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { 
  Plus, 
  Trash2, 
  Upload, 
  ChevronLeft, 
  FileText, 
  MapPin, 
  Hash, 
  CheckCircle2,
  Loader2,
  Activity,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const certificateSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().min(1, "File upload is required"),
  fileType: z.enum([
    'Bill Of Lading',
    'Phyto',
    'Eur1',
    'Invoice',
    'Certificate of Conformity',
    'Other document',
    'BRC',
    'Global GAP',
    'Organic',
    'SMETA',
    'COC',
    'SPRING',
    'GRASP'
  ]),
  fileExtension: z.string().optional(),
  expiryDate: z.string().min(1, "Expiry date is required"),
  note: z.string().optional(),
});

const processingLineSchema = z.object({
  title: z.string().min(2, "Title is required"),
  gpsLocation: z.string().min(2, "GPS location is required"),
  locationTag: z.string().max(5, "Tag must be 5 chars or less").optional(),
  stationNumber: z.coerce.number().min(1, "Station number is required"),
  description: z.string().optional(),
  exportatorNumber: z.string().optional(),
  certificates: z.array(certificateSchema).default([]),
});

type ProcessingLineFormValues = z.infer<typeof processingLineSchema>;

export default function AddProcessingLinePage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const form = useForm<ProcessingLineFormValues>({
    resolver: zodResolver(processingLineSchema),
    defaultValues: {
      title: '',
      gpsLocation: '',
      locationTag: '',
      exportatorNumber: '',
      stationNumber: 1,
      description: '',
      certificates: [{ fileName: '', fileUrl: '', fileType: 'Other document', expiryDate: '', note: '' }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'certificates'
  });

  const uploadFile = async (file: File, index: number) => {
    setUploadingIndex(index);
    try {
      const fileExtension = file.name.split('.').pop();
      const path = `processing_lines/certificates/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      
      form.setValue(`certificates.${index}.fileUrl`, url);
      form.setValue(`certificates.${index}.fileExtension`, fileExtension);
      
      if (!form.getValues(`certificates.${index}.fileName`)) {
        form.setValue(`certificates.${index}.fileName`, file.name.split('.')[0]);
      }

      toast({
        title: "File Uploaded",
        description: `Successfully uploaded ${file.name}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error.message || "Failed to upload file.",
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const onSubmit = async (values: ProcessingLineFormValues) => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const data = {
        ...values,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByDisplayName: user.displayName || user.email || 'Unknown User',
      };

      await addDoc(collection(db, 'processing_lines'), data);

      toast({
        title: "Success",
        description: "Processing line has been created successfully.",
      });
      router.push('/quality/lines');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save processing line.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-primary/5 text-primary">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-1" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li>Quality</li>
              <li className="flex items-center">
                <span className="mx-2">/</span>
                <span className="text-primary truncate max-w-[150px]">Add Processing Line</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Create New Line</h1>
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
                <CardTitle className="text-lg font-bold uppercase tracking-wider">Processing Line Information</CardTitle>
                <CardDescription className="text-xs font-medium text-primary/60">Enter the primary technical details of the line.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8">
            <div className="md:col-span-2 space-y-3">
              <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                <FileText size={14} /> Line Title
              </Label>
              <Input 
                {...form.register('title')} 
                error={!!form.formState.errors.title}
                placeholder="e.g. Main Production Line - Hall A" 
                className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white focus:ring-primary/20 transition-all font-medium text-lg" 
              />
              <FieldError message={form.formState.errors.title?.message} />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                <Hash size={14} /> Numero De Station
              </Label>
              <Input 
                type="number"
                {...form.register('stationNumber')} 
                error={!!form.formState.errors.stationNumber}
                placeholder="0" 
                className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-bold text-primary text-lg" 
              />
              <FieldError message={form.formState.errors.stationNumber?.message} />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                <MapPin size={14} /> GPS Location
              </Label>
              <Input 
                {...form.register('gpsLocation')} 
                error={!!form.formState.errors.gpsLocation}
                placeholder="31.6295° N, 7.9811° W" 
                className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
              />
              <FieldError message={form.formState.errors.gpsLocation?.message} />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-bold text-emerald-600 uppercase tracking-tighter flex items-center gap-2">
                <Activity size={14} /> Location Tag (Optional)
              </Label>
              <Input 
                {...form.register('locationTag')} 
                error={!!form.formState.errors.locationTag}
                placeholder="e.g. BFY" 
                className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/30 focus:bg-white font-black text-emerald-700 placeholder:text-emerald-200 uppercase" 
              />
              <FieldError message={form.formState.errors.locationTag?.message} />
              <p className="text-[9px] font-bold text-emerald-500/50 uppercase tracking-tighter mt-1">Appears in Lot Numbers (e.g. -BFY)</p>
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter flex items-center gap-2">
                <FileText size={14} /> Exportator Number (Optional)
              </Label>
              <Input 
                {...form.register('exportatorNumber')} 
                error={!!form.formState.errors.exportatorNumber}
                placeholder="e.g. ID-9922" 
                className="h-12 rounded-2xl border-primary/10 bg-muted/20 focus:bg-white font-medium" 
              />
              <FieldError message={form.formState.errors.exportatorNumber?.message} />
            </div>
            <div className="md:col-span-3 space-y-3">
              <Label className="text-xs font-bold text-primary/70 uppercase tracking-tighter">Description</Label>
              <Textarea 
                {...form.register('description')} 
                placeholder="Describe the line's capabilities, machinery, or capacity..." 
                className="min-h-[120px] rounded-2xl border-primary/10 bg-muted/20 focus:bg-white transition-all resize-none shadow-inner" 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b border-primary/10 p-8 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <div className="p-2 bg-primary/10 rounded-xl">
                <CheckCircle2 size={20} className="font-bold" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold uppercase tracking-wider">Add Certificates</CardTitle>
                <CardDescription className="text-xs font-medium text-primary/60">Attach compliance and quality certificates for this line.</CardDescription>
              </div>
            </div>
            <Button 
                type="button" 
                variant="outline" 
                onClick={() => append({ fileName: '', fileUrl: '', fileType: 'Other document', expiryDate: '', note: '' })}
                className="gap-2 border-primary/20 text-primary hover:bg-primary/10 rounded-2xl px-6 font-extrabold uppercase tracking-tighter transition-all hover:scale-105 active:scale-95 shadow-md"
              >
                <Plus size={18} /> ADD NEW CERTIFICATE
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-primary/5">
                  <tr className="border-b border-primary/5">
                    <th className="p-4 px-6 text-[10px] font-bold text-primary/50 uppercase tracking-widest whitespace-nowrap">File Upload</th>
                    <th className="p-4 px-6 text-[10px] font-bold text-primary/50 uppercase tracking-widest whitespace-nowrap">File Name</th>
                    <th className="p-4 px-6 text-[10px] font-bold text-primary/50 uppercase tracking-widest whitespace-nowrap">Type</th>
                    <th className="p-4 px-6 text-[10px] font-bold text-primary/50 uppercase tracking-widest whitespace-nowrap">Expiry Date</th>
                    <th className="p-4 px-6 text-[10px] font-bold text-primary/50 uppercase tracking-widest whitespace-nowrap">Note</th>
                    <th className="p-4 px-6 text-[10px] font-bold text-primary/50 uppercase tracking-widest text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {fields.map((field, index) => (
                    <tr key={field.id} className="group hover:bg-primary/[0.02] transition-colors">
                      <td className="p-4 px-6">
                        <div className="flex flex-col gap-1 w-[160px]">
                          <div className="relative">
                            <input 
                              type="file" 
                              className="hidden" 
                              id={`file-${index}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadFile(file, index);
                              }}
                            />
                            <label 
                              htmlFor={`file-${index}`}
                              className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-xs font-bold uppercase
                                ${form.watch(`certificates.${index}.fileUrl`) 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' 
                                  : 'bg-muted/30 border-primary/10 text-primary/40 hover:bg-white hover:border-primary/30'}`}
                            >
                              {uploadingIndex === index ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : form.watch(`certificates.${index}.fileUrl`) ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              {form.watch(`certificates.${index}.fileUrl`) ? 'UPLOADED' : 'UPLOAD'}
                            </label>
                          </div>
                          {form.watch(`certificates.${index}.fileExtension`) && (
                            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter text-center">
                              .{form.watch(`certificates.${index}.fileExtension`)} detected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 px-6 min-w-[180px]">
                        <Input 
                          {...form.register(`certificates.${index}.fileName`)} 
                          placeholder="Doc Name" 
                          className="h-10 rounded-lg border-primary/10 bg-transparent focus:bg-white font-medium shadow-none"
                        />
                      </td>
                      <td className="p-4 px-6 min-w-[150px]">
                        <Select 
                          onValueChange={(val) => form.setValue(`certificates.${index}.fileType`, val as any)}
                          defaultValue={field.fileType}
                        >
                          <SelectTrigger className="h-10 rounded-lg border-primary/10 bg-transparent focus:bg-white font-medium shadow-none">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bill Of Lading">Bill Of Lading</SelectItem>
                            <SelectItem value="Phyto">Phyto</SelectItem>
                            <SelectItem value="Eur1">Eur1</SelectItem>
                            <SelectItem value="Invoice">Invoice</SelectItem>
                            <SelectItem value="Certificate of Conformity">Certificate of Conformity</SelectItem>
                            <SelectItem value="Other document">Other document</SelectItem>
                            <SelectItem value="BRC">BRC</SelectItem>
                            <SelectItem value="Global GAP">Global GAP</SelectItem>
                            <SelectItem value="Organic">Organic</SelectItem>
                            <SelectItem value="SMETA">SMETA</SelectItem>
                            <SelectItem value="COC">COC</SelectItem>
                            <SelectItem value="SPRING">SPRING</SelectItem>
                            <SelectItem value="GRASP">GRASP</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 px-6 min-w-[160px]">
                        <Input 
                          type="date"
                          {...form.register(`certificates.${index}.expiryDate`)} 
                          className="h-10 rounded-lg border-primary/10 bg-transparent focus:bg-white font-medium shadow-none"
                        />
                      </td>
                      <td className="p-4 px-6 min-w-[180px]">
                        <Input 
                          {...form.register(`certificates.${index}.note`)} 
                          placeholder="Optional note..." 
                          className="h-10 rounded-lg border-primary/10 bg-transparent focus:bg-white font-medium shadow-none"
                        />
                      </td>
                      <td className="p-4 px-6 text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => remove(index)}
                          className="h-9 w-9 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/5 italic text-sm">
                <FileText size={40} className="opacity-10 mb-2" />
                No certificates added to this registration yet.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-6 pt-4 pb-20">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.push('/quality/lines')} 
            className="h-14 px-8 font-bold text-primary/60 hover:text-primary hover:bg-primary/5 uppercase tracking-widest text-xs"
          >
            DISCARD CHANGES
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="h-14 px-16 bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/30 rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-sm flex items-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Finalize & Add Location'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
