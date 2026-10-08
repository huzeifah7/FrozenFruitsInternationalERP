'use client';

import React, { useState, useMemo } from 'react';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser,
} from '@/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp, 
  query 
} from '@/firebase/firestore-override';
import { 
  Card, 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Search, 
  Filter, 
  Columns, 
  Menu, 
  Maximize2,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

export default function HRSettingsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    grossHourlyWage: '',
    netHourlyWage: '',
    plafondCNSS: '6000',
    cnss: '4.48',
    amoRate: '2.26',
    applicationDate: new Date().toISOString().split('T')[0]
  });

  // Data Fetching
  const settingsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'hrSettings'));
  }, [db, user]);

  const { data: rawSettings, isLoading } = useCollection(settingsQuery);
  
  const settings = useMemo(() => {
    if (!rawSettings) return null;
    return [...rawSettings].sort((a, b) => new Date(b.applicationDate || 0).getTime() - new Date(a.applicationDate || 0).getTime());
  }, [rawSettings]);

  const handleOpenAdd = () => {
    setEditingSettingId(null);
    setFormData({
      grossHourlyWage: '17.92',
      netHourlyWage: '16.72',
      plafondCNSS: '6000',
      cnss: '4.48',
      amoRate: '2.26',
      applicationDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingSettingId(item.id);
    setFormData({
      grossHourlyWage: item.grossHourlyWage?.toString() || '17.92',
      netHourlyWage: item.netHourlyWage?.toString() || '16.72',
      plafondCNSS: item.plafondCNSS?.toString() || '6000',
      cnss: item.cnss?.toString() || '4.48',
      amoRate: item.amoRate?.toString() || '2.26',
      applicationDate: item.applicationDate || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    setLoading(true);

    if (editingSettingId) {
      // Edit existing setting
      const updateData = {
        grossHourlyWage: Number(formData.grossHourlyWage),
        netHourlyWage: Number(formData.netHourlyWage),
        plafondCNSS: Number(formData.plafondCNSS),
        cnss: Number(formData.cnss),
        amoRate: Number(formData.amoRate),
        applicationDate: formData.applicationDate,
        updatedAt: serverTimestamp(),
        updatedBy: user.email || 'Admin'
      };

      try {
        const docRef = doc(db, 'hrSettings', editingSettingId);
        await updateDoc(docRef, updateData);
        toast({
          title: "Setting Updated",
          description: "HR configuration record updated successfully.",
        });
        setIsModalOpen(false);
      } catch (error: any) {
        console.error("Error updating hrSettings:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: error?.message || 'Could not update setting' });
      } finally {
        setLoading(false);
      }
    } else {
      // Create new setting
      const dataToSave = {
        grossHourlyWage: Number(formData.grossHourlyWage),
        netHourlyWage: Number(formData.netHourlyWage),
        plafondCNSS: Number(formData.plafondCNSS),
        cnss: Number(formData.cnss),
        amoRate: Number(formData.amoRate),
        applicationDate: formData.applicationDate,
        createdAt: serverTimestamp(),
        createdBy: user.email || 'Admin',
        updatedAt: serverTimestamp(),
        updatedBy: user.email || 'Admin'
      };

      try {
        const colRef = collection(db, 'hrSettings');
        await addDoc(colRef, dataToSave);
        toast({
          title: "Setting Added",
          description: "New HR configuration has been applied.",
        });
        setIsModalOpen(false);
      } catch (error: any) {
        console.error("Error adding hrSettings:", error);
        toast({ variant: 'destructive', title: 'Add Failed', description: error?.message || 'Could not add setting' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteSetting = async (settingId: string) => {
    if (!db || !confirm('Are you sure you want to delete this setting record?')) return;
    try {
      await deleteDoc(doc(db, 'hrSettings', settingId));
      toast({
        title: "Setting Deleted",
        description: "The HR configuration record has been removed.",
      });
    } catch (error: any) {
      console.error("Error deleting setting:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error?.message || "Failed to delete setting record.",
      });
    }
  };

  const formatDate = (val: any) => {
    if (!val) return '—';
    if (val?.seconds) {
      return format(new Date(val.seconds * 1000), 'MMMM d, yyyy');
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return format(d, 'MMMM d, yyyy');
    return String(val);
  };

  return (
    <div className="w-full p-8 space-y-6 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Setting</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Profile / Setting</p>
        </div>
        <Button 
          onClick={handleOpenAdd}
          className="gap-2 bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold text-xs h-10 px-6 rounded-lg shadow-sm transition-all"
        >
          Update Setting
        </Button>
      </div>

      {/* Toolbar & Table Section */}
      <div className="space-y-3">
        {/* Right-aligned Table Control Icons Toolbar */}
        <div className="flex items-center justify-end gap-4 text-gray-400 px-1">
          <button title="Search" className="hover:text-gray-700 transition-colors p-1">
            <Search size={18} />
          </button>
          <button title="Filter" className="hover:text-gray-700 transition-colors p-1">
            <Filter size={18} />
          </button>
          <button title="Columns" className="hover:text-gray-700 transition-colors p-1">
            <Columns size={18} />
          </button>
          <button title="Density" className="hover:text-gray-700 transition-colors p-1">
            <Menu size={18} />
          </button>
          <button title="Fullscreen" className="hover:text-gray-700 transition-colors p-1">
            <Maximize2 size={18} />
          </button>
        </div>

        {/* Main Table Card (Scrollable for all columns) */}
        <Card className="border border-slate-100 shadow-sm rounded-xl bg-white overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full min-w-[1200px]">
              <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Gross Hourly Wage</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Net Hourly Wage</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Plafound CNSS</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">CNSS Rate</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">AMO Rate</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Application Date</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Created At</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Created By</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Updated At</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 whitespace-nowrap">Updated By</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-4 text-center whitespace-nowrap">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={11} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : !settings || settings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-48 text-center text-muted-foreground font-medium italic opacity-60">
                      No settings records found. Click &quot;Update Setting&quot; to initialize configuration.
                    </TableCell>
                  </TableRow>
                ) : (
                  settings.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                      <TableCell className="font-semibold text-sm text-slate-800 py-4 whitespace-nowrap">{item.grossHourlyWage ?? 17.92}</TableCell>
                      <TableCell className="font-semibold text-sm text-slate-800 py-4 whitespace-nowrap">{item.netHourlyWage ?? 16.72}</TableCell>
                      <TableCell className="font-semibold text-sm text-slate-800 py-4 whitespace-nowrap">{item.plafondCNSS ?? 6000}</TableCell>
                      <TableCell className="font-semibold text-sm text-slate-800 py-4 whitespace-nowrap">{item.cnss ?? 4.48}</TableCell>
                      <TableCell className="font-semibold text-sm text-slate-800 py-4 whitespace-nowrap">{item.amoRate ?? 2.26}</TableCell>
                      <TableCell className="font-medium text-sm text-slate-700 py-4 whitespace-nowrap">{item.applicationDate || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-500 py-4 whitespace-nowrap">{formatDate(item.createdAt)}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium py-4 whitespace-nowrap">{item.createdBy?.split('@')[0] || 'System'}</TableCell>
                      <TableCell className="text-xs text-slate-500 py-4 whitespace-nowrap">{formatDate(item.updatedAt || item.createdAt)}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium py-4 whitespace-nowrap">{item.updatedBy?.split('@')[0] || item.createdBy?.split('@')[0] || 'System'}</TableCell>
                      <TableCell className="text-center py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            onClick={() => handleOpenEdit(item)}
                            className="bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold text-xs h-8 px-4 rounded shadow-sm transition-all"
                          >
                            EDIT
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSetting(item.id)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Setting"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Add / Edit Setting Dialog Popup */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md border-none shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-[#193A7B] text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                <Settings size={20} className="text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold uppercase tracking-tight">
                  {editingSettingId ? 'Edit Setting' : 'Add New Setting'}
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs font-medium">
                  Configure global HR rates and application date.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Gross Hourly Wage (DH)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.grossHourlyWage} 
                  onChange={e => setFormData({...formData, grossHourlyWage: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 font-medium"
                  placeholder="17.92"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Net Hourly Wage (DH)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.netHourlyWage} 
                  onChange={e => setFormData({...formData, netHourlyWage: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 font-medium"
                  placeholder="16.72"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Plafond CNSS (DH)</Label>
              <Input 
                type="number" 
                step="0.01"
                value={formData.plafondCNSS} 
                onChange={e => setFormData({...formData, plafondCNSS: e.target.value})}
                className="h-10 rounded-lg border-slate-200 font-medium"
                placeholder="6000"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">CNSS Rate (%)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.cnss} 
                  onChange={e => setFormData({...formData, cnss: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 font-medium"
                  placeholder="4.48"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">AMO Rate (%)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.amoRate} 
                  onChange={e => setFormData({...formData, amoRate: e.target.value})}
                  className="h-10 rounded-lg border-slate-200 font-medium"
                  placeholder="2.26"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Application Date</Label>
              <Input 
                type="date" 
                value={formData.applicationDate} 
                onChange={e => setFormData({...formData, applicationDate: e.target.value})}
                className="h-10 rounded-lg border-slate-200 font-medium"
                required
              />
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsModalOpen(false)}
                className="font-bold text-slate-500 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold text-xs h-10 px-6 rounded-lg shadow-sm transition-all"
              >
                {loading ? 'Saving...' : editingSettingId ? 'Save Changes' : 'Add Setting'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
