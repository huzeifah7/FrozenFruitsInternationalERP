'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  Loader2,
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    if (!user || !user.email) return;
    setLoading(true);
    try {
      // Re-authenticate before password change
      const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, values.newPassword);

      toast({ title: 'Success', description: 'Password updated successfully.' });
      form.reset();
      router.push('/profile');
    } catch (error: any) {
      console.error('Password update error:', error);
      const msg = error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : 'Failed to update password. Please try again.';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setLoading(false);
    }
  };

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

  const PasswordInput = ({
    id,
    show,
    onToggle,
    placeholder,
    ...rest
  }: { id: string; show: boolean; onToggle: () => void; placeholder?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="relative group">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all pr-12"
        {...(rest as any)}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/20 hover:text-primary transition-colors"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
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
                <span className="text-primary/60 font-black">Change Password</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Change Password</h1>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <div className="w-56 shrink-0 bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 p-3 space-y-1">
          <SidebarItem href="/profile/edit" icon={User} label="Update Profile" />
          <SidebarItem href="/profile/change-password" icon={Lock} label="Change Password" active />
        </div>

        {/* Main Card */}
        <div className="flex-1">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
              <div className="bg-primary/[0.02] px-8 py-5 border-b border-primary/5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0284C7]/10 flex items-center justify-center">
                  <ShieldCheck className="size-4 text-[#0284C7]" />
                </div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Change Password</h2>
              </div>

              <div className="px-8 py-8 space-y-6">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Current Password</Label>
                  <PasswordInput
                    id="currentPassword"
                    show={showCurrent}
                    onToggle={() => setShowCurrent(!showCurrent)}
                    placeholder="Enter your current password"
                    {...form.register('currentPassword')}
                  />
                  {form.formState.errors.currentPassword && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="border-t border-primary/5 pt-6 space-y-6">
                  {/* New Password */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">New Password</Label>
                    <PasswordInput
                      id="newPassword"
                      show={showNew}
                      onToggle={() => setShowNew(!showNew)}
                      placeholder="Min. 8 characters"
                      {...form.register('newPassword')}
                    />
                    {form.formState.errors.newPassword && (
                      <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.newPassword.message}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Confirm New Password</Label>
                    <PasswordInput
                      id="confirmPassword"
                      show={showConfirm}
                      onToggle={() => setShowConfirm(!showConfirm)}
                      placeholder="Re-enter your new password"
                      {...form.register('confirmPassword')}
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-[10px] text-rose-500 font-bold uppercase ml-1">{form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                {/* Strength hint */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Password Requirements</p>
                  <ul className="space-y-1 text-[10px] font-bold text-amber-600 list-disc list-inside">
                    <li>At least 8 characters long</li>
                    <li>Use a mix of letters, numbers, and symbols</li>
                    <li>Avoid reusing previous passwords</li>
                  </ul>
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
                {loading ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Updating...</> : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
