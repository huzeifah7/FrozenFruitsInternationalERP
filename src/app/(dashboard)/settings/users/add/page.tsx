'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, setDoc, serverTimestamp, query, getDocs } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { createAuthUserWithoutLoggingOutAdmin } from '@/lib/secondary-firebase';
import { permissionsRegistry, UserAccessRight } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, X, Plus, Minus, Upload, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AddUserPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState('User');
  const [status, setStatus] = useState('Active');
  
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [roles] = useState(['User', 'Manager', 'Admin']);

  const [accessRights, setAccessRights] = useState<UserAccessRight[]>([
    { moduleKey: permissionsRegistry[0].moduleKey, moduleLabel: permissionsRegistry[0].label, list: true, add: false, update: false, delete: false }
  ]);

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!db) return;
    const fetchLocs = async () => {
      try {
        const q = query(collection(db, 'processing_lines'));
        const snap = await getDocs(q);
        const locs = snap.docs.map(d => ({ id: d.id, name: d.data().title || d.data().name }));
        if (locs.length === 0) {
          // fallback to locations collection
          const locQ = query(collection(db, 'locations'));
          const locSnap = await getDocs(locQ);
          setLocations(locSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
        } else {
          setLocations(locs);
        }
      } catch (err) {}
    };
    fetchLocs();
  }, [db]);

  const validate = () => {
    const newErrors: any = {};
    if (!firstName) newErrors.firstName = 'First Name is required';
    if (!lastName) newErrors.lastName = 'Last Name is required';
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    if (!confirmPassword) newErrors.confirmPassword = 'Confirm Password is required';
    if (password && confirmPassword && password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!locationId) newErrors.locationId = 'Location is required';
    if (!role) newErrors.role = 'Role is required';
    if (!status) newErrors.status = 'Status is required';
    
    // Check for duplicate modules
    const selectedKeys = accessRights.map(r => r.moduleKey);
    const hasDuplicates = selectedKeys.some((val, i) => selectedKeys.indexOf(val) !== i);
    if (hasDuplicates) {
      newErrors.accessRights = 'Duplicate modules are not allowed.';
      toast({ title: 'Validation Error', description: 'You cannot select the same module twice.', variant: 'destructive' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      // Create user using secondary Auth App so admin remains logged in
      const newUser = await createAuthUserWithoutLoggingOutAdmin(email, password);
      const uid = newUser.uid;

      const locName = locations.find(l => l.id === locationId)?.name || '';
      
      const cleanAccessRights = accessRights.map(({ moduleKey, moduleLabel, list, add, update, delete: del }) => ({
        moduleKey, moduleLabel, list, add, update, delete: del
      }));

      await setDoc(doc(db, 'appUsers', uid), {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email,
        phone,
        locationId,
        locationName: locName,
        role,
        position,
        status,
        accessRights: cleanAccessRights,
        photoURL: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.email || 'System',
        updatedBy: user?.email || 'System'
      });

      toast({ title: 'Success', description: 'User added successfully.' });
      router.push('/settings/users');
    } catch (err: any) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: err.message || 'Failed to add user.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addAccessRow = () => {
    const unselected = permissionsRegistry.find(m => !accessRights.some(r => r.moduleKey === m.moduleKey));
    if (!unselected) {
      toast({ title: 'Notice', description: 'All available modules have been added.' });
      return;
    }
    setAccessRights([...accessRights, { moduleKey: unselected.moduleKey, moduleLabel: unselected.label, list: true, add: false, update: false, delete: false }]);
  };

  const removeAccessRow = (index: number) => {
    setAccessRights(accessRights.filter((_, i) => i !== index));
  };

  const updateAccessRow = (index: number, field: string, value: any) => {
    setAccessRights(accessRights.map((r, i) => {
      if (i === index) {
        if (field === 'moduleKey') {
          const matched = permissionsRegistry.find(m => m.moduleKey === value);
          return { ...r, moduleKey: value, moduleLabel: matched?.label || value };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/users' },
    { label: 'Users', href: '/settings/users' },
    { label: 'Add User', active: true }
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Users"
        subtitle="Create a new system user."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/settings/users')} className="h-12 rounded-xl px-6 font-bold text-slate-600">
              <X size={18} className="mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-8 font-bold tracking-wide transition-all">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} className="mr-2" />}
              Add User
            </Button>
          </div>
        }
      />

      <div className="max-w-[1000px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-12">
        {/* Header / Avatar */}
        <div>
          <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider border-b pb-4 mb-8">User Info</h2>
          <div className="flex justify-center mb-8">
            <div className="relative h-28 w-28 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <UserIcon size={40} className="text-slate-400" />
              <button className="absolute bottom-0 right-0 h-8 w-8 bg-[#7a9800] text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                <Upload size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Left Col */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">First Name <span className="text-rose-500">*</span></label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} className={`h-12 mt-2 rounded-xl ${errors.firstName ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} />
                {errors.firstName && <p className="text-xs text-rose-500 font-bold mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email <span className="text-rose-500">*</span></label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`h-12 mt-2 rounded-xl ${errors.email ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} />
                {errors.email && <p className="text-xs text-rose-500 font-bold mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Location <span className="text-rose-500">*</span></label>
                <select value={locationId} onChange={e => setLocationId(e.target.value)} className={`w-full h-12 mt-2 px-4 rounded-xl border ${errors.locationId ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 outline-none text-sm font-semibold`}>
                  <option value="">Select Location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {errors.locationId && <p className="text-xs text-rose-500 font-bold mt-1">{errors.locationId}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Password <span className="text-rose-500">*</span></label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className={`h-12 mt-2 rounded-xl ${errors.password ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} />
                {errors.password && <p className="text-xs text-rose-500 font-bold mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Role <span className="text-rose-500">*</span></label>
                <select value={role} onChange={e => setRole(e.target.value)} className={`w-full h-12 mt-2 px-4 rounded-xl border ${errors.role ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 outline-none text-sm font-semibold`}>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.role && <p className="text-xs text-rose-500 font-bold mt-1">{errors.role}</p>}
              </div>
            </div>

            {/* Right Col */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Last Name <span className="text-rose-500">*</span></label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} className={`h-12 mt-2 rounded-xl ${errors.lastName ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} />
                {errors.lastName && <p className="text-xs text-rose-500 font-bold mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Phone</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-12 mt-2 rounded-xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Position</label>
                <Input value={position} onChange={e => setPosition(e.target.value)} className="h-12 mt-2 rounded-xl border-slate-200 bg-slate-50" />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirm Password <span className="text-rose-500">*</span></label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`h-12 mt-2 rounded-xl ${errors.confirmPassword ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} />
                {errors.confirmPassword && <p className="text-xs text-rose-500 font-bold mt-1">{errors.confirmPassword}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status <span className="text-rose-500">*</span></label>
                <select value={status} onChange={e => setStatus(e.target.value)} className={`w-full h-12 mt-2 px-4 rounded-xl border ${errors.status ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 outline-none text-sm font-semibold`}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                {errors.status && <p className="text-xs text-rose-500 font-bold mt-1">{errors.status}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Access Rights */}
        <div>
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider">Add Accesses Right</h2>
            <Button variant="outline" size="sm" onClick={addAccessRow} className="border-[#7a9800] text-[#7a9800] hover:bg-[#7a9800] hover:text-white">
              <Plus size={16} />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 px-2">
              <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Select Module</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">List</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Add</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Update</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Delete</div>
              <div className="col-span-4"></div>
            </div>

            {accessRights.map((row, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="col-span-4">
                  <select 
                    value={row.moduleKey} 
                    onChange={e => updateAccessRow(index, 'moduleKey', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none"
                  >
                    {permissionsRegistry.map(m => (
                      <option 
                        key={m.moduleKey} 
                        value={m.moduleKey}
                        disabled={accessRights.some((r, i) => r.moduleKey === m.moduleKey && i !== index)}
                      >
                        {m.sidebarParent} &gt; {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 flex justify-center">
                  <input type="checkbox" checked={row.list} onChange={e => updateAccessRow(index, 'list', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-[#7a9800] focus:ring-[#7a9800]" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <input type="checkbox" checked={row.add} onChange={e => updateAccessRow(index, 'add', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-[#7a9800] focus:ring-[#7a9800]" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <input type="checkbox" checked={row.update} onChange={e => updateAccessRow(index, 'update', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-[#7a9800] focus:ring-[#7a9800]" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <input type="checkbox" checked={row.delete} onChange={e => updateAccessRow(index, 'delete', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-[#7a9800] focus:ring-[#7a9800]" />
                </div>
                <div className="col-span-4 flex justify-end">
                  <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => removeAccessRow(index)}>
                    <Minus size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-8 mt-8 border-t">
            <Button onClick={handleSave} disabled={loading} className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-10 font-bold tracking-wide transition-all">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add User'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
