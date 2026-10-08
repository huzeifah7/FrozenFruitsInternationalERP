'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  MapPin, 
  Users, 
  FileText, 
  Briefcase, 
  ShieldCheck, 
  Factory, 
  Upload
} from 'lucide-react';
import { 
  SelectInput, 
  InputField, 
  FormCard, 
  MinimalAddButton, 
  MinimalDeleteButton, 
  LogoAvatarUpload,
  SelectOption
} from './add-customer-components';
import { ALL_COUNTRIES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

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

const PAYMENT_TERMS: SelectOption[] = [
  { label: '30 Days Net', value: '30_days_net' },
  { label: '60 Days Net', value: '60_days_net' },
  { label: 'Cash in Advance', value: 'cash_in_advance' },
  { label: 'LC at Sight', value: 'lc_at_sight' }
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
  { label: 'Other', value: 'Other' }
];

const USER_TYPES: SelectOption[] = [
  { label: 'Administrator', value: 'Administrator' },
  { label: 'Standard', value: 'Standard' },
  { label: 'Guest', value: 'Guest' }
];

const FARM_OPTIONS: SelectOption[] = [
  { label: 'Farm Alfa - Agadir', value: 'farm_alfa' },
  { label: 'Farm Beta - Taroudant', value: 'farm_beta' },
  { label: 'Farm Gamma - Dakhla', value: 'farm_gamma' }
];

const PROCESSING_LINE_OPTIONS: SelectOption[] = [
  { label: 'Export Optimum Main Station', value: 'line_optimum_main' },
  { label: 'Station 1 - Citrus Line', value: 'line_citrus' }
];

export interface AddressRow {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

export interface BrokerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  coCode: string;
  phytoType: string;
  address: string;
}

export interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  function: string;
}

export interface DocumentRow {
  id: string;
  file: File | null;
  fileName: string;
  fileType: string;
}

export interface FarmRow {
  id: string;
  farmId: string;
  ggnNumber: string;
  farmSize: string;
  estimatedCrops: string;
}

export interface LineRow {
  id: string;
  locationId: string;
  gpsLocation: string;
  description: string;
}

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  function: string;
  userType: string;
}

export default function AddCustomerForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [incoterm, setIncoterm] = useState('DAP');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [vat, setVat] = useState('');

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [processingLines, setProcessingLines] = useState<LineRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const countryOptions: SelectOption[] = ALL_COUNTRIES.map((c) => ({ label: c, value: c }));

  const handleLogoSelect = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addAddress = () => {
    setAddresses((prev) => [
      ...prev,
      { id: Date.now().toString(), type: 'Billing', name: '', email: '', phone: '', street: '', city: '', zipCode: '', country: '' }
    ]);
  };

  const removeAddress = (id: string) => {
    setAddresses((prev) => prev.filter((row) => row.id !== id));
  };

  const updateAddress = (id: string, field: keyof AddressRow, value: string) => {
    setAddresses((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addBroker = () => {
    setBrokers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', phone: '', email: '', coCode: '', phytoType: 'Transit', address: '' }
    ]);
  };

  const removeBroker = (id: string) => {
    setBrokers((prev) => prev.filter((row) => row.id !== id));
  };

  const updateBroker = (id: string, field: keyof BrokerRow, value: string) => {
    setBrokers((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { id: Date.now().toString(), firstName: '', lastName: '', email: '', phone: '', function: '' }
    ]);
  };

  const removeContact = (id: string) => {
    setContacts((prev) => prev.filter((row) => row.id !== id));
  };

  const updateContact = (id: string, field: keyof ContactRow, value: string) => {
    setContacts((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addDocument = () => {
    setDocuments((prev) => [
      ...prev,
      { id: Date.now().toString(), file: null, fileName: '', fileType: 'Contract' }
    ]);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((row) => row.id !== id));
  };

  const updateDocument = (id: string, field: keyof DocumentRow, value: any) => {
    setDocuments((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addFarm = () => {
    setFarms((prev) => [
      ...prev,
      { id: Date.now().toString(), farmId: '', ggnNumber: '', farmSize: '', estimatedCrops: '' }
    ]);
  };

  const removeFarm = (id: string) => {
    setFarms((prev) => prev.filter((row) => row.id !== id));
  };

  const updateFarm = (id: string, field: keyof FarmRow, value: string) => {
    setFarms((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addProcessingLine = () => {
    setProcessingLines((prev) => [
      ...prev,
      { id: Date.now().toString(), locationId: '', gpsLocation: '', description: '' }
    ]);
  };

  const removeProcessingLine = (id: string) => {
    setProcessingLines((prev) => prev.filter((row) => row.id !== id));
  };

  const updateProcessingLine = (id: string, field: keyof LineRow, value: string) => {
    setProcessingLines((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addUser = () => {
    setUsers((prev) => [
      ...prev,
      { id: Date.now().toString(), firstName: '', lastName: '', email: '', password: '', function: '', userType: 'Standard' }
    ]);
  };

  const removeUser = (id: string) => {
    setUsers((prev) => prev.filter((row) => row.id !== id));
  };

  const updateUser = (id: string, field: keyof UserRow, value: string) => {
    setUsers((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Company Name is required.'
      });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: 'Customer Created',
        description: `Customer "${companyName}" has been successfully added.`
      });
      router.push('/sales/customers');
    }, 600);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-16 font-sans">
      {/* SECTION 1: Company Info */}
      <FormCard title="Company Info" icon={<Building2 className="w-5 h-5 stroke-[1.75]" />}>
        <LogoAvatarUpload previewUrl={logoPreview} onFileSelect={handleLogoSelect} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-2">
          <div className="space-y-5">
            <InputField
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
            />
            <InputField
              label="Company Email"
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="contact@company.com"
            />
            <SelectInput
              label="Select Currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES}
            />
            <SelectInput
              label="Payment Terms"
              value={paymentTerms}
              onChange={setPaymentTerms}
              options={PAYMENT_TERMS}
            />
          </div>

          <div className="space-y-5">
            <InputField
              label="Company Phone"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              placeholder="+212 ..."
            />
            <InputField
              label="Company Website"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              placeholder="https://company.com"
            />
            <SelectInput
              label="Incoterm"
              value={incoterm}
              onChange={setIncoterm}
              options={INCOTERMS}
            />
            <InputField
              label="VAT"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              placeholder="Tax ID"
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
          <MinimalAddButton label="Add Address" onClick={addAddress} />
        </div>

        {addresses.length > 0 && (
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
                {addresses.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5">
                      <SelectInput
                        value={row.type}
                        onChange={(val) => updateAddress(row.id, 'type', val)}
                        options={ADDRESS_TYPES}
                      />
                    </td>
                    <td className="p-2.5"><InputField value={row.name} onChange={(e) => updateAddress(row.id, 'name', e.target.value)} placeholder="Name" /></td>
                    <td className="p-2.5"><InputField value={row.email} onChange={(e) => updateAddress(row.id, 'email', e.target.value)} placeholder="Email" /></td>
                    <td className="p-2.5"><InputField value={row.phone} onChange={(e) => updateAddress(row.id, 'phone', e.target.value)} placeholder="Phone" /></td>
                    <td className="p-2.5"><InputField value={row.street} onChange={(e) => updateAddress(row.id, 'street', e.target.value)} placeholder="Street" /></td>
                    <td className="p-2.5"><InputField value={row.city} onChange={(e) => updateAddress(row.id, 'city', e.target.value)} placeholder="City" /></td>
                    <td className="p-2.5"><InputField value={row.zipCode} onChange={(e) => updateAddress(row.id, 'zipCode', e.target.value)} placeholder="Zip" /></td>
                    <td className="p-2.5">
                      <SelectInput
                        value={row.country}
                        onChange={(val) => updateAddress(row.id, 'country', val)}
                        options={countryOptions}
                        placeholder="Select country"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <MinimalDeleteButton onClick={() => removeAddress(row.id)} />
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
          <MinimalAddButton label="Add Broker" onClick={addBroker} />
        </div>

        {brokers.length > 0 && (
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
                {brokers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5"><InputField value={row.name} onChange={(e) => updateBroker(row.id, 'name', e.target.value)} placeholder="Broker Name" /></td>
                    <td className="p-2.5"><InputField value={row.phone} onChange={(e) => updateBroker(row.id, 'phone', e.target.value)} placeholder="Phone" /></td>
                    <td className="p-2.5"><InputField value={row.email} onChange={(e) => updateBroker(row.id, 'email', e.target.value)} placeholder="Email" /></td>
                    <td className="p-2.5"><InputField value={row.coCode} onChange={(e) => updateBroker(row.id, 'coCode', e.target.value)} placeholder="CO Code" /></td>
                    <td className="p-2.5">
                      <SelectInput
                        value={row.phytoType}
                        onChange={(val) => updateBroker(row.id, 'phytoType', val)}
                        options={PHYTO_TYPES}
                      />
                    </td>
                    <td className="p-2.5"><InputField value={row.address} onChange={(e) => updateBroker(row.id, 'address', e.target.value)} placeholder="Address" /></td>
                    <td className="p-2.5 text-center">
                      <MinimalDeleteButton onClick={() => removeBroker(row.id)} />
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
          <MinimalAddButton label="Add Contact" onClick={addContact} />
        </div>

        {contacts.length > 0 && (
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
                {contacts.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5"><InputField value={row.firstName} onChange={(e) => updateContact(row.id, 'firstName', e.target.value)} placeholder="First Name" /></td>
                    <td className="p-2.5"><InputField value={row.lastName} onChange={(e) => updateContact(row.id, 'lastName', e.target.value)} placeholder="Last Name" /></td>
                    <td className="p-2.5"><InputField value={row.email} onChange={(e) => updateContact(row.id, 'email', e.target.value)} placeholder="Email" /></td>
                    <td className="p-2.5"><InputField value={row.phone} onChange={(e) => updateContact(row.id, 'phone', e.target.value)} placeholder="Phone" /></td>
                    <td className="p-2.5"><InputField value={row.function} onChange={(e) => updateContact(row.id, 'function', e.target.value)} placeholder="Function / Role" /></td>
                    <td className="p-2.5 text-center">
                      <MinimalDeleteButton onClick={() => removeContact(row.id)} />
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
          <MinimalAddButton label="Add Document" onClick={addDocument} />
        </div>

        {documents.length > 0 && (
          <div className="space-y-3 animate-in fade-in-50 duration-200">
            {documents.map((row) => (
              <div key={row.id} className="flex items-end gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
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
                              updateDocument(row.id, 'file', file);
                              if (!row.fileName) {
                                updateDocument(row.id, 'fileName', file.name);
                              }
                            }
                          }}
                        />
                      </label>
                      <span className="text-xs text-slate-500 truncate font-medium">
                        {row.file ? row.file.name : 'No file selected'}
                      </span>
                    </div>
                  </div>

                  <InputField
                    label="File Name"
                    value={row.fileName}
                    onChange={(e) => updateDocument(row.id, 'fileName', e.target.value)}
                    placeholder="e.g. Agreement_2026.pdf"
                  />

                  <SelectInput
                    label="File Type"
                    value={row.fileType}
                    onChange={(val) => updateDocument(row.id, 'fileType', val)}
                    options={FILE_TYPES}
                  />
                </div>
                <MinimalDeleteButton onClick={() => removeDocument(row.id)} className="mb-0.5" />
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
          <MinimalAddButton label="Add Released Farm" onClick={addFarm} />
        </div>

        {farms.length > 0 && (
          <div className="space-y-3 animate-in fade-in-50 duration-200">
            {farms.map((row) => (
              <div key={row.id} className="flex items-end gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <SelectInput
                    label="Select Farm"
                    value={row.farmId}
                    onChange={(val) => updateFarm(row.id, 'farmId', val)}
                    options={FARM_OPTIONS}
                  />
                  <InputField
                    label="GGN Number"
                    value={row.ggnNumber}
                    onChange={(e) => updateFarm(row.id, 'ggnNumber', e.target.value)}
                    placeholder="GGN Number"
                  />
                  <InputField
                    label="Farm Size"
                    value={row.farmSize}
                    onChange={(e) => updateFarm(row.id, 'farmSize', e.target.value)}
                    placeholder="Size (ha)"
                  />
                  <InputField
                    label="Estimated Crops"
                    value={row.estimatedCrops}
                    onChange={(e) => updateFarm(row.id, 'estimatedCrops', e.target.value)}
                    placeholder="Tons"
                  />
                </div>
                <MinimalDeleteButton onClick={() => removeFarm(row.id)} className="mb-0.5" />
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
          <MinimalAddButton label="Add Processing Line" onClick={addProcessingLine} />
        </div>

        {processingLines.length > 0 && (
          <div className="space-y-3 animate-in fade-in-50 duration-200">
            {processingLines.map((row) => (
              <div key={row.id} className="flex items-end gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SelectInput
                    label="Select Location"
                    value={row.locationId}
                    onChange={(val) => updateProcessingLine(row.id, 'locationId', val)}
                    options={PROCESSING_LINE_OPTIONS}
                  />
                  <InputField
                    label="GPS Location"
                    value={row.gpsLocation}
                    onChange={(e) => updateProcessingLine(row.id, 'gpsLocation', e.target.value)}
                    placeholder="Coordinates"
                  />
                  <InputField
                    label="Description"
                    value={row.description}
                    onChange={(e) => updateProcessingLine(row.id, 'description', e.target.value)}
                    placeholder="Line notes..."
                  />
                </div>
                <MinimalDeleteButton onClick={() => removeProcessingLine(row.id)} className="mb-0.5" />
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
          <MinimalAddButton label="Add User" onClick={addUser} />
        </div>

        {users.length > 0 && (
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
                {users.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5"><InputField value={row.firstName} onChange={(e) => updateUser(row.id, 'firstName', e.target.value)} placeholder="First Name" /></td>
                    <td className="p-2.5"><InputField value={row.lastName} onChange={(e) => updateUser(row.id, 'lastName', e.target.value)} placeholder="Last Name" /></td>
                    <td className="p-2.5"><InputField type="email" value={row.email} onChange={(e) => updateUser(row.id, 'email', e.target.value)} placeholder="Email" /></td>
                    <td className="p-2.5"><InputField type="password" value={row.password} onChange={(e) => updateUser(row.id, 'password', e.target.value)} placeholder="Password" /></td>
                    <td className="p-2.5"><InputField value={row.function} onChange={(e) => updateUser(row.id, 'function', e.target.value)} placeholder="Function" /></td>
                    <td className="p-2.5">
                      <SelectInput
                        value={row.userType}
                        onChange={(val) => updateUser(row.id, 'userType', val)}
                        options={USER_TYPES}
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <MinimalDeleteButton onClick={() => removeUser(row.id)} />
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
  );
}
