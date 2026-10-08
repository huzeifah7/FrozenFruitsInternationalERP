'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp } from '@/firebase/firestore-override';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  useFirestore, 
  useStorage, 
  useCollection, 
  useMemoFirebase,
  useUser 
} from '@/firebase';

import { 
  SelectInput, 
  InputField, 
  FormCard, 
  MinimalAddButton, 
  MinimalDeleteButton, 
  LogoAvatarUpload,
  SelectOption
} from '@/components/customers/add-customer-components';
import { ALL_COUNTRIES } from '@/lib/constants';
import { sanitizeForFirestore } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Users, 
  FileText, 
  ShieldCheck, 
  Factory,
  ChevronRight,
  Upload
} from 'lucide-react';

const CURRENCIES: SelectOption[] = [
  { label: 'DH', value: 'DH' },
  { label: 'USD', value: 'USD' },
  { label: 'EUR', value: 'EUR' },
  { label: 'GBP', value: 'GBP' }
];

const INCOTERMS: SelectOption[] = [
  { label: 'EXW', value: 'EXW' },
  { label: 'FCA', value: 'FCA' },
  { label: 'CPT', value: 'CPT' },
  { label: 'CIP', value: 'CIP' },
  { label: 'DAP', value: 'DAP' },
  { label: 'DPU', value: 'DPU' },
  { label: 'DDP', value: 'DDP' },
  { label: 'FAS', value: 'FAS' },
  { label: 'FOB', value: 'FOB' },
  { label: 'CFR', value: 'CFR' },
  { label: 'CIF', value: 'CIF' }
];

const ADDRESS_TYPES: SelectOption[] = [
  { label: 'Billing', value: 'Billing' },
  { label: 'Shipping', value: 'Shipping' }
];

const PHYTO_TYPES: SelectOption[] = [
  { label: 'Transit', value: 'Transit' },
  { label: 'Final', value: 'Final' }
];

const FILE_TYPES: SelectOption[] = [
  { label: 'Contract', value: 'Contract' },
  { label: 'Certification', value: 'Certification' },
  { label: 'Legal Doc', value: 'Legal Doc' },
  { label: 'Quality Certificate', value: 'Quality Certificate' },
  { label: 'Other', value: 'Other' }
];

const USER_TYPES: SelectOption[] = [
  { label: 'Administrator', value: 'Administrator' },
  { label: 'Standard', value: 'Standard' },
  { label: 'Guest', value: 'Guest' }
];

const customerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  email: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  phone: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  website: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  currency: z.string().default('EUR'),
  incoterm: z.string().default('DAP'),
  paymentTermsId: z.string().optional().nullable().or(z.literal('')).transform(val => val || ''),
  vat: z.string().optional().nullable(),
  addresses: z.array(z.object({
    type: z.string().default('Billing'),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().default('')
  })).default([]),
  brokers: z.array(z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    coCode: z.string().optional(),
    phytoType: z.string().optional(),
    address: z.string().optional()
  })).default([]),
  contacts: z.array(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    function: z.string().optional()
  })).default([]),
  documents: z.array(z.object({
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    fileUrl: z.any().optional()
  })).default([]),
  farms: z.array(z.object({
    farmId: z.string().optional(),
    ggnNumber: z.string().optional(),
    farmSize: z.string().optional(),
    estimatedCrops: z.string().optional()
  })).default([]),
  processingLines: z.array(z.object({
    locationId: z.string().optional(),
    gpsLocation: z.string().optional(),
    description: z.string().optional()
  })).default([]),
  users: z.array(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    function: z.string().optional(),
    userType: z.string().optional()
  })).default([])
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function AddCustomerPage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const paymentTermsQuery = useMemoFirebase(() => db && user ? collection(db, 'payment_terms') : null, [db, user]);
  const locationsQuery = useMemoFirebase(() => db && user ? collection(db, 'processing_lines') : null, [db, user]);
  const farmsQuery = useMemoFirebase(() => db && user ? collection(db, 'main_farms') : null, [db, user]);

  const { data: paymentTerms } = useCollection(paymentTermsQuery);
  const { data: locations } = useCollection(locationsQuery);
  const { data: farmList } = useCollection(farmsQuery);

  const paymentTermsOptions: SelectOption[] = paymentTerms?.length
    ? paymentTerms.map((t) => ({ label: t.name || t.label || t.title, value: String(t.id) }))
    : [
        { label: '30 Days Net', value: '30_days_net' },
        { label: '60 Days Net', value: '60_days_net' },
        { label: 'Cash in Advance', value: 'cash_in_advance' },
        { label: 'LC at Sight', value: 'lc_at_sight' }
      ];

  const farmOptions: SelectOption[] = farmList?.length
    ? farmList.map((f) => ({ label: f.name || f.farmName, value: String(f.id) }))
    : [
        { label: 'Farm Alfa - Agadir', value: 'farm_alfa' },
        { label: 'Farm Beta - Taroudant', value: 'farm_beta' },
        { label: 'Farm Gamma - Dakhla', value: 'farm_gamma' }
      ];

  const locationOptions: SelectOption[] = locations?.length
    ? locations.map((l) => ({ label: l.title || l.name, value: String(l.id) }))
    : [
        { label: 'Export Optimum Main Station', value: 'line_optimum_main' },
        { label: 'Station 1 - Citrus Line', value: 'line_citrus' }
      ];

  const countryOptions: SelectOption[] = ALL_COUNTRIES.map(c => ({ label: c, value: c }));

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      currency: 'EUR',
      incoterm: 'DAP',
      email: '',
      phone: '',
      website: '',
      vat: '',
      addresses: [],
      brokers: [],
      contacts: [],
      documents: [],
      farms: [],
      processingLines: [],
      users: []
    }
  });

  const { fields: addressFields, append: appendAddress, remove: removeAddress } = useFieldArray({ control: form.control, name: 'addresses' });
  const { fields: brokerFields, append: appendBroker, remove: removeBroker } = useFieldArray({ control: form.control, name: 'brokers' });
  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({ control: form.control, name: 'contacts' });
  const { fields: documentFields, append: appendDocument, remove: removeDocument } = useFieldArray({ control: form.control, name: 'documents' });
  const { fields: farmFields, append: appendFarm, remove: removeFarm } = useFieldArray({ control: form.control, name: 'farms' });
  const { fields: lineFields, append: appendLine, remove: removeLine } = useFieldArray({ control: form.control, name: 'processingLines' });
  const { fields: userFields, append: appendUser, remove: removeUser } = useFieldArray({ control: form.control, name: 'users' });

  const handleLogoSelect = (file: File) => {
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadFile = async (file: File, path: string) => {
    if (!storage) return '';
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const onSubmit = async (values: CustomerFormValues) => {
    setLoading(true);
    try {
      let logoUrl = '';
      if (logoFile && storage) {
        logoUrl = await uploadFile(logoFile, 'customers/logos');
      }

      if (db) {
        const rawCustomerData = {
          ...values,
          logoUrl,
          createdAt: serverTimestamp(),
          createdBy: user?.email || 'admin',
          updatedAt: serverTimestamp()
        };
        const customerData = sanitizeForFirestore(rawCustomerData);
        await addDoc(collection(db, 'customers'), customerData);
      }

      toast({
        title: "Customer Created",
        description: `${values.companyName} has been successfully registered.`,
      });
      router.push('/sales/customers');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error?.message || "Failed to process customer creation.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
      {/* Sleek Breadcrumb Header */}
      <div className="flex items-center text-xs text-slate-400 gap-2 mb-6 font-medium">
        <span>Profile</span>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span>Customers</span>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="text-slate-800 font-semibold">Add Customer</span>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-[1400px] mx-auto pb-20">
        
        {/* SECTION 1: Company Info */}
        <FormCard title="Company Info" icon={<Building2 className="w-5 h-5 stroke-[1.75]" />}>
          <LogoAvatarUpload previewUrl={logoPreview} onFileSelect={handleLogoSelect} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-2">
            <div className="space-y-5">
              <InputField
                label="Company Name"
                placeholder="Enter company name"
                {...form.register('companyName')}
                error={form.formState.errors.companyName?.message}
              />
              <InputField
                label="Company Email"
                type="email"
                placeholder="contact@company.com"
                {...form.register('email')}
              />
              <SelectInput
                label="Select Currency"
                value={form.watch('currency')}
                onChange={(val) => form.setValue('currency', val)}
                options={CURRENCIES}
              />
              <SelectInput
                label="Payment Terms"
                value={form.watch('paymentTermsId') || ''}
                onChange={(val) => form.setValue('paymentTermsId', val)}
                options={paymentTermsOptions}
              />
            </div>

            <div className="space-y-5">
              <InputField
                label="Company Phone"
                placeholder="+212 ..."
                {...form.register('phone')}
              />
              <InputField
                label="Company Website"
                placeholder="https://company.com"
                {...form.register('website')}
              />
              <SelectInput
                label="Incoterm"
                value={form.watch('incoterm')}
                onChange={(val) => form.setValue('incoterm', val)}
                options={INCOTERMS}
              />
              <InputField
                label="VAT"
                placeholder="Tax ID"
                {...form.register('vat')}
              />
            </div>
          </div>
        </FormCard>

        {/* SECTION 2: Add Address */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Address</h2>
            </div>
            <MinimalAddButton 
              label="Add Address" 
              onClick={() => appendAddress({ type: 'Billing', name: '', email: '', phone: '', street: '', city: '', zipCode: '', country: '' })} 
            />
          </div>

          {addressFields.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 animate-in fade-in-50 duration-200">
              <table className="w-full min-w-[1280px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3 w-[150px]">Address Type</th>
                    <th className="py-3 px-3 w-[160px]">Name</th>
                    <th className="py-3 px-3 w-[180px]">Email</th>
                    <th className="py-3 px-3 w-[150px]">Phone Number</th>
                    <th className="py-3 px-3 w-[180px]">Street</th>
                    <th className="py-3 px-3 w-[140px]">City</th>
                    <th className="py-3 px-3 w-[110px]">Zip Code</th>
                    <th className="py-3 px-3 w-[190px]">Country</th>
                    <th className="py-3 px-3 w-[50px] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {addressFields.map((field, index) => (
                    <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5">
                        <SelectInput
                          value={form.watch(`addresses.${index}.type`)}
                          onChange={(val) => form.setValue(`addresses.${index}.type`, val)}
                          options={ADDRESS_TYPES}
                        />
                      </td>
                      <td className="p-2.5"><InputField {...form.register(`addresses.${index}.name`)} placeholder="Name" /></td>
                      <td className="p-2.5"><InputField {...form.register(`addresses.${index}.email`)} placeholder="Email" /></td>
                      <td className="p-2.5"><InputField {...form.register(`addresses.${index}.phone`)} placeholder="Phone" /></td>
                      <td className="p-2.5"><InputField {...form.register(`addresses.${index}.street`)} placeholder="Street" /></td>
                      <td className="p-2.5"><InputField {...form.register(`addresses.${index}.city`)} placeholder="City" /></td>
                      <td className="p-2.5"><InputField {...form.register(`addresses.${index}.zipCode`)} placeholder="Zip" /></td>
                      <td className="p-2.5">
                        <SelectInput
                          value={form.watch(`addresses.${index}.country`)}
                          onChange={(val) => form.setValue(`addresses.${index}.country`, val)}
                          options={countryOptions}
                          placeholder="Select country"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <MinimalDeleteButton onClick={() => removeAddress(index)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 3: Add Broker */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Briefcase className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Broker</h2>
            </div>
            <MinimalAddButton 
              label="Add Broker" 
              onClick={() => appendBroker({ name: '', phone: '', email: '', coCode: '', phytoType: 'Transit', address: '' })} 
            />
          </div>

          {brokerFields.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 animate-in fade-in-50 duration-200">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Phone Number</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">CO Code</th>
                    <th className="py-3 px-3 w-[160px]">Phyto Type</th>
                    <th className="py-3 px-3">Address</th>
                    <th className="py-3 px-3 w-[50px] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {brokerFields.map((field, index) => (
                    <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5"><InputField {...form.register(`brokers.${index}.name`)} placeholder="Broker Name" /></td>
                      <td className="p-2.5"><InputField {...form.register(`brokers.${index}.phone`)} placeholder="Phone" /></td>
                      <td className="p-2.5"><InputField {...form.register(`brokers.${index}.email`)} placeholder="Email" /></td>
                      <td className="p-2.5"><InputField {...form.register(`brokers.${index}.coCode`)} placeholder="CO Code" /></td>
                      <td className="p-2.5">
                        <SelectInput
                          value={form.watch(`brokers.${index}.phytoType`)}
                          onChange={(val) => form.setValue(`brokers.${index}.phytoType`, val)}
                          options={PHYTO_TYPES}
                        />
                      </td>
                      <td className="p-2.5"><InputField {...form.register(`brokers.${index}.address`)} placeholder="Address" /></td>
                      <td className="p-2.5 text-center">
                        <MinimalDeleteButton onClick={() => removeBroker(index)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 4: Add Contact */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Contact</h2>
            </div>
            <MinimalAddButton 
              label="Add Contact" 
              onClick={() => appendContact({ firstName: '', lastName: '', email: '', phone: '', function: '' })} 
            />
          </div>

          {contactFields.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 animate-in fade-in-50 duration-200">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">First Name</th>
                    <th className="py-3 px-3">Last Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Phone Number</th>
                    <th className="py-3 px-3">Function</th>
                    <th className="py-3 px-3 w-[50px] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {contactFields.map((field, index) => (
                    <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5"><InputField {...form.register(`contacts.${index}.firstName`)} placeholder="First Name" /></td>
                      <td className="p-2.5"><InputField {...form.register(`contacts.${index}.lastName`)} placeholder="Last Name" /></td>
                      <td className="p-2.5"><InputField {...form.register(`contacts.${index}.email`)} placeholder="Email" /></td>
                      <td className="p-2.5"><InputField {...form.register(`contacts.${index}.phone`)} placeholder="Phone" /></td>
                      <td className="p-2.5"><InputField {...form.register(`contacts.${index}.function`)} placeholder="Function / Role" /></td>
                      <td className="p-2.5 text-center">
                        <MinimalDeleteButton onClick={() => removeContact(index)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 5: Add Contract Documents */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Contract Documents</h2>
            </div>
            <MinimalAddButton 
              label="Add Document" 
              onClick={() => appendDocument({ fileName: '', fileType: 'Contract', fileUrl: null })} 
            />
          </div>

          {documentFields.length > 0 && (
            <div className="space-y-3 animate-in fade-in-50 duration-200">
              {documentFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5 font-sans">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Upload File
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs gap-2">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Choose File</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                form.setValue(`documents.${index}.fileUrl`, file as any);
                                if (!form.watch(`documents.${index}.fileName`)) {
                                  form.setValue(`documents.${index}.fileName`, file.name);
                                }
                              }
                            }}
                          />
                        </label>
                        <span className="text-xs text-slate-500 truncate font-medium">
                          {form.watch(`documents.${index}.fileUrl`) instanceof File
                            ? (form.watch(`documents.${index}.fileUrl`) as unknown as File).name
                            : 'No file selected'}
                        </span>
                      </div>
                    </div>

                    <InputField
                      label="File Name"
                      placeholder="e.g. Agreement_2026.pdf"
                      {...form.register(`documents.${index}.fileName`)}
                    />

                    <SelectInput
                      label="File Type"
                      value={form.watch(`documents.${index}.fileType`)}
                      onChange={(val) => form.setValue(`documents.${index}.fileType`, val)}
                      options={FILE_TYPES}
                    />
                  </div>
                  <MinimalDeleteButton onClick={() => removeDocument(index)} className="mb-0.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 6: Add Released Farms */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Released Farms</h2>
            </div>
            <MinimalAddButton 
              label="Add Released Farm" 
              onClick={() => appendFarm({ farmId: '', ggnNumber: '', farmSize: '', estimatedCrops: '' })} 
            />
          </div>

          {farmFields.length > 0 && (
            <div className="space-y-3 animate-in fade-in-50 duration-200">
              {farmFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <SelectInput
                      label="Select Farm"
                      value={form.watch(`farms.${index}.farmId`)}
                      onChange={(val) => form.setValue(`farms.${index}.farmId`, val)}
                      options={farmOptions}
                    />
                    <InputField
                      label="GGN Number"
                      placeholder="GGN Number"
                      {...form.register(`farms.${index}.ggnNumber`)}
                    />
                    <InputField
                      label="Farm Size"
                      placeholder="Size (ha)"
                      {...form.register(`farms.${index}.farmSize`)}
                    />
                    <InputField
                      label="Estimated Crops"
                      placeholder="Tons"
                      {...form.register(`farms.${index}.estimatedCrops`)}
                    />
                  </div>
                  <MinimalDeleteButton onClick={() => removeFarm(index)} className="mb-0.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 7: Add Processing Lines */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Factory className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Processing Lines</h2>
            </div>
            <MinimalAddButton 
              label="Add Processing Line" 
              onClick={() => appendLine({ locationId: '', gpsLocation: '', description: '' })} 
            />
          </div>

          {lineFields.length > 0 && (
            <div className="space-y-3 animate-in fade-in-50 duration-200">
              {lineFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SelectInput
                      label="Select Location"
                      value={form.watch(`processingLines.${index}.locationId`)}
                      onChange={(val) => form.setValue(`processingLines.${index}.locationId`, val)}
                      options={locationOptions}
                    />
                    <InputField
                      label="GPS Location"
                      placeholder="Coordinates"
                      {...form.register(`processingLines.${index}.gpsLocation`)}
                    />
                    <InputField
                      label="Description"
                      placeholder="Line notes..."
                      {...form.register(`processingLines.${index}.description`)}
                    />
                  </div>
                  <MinimalDeleteButton onClick={() => removeLine(index)} className="mb-0.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 8: Add Users */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-slate-700 stroke-[1.75]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Add Users</h2>
            </div>
            <MinimalAddButton 
              label="Add User" 
              onClick={() => appendUser({ firstName: '', lastName: '', email: '', password: '', function: '', userType: 'Standard' })} 
            />
          </div>

          {userFields.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 animate-in fade-in-50 duration-200">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">First Name</th>
                    <th className="py-3 px-3">Last Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Password</th>
                    <th className="py-3 px-3">Function</th>
                    <th className="py-3 px-3 w-[160px]">User Type</th>
                    <th className="py-3 px-3 w-[50px] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {userFields.map((field, index) => (
                    <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5"><InputField {...form.register(`users.${index}.firstName`)} placeholder="First Name" /></td>
                      <td className="p-2.5"><InputField {...form.register(`users.${index}.lastName`)} placeholder="Last Name" /></td>
                      <td className="p-2.5"><InputField type="email" {...form.register(`users.${index}.email`)} placeholder="Email" /></td>
                      <td className="p-2.5"><InputField type="password" {...form.register(`users.${index}.password`)} placeholder="Password" /></td>
                      <td className="p-2.5"><InputField {...form.register(`users.${index}.function`)} placeholder="Function" /></td>
                      <td className="p-2.5">
                        <SelectInput
                          value={form.watch(`users.${index}.userType`)}
                          onChange={(val) => form.setValue(`users.${index}.userType`, val)}
                          options={USER_TYPES}
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <MinimalDeleteButton onClick={() => removeUser(index)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-all duration-150 cursor-pointer disabled:opacity-50 text-sm tracking-wide"
          >
            {loading ? 'Processing...' : 'Add Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
