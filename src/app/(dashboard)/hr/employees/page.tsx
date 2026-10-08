"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, UserCheck, UserMinus, CalendarClock, Briefcase, 
  CircleDollarSign, ShieldCheck, Search, Filter, Plus,
  MoreVertical, FileText, ChevronLeft, ChevronRight, X,
  Download, SlidersHorizontal, ArrowUpDown, Building, MapPin,
  Mail, Phone, FileSignature, CheckCircle2, XCircle, AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
// import { exportEmployeesExcel } from '@/lib/export-employees-excel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, updateDoc, deleteDoc, doc } from '@/firebase/firestore-override';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function getSeniorityDuration(dateString: string) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  const diffInMs = Date.now() - date.getTime();
  if (diffInMs < 0) return '—';
  const totalMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0 && months === 0) return 'New';
  if (years === 0) return `${months} month${months > 1 ? 's' : ''}`;
  if (months === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
}

export default function EmployeesDashboardPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'Seasonal' | 'Fixed'>('Seasonal');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Additional Filter States
  const [filterLocation, setFilterLocation] = useState('');
  const [filterGender, setFilterGender] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteEmployee = async () => {
    if (!deleteTarget || !db) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'employees', deleteTarget.id));
      toast({
        title: 'Employee Deleted',
        description: `${deleteTarget.name} has been deleted successfully.`
      });
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: err.message || 'Failed to delete employee record.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // --- DATA FETCHING ---
  const employeesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
  }, [db]);
  
  const { data: rawEmployees, isLoading } = useCollection(employeesQuery);

  const linesQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return query(collection(db, 'processing_lines'));
  }, [db, user, isUserLoading]);
  const { data: processingLines } = useCollection(linesQuery);

  const linesMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (processingLines) {
      processingLines.forEach((line: any) => {
        map[line.id] = line.title || line.name || line.lineName || line.id;
      });
    }
    return map;
  }, [processingLines]);

  // Map Firebase data to UI expected format safely
  const employees = useMemo(() => {
    if (!rawEmployees) return [];
    return rawEmployees.map((emp: any) => ({
      id: emp.id,
      firstName: emp.firstName || 'Unknown',
      lastName: emp.lastName || '',
      gender: emp.gender || 'male',
      photoUrl: emp.imageUrl || `https://ui-avatars.com/api/?name=${emp.firstName}+${emp.lastName}&background=random`,
      position: emp.position || 'Employee',
      department: emp.department || 'N/A', 
      location: linesMap[emp.locationId] || emp.locationId || 'N/A',
      type: emp.employeeStatus || 'Fixed CDD', 
      status: emp.status || 'active',
      phone: emp.phone || 'N/A',
      email: emp.email || '',
      joinDate: emp.joinDate || emp.createdAt?.toDate?.()?.toISOString() || '',
      dateBirth: emp.birthday || '—',
      employmentDate: emp.employmentDate || '—',
      seniority: emp.seniority || '0%',
      familySituation: emp.familySituation || '—',
      shift: emp.shift || '—',
      netSalary: Number(emp.salaryNet) || 0,
      brutSalary: Number(emp.salaryBrut) || 0,
      cnssStatus: emp.cnssStatus || 'Not Declared',
      rib: emp.rib || '—',
      cin: emp.cin || '—',
      matricule: emp.matricule || '—',
      cnssRegistered: emp.cnssStatus === 'Declared',
      createdBy: emp.createdBy || 'Admin', // Modify when auth is fully linked
      updatedBy: emp.updatedBy || '—',
      address: emp.address || '—',
      childrenCount: Number(emp.childrenCount || 0),
      paymentStatus: emp.paymentStatus || '—',
      taxReduction: Number(emp.taxReduction || 0),
      cnssNumber: emp.cnssNumber || '—',
      contractEndDate: emp.contractEndDate || emp.endDate || '—'
    }));
  }, [rawEmployees, linesMap]);

  // --- COMPUTED DATA ---
  const kpis = useMemo(() => {
    if (!employees) return null;
    return {
      total: employees.length,
      fixedCDD: employees.filter(e => e.type === 'Fixed CDD').length,
      fixedCDI: employees.filter(e => e.type === 'Fixed CDI').length,
      seasonal: employees.filter(e => e.type === 'Seasonal').length,
      active: employees.filter(e => e.status === 'active').length,
      inactive: employees.filter(e => e.status === 'inactive').length,
      monthlyPayroll: employees.reduce((sum, e) => sum + (e.netSalary || 0), 0),
      cnss: employees.filter(e => e.cnssRegistered).length,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => {
      // 1. Tab Filter
      if (activeTab === 'Seasonal' && emp.type !== 'Seasonal') return false;
      if (activeTab === 'Fixed' && !emp.type.includes('Fixed')) return false;
      
      // 2. Search Filter (Name, ID, Phone)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        if (!name.includes(term) && 
            !emp.id.toLowerCase().includes(term) && 
            !(emp.phone || '').includes(term)) {
          return false;
        }
      }

      // 3. Advanced Filters
      if (filterLocation && emp.location !== filterLocation) return false;
      if (filterGender && emp.gender.toLowerCase() !== filterGender.toLowerCase()) return false;

      // 4. Column Filters
      const colMatches = Object.entries(columnFilters).every(([key, val]) => {
        if (!val) return true;
        const v = val.toLowerCase();
        switch(key) {
          case 'fullName': return `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(v);
          case 'gender': return emp.gender.toLowerCase() === v;
          case 'phone': return emp.phone.toLowerCase().includes(v);
          case 'type': return emp.type.toLowerCase().includes(v);
          case 'dateBirth': return emp.dateBirth.toLowerCase().includes(v);
          case 'employmentDate': return emp.employmentDate.toLowerCase().includes(v);
          case 'joinDate': return emp.joinDate.toLowerCase().includes(v);
          case 'seniorityYears': return getSeniorityDuration(emp.joinDate).toLowerCase().includes(v);
          case 'familySituation': return emp.familySituation.toLowerCase().includes(v);
          case 'location': return emp.location.toLowerCase().includes(v);
          case 'shift': return emp.shift.toLowerCase().includes(v);
          case 'cnssStatus': return emp.cnssStatus.toLowerCase().includes(v);
          case 'rib': return emp.rib.toLowerCase().includes(v);
          case 'cin': return emp.cin.toLowerCase().includes(v);
          case 'matricule': return emp.matricule.toLowerCase().includes(v);
          case 'status': return emp.status.toLowerCase().includes(v);
          default: return true;
        }
      });
      if (!colMatches) return false;

      return true;
    });
  }, [employees, activeTab, searchTerm, filterLocation, filterGender, columnFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage) || 1;
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterLocation('');
    setFilterGender('');
    setColumnFilters({});
    setCurrentPage(1);
  };

  const handleStatusToggle = async (empId: string, newStatus: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'employees', empId), { status: newStatus });
      toast({ title: 'Status updated' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error updating status' });
    }
  };

  const handleExportExcel = async () => {
    if (isExporting || !employees || employees.length === 0) return;
    setIsExporting(true);
    try {
      const exportData = employees.map(emp => ({
        firstName: emp.firstName,
        lastName: emp.lastName,
        gender: emp.gender,
        phone: emp.phone,
        dateOfBirth: emp.dateBirth,
        joinDate: emp.joinDate,
        employmentDate: emp.employmentDate,
        familySituation: emp.familySituation,
        employeeStatus: emp.type,
        location: emp.location,
        shift: emp.shift,
        contractEndDate: emp.contractEndDate,
        salaryNetto: emp.netSalary,
        salaryBrutto: emp.brutSalary,
        rib: emp.rib,
        cin: emp.cin,
        cnssStatus: emp.cnssStatus,
        cnss: emp.cnssNumber,
        matricule: emp.matricule,
        position: emp.position,
        address: emp.address,
        numberOfChildren: emp.childrenCount,
        paymentStatus: emp.paymentStatus,
        seniority: emp.seniority,
        incomeTaxDeduction: emp.taxReduction,
        status: emp.status
      }));

      const { exportEmployeesExcel } = await import('@/lib/export-employees-excel');
      await exportEmployeesExcel(exportData);

      toast({
        title: "Export Successful",
        description: `HR Employees exported using ExcelJS template.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Export Failed",
        description: "Could not export HR Employees.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-200">Inactive</Badge>;
      case 'on_leave':
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200">On Leave</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Employees Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage personnel, payroll, and HR operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-white border-slate-200 text-slate-600 shadow-sm h-10 rounded-xl font-bold"
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Export
              </>
            )}
          </Button>
          <Button 
            onClick={() => router.push('/hr/employees/add')}
            className="bg-[#193A7B] hover:bg-[#0F2552] text-white shadow-md shadow-[#193A7B]/20 h-10 rounded-xl font-bold"
          >
            <Plus className="mr-2 h-4 w-4 stroke-[3]" /> Add Employee
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <KpiCard title="Total Employees" value={kpis.total} icon={<Users />} color="text-blue-500" bg="bg-blue-50" />
          <KpiCard title="Fixed CDD" value={kpis.fixedCDD} icon={<Briefcase />} color="text-indigo-500" bg="bg-indigo-50" />
          <KpiCard title="Fixed CDI" value={kpis.fixedCDI} icon={<Briefcase />} color="text-teal-500" bg="bg-teal-50" />
          <KpiCard title="Seasonal" value={kpis.seasonal} icon={<CalendarClock />} color="text-orange-500" bg="bg-orange-50" />
          <KpiCard title="Active" value={kpis.active} icon={<UserCheck />} color="text-emerald-500" bg="bg-emerald-50" />
          <KpiCard title="Inactive" value={kpis.inactive} icon={<UserMinus />} color="text-rose-500" bg="bg-rose-50" />
          <KpiCard title="CNSS Registered" value={kpis.cnss} icon={<ShieldCheck />} color="text-purple-500" bg="bg-purple-50" />
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {/* TABS */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => { setActiveTab('Seasonal'); setCurrentPage(1); }}
            className={cn(
              "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
              activeTab === 'Seasonal'
                ? "border-[#0284C7] text-[#0284C7]"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
            )}
          >
            Seasonal
            <Badge variant="secondary" className={cn("ml-1", activeTab === 'Seasonal' ? "bg-[#0284C7]/10 text-[#0284C7]" : "bg-slate-100 text-slate-500")}>
              {employees?.filter(e => e.type === 'Seasonal').length || 0}
            </Badge>
          </button>
          <button
            onClick={() => { setActiveTab('Fixed'); setCurrentPage(1); }}
            className={cn(
              "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
              activeTab === 'Fixed'
                ? "border-[#0284C7] text-[#0284C7]"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
            )}
          >
            Fixed
            <Badge variant="secondary" className={cn("ml-1", activeTab === 'Fixed' ? "bg-[#0284C7]/10 text-[#0284C7]" : "bg-slate-100 text-slate-500")}>
              {employees?.filter(e => e.type.includes('Fixed')).length || 0}
            </Badge>
          </button>
        </div>

        {/* TOOLBAR & FILTERS */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by name, ID, or phone..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#0284C7] text-sm w-full shadow-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            
            {/* Toolbar Buttons */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "h-10 rounded-xl border-slate-200 bg-white font-bold text-slate-600 shadow-sm text-xs transition-colors",
                  showAdvancedFilters && "bg-slate-100 border-slate-300"
                )}
              >
                <Filter size={14} className="mr-2" /> 
                Advanced Filters
                {(filterLocation || filterGender) && (
                  <Badge className="ml-2 bg-[#7a9800] h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">!</Badge>
                )}
              </Button>
            </div>
          </div>

          {/* ADVANCED FILTERS PANEL */}
          {showAdvancedFilters && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Location (Processing Line)</label>
                <select 
                  className="w-full h-9 rounded-lg border-slate-200 text-sm focus:ring-[#7a9800] focus:border-[#7a9800]"
                  value={filterLocation}
                  onChange={(e) => { setFilterLocation(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">All Locations</option>
                  {processingLines?.map((line: any) => {
                    const name = line.title || line.name || line.lineName || line.id;
                    return <option key={line.id} value={name}>{name}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gender</label>
                <select 
                  className="w-full h-9 rounded-lg border-slate-200 text-sm focus:ring-[#7a9800] focus:border-[#7a9800]"
                  value={filterGender}
                  onChange={(e) => { setFilterGender(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="flex items-end gap-2 md:col-span-2 lg:col-span-1">
                <Button onClick={handleResetFilters} variant="ghost" className="h-9 w-full text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-700 text-xs">
                  Reset Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="w-full min-w-[max-content] whitespace-nowrap">
            <TableHeader className="bg-slate-50/80 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 sticky left-0 bg-slate-50/80 z-10">Actions</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Full name</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gender</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Phone number</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Employee status</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date birth</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Employment date</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Join date</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Seniority years</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Seniority rate</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Family situation</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Location</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Shift</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Salary net</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Salary brut</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total salary</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">CNSS Status</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">RIB</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">CIN</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Matricule</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Created by</TableHead>
                <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Updated by</TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent bg-slate-50/50">
                <TableHead className="py-2 px-2 sticky left-0 bg-slate-50/80 z-10 border-b border-slate-100"></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, fullName: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100">
                  <select 
                    className="h-7 text-xs bg-white border border-slate-200 rounded px-1.5 py-0 w-full focus:ring-[#7a9800] focus:border-[#7a9800] font-bold text-slate-700"
                    value={columnFilters.gender || ''}
                    onChange={(e) => setColumnFilters({...columnFilters, gender: e.target.value})}
                  >
                    <option value="">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, phone: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, type: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, dateBirth: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, employmentDate: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, joinDate: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, seniorityYears: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, familySituation: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, location: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, shift: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, cnssStatus: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, rib: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, cin: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, matricule: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"><Input placeholder="Filter..." className="h-7 text-xs bg-white" onChange={(e) => setColumnFilters({...columnFilters, status: e.target.value})} /></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"></TableHead>
                <TableHead className="py-2 px-2 border-b border-slate-100"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={22} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin mx-auto" />
                      <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Loading Employees...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={22} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 max-w-sm mx-auto">
                      <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users size={28} className="text-slate-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-700">No employees found</h3>
                        <p className="text-sm text-slate-500 mt-1">Create your first employee or adjust your filters to find what you're looking for.</p>
                      </div>
                      <Button onClick={handleResetFilters} variant="outline" className="mt-2 font-bold text-xs">
                        Clear Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-slate-50/60 transition-colors group border-b border-slate-100 last:border-none">
                    {/* Actions */}
                    <TableCell className="py-3 sticky left-0 bg-white group-hover:bg-slate-50/60 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 data-[state=open]:bg-slate-100">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-1 font-medium text-xs z-50">
                          <DropdownMenuItem onClick={() => router.push(`/hr/employees/${emp.id}`)} className="cursor-pointer py-2 px-3 focus:bg-slate-100 rounded-lg">
                            <UserCheck size={14} className="mr-2 text-slate-400" /> View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/hr/employees/${emp.id}/edit`)} className="cursor-pointer py-2 px-3 focus:bg-slate-100 rounded-lg">
                            <FileSignature size={14} className="mr-2 text-slate-400" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-100" />
                          <DropdownMenuItem 
                            onClick={() => setDeleteTarget({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` })}
                            className="cursor-pointer py-2 px-3 focus:bg-rose-50 text-rose-600 font-bold rounded-lg"
                          >
                            <UserMinus size={14} className="mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {/* Full Name */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <img src={emp.photoUrl} alt={emp.firstName} className="h-6 w-6 rounded-full object-cover border border-slate-200" />
                        <Link href={`/hr/employees/${emp.id}`} className="font-bold text-slate-800 hover:text-[#7a9800] transition-colors">
                          {emp.firstName} {emp.lastName}
                        </Link>
                      </div>
                    </TableCell>

                    {/* Gender */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600 capitalize">{emp.gender}</TableCell>

                    {/* Phone number */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.phone}</TableCell>

                    {/* Employee status */}
                    <TableCell className="py-3">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase">{emp.type}</Badge>
                    </TableCell>

                    {/* Date birth */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.dateBirth}</TableCell>

                    {/* Employment date */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.employmentDate}</TableCell>

                    {/* Join date */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">
                      {emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </TableCell>

                    {/* Seniority years */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">
                      {getSeniorityDuration(emp.joinDate)}
                    </TableCell>

                    {/* Seniority rate */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.seniority}</TableCell>

                    {/* Family situation */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.familySituation}</TableCell>

                    {/* Location */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.location}</TableCell>

                    {/* Shift */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.shift}</TableCell>

                    {/* Salary net */}
                    <TableCell className="py-3 text-xs font-black text-slate-800">{emp.netSalary.toLocaleString()} MAD</TableCell>

                    {/* Salary brut */}
                    <TableCell className="py-3 text-xs font-bold text-slate-600">{emp.brutSalary.toLocaleString()} MAD</TableCell>

                    {/* Total salary */}
                    <TableCell className="py-3 text-xs font-black text-[#193A7B]">{(emp.netSalary + emp.brutSalary).toLocaleString()} MAD</TableCell>

                    {/* CNSS Status */}
                    <TableCell className="py-3">
                      <Badge variant="outline" className={emp.cnssRegistered ? "bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px]" : "bg-slate-50 text-slate-500 text-[10px]"}>
                        {emp.cnssStatus}
                      </Badge>
                    </TableCell>

                    {/* RIB */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.rib}</TableCell>

                    {/* CIN */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.cin}</TableCell>

                    {/* Matricule */}
                    <TableCell className="py-3 text-xs font-medium text-slate-600">{emp.matricule}</TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="focus:outline-none">
                          {getStatusBadge(emp.status)}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleStatusToggle(emp.id, 'active')} className="cursor-pointer">Active</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusToggle(emp.id, 'inactive')} className="cursor-pointer">Inactive</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {/* Created by */}
                    <TableCell className="py-3 text-xs font-medium text-slate-500">{emp.createdBy}</TableCell>

                    {/* Updated by */}
                    <TableCell className="py-3 text-xs font-medium text-slate-500">{emp.updatedBy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            Showing {Math.min(filteredEmployees.length, currentPage * itemsPerPage)} of {filteredEmployees.length} Employee(s)
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="h-8 px-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
            >
              <ChevronLeft size={16} />
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button 
                key={i} 
                variant={currentPage === i + 1 ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setCurrentPage(i + 1)}
                className={cn(
                  "h-8 w-8 p-0 rounded-lg text-xs font-bold",
                  currentPage === i + 1 ? "bg-[#193A7B] text-white hover:bg-[#0F2552]" : "text-slate-500 hover:bg-slate-200"
                )}
              >
                {i + 1}
              </Button>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="h-8 px-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md bg-white border border-slate-100 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-slate-800">
              Delete Employee Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500 mt-1">
              Are you sure you want to delete <span className="font-bold text-slate-800">{deleteTarget?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex items-center gap-3">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl font-bold border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteEmployee();
              }}
              disabled={isDeleting}
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isDeleting ? "Deleting..." : "Delete Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({ title, value, icon, color, bg }: { title: string, value: string | number, icon: React.ReactNode, color: string, bg: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-slate-300 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        <div className={cn("p-1.5 rounded-lg", bg, color)}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  );
}
