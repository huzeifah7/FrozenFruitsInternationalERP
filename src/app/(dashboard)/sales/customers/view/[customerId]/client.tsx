'use client';

import React, { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  useDoc, 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { doc, collection } from '@/firebase/firestore-override';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronLeft, 
  Edit2, 
  Building2, 
  MapPin, 
  Users, 
  FileText, 
  Briefcase, 
  Globe, 
  Clock,
  ShieldCheck,
  Factory,
  Mail,
  Phone,
  ExternalLink,
  Sprout,
  Navigation
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailsPage() {
  const { customerId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();

  // 1. Fetch Customer Data
  const customerRef = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return doc(db, 'customers', customerId as string);
  }, [db, customerId]);

  const { data: customer, isLoading: isCustomerLoading } = useDoc(customerRef);

  // 2. Fetch Reference Data for Lookups
  const termsQuery = useMemoFirebase(() => {
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

  const { data: terms } = useCollection(termsQuery);
  const { data: locations } = useCollection(locationsQuery);
  const { data: farmList } = useCollection(farmsQuery);

  // 3. Helpers
  const paymentTermName = useMemo(() => {
    const termId = customer?.payment_term_id || customer?.paymentTermsId;
    if (!termId || !terms) return 'Standard Terms';
    return terms.find(t => t.id === termId)?.name || 'Custom Terms';
  }, [customer, terms]);

  const getLocationInfo = (id: string) => {
    const loc = locations?.find(l => l.id === id);
    return {
      title: loc?.title || loc?.name || id || 'Processing Facility',
      gpsLocation: loc?.gpsLocation || '',
      description: loc?.description || ''
    };
  };

  const getFarmInfo = (id: string) => {
    const farm = farmList?.find(f => f.id === id);
    return {
      name: farm?.name || id || 'Farm Facility',
      ggnNumber: farm?.ggnNumber || '',
      farmSize: farm?.farmSize || '',
      estimatedCrops: farm?.estimatedCrops || ''
    };
  };

  if (isCustomerLoading) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-72" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-muted p-6 rounded-full mb-4">
          <Building2 className="h-12 w-12 text-muted-foreground opacity-20" />
        </div>
        <h2 className="text-2xl font-bold text-primary">Customer Not Found</h2>
        <p className="text-muted-foreground mt-2">The record you are looking for might have been archived or deleted.</p>
        <Button asChild variant="link" className="mt-4 text-primary font-bold">
          <Link href="/sales/customers">Return to Registry</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sales/customers')} className="rounded-full h-12 w-12 hover:bg-primary/10 transition-all">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              <span>Registry</span>
              <span className="opacity-40">/</span>
              <span className="text-primary uppercase">Profile View</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Partner Portfolio</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => {
              if (customer) {
                const syntheticUser = {
                  id: `admin_view_${customer.id}`,
                  customer_id: customer.id,
                  first_name: customer.companyName || 'Customer',
                  last_name: 'View',
                  email: customer.email || 'portal@customer.com',
                  function: 'Customer',
                  user_type: 'Customer',
                  active: true
                };
                localStorage.setItem('customer_portal_user', JSON.stringify(syntheticUser));
                window.open(`/customer-portal/dashboard?asCustomer=${customer.id}`, '_blank');
              }
            }}
            variant="outline" 
            className="gap-2 border-[#709506] text-[#709506] hover:bg-[#709506]/10 h-12 px-6 rounded-xl font-bold uppercase tracking-widest transition-all bg-transparent shadow-none"
          >
            <ExternalLink size={18} /> View Customer Portal
          </Button>
          <Button asChild className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all">
            <Link href={`/sales/customers/edit/${customerId}`}>
              <Edit2 size={18} /> Edit Profile
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Identity Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 pb-8 p-8 border-b border-primary/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                <AvatarImage src={customer.logoUrl || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold uppercase">
                  {customer.companyName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold text-primary">{customer.companyName}</CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
                  {customer.email && (
                    <span className="flex items-center gap-1.5"><Mail size={14} className="opacity-50" /> {customer.email}</span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1.5"><Phone size={14} className="opacity-50" /> {customer.phone}</span>
                  )}
                  {customer.website && (
                    <a href={customer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                      <Globe size={14} className="opacity-50" /> Website <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white border-primary/20 text-primary font-black px-4 py-1.5 rounded-full text-[10px] tracking-widest shadow-sm">
                {customer.incoterm || 'DAP'}
              </Badge>
              <Badge className="bg-accent text-white font-black px-4 py-1.5 rounded-full text-[10px] tracking-widest shadow-sm">
                {customer.currency || 'EUR'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-muted/30">
            <div className="p-8 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Financial Terms</span>
              <p className="font-bold text-primary text-lg">{paymentTermName}</p>
            </div>
            <div className="p-8 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">VAT / Tax ID</span>
              <p className="font-mono text-primary text-lg tracking-tighter">{customer.vat || 'N/A'}</p>
            </div>
            <div className="p-8 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account Created</span>
              <p className="font-bold text-primary text-lg">
                {customer.createdAt ? new Date(customer.createdAt.seconds * 1000).toLocaleDateString() : 'Initial'}
              </p>
            </div>
            <div className="p-8 space-y-1 text-right">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Managed By</span>
              <p className="font-bold text-primary text-lg">{customer.createdBy?.split('@')[0] || 'System'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Addresses & Contacts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Addresses */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <MapPin className="size-5" /> Global Address Registry
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-muted/20">
                {customer.addresses?.length > 0 ? customer.addresses.map((addr: any, idx: number) => (
                  <div key={idx} className="p-6 hover:bg-primary/[0.02] transition-colors flex items-start gap-4">
                    <div className="h-10 w-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary shrink-0">
                      {addr.type === 'Billing' ? <FileText size={20} /> : <Briefcase size={20} />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-primary">{addr.name || 'Site Address'}</h4>
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border-none">{addr.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {addr.street}, {addr.city} {addr.zipCode}<br />
                        <span className="font-bold text-primary/70">{addr.country}</span>
                      </p>
                      <div className="flex gap-4 pt-2 text-[11px] font-medium text-muted-foreground">
                        {addr.email && <span className="flex items-center gap-1"><Mail size={12} /> {addr.email}</span>}
                        {addr.phone && <span className="flex items-center gap-1"><Phone size={12} /> {addr.phone}</span>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center text-muted-foreground italic text-sm">No registered addresses found.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contacts (Renamed from Authorized Contacts) */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Users className="size-5" /> Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-muted/20">
                {customer.contacts?.length > 0 ? customer.contacts.map((contact: any, idx: number) => (
                  <div key={idx} className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-accent/10 rounded-full flex items-center justify-center text-accent font-bold">
                        {contact.firstName?.[0]}{contact.lastName?.[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">{contact.firstName} {contact.lastName}</h4>
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest">{contact.function}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {contact.email && <p className="flex items-center gap-2"><Mail size={12} className="opacity-40" /> {contact.email}</p>}
                      {contact.phone && <p className="flex items-center gap-2"><Phone size={12} className="opacity-40" /> {contact.phone}</p>}
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center text-muted-foreground italic text-sm col-span-2">No contact personnel defined.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Released Farms Section */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Sprout className="size-5 text-emerald-600" /> Released Farms ({customer.farms?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-muted/20">
                {customer.farms?.length > 0 ? customer.farms.map((f: any, idx: number) => {
                  const farmInfo = getFarmInfo(f.farmId);
                  const ggn = f.ggnNumber || farmInfo.ggnNumber || '—';
                  const size = f.farmSize || farmInfo.farmSize || '—';
                  const crops = f.estimatedCrops || farmInfo.estimatedCrops || '—';

                  return (
                    <div key={idx} className="p-6 hover:bg-emerald-50/30 transition-colors flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-emerald-100/80 rounded-xl flex items-center justify-center text-emerald-800 font-bold shrink-0">
                          <Sprout size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-primary text-base">{farmInfo.name}</h4>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                            <span className="font-mono bg-muted/40 px-2 py-0.5 rounded text-primary font-bold">GGN: {ggn}</span>
                            {size !== '—' && <span>Size: <strong className="text-primary">{size} Ha</strong></span>}
                            {crops !== '—' && <span>Est. Crops: <strong className="text-primary">{crops} Tons</strong></span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="p-12 text-center text-muted-foreground italic text-sm">No released farms defined.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Processing Lines Section */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Factory className="size-5 text-accent" /> Processing Lines ({customer.processingLines?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-muted/20">
                {customer.processingLines?.length > 0 ? customer.processingLines.map((l: any, idx: number) => {
                  const locInfo = getLocationInfo(l.locationId);
                  const gps = l.gpsLocation || locInfo.gpsLocation || '—';
                  const desc = l.description || locInfo.description || '—';

                  return (
                    <div key={idx} className="p-6 hover:bg-accent/5 transition-colors flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent font-bold shrink-0">
                          <Factory size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-primary text-base">{locInfo.title}</h4>
                          {gps !== '—' && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                              <Navigation size={12} className="text-accent" /> GPS: {gps}
                            </p>
                          )}
                          {desc !== '—' && (
                            <p className="text-xs text-muted-foreground pt-1">{desc}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="p-12 text-center text-muted-foreground italic text-sm">No processing lines defined.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Documents & Brokers */}
        <div className="space-y-8">
          {/* Documents */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <FileText className="size-5" /> Digital Archive
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {customer.documents?.length > 0 ? customer.documents.map((doc: any, idx: number) => (
                <a 
                  key={idx} 
                  href={doc.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-primary/5 hover:scale-[1.02] transition-all border border-transparent hover:border-primary/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/5">
                      <FileText size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-primary group-hover:underline">{doc.fileName}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">{doc.fileType}</span>
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-muted-foreground opacity-40 group-hover:opacity-100" />
                </a>
              )) : (
                <div className="py-8 text-center text-xs text-muted-foreground italic font-medium opacity-50">No contract documents uploaded.</div>
              )}
            </CardContent>
          </Card>

          {/* Brokers (Renamed from Operations Log) */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Briefcase className="size-5" /> Brokers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary/50 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ShieldCheck size={12} /> Customs Clearance Brokers
                </h4>
                {customer.brokers?.length > 0 ? customer.brokers.map((broker: any, idx: number) => (
                  <div key={idx} className="bg-muted/20 p-4 rounded-2xl space-y-1.5">
                    <p className="font-bold text-primary text-sm">{broker.name}</p>
                    {broker.address && <p className="text-[10px] text-muted-foreground leading-tight">{broker.address}</p>}
                    <div className="flex flex-wrap gap-3 pt-2 text-[10px] font-bold text-primary/70">
                      {broker.coCode && <span>CO: {broker.coCode}</span>}
                      {broker.phytoType && (
                        <>
                          <span className="opacity-30">|</span>
                          <span>PHYTO: {broker.phytoType}</span>
                        </>
                      )}
                      {broker.phone && (
                        <>
                          <span className="opacity-30">|</span>
                          <span>TEL: {broker.phone}</span>
                        </>
                      )}
                      {broker.email && (
                        <>
                          <span className="opacity-30">|</span>
                          <span>EMAIL: {broker.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="py-6 text-center text-xs text-muted-foreground italic font-medium opacity-50">No customs brokers defined.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Internal Portal Users */}
      {customer.users?.length > 0 && (
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 p-6 border-b border-primary/5">
            <CardTitle className="text-lg font-bold text-primary uppercase tracking-tighter">Authorized Portal Personnel</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/30 border-b border-muted/20">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Work Email</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Corporate Function</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/20">
                  {customer.users.map((u: any, idx: number) => (
                    <tr key={idx} className="hover:bg-primary/[0.02]">
                      <td className="px-6 py-4 font-bold text-sm text-primary">{u.firstName} {u.lastName}</td>
                      <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{u.email}</td>
                      <td className="px-6 py-4 text-xs font-bold text-primary/70 uppercase">{u.function}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[9px] font-black tracking-tighter border-primary/10 bg-white">{u.userType}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
