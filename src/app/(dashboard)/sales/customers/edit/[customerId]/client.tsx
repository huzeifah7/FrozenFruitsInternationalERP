'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  doc, 
  collection, 
  updateDoc, 
  serverTimestamp,
  query,
  where,
  addDoc,
  deleteDoc
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
  useUser,
  errorEmitter,
  FirestorePermissionError
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FieldError } from '@/components/ui/field-error';
import { sanitizeForFirestore } from '@/lib/utils';

function FullObjectSelect({ options, value, onChange, placeholder, error }: any) {
  return (
    <SearchableSelect
      value={value?.value || ''}
      onValueChange={(val: string) => {
        onChange(options.find((o: any) => o.value === val) || null);
      }}
      options={options}
      placeholder={placeholder}
      triggerClassName={`h-11 rounded-xl bg-muted/30 border-none font-medium text-primary focus:ring-2 focus:ring-primary/10 w-full ${error ? 'ring-2 ring-destructive' : ''}`}
    />
  );
}

import { ALL_COUNTRIES } from '@/lib/constants';

let cachedCountries: string[] | null = null;

const DEFAULT_COUNTRIES = ALL_COUNTRIES;

const CURRENCIES = ['DH', 'USD', 'EUR', 'GBP'].map(c => ({ label: c, value: c }));

const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map(i => ({ label: i, value: i }));
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Building2, 
  MapPin, 
  Users, 
  FileText, 
  Briefcase, 
  ChevronLeft,
  Loader2,
  ShieldCheck,
  Globe,
  Factory
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const customerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  email: z.string().optional().nullable().or(z.literal('')).transform(val => val || '').refine(val => {
    if (!val || !val.trim()) return true;
    return z.string().email().safeParse(val.trim()).success;
  }, "Invalid email format"),
  phone: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  website: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  currency: z.string().default('EUR'),
  incoterm: z.string().default('DAP'),
  paymentTermsId: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  vat: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  
  addresses: z.array(z.object({
    type: z.enum(['Billing', 'Shipping']),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    street: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    country: z.string().default('')
  })).default([]),

  brokers: z.array(z.object({
    name: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    coCode: z.string().optional().nullable(),
    phytoType: z.string().optional().nullable(),
    address: z.string().optional().nullable()
  })).default([]),

  contacts: z.array(z.object({
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    function: z.string().optional().nullable()
  })).default([]),

  documents: z.array(z.object({
    fileName: z.string().optional().nullable(),
    fileType: z.string().optional().nullable(),
    fileUrl: z.any().optional().nullable()
  })).default([]),

  farms: z.array(z.object({
    farmId: z.string().optional().nullable(),
    ggnNumber: z.string().optional().nullable(),
    farmSize: z.union([z.string(), z.number()]).optional().nullable(),
    estimatedCrops: z.union([z.string(), z.number()]).optional().nullable()
  })).default([]),

  processingLines: z.array(z.object({
    locationId: z.string().optional().nullable(),
    gpsLocation: z.string().optional().nullable(),
    description: z.string().optional().nullable()
  })).default([]),

  users: z.array(z.object({
    id: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    function: z.string().optional().nullable(),
    userType: z.string().optional().nullable(),
    active: z.boolean().default(true)
  })).default([])
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function EditCustomerPage() {
  const router = useRouter();
  const { customerId } = useParams();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>(DEFAULT_COUNTRIES);

  useEffect(() => {
    if (cachedCountries) {
      setCountries(cachedCountries);
      return;
    }
    fetch('https://restcountries.com/v3.1/all?fields=name')
      .then(res => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          const names = data
            .map((c: any) => c.name?.common)
            .filter(Boolean)
            .sort();
          cachedCountries = names;
          setCountries(names);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch countries, using fallback list', err);
      });
  }, []);

  // Data Fetching
  const customerRef = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return doc(db, 'customers', customerId as string);
  }, [db, customerId]);

  const { data: customer, isLoading: isCustomerLoading } = useDoc(customerRef);

  const portalUsersQuery = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'customer_portal_users'), where('customer_id', '==', customerId));
  }, [db, customerId]);

  const { data: portalUsers } = useCollection(portalUsersQuery);

  const paymentTermsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'payment_terms');
  }, [db, user]);

  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);

  const farmsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'main_farms');
  }, [db, user]);

  const { data: paymentTerms, isLoading: isPaymentTermsLoading } = useCollection(paymentTermsQuery);
  const { data: locations } = useCollection(locationsQuery);
  const { data: farmList } = useCollection(farmsQuery);

  const normalizedData = React.useMemo(() => {
    if (!customer) return undefined;
    return {
      companyName: customer.companyName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      website: customer.website || '',
      currency: customer.currency || 'EUR',
      incoterm: customer.incoterm || 'DAP',
      paymentTermsId: (customer.payment_term_id !== undefined && customer.payment_term_id !== null) ? String(customer.payment_term_id) :
                      (customer.paymentTermsId !== undefined && customer.paymentTermsId !== null) ? String(customer.paymentTermsId) :
                      (customer.paymentTermId !== undefined && customer.paymentTermId !== null) ? String(customer.paymentTermId) :
                      (customer.paymentTerms !== undefined && customer.paymentTerms !== null) ? String(customer.paymentTerms) :
                      (customer.payment_terms !== undefined && customer.payment_terms !== null) ? String(customer.payment_terms) : '',
      vat: customer.vat || '',
      logoUrl: customer.logoUrl || '',
      addresses: (customer.addresses || []).map((a: any) => ({
        type: a.type || 'Billing',
        name: a.name || '',
        email: a.email || '',
        phone: a.phone || '',
        street: a.street || '',
        city: a.city || '',
        zipCode: a.zipCode || '',
        country: a.country || ''
      })),
      brokers: (customer.brokers || []).map((b: any) => ({
        name: b.name || '',
        phone: b.phone || '',
        email: b.email || '',
        coCode: b.coCode || '',
        phytoType: b.phytoType || '',
        address: b.address || ''
      })),
      contacts: (customer.contacts || []).map((c: any) => ({
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email || '',
        phone: c.phone || '',
        function: c.function || ''
      })),
      documents: (customer.documents || []).map((d: any) => ({
        fileName: d.fileName || '',
        fileType: d.fileType || '',
        fileUrl: d.fileUrl || ''
      })),
      farms: (customer.farms || []).map((f: any) => ({
        farmId: f.farmId || '',
        ggnNumber: f.ggnNumber || '',
        farmSize: f.farmSize || '',
        estimatedCrops: f.estimatedCrops || ''
      })),
      processingLines: (customer.processingLines || []).map((l: any) => ({
        locationId: l.locationId || '',
        gpsLocation: l.gpsLocation || '',
        description: l.description || ''
      })),
      users: (portalUsers || []).map((u: any) => ({
        id: u.id,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        email: u.email || '',
        password: '',
        function: u.function || '',
        userType: u.user_type || 'Standard',
        active: u.active !== false
      }))
    };
  }, [customer, portalUsers]);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    values: normalizedData, // Acts as enableReinitialize=true
    defaultValues: {
      currency: 'EUR',
      incoterm: 'DAP',
      addresses: [],
      brokers: [],
      contacts: [],
      documents: [],
      farms: [],
      processingLines: [],
      users: []
    }
  });

  // Sync form with customer data
  useEffect(() => {
    if (customer) {
      if (customer.logoUrl) setLogoPreview(customer.logoUrl);
    }
  }, [customer]);

  const paymentTermsOptions = React.useMemo(() => {
    return paymentTerms?.map(t => ({
      value: String(t.id),
      label: String(t.name || t.label || t.title)
    })) || [];
  }, [paymentTerms]);

  const { fields: addressFields, append: appendAddress, remove: removeAddress } = useFieldArray({ control: form.control, name: 'addresses' });
  const { fields: brokerFields, append: appendBroker, remove: removeBroker } = useFieldArray({ control: form.control, name: 'brokers' });
  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({ control: form.control, name: 'contacts' });
  const { fields: documentFields, append: appendDocument, remove: removeDocument } = useFieldArray({ control: form.control, name: 'documents' });
  const { fields: farmFields, append: appendFarm, remove: removeFarm } = useFieldArray({ control: form.control, name: 'farms' });
  const { fields: lineFields, append: appendLine, remove: removeLine } = useFieldArray({ control: form.control, name: 'processingLines' });
  const { fields: userFields, append: appendUser, remove: removeUser } = useFieldArray({ control: form.control, name: 'users' });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const hashPasswordSHA256 = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const onSubmit = async (values: CustomerFormValues) => {
    if (!db || !customerRef) return;
    setSaving(true);
    
    try {
      let finalLogoUrl = values.logoUrl || '';
      if (logoFile) {
        finalLogoUrl = await uploadFile(logoFile, 'customers/logos');
      }

      // Process new document uploads
      const processedDocuments = await Promise.all(
        (values.documents || []).map(async (docItem) => {
          if (docItem.fileUrl && (docItem.fileUrl as any) instanceof File) {
            const url = await uploadFile(docItem.fileUrl as any, 'customers/documents');
            return { ...docItem, fileUrl: url };
          }
          return docItem;
        })
      );

      const rawUpdateData = {
        companyName: values.companyName,
        email: values.email,
        phone: values.phone,
        website: values.website || '',
        currency: values.currency || 'EUR',
        incoterm: values.incoterm || 'FOB',
        vat: values.vat || '',
        addresses: values.addresses || [],
        brokers: values.brokers || [],
        contacts: values.contacts || [],
        farms: values.farms || [],
        processingLines: values.processingLines || [],
        paymentTermsId: values.paymentTermsId || '',
        payment_term_id: values.paymentTermsId || '',
        payment_term_name: paymentTerms?.find(t => t.id === values.paymentTermsId)?.name || '',
        logoUrl: finalLogoUrl,
        documents: processedDocuments || [],
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown'
      };

      const updateData = sanitizeForFirestore(rawUpdateData);
      await updateDoc(customerRef, updateData);

      const existingPortalUsers = portalUsers || [];
      const incomingUsers = values.users || [];
      const incomingIds = incomingUsers.map(u => u.id).filter(Boolean);

      // Delete removed users
      for (const dbUser of existingPortalUsers) {
        if (!incomingIds.includes(dbUser.id)) {
          await deleteDoc(doc(db, 'customer_portal_users', dbUser.id));
        }
      }

      // Add or Update incoming users
      for (const u of incomingUsers) {
        if (u.firstName && u.lastName && u.email) {
          const rawUserData: any = {
            customer_id: customerId,
            first_name: u.firstName,
            last_name: u.lastName,
            email: u.email.toLowerCase().trim(),
            function: u.function || '',
            user_type: u.userType || 'Standard',
            active: u.active !== false,
            updated_by: user?.email || 'unknown',
            updatedAt: serverTimestamp()
          };

          if (u.password && u.password.trim() !== '') {
            rawUserData.password = await hashPasswordSHA256(u.password);
          }

          const userData = sanitizeForFirestore(rawUserData);

          if (u.id) {
            await updateDoc(doc(db, 'customer_portal_users', u.id), userData);
          } else {
            if (u.password && u.password.trim() !== '') {
              userData.created_by = user?.email || 'unknown';
              userData.createdAt = serverTimestamp();
              await addDoc(collection(db, 'customer_portal_users'), userData);
            }
          }
        }
      }

      toast({
        title: "Profile Updated",
        description: `${values.companyName} records have been successfully synchronized.`,
      });
      router.push('/sales/customers');

    } catch (error: any) {
      console.error("Error updating customer:", error);
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: customerRef.path,
          operation: 'update',
          requestResourceData: values
        }));
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: error?.message || "An error occurred during update process.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (isCustomerLoading || isPaymentTermsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold animate-pulse uppercase tracking-widest">Synchronizing customer data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/sales/customers')} className="rounded-full hover:bg-primary/10">
          <ChevronLeft className="h-5 w-5 text-primary" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">Edit Customer Profile</h1>
          <p className="text-sm text-muted-foreground font-medium">Modifying record for <span className="text-primary font-bold">{customer?.companyName}</span></p>
        </div>
      </div>

      <form 
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Detailed Form validation errors:", JSON.stringify(errors, null, 2));
          console.log("Current form values:", form.getValues());
          const errorPaths = Object.keys(errors);
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: errorPaths.length > 0 
              ? `Required fields missing in: ${errorPaths.join(', ')}` 
              : "Please check all required fields in the form sections.",
          });
        })} 
        className="space-y-8"
      >
        {/* Logo Upload */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-xl group-hover:border-primary/40 transition-all">
              <AvatarImage src={logoPreview || ''} />
              <AvatarFallback className="bg-muted text-muted-foreground">
                <Building2 size={48} />
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
              <Upload size={16} />
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
            </label>
          </div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Update Logo</span>
        </div>

        {/* Company Info */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Building2 size={14} /> Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Company Name</Label>
                <Input {...form.register('companyName')} error={!!form.formState.errors.companyName} className="h-11 rounded-xl bg-muted/30 border-none font-medium" />
                <FieldError message={form.formState.errors.companyName?.message} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Company Email</Label>
                <Input {...form.register('email')} type="email" error={!!form.formState.errors.email} className="h-11 rounded-xl bg-muted/30 border-none font-medium" />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Currency</Label>
                  <SearchableSelect
                    value={form.watch('currency') || 'EUR'}
                    onValueChange={(val) => form.setValue('currency', val, { shouldValidate: true })}
                    options={CURRENCIES}
                    placeholder="Select"
                    triggerClassName="h-11 rounded-xl bg-muted/30 border-none font-medium text-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Payment Terms</Label>
                  <FullObjectSelect
                    options={paymentTermsOptions}
                    value={paymentTermsOptions.find((opt: any) => String(opt.value) === String(form.watch('paymentTermsId'))) || null}
                    onChange={(selected: any) => form.setValue('paymentTermsId', selected ? selected.value : '', { shouldValidate: true })}
                    placeholder="Select terms"
                    error={!!form.formState.errors.paymentTermsId}
                  />
                  <FieldError message={form.formState.errors.paymentTermsId?.message} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Company Phone</Label>
                <Input {...form.register('phone')} error={!!form.formState.errors.phone} className="h-11 rounded-xl bg-muted/30 border-none font-medium" />
                <FieldError message={form.formState.errors.phone?.message} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Company Website</Label>
                <Input {...form.register('website')} className="h-11 rounded-xl bg-muted/30 border-none font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Incoterm</Label>
                  <Select 
                    onValueChange={(val) => form.setValue('incoterm', val, { shouldValidate: true })} 
                    value={form.watch('incoterm') || 'FOB'}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium text-primary focus:ring-2 focus:ring-primary/10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCOTERMS.map(i => (
                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">VAT Number</Label>
                  <Input {...form.register('vat')} className="h-11 rounded-xl bg-muted/30 border-none font-medium" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Addresses */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <MapPin size={14} /> Registered Addresses
            </CardTitle>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => appendAddress({ type: 'Billing', name: '', email: '', phone: '', street: '', city: '', zipCode: '', country: '' })}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 h-9 font-bold"
            >
              <Plus size={14} /> ADD ROW
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-muted/50">
                    {['Address Type', 'Name', 'Email', 'Phone', 'Street', 'City', 'Zip', 'Country', ''].map(h => (
                      <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {addressFields.map((field, index) => (
                    <tr key={field.id} className="group hover:bg-muted/5 transition-colors">
                      <td className="p-2 min-w-[120px]">
                        <Select onValueChange={(val) => form.setValue(`addresses.${index}.type`, val as any)} defaultValue={field.type}>
                          <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none shadow-none"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Billing">Billing</SelectItem><SelectItem value="Shipping">Shipping</SelectItem></SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input {...form.register(`addresses.${index}.name`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`addresses.${index}.email`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`addresses.${index}.phone`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`addresses.${index}.street`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`addresses.${index}.city`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`addresses.${index}.zipCode`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2 min-w-[150px]">
                        <SearchableSelect
                          value={form.watch(`addresses.${index}.country`)}
                          onValueChange={(val) => form.setValue(`addresses.${index}.country`, val)}
                          options={countries.map(c => ({ label: c, value: c }))}
                          placeholder="Select"
                          triggerClassName="h-9 rounded-lg bg-muted/20 border-none shadow-none font-medium text-primary w-full focus:ring-2 focus:ring-primary/10"
                        />
                      </td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => removeAddress(index)} className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Brokers */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Briefcase size={14} /> Customs Brokers
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => appendBroker({ name: '', phone: '', email: '', coCode: '', phytoType: 'Transit', address: '' })} className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 font-bold h-9">
              <Plus size={14} /> ADD ROW
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-muted/50">
                    {['Name', 'Phone', 'Email', 'CO Code', 'Phyto', 'Address', ''].map(h => (
                      <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {brokerFields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="p-2"><Input {...form.register(`brokers.${index}.name`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`brokers.${index}.phone`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`brokers.${index}.email`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`brokers.${index}.coCode`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2 min-w-[120px]">
                        <Select onValueChange={(val) => form.setValue(`brokers.${index}.phytoType`, val)} defaultValue={field.phytoType || 'Transit'}>
                          <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none shadow-none"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent><SelectItem value="Transit">Transit</SelectItem><SelectItem value="Final">Final</SelectItem></SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input {...form.register(`brokers.${index}.address`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => removeBroker(index)} className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Users size={14} /> Contacts
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => appendContact({ firstName: '', lastName: '', email: '', phone: '', function: '' })} className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 font-bold h-9">
              <Plus size={14} /> ADD ROW
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-muted/50">
                    {['First Name', 'Last Name', 'Email', 'Phone', 'Function', ''].map(h => (
                      <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {contactFields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="p-2"><Input {...form.register(`contacts.${index}.firstName`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`contacts.${index}.lastName`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`contacts.${index}.email`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`contacts.${index}.phone`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`contacts.${index}.function`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => removeContact(index)} className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <FileText size={14} /> Contract documents
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => appendDocument({ fileName: '', fileType: 'Contract', fileUrl: '' })} className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 font-bold h-9">
              <Plus size={14} /> ADD ROW
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-muted/50">
                    {['Upload New', 'File Name', 'File Type', 'Current Link', ''].map(h => (
                      <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {documentFields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="p-2 w-[250px]">
                        <Input 
                          type="file" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) form.setValue(`documents.${index}.fileUrl`, file as any);
                          }}
                          className="h-9 rounded-lg bg-muted/20 border-none file:text-[10px] file:font-bold file:uppercase file:bg-primary/10 file:text-primary file:border-none file:rounded-md file:px-3 file:mr-3" 
                        />
                      </td>
                      <td className="p-2"><Input {...form.register(`documents.${index}.fileName`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2 min-w-[150px]">
                        <Select onValueChange={(val) => form.setValue(`documents.${index}.fileType`, val)} defaultValue={field.fileType || 'Contract'}>
                          <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none shadow-none"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Contract">Contract</SelectItem>
                            <SelectItem value="Certification">Certification</SelectItem>
                            <SelectItem value="Legal Doc">Legal Doc</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        {typeof field.fileUrl === 'string' && field.fileUrl ? (
                          <a href={field.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary underline truncate max-w-[100px] block hover:text-primary/80 transition-colors">
                            VIEW FILE
                          </a>
                        ) : <span className="text-[10px] opacity-30 italic">No File</span>}
                      </td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => removeDocument(index)} className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Released Farms */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <ShieldCheck size={14} /> Add Released Farms
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => appendFarm({ farmId: '', ggnNumber: '', farmSize: '', estimatedCrops: '' })} className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 font-bold h-9">
              <Plus size={14} /> ADD ROW
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-muted/50">
                    {['Select Farm', 'GGN Number', 'Farm Size', 'Est. Crops', ''].map(h => (
                      <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {farmFields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="p-2 min-w-[200px]">
                        <Select 
                          onValueChange={(val) => {
                            form.setValue(`farms.${index}.farmId`, val);
                            const selectedFarm = farmList?.find(f => f.id === val);
                            if (selectedFarm) {
                              form.setValue(`farms.${index}.ggnNumber`, selectedFarm.ggnNumber || '');
                              form.setValue(`farms.${index}.farmSize`, selectedFarm.farmSize?.toString() || '');
                              form.setValue(`farms.${index}.estimatedCrops`, selectedFarm.estimatedCrops?.toString() || '');
                            }
                          }} 
                          defaultValue={field.farmId || ''}
                        >
                          <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none shadow-none"><SelectValue placeholder="Select farm" /></SelectTrigger>
                          <SelectContent>
                            {farmList?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input {...form.register(`farms.${index}.ggnNumber`)} className="h-9 rounded-lg bg-muted/20 border-none opacity-60 cursor-not-allowed" disabled /></td>
                      <td className="p-2"><Input {...form.register(`farms.${index}.farmSize`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2"><Input {...form.register(`farms.${index}.estimatedCrops`)} className="h-9 rounded-lg bg-muted/20 border-none" /></td>
                      <td className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => removeFarm(index)} className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Processing Lines */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Factory size={14} /> Add Processing Lines
            </CardTitle>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const defaultLine = locations?.find((l: any) => 
                  (l.title || l.name || '').toLowerCase().includes('export optimum')
                );
                appendLine({ 
                  locationId: defaultLine?.id || '', 
                  gpsLocation: defaultLine?.gpsLocation || '', 
                  description: defaultLine?.description || '' 
                });
              }} 
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 font-bold h-9"
            >
              <Plus size={14} /> ADD ROW
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-muted/50">
                    {['Select Location', 'GPS Location', 'Description', ''].map(h => (
                      <th key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {lineFields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="p-2 min-w-[200px]">
                        <Select 
                          onValueChange={(val) => {
                            form.setValue(`processingLines.${index}.locationId`, val);
                            const selectedLine = locations?.find(l => l.id === val);
                            if (selectedLine) {
                              form.setValue(`processingLines.${index}.gpsLocation`, selectedLine.gpsLocation || '');
                              form.setValue(`processingLines.${index}.description`, selectedLine.description || '');
                            }
                          }} 
                          defaultValue={field.locationId || ''}
                        >
                          <SelectTrigger className="h-9 rounded-lg bg-muted/20 border-none shadow-none"><SelectValue placeholder="Select facility" /></SelectTrigger>
                          <SelectContent>
                            {locations?.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input {...form.register(`processingLines.${index}.gpsLocation`)} readOnly className="h-9 rounded-lg bg-muted/20 border-none opacity-60 cursor-not-allowed" /></td>
                      <td className="p-2"><Input {...form.register(`processingLines.${index}.description`)} readOnly className="h-9 rounded-lg bg-muted/20 border-none opacity-60 cursor-not-allowed" /></td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" onClick={() => removeLine(index)} className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lineFields.length === 0 && <div className="py-12 text-center text-xs text-muted-foreground italic font-medium opacity-50">No processing lines defined yet.</div>}
            </div>
          </CardContent>
        </Card>

        {/* Customer Portal Access */}
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <ShieldCheck size={14} /> Customer Portal Access
            </CardTitle>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => appendUser({ firstName: '', lastName: '', email: '', password: '', function: '', userType: 'Standard', active: true })}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 h-9 font-bold"
            >
              <Plus size={14} /> ADD PORTAL USER
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {userFields.map((field, index) => (
                <div key={field.id} className="relative p-6 rounded-2xl border border-muted/80 bg-muted/10 space-y-4 shadow-sm hover:border-primary/20 transition-all">
                  <div className="absolute top-4 right-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeUser(index)} 
                      className="h-8 w-8 text-rose-500 rounded-full hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-primary" />
                    <span className="text-xs font-black text-primary uppercase tracking-wider">Portal User #{index + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">First Name</Label>
                      <Input {...form.register(`users.${index}.firstName`)} placeholder="John" className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Last Name</Label>
                      <Input {...form.register(`users.${index}.lastName`)} placeholder="Doe" className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</Label>
                      <Input {...form.register(`users.${index}.email`)} placeholder="user@company.com" className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Password (optional)</Label>
                      <Input type="password" {...form.register(`users.${index}.password`)} placeholder="Leave blank to keep current" className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Function</Label>
                      <Input {...form.register(`users.${index}.function`)} placeholder="Manager" className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold" />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User Type</Label>
                      <Select 
                        onValueChange={(val) => form.setValue(`users.${index}.userType`, val)} 
                        defaultValue={form.watch(`users.${index}.userType`) || 'Standard'}
                      >
                        <SelectTrigger className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Administrator">Administrator</SelectItem>
                          <SelectItem value="Standard">Standard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                      <Select 
                        onValueChange={(val) => form.setValue(`users.${index}.active`, val === 'Active')} 
                        defaultValue={form.watch(`users.${index}.active`) === false ? 'Inactive' : 'Active'}
                      >
                        <SelectTrigger className="h-9 rounded-lg bg-white border-muted/50 text-sm font-semibold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {userFields.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground italic font-medium opacity-50">
                No portal users configured. This customer won't be able to log in.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex justify-end pt-8 pb-12 gap-4">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.push('/sales/customers')}
            className="h-14 px-8 font-bold text-muted-foreground uppercase tracking-widest hover:bg-muted/50 transition-all rounded-xl"
          >
            Discard Changes
          </Button>
          <Button 
            type="submit" 
            disabled={saving}
            className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest min-w-[240px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Synchronizing...
              </>
            ) : 'Save Modifications'}
          </Button>
        </div>
      </form>
    </div>
  );
}
