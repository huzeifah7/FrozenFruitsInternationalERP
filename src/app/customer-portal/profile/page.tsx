'use client';

import React, { useState, useEffect } from 'react';
import { useCustomerAuth, hashPasswordSHA256 } from '@/components/customer-auth-provider';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, setDoc } from '@/firebase/firestore-override';
import { User, Lock, Pencil, Loader2, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';

export default function CustomerProfilePage() {
  const { user, customer, loading: authLoading, refreshUser } = useCustomerAuth();
  const db = useFirestore();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [loading, setLoading] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [userFunction, setUserFunction] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || customer?.companyName || '');
      setLastName(user.last_name || '');
      setEmail(user.email || customer?.email || '');
      setUserFunction(user.function || 'Customer Administrator');
    } else if (customer) {
      setFirstName(customer.companyName || '');
      setEmail(customer.email || '');
      setUserFunction('Customer Administrator');
    }
  }, [user, customer]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setLoading(true);

    try {
      if (user?.id) {
        const userRef = doc(db, 'customer_portal_users', user.id);
        await updateDoc(userRef, {
          first_name: firstName,
          last_name: lastName,
          email: email.toLowerCase().trim(),
          function: userFunction
        });
      }
      
      if (customer?.id) {
        const custRef = doc(db, 'customers', customer.id);
        await updateDoc(custRef, {
          companyName: firstName,
          email: email.toLowerCase().trim(),
        });
      }

      await refreshUser();

      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        icon: 'success',
        title: 'Profile Updated Successfully'
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        icon: 'error',
        title: 'Failed to update profile'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        icon: 'error',
        title: 'Passwords do not match'
      });
      return;
    }

    if (!db || !user?.id) return;
    setLoading(true);

    try {
      const newHashed = await hashPasswordSHA256(newPassword);
      const userRef = doc(db, 'customer_portal_users', user.id);
      await updateDoc(userRef, {
        password: newHashed
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        icon: 'success',
        title: 'Password Changed Successfully'
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        icon: 'error',
        title: 'Failed to change password'
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-[#709506] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 space-y-6 max-w-7xl mx-auto">
      {/* Title & Breadcrumbs */}
      <div>
        <h1 className="text-2xl font-bold text-[#3b2164]">Update Profile</h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
          <span>Profile</span>
          <span>/</span>
          <span className="text-[#709506] font-medium">Update Profile</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side Navigation */}
        <Card className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-3 space-y-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-[#709506]/10 text-[#709506]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <User size={16} /> Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'password'
                ? 'bg-[#709506]/10 text-[#709506]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Lock size={16} /> Change Password
          </button>
        </Card>

        {/* Right Main Form Container */}
        <div className="lg:col-span-3">
          <Card className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-8 space-y-8">
            {activeTab === 'profile' ? (
              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <h2 className="text-lg font-semibold text-[#3b2164]">User Information</h2>

                {/* Avatar with Pencil Edit Icon */}
                <div className="flex justify-center my-4">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                      <User size={48} className="text-slate-300" />
                    </div>
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-[#709506] hover:border-[#709506] transition-all"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* First Name & Last Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">First Name</Label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                        placeholder="First Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-600">Last Name</Label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                        placeholder="Last Name"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                      placeholder="Email Address"
                    />
                  </div>

                  {/* Function */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">Function</Label>
                    <Input
                      value={userFunction}
                      onChange={(e) => setUserFunction(e.target.value)}
                      className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                      placeholder="User Function / Position"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#709506] hover:bg-[#5e7e05] text-white font-semibold h-10 px-8 rounded-lg text-xs shadow-xs"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-8">
                <h2 className="text-lg font-semibold text-[#3b2164]">Change Password</h2>

                <div className="space-y-6 max-w-xl">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">Current Password</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                      placeholder="••••••••"
                    />
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                      placeholder="••••••••"
                    />
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600">Confirm Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-lg border-slate-200 text-xs focus-visible:ring-[#709506]"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#709506] hover:bg-[#5e7e05] text-white font-semibold h-10 px-8 rounded-lg text-xs shadow-xs"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
