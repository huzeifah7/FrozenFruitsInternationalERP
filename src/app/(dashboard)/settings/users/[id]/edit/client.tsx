'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, query, getDocs, serverTimestamp } from '@/firebase/firestore-override';
import { updatePassword } from 'firebase/auth';
import { useFirestore, useUser, useAuth } from '@/firebase';
import { permissionsRegistry, UserAccessRight } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, X, Plus, Minus, Upload, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function normalizeValue(value: any): string {
  if (!value) return "";
  if (typeof value === "object") {
    return String(
      value.value ??
      value.label ??
      value.name ??
      value.id ??
      ""
    ).trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
}

function findMatchingOption(options: any[], savedValue: any) {
  const saved = normalizeValue(savedValue);
  if (!saved) return null;
  return (
    options.find((option) => {
      if (typeof option === 'string') return normalizeValue(option) === saved;
      return (
        normalizeValue(option.value) === saved ||
        normalizeValue(option.label) === saved ||
        normalizeValue(option.name) === saved ||
        normalizeValue(option.id) === saved
      );
    }) || null
  );
}

function toBoolean(value: any): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [position, setPosition] = useState('');
  const [role, setRole] = useState('User');
  const [status, setStatus] = useState('Active');
  
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState(['User', 'Manager', 'Admin']);
  const [statusOptions, setStatusOptions] = useState(['Active', 'Inactive']);

  const [accessRights, setAccessRights] = useState<UserAccessRight[]>([]);

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!db || !id) return;
    const loadEditUser = async () => {
      try {
        setFetching(true);
        // Load locations
        let locs: {id: string; name: string}[] = [];
        try {
          const q = query(collection(db, 'processing_lines'));
          const snap = await getDocs(q);
          locs = snap.docs.map(d => ({ id: d.id, name: d.data().title || d.data().name }));
          if (locs.length === 0) {
            const locQ = query(collection(db, 'locations'));
            const locSnap = await getDocs(locQ);
            locs = locSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
          }
        } catch (e) { console.error(e); }

        // Load user
        const userSnap = await getDoc(doc(db, 'appUsers', id));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
          setPosition(data.position || '');

          // Location
          const savedLoc = data.locationId || data.locationName || data.userLocation || data.userLocationId || data.processingLineId || data.processingLineName;
          const matchedLoc = findMatchingOption(locs, savedLoc);
          if (matchedLoc) {
            setLocationId(matchedLoc.id);
          } else if (savedLoc) {
            const fallbackVal = typeof savedLoc === 'object' ? (savedLoc.id || savedLoc.value || savedLoc.name || '') : String(savedLoc);
            const fallbackName = data.locationName || fallbackVal;
            setLocationId(fallbackVal);
            locs.push({ id: fallbackVal, name: fallbackName });
          }
          setLocations(locs);

          // Role
          const savedRole = data.role || data.roleName || data.roleId;
          const matchedRole = findMatchingOption(['Admin', 'Manager', 'User'], savedRole);
          if (matchedRole) {
            setRole(matchedRole);
          } else if (savedRole) {
            const fbRole = String(savedRole);
            setRole(fbRole);
            setRoles(prev => prev.includes(fbRole) ? prev : [...prev, fbRole]);
          }

          // Status
          const savedStatus = data.status;
          const matchedStatus = findMatchingOption(['Active', 'Inactive'], savedStatus);
          if (matchedStatus) {
            setStatus(matchedStatus);
          } else if (savedStatus) {
            const fbStatus = String(savedStatus);
            setStatus(fbStatus);
            setStatusOptions(prev => prev.includes(fbStatus) ? prev : [...prev, fbStatus]);
          }

          // Access Rights
          let accesses: any[] = [];
          if (data.accessRights && Array.isArray(data.accessRights)) accesses = data.accessRights;
          else if (data.permissions && Array.isArray(data.permissions)) accesses = data.permissions;
          else if (data.accesses && Array.isArray(data.accesses)) accesses = data.accesses;
          else if (data.accessRights && typeof data.accessRights === 'object') {
            accesses = Object.entries(data.accessRights).map(([key, val]: any) => ({
              moduleKey: key,
              ...val
            }));
          }

          if (accesses.length > 0) {
            setAccessRights(accesses.map((r: any) => {
              const savedMod = r.moduleKey || r.moduleLabel || r.name;
              const matchedMod = permissionsRegistry.find(m => 
                normalizeValue(m.moduleKey) === normalizeValue(savedMod) || 
                normalizeValue(m.label) === normalizeValue(savedMod)
              );
              return {
                moduleKey: matchedMod ? matchedMod.moduleKey : (r.moduleKey || String(savedMod)),
                moduleLabel: matchedMod ? matchedMod.label : (r.moduleLabel || String(savedMod)),
                list: toBoolean(r.list),
                add: toBoolean(r.add),
                update: toBoolean(r.update),
                delete: toBoolean(r.delete)
              };
            }));
          } else {
            setAccessRights([]);
          }
        } else {
          setLocations(locs);
        }
      } catch (err) {
        console.error('Error fetching user edit data:', err);
      } finally {
        setFetching(false);
      }
    };
    loadEditUser();
  }, [db, id]);

  const validate = () => {
    const newErrors: any = {};
    if (!firstName) newErrors.firstName = 'First Name is required';
    if (!lastName) newErrors.lastName = 'Last Name is required';
    if (!email) newErrors.email = 'Email is required';
    
    if (password) {
      if (password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm the new password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (!locationId) newErrors.locationId = 'Location is required';
    if (!role) newErrors.role = 'Role is required';
    if (!status) newErrors.status = 'Status is required';

    const selectedKeys = accessRights.map(r => r.moduleKey);
    const hasDuplicates = selectedKeys.some((val, i) => selectedKeys.indexOf(val) !== i);
    if (hasDuplicates) {
      newErrors.accessRights = 'Duplicate modules are not allowed.';
      toast({ title: 'Validation Error', description: 'You cannot select the same module twice.', variant: 'destructive' });
    }

    if (role !== 'Admin' && accessRights.length === 0) {
      newErrors.accessRights = 'At least one module is required for non-Admin users.';
      toast({ title: 'Validation Error', description: 'Non-admin users must have at least one access right.', variant: 'destructive' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      const locName = locations.find(l => l.id === locationId)?.name || '';
      
      const cleanAccessRights = accessRights.map(({ moduleKey, moduleLabel, list, add, update, delete: del }) => ({
        moduleKey, moduleLabel, list, add, update, delete: del
      }));

      await updateDoc(doc(db, 'appUsers', id), {
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
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System'
      });

      if (password && auth) {
        const { updateUserPasswordClient } = await import('@/services/userService');
        const res = await updateUserPasswordClient({
          auth,
          currentUser: auth.currentUser,
          targetUid: id,
          newPassword: password,
        });
        if (res.message) {
          toast({ title: 'Password Status', description: res.message });
        }
      }

      toast({ title: 'Success', description: 'User updated successfully.' });
      router.push('/settings/users');
    } catch (err: any) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: err.message || 'Failed to update user.', variant: 'destructive' });
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
    { label: 'Edit User', active: true }
  ];

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f3f3] gap-4">
        <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Users"
        subtitle="Update user details and permissions."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/settings/users')} className="h-12 rounded-xl px-6 font-bold text-slate-600">
              <X size={18} className="mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-8 font-bold tracking-wide transition-all">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} className="mr-2" />}
              Update User
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
                  <option value="" disabled>Select Location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {errors.locationId && <p className="text-xs text-rose-500 font-bold mt-1">{errors.locationId}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">New Password (Optional)</label>
                <div className="relative mt-2">
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className={`h-12 rounded-xl pr-10 ${errors.password ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} 
                    placeholder="Leave blank to keep unchanged" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirm Password</label>
                <div className="relative mt-2">
                  <Input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className={`h-12 rounded-xl pr-10 ${errors.confirmPassword ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} 
                    placeholder="Confirm new password" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-rose-500 font-bold mt-1">{errors.confirmPassword}</p>}
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status <span className="text-rose-500">*</span></label>
                <select value={status} onChange={e => setStatus(e.target.value)} className={`w-full h-12 mt-2 px-4 rounded-xl border ${errors.status ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 outline-none text-sm font-semibold`}>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.status && <p className="text-xs text-rose-500 font-bold mt-1">{errors.status}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Access Rights */}
        <div>
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider">Access Rights</h2>
            <Button variant="outline" size="sm" onClick={addAccessRow} className="border-[#7a9800] text-[#7a9800] hover:bg-[#7a9800] hover:text-white">
              <Plus size={16} />
            </Button>
          </div>

          {errors.accessRights && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-500 text-sm font-bold border border-rose-100">
              {errors.accessRights}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 px-2">
              <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Select Module</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">List</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Add</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Update</div>
              <div className="col-span-1 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Delete</div>
              <div className="col-span-4"></div>
            </div>

            {accessRights.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm italic bg-slate-50 rounded-xl border border-slate-100">
                No access rights configured for this user.
              </div>
            ) : (
              accessRights.map((row, index) => (
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
                      {!permissionsRegistry.some(m => m.moduleKey === row.moduleKey) && (
                        <option value={row.moduleKey}>{row.moduleLabel || row.moduleKey}</option>
                      )}
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
              ))
            )}
          </div>

          <div className="flex justify-end pt-8 mt-8 border-t">
            <Button onClick={handleSave} disabled={loading} className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-10 font-bold tracking-wide transition-all">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update User'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
