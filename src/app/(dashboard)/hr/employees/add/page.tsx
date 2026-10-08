'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  collection, 
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from '@/firebase/firestore-override';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  useFirestore, 
  useStorage, 
  useCollection, 
  useMemoFirebase,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, 
  Trash2, 
  Upload, 
  User, 
  Briefcase, 
  CreditCard, 
  FileText, 
  Coins,
  ChevronLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const employeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.enum(['male', 'female']),
  phone: z.string().optional().or(z.literal('')),
  birthday: z.string().optional().or(z.literal('')),
  joinDate: z.string().optional().or(z.literal('')),
  employmentDate: z.string().optional().or(z.literal('')),
  familySituation: z.enum(['Mariée', 'Célibataire', 'Divorcé(e)', 'Veuf / Veuve']),
  status: z.enum(['active', 'inactive']).default('active'),
  employeeStatus: z.enum(['Fixed CDD', 'Seasonal', 'Fixed CDI']),
  locationId: z.string().optional(),
  shift: z.string().optional().or(z.literal('')),
  equipe: z.string().optional().or(z.literal('')),
  position: z.string().optional().or(z.literal('')),
  salaryNet: z.coerce.number().optional().or(z.literal('')),
  salaryBrut: z.coerce.number().optional().or(z.literal('')),
  rib: z.string().length(24, "RIB must be exactly 24 characters"),
  cin: z.string().optional().or(z.literal('')),
  cnssStatus: z.enum(['Declared', 'Not Declared']),
  matricule: z.string().optional(),
  address: z.string().optional(),
  childrenCount: z.coerce.number().min(0).default(0),
  paymentStatus: z.enum(['Virement', 'Espèce']),
  seniority: z.string().default('0%'),
  taxReduction: z.coerce.number().min(0).default(0),
  documents: z.array(z.object({
    name: z.string().min(1, "Document name is required"),
    fileUrl: z.string()
  })).max(10).default([]),
  allowances: z.array(z.object({
    type: z.string().min(1, "Type is required"),
    amount: z.coerce.number().min(0)
  })).default([]),
  imageUrl: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.cnssStatus === 'Declared') {
    if (!data.matricule || data.matricule.length !== 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matricule'],
        message: "CNSS Number must be exactly 9 characters when declared",
      });
    }
  }
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function AddEmployeePage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  // Guard query with user to ensure auth context is available for security rules
  const linesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);
  
  const { data: processingLines } = useCollection(linesQuery);

  const settingsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'hrSettings'));
  }, [db, user]);
  const { data: hrSettings } = useCollection(settingsQuery);
  const latestHRSetting = hrSettings && hrSettings.length > 0 ? [...hrSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0] : null;

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      gender: 'male',
      familySituation: 'Célibataire',
      status: 'active',
      employeeStatus: 'Seasonal',
      cnssStatus: 'Not Declared',
      paymentStatus: 'Virement',
      seniority: '0%',
      documents: [],
      allowances: [],
    }
  });

  const employeeStatus = form.watch('employeeStatus');
  const familySituation = form.watch('familySituation');
  const cnssStatus = form.watch('cnssStatus');

  React.useEffect(() => {
    if (employeeStatus === 'Seasonal' && latestHRSetting) {
      form.setValue('salaryNet', latestHRSetting.netHourlyWage);
      form.setValue('salaryBrut', latestHRSetting.grossHourlyWage);
    } else if (employeeStatus !== 'Seasonal') {
      form.setValue('salaryNet', '');
      form.setValue('salaryBrut', '');
      form.setValue('cnssStatus', 'Declared');
    }
  }, [employeeStatus, latestHRSetting, form]);

  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control: form.control,
    name: 'documents'
  });

  const { fields: allowanceFields, append: appendAllowance, remove: removeAllowance } = useFieldArray({
    control: form.control,
    name: 'allowances'
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const onSubmit = async (values: EmployeeFormValues) => {
    setLoading(true);
    try {
      let imageUrl = '';
      if (profileImage) {
        imageUrl = await uploadFile(profileImage, 'employees/profiles');
      }

      // 1. Calculate Employee ID (Matricule)
      const employeesSnap = await getDocs(collection(db, 'employees'));
      let cdiCddCount = 0;
      let seasonalCount = 0;
      
      employeesSnap.forEach(docSnap => {
        const status = docSnap.data().employeeStatus;
        if (status === 'Fixed CDI' || status === 'Fixed CDD') {
          cdiCddCount++;
        } else if (status === 'Seasonal') {
          seasonalCount++;
        }
      });

      let newEmployeeId = '';
      if (values.employeeStatus === 'Fixed CDI' || values.employeeStatus === 'Fixed CDD') {
        newEmployeeId = String(cdiCddCount + 1).padStart(3, '0');
      } else if (values.employeeStatus === 'Seasonal') {
        newEmployeeId = String(seasonalCount + 50).padStart(3, '0');
      } else {
        newEmployeeId = String(Date.now()); // Fallback
      }

      // 2. CNSS number = Matricule
      const employeeData = {
        ...values,
        imageUrl,
        matricule: newEmployeeId,
        cnssNumber: values.cnssNumber || values.matricule || '',
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'employees', newEmployeeId), employeeData);

      toast({
        title: "Employee Added",
        description: `${values.firstName} ${values.lastName} has been successfully registered.`,
      });
      router.push('/hr/employees');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add employee.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">Add New Employee</h1>
          <p className="text-sm text-muted-foreground">Register a new team member with full corporate details.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-xl group-hover:border-primary/40 transition-all">
              <AvatarImage src={profilePreview || ''} />
              <AvatarFallback className="bg-muted text-muted-foreground">
                <User size={48} />
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Upload size={16} />
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Profile Portrait</span>
        </div>

        {/* Basic Information */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <User size={16} /> Basic Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...form.register('firstName')} placeholder="John" className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...form.register('lastName')} placeholder="Doe" className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select onValueChange={(val) => form.setValue('gender', val as 'male' | 'female')} defaultValue="male">
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input {...form.register('phone')} placeholder="+212 ..." className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Birthday</Label>
              <Input type="date" {...form.register('birthday')} className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Join Date</Label>
              <Input type="date" {...form.register('joinDate')} className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Employment Date</Label>
              <Input type="date" {...form.register('employmentDate')} className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>Family Situation</Label>
              <Select onValueChange={(val) => form.setValue('familySituation', val as any)} defaultValue="Célibataire">
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Situation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Célibataire">Célibataire</SelectItem>
                  <SelectItem value="Mariée">Mariée</SelectItem>
                  <SelectItem value="Divorcé(e)">Divorcé(e)</SelectItem>
                  <SelectItem value="Veuf / Veuve">Veuf / Veuve</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {familySituation && familySituation !== 'Célibataire' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Number of Childrens</Label>
                <Input type="number" {...form.register('childrenCount')} className="h-11 rounded-xl bg-muted/30" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employment & Location */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-accent/5 pb-4">
            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Briefcase size={16} /> Employment & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Label>Employee Status</Label>
              <Select 
                onValueChange={(val) => form.setValue('employeeStatus', val as any)} 
                value={form.watch('employeeStatus')}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Contract type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed CDD">Fixed CDD</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                  <SelectItem value="Fixed CDI">Fixed CDI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Processing Line / Location</Label>
              <Select onValueChange={(val) => form.setValue('locationId', val)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Select processing line" />
                </SelectTrigger>
                <SelectContent>
                  {processingLines?.map((line: any) => (
                    <SelectItem key={line.id} value={line.id}>{line.title || line.name || line.lineName || line.id}</SelectItem>
                  ))}
                  {!processingLines?.length && <SelectItem value="none" disabled>No lines defined</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position / Job Title</Label>
              <Input {...form.register('position')} placeholder="Operator / Manager" className="h-11 rounded-xl bg-muted/30" />
            </div>
            {employeeStatus === 'Seasonal' && (
              <>
                <div className="space-y-2">
                  <Label>Equipe</Label>
                  <Input {...form.register('equipe')} placeholder="Team name" className="h-11 rounded-xl bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select onValueChange={(val) => form.setValue('shift', val)} defaultValue={form.watch('shift') || undefined}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Shift 1">Shift 1</SelectItem>
                      <SelectItem value="Shift 2">Shift 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Record Status</Label>
              <Select onValueChange={(val) => form.setValue('status', val as 'active' | 'inactive')} defaultValue="active">
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Legal */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-emerald-50 pb-4">
            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <CreditCard size={16} /> Financial & Legal Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label>Salary Net (DH)</Label>
              <Input type="number" step="0.01" {...form.register('salaryNet')} readOnly={employeeStatus === 'Seasonal'} className={`h-11 rounded-xl ${employeeStatus === 'Seasonal' ? 'bg-muted/60 opacity-70 cursor-not-allowed' : 'bg-muted/30'}`} />
            </div>
            <div className="space-y-2">
              <Label>Salary Brut (DH)</Label>
              <Input type="number" step="0.01" {...form.register('salaryBrut')} readOnly={employeeStatus === 'Seasonal'} className={`h-11 rounded-xl ${employeeStatus === 'Seasonal' ? 'bg-muted/60 opacity-70 cursor-not-allowed' : 'bg-muted/30'}`} />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select onValueChange={(val) => form.setValue('paymentStatus', val as any)} defaultValue="Virement">
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="Espèce">Espèce</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>RIB (Bank Account) <span className="text-rose-500">*</span></Label>
              <Input {...form.register('rib')} maxLength={24} placeholder="24-digit account number" className={`h-11 rounded-xl ${form.formState.errors.rib ? 'border-rose-500 focus-visible:ring-rose-500' : 'bg-muted/30'}`} />
              {form.formState.errors.rib && <p className="text-xs text-rose-500 font-bold">{form.formState.errors.rib.message as string}</p>}
            </div>
            <div className="space-y-2">
              <Label>CIN (National ID)</Label>
              <Input {...form.register('cin')} placeholder="ID Number" className="h-11 rounded-xl bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label>CNSS Registration</Label>
              <Select 
                onValueChange={(val) => form.setValue('cnssStatus', val as any)} 
                value={form.watch('cnssStatus')}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Declared">Declared</SelectItem>
                  <SelectItem value="Not Declared">Not Declared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cnssStatus === 'Declared' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>CNSS Number <span className="text-rose-500">*</span></Label>
                <Input {...form.register('matricule')} maxLength={9} placeholder="9-digit CNSS Number" className={`h-11 rounded-xl ${form.formState.errors.matricule ? 'border-rose-500 focus-visible:ring-rose-500' : 'bg-muted/30'}`} />
                {form.formState.errors.matricule && <p className="text-xs text-rose-500 font-bold">{form.formState.errors.matricule.message as string}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Seniority Level</Label>
              <Select onValueChange={(val) => form.setValue('seniority', val)} defaultValue="0%">
                <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                  <SelectValue placeholder="%" />
                </SelectTrigger>
                <SelectContent>
                  {['0%', '5%', '10%', '15%', '20%', '25%'].map(val => (
                    <SelectItem key={val} value={val}>{val}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Documents */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <FileText size={16} /> Legal Documents
              </CardTitle>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => appendDoc({ name: '', fileUrl: '' })}
                disabled={docFields.length >= 10}
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full"
              >
                <Plus size={14} /> ADD DOC
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {docFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-bold">Label</Label>
                    <Input {...form.register(`documents.${index}.name`)} placeholder="Passport, Contract..." className="h-10 rounded-lg bg-muted/20" />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <Label className="text-[10px] font-bold">File (PDF/JPG)</Label>
                    <Input 
                      type="file" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await uploadFile(file, 'employees/docs');
                          form.setValue(`documents.${index}.fileUrl`, url);
                        }
                      }}
                      className="h-10 rounded-lg bg-muted/20 file:text-[10px] file:font-bold file:uppercase" 
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeDoc(index)} className="text-destructive h-10 w-10">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {docFields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs italic opacity-60">
                  No documents attached yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allowances */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <Coins size={16} /> Monthly Allowances
              </CardTitle>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => appendAllowance({ type: '', amount: 0 })}
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full"
              >
                <Plus size={14} /> ADD ITEM
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {allowanceFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-bold">Type</Label>
                    <Select onValueChange={(val) => form.setValue(`allowances.${index}.type`, val)}>
                      <SelectTrigger className="h-10 rounded-lg bg-muted/20">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meal Allowance">Meal Allowance</SelectItem>
                        <SelectItem value="Transport Allowance">Transport Allowance</SelectItem>
                        <SelectItem value="Performance Allowance">Performance Allowance</SelectItem>
                        <SelectItem value="Prime de caisse">Prime de caisse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-bold">Amount (DH)</Label>
                    <Input type="number" {...form.register(`allowances.${index}.amount`)} placeholder="0.00" className="h-10 rounded-lg bg-muted/20" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAllowance(index)} className="text-destructive h-10 w-10">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {allowanceFields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs italic opacity-60">
                  No extra allowances defined.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pb-12">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="font-bold text-muted-foreground uppercase tracking-widest">
            Discard Changes
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest"
          >
            {loading ? 'Processing Registration...' : 'Finalize Employee Registration'}
          </Button>
        </div>
      </form>
    </div>
  );
}
