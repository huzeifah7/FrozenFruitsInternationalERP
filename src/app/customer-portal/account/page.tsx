'use client';

import React, { useState } from 'react';
import { useCustomerAuth, hashPasswordSHA256 } from '@/components/customer-auth-provider';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from '@/firebase/firestore-override';
import { User, ShieldCheck, Languages, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function CustomerAccountPage() {
  const { user, refreshUser } = useCustomerAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState('English');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingSecurity, setUpdatingSecurity] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'customer_portal_users', user.id), {
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase().trim()
      });
      await refreshUser();
      toast({ title: 'Profile Updated', description: 'Your profile details have been saved.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message || 'Could not update profile.' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!password) {
      toast({ variant: 'destructive', title: 'Security Error', description: 'Please enter a valid password.' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Security Error', description: 'Passwords do not match.' });
      return;
    }

    setUpdatingSecurity(true);
    try {
      const hashed = await hashPasswordSHA256(password);
      await updateDoc(doc(db, 'customer_portal_users', user.id), {
        password: hashed
      });
      setPassword('');
      setConfirmPassword('');
      toast({ title: 'Password Changed', description: 'Your login credentials have been updated.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Security Error', description: err.message || 'Could not change password.' });
    } finally {
      setUpdatingSecurity(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-[#2e1d52] uppercase tracking-tight">My Account</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Manage your login details and account preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-[#2e1d52]/5 border-b border-slate-100 p-6">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-[#2e1d52] flex items-center gap-2">
              <User size={16} className="text-primary" /> Profile Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Name</Label>
                <Input 
                  value={firstName} 
                  onChange={e => setFirstName(e.target.value)} 
                  required
                  className="h-11 bg-slate-50 border-slate-100 rounded-xl text-sm font-semibold focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Name</Label>
                <Input 
                  value={lastName} 
                  onChange={e => setLastName(e.target.value)} 
                  required
                  className="h-11 bg-slate-50 border-slate-100 rounded-xl text-sm font-semibold focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required
                  className="h-11 bg-slate-50 border-slate-100 rounded-xl text-sm font-semibold focus-visible:ring-primary"
                />
              </div>
              <Button type="submit" disabled={updatingProfile} className="w-full bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl h-11 font-bold uppercase tracking-wider text-xs gap-2">
                {updatingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={14} />} Save Details
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Security Card */}
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-[#2e1d52]/5 border-b border-slate-100 p-6">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-[#2e1d52] flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> Security & Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateSecurity} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password</Label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Enter new password"
                    required
                    className="h-11 bg-slate-50 border-slate-100 rounded-xl focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirm Password</Label>
                  <Input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder="Confirm new password"
                    required
                    className="h-11 bg-slate-50 border-slate-100 rounded-xl focus-visible:ring-primary"
                  />
                </div>
                <Button type="submit" disabled={updatingSecurity} className="w-full bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl h-11 font-bold uppercase tracking-wider text-xs gap-2">
                  {updatingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={14} />} Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Preferences Card */}
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-[#2e1d52]/5 border-b border-slate-100 p-6">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-[#2e1d52] flex items-center gap-2">
                <Languages size={16} className="text-primary" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-semibold text-xs text-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="French">Français</SelectItem>
                      <SelectItem value="Arabic">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
