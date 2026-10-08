'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  doc,
  updateDoc, 
  serverTimestamp,
  query,
  orderBy,
  getDoc,
  getDocs,
  limit
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
  useDoc,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' }
];

const shiftOptions = [
  { value: 'Shift 1', label: 'Shift 1' },
  { value: 'Shift 2', label: 'Shift 2' }
];

const cnssOptions = [
  { value: 'Declared', label: 'Declared' },
  { value: 'Not Declared', label: 'Not Declared' }
];

function normalizeSelectValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return String(
      value.value ??
      value.label ??
      value.name ??
      value.id ??
      ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeShift(value: any): string {
  return normalizeSelectValue(value)
    .replace("shift", "")
    .replace(/\s+/g, "")
    .trim();
}

function findSelectOption(options: any[], savedValue: any) {
  const saved = normalizeSelectValue(savedValue);
  if (!saved) return null;

  return (
    options.find((option) => {
      if (typeof option !== "object" || option === null) {
        return normalizeSelectValue(option) === saved;
      }
      return (
        normalizeSelectValue(option.value) === saved ||
        normalizeSelectValue(option.label) === saved ||
        normalizeSelectValue(option.name) === saved ||
        normalizeSelectValue(option.id) === saved
      );
    }) || null
  );
}

function findShiftOption(options: any[], savedValue: any) {
  const saved = normalizeShift(savedValue);
  if (!saved) return null;

  return (
    options.find((option) => {
      if (typeof option !== "object" || option === null) {
        return normalizeShift(option) === saved;
      }
      return (
        normalizeShift(option.value) === saved ||
        normalizeShift(option.label) === saved ||
        normalizeShift(option.name) === saved ||
        normalizeShift(option.id) === saved
      );
    }) || null
  );
}

function ensureOption(options: any[], savedValue: any, isShift = false) {
  const found = isShift ? findShiftOption(options, savedValue) : findSelectOption(options, savedValue);
  if (found) return options;

  if (!savedValue) return options;

  const label =
    typeof savedValue === "object"
      ? savedValue.label || savedValue.name || savedValue.value || savedValue.id || ""
      : String(savedValue);

  if (!label) return options;

  return [
    ...options,
    {
      label,
      value: label,
      id: label
    }
  ];
}

const matchGender = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const norm = normalizeSelectValue(val);
  if (norm === 'm') return 'male';
  if (norm === 'f') return 'female';

  const matched = findSelectOption(genderOptions, val);
  if (matched) return matched.value;

  return String(val);
};

const matchShift = (val: any) => {
  if (val === undefined || val === null || val === '') return '';

  const matched = findShiftOption(shiftOptions, val);
  if (matched) return matched.value;

  return String(val);
};

const matchCnss = (val: any) => {
  if (val === undefined || val === null || val === '') return '';

  const norm = normalizeSelectValue(val);
  if (['oui', 'yes', 'true', 'active', 'registered', '1'].includes(norm)) return 'Declared';
  if (['non', 'no', 'false', 'inactive', 'not registered', '0'].includes(norm)) return 'Not Declared';

  const matched = findSelectOption(cnssOptions, val);
  if (matched) return matched.value;

  return String(val);
};

const employeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.string().min(1),
  phone: z.string().optional().or(z.literal('')),
  birthday: z.string().optional().or(z.literal('')),
  joinDate: z.string().optional().or(z.literal('')),
  employmentDate: z.string().optional().or(z.literal('')),
  familySituation: z.string().min(1),
  status: z.string().default('active'),
  employeeStatus: z.string().min(1),
  locationId: z.string().optional(),
  shift: z.string().optional().or(z.literal('')),
  equipe: z.string().optional().or(z.literal('')),
  position: z.string().optional().or(z.literal('')),
  salaryNet: z.coerce.number().optional().or(z.literal('')),
  salaryBrut: z.coerce.number().optional().or(z.literal('')),
  rib: z.string().length(24, "RIB must be exactly 24 characters").optional().or(z.literal('')),
  cin: z.string().optional().or(z.literal('')),
  cnssStatus: z.string().min(1),
  matricule: z.string().optional(),
  address: z.string().optional(),
  childrenCount: z.coerce.number().min(0).default(0),
  paymentStatus: z.string().min(1),
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

const parseDateForInput = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return val;
  }
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return '';
};

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  const [employeeData, setEmployeeData] = useState<any>(null);
  const [processingLines, setProcessingLines] = useState<any[]>([]);
  const [hrSettings, setHrSettings] = useState<any[]>([]);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);

  useEffect(() => {
    if (!db || !user || !unwrappedParams.id) return;

    let mounted = true;

    async function loadData() {
      setIsLoadingEmployee(true);
      
      console.time("load employee");
      const empPromise = getDoc(doc(db, 'employees', unwrappedParams.id));
      
      console.time("load processing lines");
      const linesPromise = getDocs(collection(db, 'processing_lines'));

      console.time("load hrSettings");
      const settingsPromise = getDocs(query(collection(db, 'hrSettings')));

      const [empSnap, linesSnap, settingsSnap] = await Promise.all([
        empPromise,
        linesPromise,
        settingsPromise
      ]);

      console.timeEnd("load employee");
      console.timeEnd("load processing lines");
      console.timeEnd("load hrSettings");

      if (!mounted) return;

      if (empSnap.exists()) {
        setEmployeeData({ id: empSnap.id, ...empSnap.data() });
      }
      
      setProcessingLines(linesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setHrSettings(settingsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      setIsLoadingEmployee(false);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [db, user, unwrappedParams.id]);

  const latestHRSetting = hrSettings && hrSettings.length > 0 ? [...hrSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0] : null;

  const normalizedData = React.useMemo(() => {
    if (!employeeData) return undefined;
    return {
      firstName: employeeData.firstName || '',
      lastName: employeeData.lastName || '',
      gender: matchGender(employeeData.gender || employeeData.employeeGender || employeeData.sexe || employeeData.sex),
      phone: employeeData.phone || '',
      birthday: parseDateForInput(employeeData.birthday),
      joinDate: parseDateForInput(employeeData.joinDate),
      employmentDate: parseDateForInput(employeeData.employmentDate),
      familySituation: employeeData.familySituation || 'Célibataire',
      status: employeeData.status || 'active',
      employeeStatus: employeeData.employeeStatus || 'Seasonal',
      locationId: (typeof employeeData.locationId === 'object' && employeeData.locationId !== null)
        ? (employeeData.locationId.id || employeeData.locationId.value || '') 
        : (employeeData.locationId || ''),
      shift: matchShift(employeeData.shift || employeeData.shiftId || employeeData.shiftName || employeeData.employeeShift),
      equipe: employeeData.equipe || '',
      position: employeeData.position || '',
      salaryNet: employeeData.salaryNet || '',
      salaryBrut: employeeData.salaryBrut || '',
      rib: employeeData.rib || '',
      cin: employeeData.cin || '',
      cnssStatus: matchCnss(employeeData.cnssRegistration || employeeData.cnssStatus || employeeData.cnss || employeeData.cnssRegistered),
      matricule: employeeData.matricule || employeeData.cnssNumber || '',
      address: employeeData.address || '',
      childrenCount: employeeData.childrenCount || 0,
      paymentStatus: employeeData.paymentStatus || 'Virement',
      seniority: employeeData.seniority || '0%',
      taxReduction: employeeData.taxReduction || 0,
      documents: employeeData.documents || [],
      allowances: employeeData.allowances || [],
    };
  }, [employeeData]);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    values: normalizedData,
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

  useEffect(() => {
    if (employeeData?.imageUrl) {
      setProfilePreview(employeeData.imageUrl);
    }
    if (normalizedData) {
      form.reset(normalizedData);
    }
  }, [employeeData, normalizedData, form]);

  const employeeStatus = form.watch('employeeStatus');
  const familySituation = form.watch('familySituation');
  const cnssStatus = form.watch('cnssStatus');

  useEffect(() => {
    if (employeeStatus === 'Seasonal' && latestHRSetting && !employeeData?.salaryNet && !employeeData?.salaryBrut) {
      form.setValue('salaryNet', latestHRSetting.netHourlyWage);
      form.setValue('salaryBrut', latestHRSetting.grossHourlyWage);
    } else if (employeeStatus !== 'Seasonal') {
      // Auto-set cnssStatus to Declared for fixed employees
      if (form.getValues('cnssStatus') !== 'Declared') {
        form.setValue('cnssStatus', 'Declared');
      }
    }
  }, [employeeStatus, latestHRSetting, form, employeeData]);

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
    if (!db || !unwrappedParams.id) return;
    setLoading(true);
    try {
      let imageUrl = employeeData?.imageUrl || '';
      
      if (profileImage) {
        imageUrl = await uploadFile(profileImage, 'employees/profiles');
      }

      const updatedData = {
        ...values,
        imageUrl,
        cnssNumber: values.matricule || '',
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'employees', unwrappedParams.id), updatedData);

      toast({
        title: "Employee Updated",
        description: `${values.firstName} ${values.lastName}'s profile has been updated.`,
      });
      router.push(`/hr/employees/${unwrappedParams.id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update employee.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  if (isLoadingEmployee) {
    return <div className="p-8 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin" /></div>;
  }

  const genderVal = form.watch('gender');
  const familySitVal = form.watch('familySituation');
  const empStatusVal = form.watch('employeeStatus');
  const shiftVal = form.watch('shift');
  const recordStatusVal = form.watch('status');
  const paymentModeVal = form.watch('paymentStatus');
  const cnssVal = form.watch('cnssStatus');
  const seniorityVal = form.watch('seniority');
  const locationVal = form.watch('locationId');

  console.log("DEBUG RENDER:", {
    employeeData,
    genderVal,
    shiftVal,
    cnssVal,
    locationVal,
    familySitVal,
    empStatusVal,
    recordStatusVal,
    paymentModeVal,
    seniorityVal
  });

  const standardGenders = ['male', 'female'];
  const standardFamilySits = ['Célibataire', 'Mariée', 'Divorcé(e)', 'Veuf / Veuve'];
  const standardEmpStatuses = ['Fixed CDD', 'Seasonal', 'Fixed CDI'];
  const standardShifts = ['Shift 1', 'Shift 2'];
  const standardRecordStatuses = ['active', 'inactive'];
  const standardPaymentModes = ['Virement', 'Espèce'];
  const standardCnssStatuses = ['Declared', 'Not Declared'];
  const standardSeniorityLevels = ['0%', '5%', '10%', '15%', '20%', '25%'];
  const standardAllowanceTypes = ['Meal Allowance', 'Transport Allowance', 'Performance Allowance', 'Prime de caisse'];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">Edit Employee</h1>
          <p className="text-sm text-muted-foreground">Update personnel and corporate details.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
        console.error("Form validation errors:", Object.keys(errors), errors);
        const firstErrorKey = Object.keys(errors)[0];
        const firstError = errors[firstErrorKey as keyof typeof errors];
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: firstError?.message?.toString() || `Field '${firstErrorKey}' is invalid.`
        });
      })} className="space-y-8">
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
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {ensureOption(genderOptions, field.value).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
              <Controller
                control={form.control}
                name="familySituation"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Situation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Célibataire">Célibataire</SelectItem>
                      <SelectItem value="Mariée">Mariée</SelectItem>
                      <SelectItem value="Divorcé(e)">Divorcé(e)</SelectItem>
                      <SelectItem value="Veuf / Veuve">Veuf / Veuve</SelectItem>
                      {field.value && !standardFamilySits.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {familySituation && familySituation !== 'Célibataire' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Number of Childrens</Label>
                <Input type="number" onWheel={handleWheel} {...form.register('childrenCount')} className="h-11 rounded-xl bg-muted/30" />
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
              <Controller
                control={form.control}
                name="employeeStatus"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fixed CDD">Fixed CDD</SelectItem>
                      <SelectItem value="Seasonal">Seasonal</SelectItem>
                      <SelectItem value="Fixed CDI">Fixed CDI</SelectItem>
                      {field.value && !standardEmpStatuses.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Processing Line / Location</Label>
              <Controller
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Select processing line" />
                    </SelectTrigger>
                    <SelectContent>
                      {processingLines?.map((line: any) => (
                        <SelectItem key={line.id} value={line.id}>{line.title || line.name || line.lineName || line.id}</SelectItem>
                      ))}
                      {field.value && field.value !== 'none' && (!processingLines || !processingLines.find((l:any) => l.id === field.value)) && (
                        <SelectItem value={field.value}>{employeeData?.locationName || field.value}</SelectItem>
                      )}
                      {!processingLines?.length && !field.value && <SelectItem value="none" disabled>No lines defined</SelectItem>}
                    </SelectContent>
                  </Select>
                )}
              />
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
                  <Controller
                    control={form.control}
                    name="shift"
                    render={({ field }) => (
                      <Select 
                        onValueChange={(val) => {
                          if (val) field.onChange(val);
                        }} 
                        value={field.value || ''}
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent>
                          {ensureOption(shiftOptions, field.value, true).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Record Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      {field.value && !standardRecordStatuses.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
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
              <Input type="number" step="0.01" onWheel={handleWheel} {...form.register('salaryNet')} readOnly={employeeStatus === 'Seasonal'} className={`h-11 rounded-xl ${employeeStatus === 'Seasonal' ? 'bg-muted/60 opacity-70 cursor-not-allowed' : 'bg-muted/30'}`} />
            </div>
            <div className="space-y-2">
              <Label>Salary Brut (DH)</Label>
              <Input type="number" step="0.01" onWheel={handleWheel} {...form.register('salaryBrut')} readOnly={employeeStatus === 'Seasonal'} className={`h-11 rounded-xl ${employeeStatus === 'Seasonal' ? 'bg-muted/60 opacity-70 cursor-not-allowed' : 'bg-muted/30'}`} />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Controller
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Virement">Virement</SelectItem>
                      <SelectItem value="Espèce">Espèce</SelectItem>
                      {field.value && !standardPaymentModes.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
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
              <Controller
                control={form.control}
                name="cnssStatus"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {ensureOption(cnssOptions, field.value).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
              <Controller
                control={form.control}
                name="seniority"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }} 
                    value={field.value || ''}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                      <SelectValue placeholder="%" />
                    </SelectTrigger>
                    <SelectContent>
                      {standardSeniorityLevels.map(val => (
                        <SelectItem key={val} value={val}>{val}</SelectItem>
                      ))}
                      {field.value && !standardSeniorityLevels.includes(field.value) && (
                        <SelectItem value={field.value}>{field.value}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
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
                    <div className="flex gap-2 items-center">
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
                      {form.watch(`documents.${index}.fileUrl`) && (
                        <a href={form.watch(`documents.${index}.fileUrl`)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline">
                          View
                        </a>
                      )}
                    </div>
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
              {allowanceFields.map((field, index) => {
                const allowanceTypeVal = form.watch(`allowances.${index}.type`);
                return (
                  <div key={field.id} className="flex gap-2 items-end animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] font-bold">Type</Label>
                      <Select onValueChange={(val) => form.setValue(`allowances.${index}.type`, val)} value={allowanceTypeVal || ''}>
                        <SelectTrigger className="h-10 rounded-lg bg-muted/20">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Meal Allowance">Meal Allowance</SelectItem>
                          <SelectItem value="Transport Allowance">Transport Allowance</SelectItem>
                          <SelectItem value="Performance Allowance">Performance Allowance</SelectItem>
                          <SelectItem value="Prime de caisse">Prime de caisse</SelectItem>
                          {allowanceTypeVal && !standardAllowanceTypes.includes(allowanceTypeVal) && (
                            <SelectItem value={allowanceTypeVal}>{allowanceTypeVal}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] font-bold">Amount (DH)</Label>
                      <Input type="number" onWheel={handleWheel} {...form.register(`allowances.${index}.amount`)} placeholder="0.00" className="h-10 rounded-lg bg-muted/20" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAllowance(index)} className="text-destructive h-10 w-10">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                );
              })}
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
            {loading ? 'Saving Changes...' : 'Update Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
