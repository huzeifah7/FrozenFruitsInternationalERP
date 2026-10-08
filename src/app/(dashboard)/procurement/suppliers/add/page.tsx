'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Loader2,
  Phone,
  User,
  Notebook,
  Building,
  MapPin,
  ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

export default function AddSupplierPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Input States
  const [name, setName] = useState('');
  const [supplierType, setSupplierType] = useState('Farmer');
  const [currency, setCurrency] = useState('MAD');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [IF, setIF] = useState('');
  const [ICE, setICE] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<any>({});

  const validateForm = () => {
    const newErrors: any = {};
    if (!name.trim()) newErrors.name = 'Supplier Name is required';
    if (!supplierType.trim()) newErrors.supplierType = 'Supplier Type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'procurement_suppliers'), {
        name: name.trim(),
        supplier_type: supplierType.trim(),
        currency: currency.trim() || 'MAD',
        contact_person: contactPerson.trim(),
        phone_number: phoneNumber.trim(),
        address: address.trim(),
        bank_number: bankNumber.trim(),
        bank_name: bankName.trim(),
        IF: IF.trim(),
        ICE: ICE.trim(),
        note: note.trim(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user.email || 'system',
        updated_by: user.email || 'system'
      });

      toast({
        title: "Success",
        description: "Supplier created successfully.",
      });

      router.push('/procurement/suppliers');
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to create supplier.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className="rounded-full hover:bg-[#7a9800]/5 text-[#7a9800]/40 hover:text-[#7a9800] transition-all"
          >
            <Link href="/procurement/suppliers">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          </Button>
          <div className="space-y-1">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-slate-400" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Procurement Suppliers
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-[#7a9800] font-black uppercase">Add Supplier</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">Add Supplier</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleAddSubmit} className="space-y-8">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-100/50 border border-slate-100 overflow-hidden">
          <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
              <Building className="h-4 w-4" /> Supplier Details
            </h2>
          </div>

          <div className="p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Supplier Name */}
              <div className="space-y-2">
                <Label htmlFor="addName" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier Name *</Label>
                <div className="relative">
                  <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="addName"
                    placeholder="Enter business name..."
                    className={cn(
                      "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                      errors.name && "ring-2 ring-rose-500"
                    )}
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                {errors.name && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.name}</p>}
              </div>

              {/* Supplier Type */}
              <div className="space-y-2">
                <Label htmlFor="addSupplierType" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier Type *</Label>
                <select
                  id="addSupplierType"
                  className={cn(
                    "w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all",
                    errors.supplierType && "ring-2 ring-rose-500"
                  )}
                  value={supplierType}
                  onChange={e => setSupplierType(e.target.value)}
                >
                  <option value="Farmer">Farmer</option>
                  <option value="Trader">Trader</option>
                </select>
                {errors.supplierType && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.supplierType}</p>}
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="addCurrency" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Currency</Label>
                <select
                  id="addCurrency"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                >
                  <option value="MAD">MAD</option>
                  <option value="EURO">EURO</option>
                  <option value="Dollar">Dollar</option>
                  <option value="Pound">Pound</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Contact */}
              <div className="space-y-2">
                <Label htmlFor="addContactPerson" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Contact</Label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="addContactPerson"
                    placeholder="Enter contact full name..."
                    className={cn(
                      "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                      errors.contactPerson && "ring-2 ring-rose-500"
                    )}
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                  />
                </div>
                {errors.contactPerson && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.contactPerson}</p>}
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="addPhoneNumber" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="addPhoneNumber"
                    placeholder="e.g. +212 600 000 000"
                    className={cn(
                      "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                      errors.phoneNumber && "ring-2 ring-rose-500"
                    )}
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                  />
                </div>
                {errors.phoneNumber && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.phoneNumber}</p>}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="addAddress" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Address</Label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="addAddress"
                  placeholder="Street name, City..."
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                    errors.address && "ring-2 ring-rose-500"
                  )}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
              {errors.address && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bank Number (RIB) */}
              <div className="space-y-2">
                <Label htmlFor="addBankNumber" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bank Account Number (RIB)</Label>
                <Input
                  id="addBankNumber"
                  placeholder="24-digit account number..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] px-4"
                  value={bankNumber}
                  onChange={e => setBankNumber(e.target.value)}
                />
              </div>

              {/* Bank Name */}
              <div className="space-y-2">
                <Label htmlFor="addBankName" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bank Name</Label>
                <Input
                  id="addBankName"
                  placeholder="e.g. Attijariwafa..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] px-4"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* IF */}
              <div className="space-y-2">
                <Label htmlFor="addIF" className="text-[10px] font-black uppercase tracking-widest text-slate-400">IF (Identifiant Fiscal)</Label>
                <Input
                  id="addIF"
                  placeholder="IF number..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] px-4"
                  value={IF}
                  onChange={e => setIF(e.target.value)}
                />
              </div>

              {/* ICE */}
              <div className="space-y-2">
                <Label htmlFor="addICE" className="text-[10px] font-black uppercase tracking-widest text-slate-400">ICE</Label>
                <Input
                  id="addICE"
                  placeholder="ICE number..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] px-4"
                  value={ICE}
                  onChange={e => setICE(e.target.value)}
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="addNote" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes / Remarks</Label>
              <div className="relative">
                <Notebook size={16} className="absolute left-3.5 top-5 text-slate-400" />
                <Textarea
                  id="addNote"
                  placeholder="Enter remarks or notes..."
                  className="rounded-xl bg-slate-50 border-none font-semibold text-slate-800 focus-visible:ring-[#7a9800] pl-10 min-h-[100px] resize-none"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="h-14 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-2xl shadow-xl shadow-[#7a9800]/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-[10px] gap-3"
          >
            {isSubmitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> CREATING...</>
            ) : 'CREATE SUPPLIER'}
          </Button>
        </div>
      </form>
    </div>
  );
}
