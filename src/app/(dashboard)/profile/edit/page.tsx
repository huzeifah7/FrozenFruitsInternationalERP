'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, updateDoc, serverTimestamp, collection } from '@/firebase/firestore-override';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  Loader2,
  User,
  Lock,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  location: z.string().optional(),
  position: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user, profile } = useAuthContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch Processing Lines for the location select
  const linesQuery = useMemoFirebase(() => db ? collection(db, 'processing_lines') : null, [db]);
  const { data: linesData } = useCollection(linesQuery);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      position: '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || user?.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        position: profile.position || '',
      });
    }
  }, [profile, user]);

  const onImageClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user || !db) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please upload an image file.' });
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `userprofile/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'appUsers', user.uid), {
        avatar_url: downloadURL,
        updated_at: serverTimestamp(),
      });

      toast({ title: 'Success', description: 'Profile picture updated.' });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload image.' });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!db || !user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'appUsers', user.uid), {
        ...values,
        updated_at: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Profile updated successfully.' });
      router.push('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'User';
  const initials = `${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const SidebarItem = ({ href, label, icon: Icon, active }: { href: string; label: string; icon: any; active?: boolean }) => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all',
        active
          ? 'bg-[#193A7B] text-white shadow-lg shadow-[#193A7B]/20'
          : 'text-primary/50 hover:text-primary hover:bg-primary/5'
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/profile')}
          className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="space-y-1">
          <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
            <ol className="inline-flex items-center space-x-2">
              <li>Profile</li>
              <li className="flex items-center">
                <span className="mx-2 opacity-20">/</span>
                <span className="text-primary/60 font-black">Update Profile</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Edit Profile</h1>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <div className="w-56 shrink-0 bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 p-3 space-y-1">
          <SidebarItem href="/profile/edit" icon={User} label="Update Profile" active />
          <SidebarItem href="/profile/change-password" icon={Lock} label="Change Password" />
        </div>

        {/* Main Form Card */}
        <div className="flex-1">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
              <div className="bg-primary/[0.02] px-8 py-5 border-b border-primary/5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">User Information</h2>
              </div>

              {/* Avatar section */}
              <div className="flex justify-center pt-8 pb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div 
                  onClick={onImageClick}
                  className={cn(
                    "relative group cursor-pointer",
                    uploading && "pointer-events-none opacity-50"
                  )}
                >
                  <Avatar className="h-24 w-24 border-4 border-white shadow-2xl shadow-primary/20">
                    <AvatarImage src={profile?.avatar_url || `https://picsum.photos/seed/${user?.uid}/200/200`} />
                    <AvatarFallback className="bg-primary text-white text-2xl font-black">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="size-6 text-white animate-spin" /> : <Camera className="size-6 text-white" />}
                  </div>
                </div>
              </div>
              <p className="text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 mb-6">
                {uploading ? 'Uploading...' : fullName}
              </p>

              {/* Fields Grid */}
              <div className="px-8 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">First Name</Label>
                  <Input
                    {...form.register('firstName')}
                    placeholder="e.g. Houdaifa"
                    className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Last Name</Label>
                  <Input
                    {...form.register('lastName')}
                    placeholder="e.g. El Baal"
                    className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Email Address</Label>
                  <Input
                    {...form.register('email')}
                    type="email"
                    placeholder="e.g. user@company.com"
                    className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  />
                  {form.formState.errors.email && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Phone Number</Label>
                  <Input
                    {...form.register('phone')}
                    placeholder="e.g. +212 6XX XXX XXX"
                    className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  />
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Location / Address</Label>
                  <Select
                    value={form.watch('location')}
                    onValueChange={(val) => form.setValue('location', val)}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-primary/5 shadow-2xl">
                      {linesData?.map((line) => (
                        <SelectItem 
                          key={line.id} 
                          value={line.title}
                          className="rounded-lg font-bold py-2.5 px-3 text-[11px] uppercase tracking-widest cursor-pointer hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          {line.title}
                        </SelectItem>
                      ))}
                      {(!linesData || linesData.length === 0) && (
                        <SelectItem value="none" disabled className="text-[10px] font-bold text-muted-foreground/30 italic">
                          No locations found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Position / Title</Label>
                  <Input
                    {...form.register('position')}
                    placeholder="e.g. Supply Chain Manager"
                    className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-5">
              <Button
                type="submit"
                disabled={loading}
                className="h-14 px-12 bg-[#193A7B] hover:bg-[#0F2552] text-white font-black rounded-xl shadow-xl shadow-[#193A7B]/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-[10px]"
              >
                {loading ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Saving...</> : 'Update Profile'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
