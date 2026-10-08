'use client';

import { generatePayslipPDF, generateBatchPayslipsPDF, buildPayslipData, loadLogoAsDataUrl } from '@/lib/export-payslip-pdf';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser
} from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit
} from '@/firebase/firestore-override';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Calculator, 
  FileText, 
  Filter, 
  Search, 
  ArrowRight,
  Landmark,
  Loader2,
  Calendar,
  AlertCircle,
  Settings,
  AlertTriangle,
  ExternalLink,
  XCircle,
  Clock,
  RefreshCcw
} from 'lucide-react';
import { format, endOfMonth, startOfMonth, setDate as setDayOfMonth } from 'date-fns';
import Link from 'next/link';

export default function PaySlipsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  // Filter States
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [employeeType, setEmployeeType] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState<string | string[]>('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  // Local state for results triggered by "Search"
  const [appliedFilters, setAppliedFilters] = useState<{
    start: string;
    end: string;
    type: string;
    location: string;
    staff: string | string[];
    shift: string;
  }>({
    start: firstDay,
    end: lastDay,
    type: 'all',
    location: 'all',
    staff: 'all',
    shift: 'all'
  });

  const handleToggleEmployee = (id: string) => {
    setEmployeeFilter(prev => {
      if (prev === 'all') {
        return [id];
      }
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        return next.length === 0 ? 'all' : next;
      }
      return [...prev, id];
    });
  };

  const handleSelectAllEmployees = () => {
    setEmployeeFilter('all');
  };

  const getEmployeeFilterLabel = () => {
    if (employeeFilter === 'all') return 'Select';
    if (Array.isArray(employeeFilter)) {
      if (employeeFilter.length === 1) {
        const emp = employees?.find(e => e.id === employeeFilter[0]);
        return emp ? `${emp.firstName} ${emp.lastName}` : '1 Selected';
      }
      return `${employeeFilter.length} Selected`;
    }
    return 'Select';
  };

  // Initialize Period Dates (Quinze system)
  useEffect(() => {
    const today = new Date();
    const day = today.getDate();
    
    let start, end;
    if (day <= 15) {
      start = startOfMonth(today);
      end = setDayOfMonth(today, 15);
    } else {
      start = setDayOfMonth(today, 16);
      end = endOfMonth(today);
    }

    const s = format(start, 'yyyy-MM-dd');
    const e = format(end, 'yyyy-MM-dd');
    setStartDate(s);
    setEndDate(e);
    setAppliedFilters(prev => ({ ...prev, start: s, end: e }));
  }, []);

  // Data Fetching
  const employeesQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'employees');
  }, [db, user, isUserLoading]);

  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'locations');
  }, [db, user, isUserLoading]);

  const settingsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return query(collection(db, 'hrSettings'));
  }, [db, user, isUserLoading]);

  // Fetch all work entries for the selected period to aggregate in-memory (reactive)
  const workEntriesQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading || !appliedFilters.start || !appliedFilters.end) return null;
    return query(
      collection(db, 'work_time_tracking'),
      where('date', '>=', appliedFilters.start),
      where('date', '<=', appliedFilters.end)
    );
  }, [db, user, isUserLoading, appliedFilters.start, appliedFilters.end]);

  const { data: employees } = useCollection(employeesQuery, { where: [], orderBy: [] });
  const { data: locations } = useCollection(locationsQuery, { where: [], orderBy: [] });
  const { data: latestSettings } = useCollection(settingsQuery, { where: [], orderBy: [] });
  const { data: workEntries, isLoading: isLoadingWork, error: workError } = useCollection(workEntriesQuery, { where: [], orderBy: [] });

  // Aggregation Logic: Group work entries by employee and calculate earnings
  const calculatedSlips = useMemo(() => {
    if (!employees || !workEntries || !latestSettings?.[0]) return [];

    const sortedSettings = [...latestSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime());
    const hourlyWage = Number(sortedSettings[0].netHourlyWage || 0);
    
    // Group entries by employeeId
    const entriesByEmployee = workEntries.reduce((acc, entry) => {
      const id = entry.employeeId;
      if (!acc[id]) acc[id] = [];
      acc[id].push(entry);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate slip for each employee
    return employees
      .filter(emp => {
        const matchesType = appliedFilters.type === 'all' || emp.employeeStatus === appliedFilters.type;
        const matchesLocation = appliedFilters.location === 'all' || emp.locationId === appliedFilters.location;
        const matchesEmployee = appliedFilters.staff === 'all' || 
          (Array.isArray(appliedFilters.staff) 
            ? appliedFilters.staff.includes(emp.id) 
            : emp.id === appliedFilters.staff);
        const matchesShift = appliedFilters.shift === 'all' || emp.shift === appliedFilters.shift;
        const matchesSearch = !searchTerm || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesLocation && matchesEmployee && matchesShift && matchesSearch && emp.status === 'active';
      })
      .map(emp => {
        const employeeEntries = entriesByEmployee[emp.id] || [];
        let totalHours = 0;
        let totalAdvance = 0;

        employeeEntries.forEach((entry: any) => {
          totalHours += Number(entry.totalHours || 0);
          totalAdvance += Number(entry.advanceSalary || 0);
        });

        const netEarning = totalHours * hourlyWage;

        return {
          id: `slip-${emp.id}-${appliedFilters.start}`,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          position: emp.position || 'Employee',
          startDate: appliedFilters.start,
          endDate: appliedFilters.end,
          totalHours,
          netHourlyWage: hourlyWage,
          netEarning,
          advanceSalary: totalAdvance,
          paymentMethod: emp.paymentStatus || 'Virement',
          rib: emp.rib || 'N/A'
        };
      })
      .filter(slip => slip.totalHours > 0); // Only show slips with recorded work
  }, [employees, workEntries, latestSettings, appliedFilters, searchTerm]);

  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingBatchPDF, setIsGeneratingBatchPDF] = useState(false);

  const handleExportBankTransfer = async () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing Period",
        description: "Please select a start and end date."
      });
      return;
    }

    if (!employees || !workEntries || !latestSettings?.[0]) {
      toast({
        variant: "destructive",
        title: "Data Not Ready",
        description: "Payroll data is still loading."
      });
      return;
    }

    if (calculatedSlips.length === 0) {
      toast({
        variant: "destructive",
        title: "No Eligible Employees",
        description: "No employees with recorded work were found for this period."
      });
      return;
    }

    setIsExporting(true);
    try {
      const { exportBankTransferExcel } = await import('@/lib/export-bank-transfer');
      await exportBankTransferExcel(
        calculatedSlips,
        employees,
        workEntries,
        [...latestSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0],
        appliedFilters.start || startDate,
        appliedFilters.end || endDate
      );
      toast({
        title: "Bank Transfer Exported",
        description: "The Excel file has been generated successfully."
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate the bank transfer Excel file."
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleApplyFilters = () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing Period",
        description: "Please select a start and end date."
      });
      return;
    }
    setAppliedFilters({
      start: startDate,
      end: endDate,
      type: employeeType,
      location: locationFilter,
      staff: employeeFilter,
      shift: shiftFilter
    });
    toast({
      title: "Filters Applied",
      description: "Updating payroll registry based on selected criteria."
    });
  };

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing Period",
        description: "Please select a start and end date."
      });
      return;
    }

    setAppliedFilters({
      start: startDate,
      end: endDate,
      type: employeeType,
      location: locationFilter,
      staff: employeeFilter,
      shift: shiftFilter
    });

    toast({
      title: "Payslips Calculated",
      description: "Payroll registry updated for the selected period."
    });
  };

  const handleClearFilters = () => {
    const today = new Date();
    const start = format(startOfMonth(today), 'yyyy-MM-dd');
    const end = format(endOfMonth(today), 'yyyy-MM-dd');
    
    setStartDate(start);
    setEndDate(end);
    setSearchTerm('');
    setEmployeeType('all');
    setLocationFilter('all');
    setEmployeeFilter('all');
    setShiftFilter('all');
    setAppliedFilters({
      start,
      end,
      type: 'all',
      location: 'all',
      staff: 'all',
      shift: 'all'
    });
  };

  const handleGenerateBatchPDFs = async () => {
    if (!employees || !workEntries || !latestSettings?.[0]) {
      toast({ variant: "destructive", title: "Data Not Ready", description: "Employee data or HR settings are not loaded yet." });
      return;
    }
    if (calculatedSlips.length === 0) {
      toast({ variant: "destructive", title: "No Slips", description: "No payslips available to generate." });
      return;
    }

    setIsGeneratingBatchPDF(true);
    try {
      const logoDataUrl = await loadLogoAsDataUrl();
      const payslipsData = calculatedSlips.map(slip => {
        const rawEmployee = employees.find((emp: any) => emp.id === slip.employeeId);
        const employeeWorkEntries = workEntries.filter((entry: any) => entry.employeeId === slip.employeeId);
        return buildPayslipData({
          employee: rawEmployee,
          workEntries: employeeWorkEntries,
          hrSettings: [...latestSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0],
          startDate: appliedFilters.start,
          endDate: appliedFilters.end,
        });
      });

      await generateBatchPayslipsPDF(payslipsData, logoDataUrl);

      toast({
        title: "Batch PDF Generated",
        description: `Generated ${calculatedSlips.length} payslips successfully.`
      });
    } catch (error) {
      console.error('Batch PDF generation error:', error);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not generate the batch payslips PDF." });
    } finally {
      setIsGeneratingBatchPDF(false);
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);

  const downloadSlip = async (slip: any) => {
    if (!employees || !workEntries || !latestSettings?.[0]) {
      toast({
        variant: "destructive",
        title: "Data Not Ready",
        description: "Employee data or HR settings are not loaded yet."
      });
      return;
    }

    setIsGeneratingPDF(slip.employeeId);

    try {
      // Find the raw employee record
      const rawEmployee = employees.find((emp: any) => emp.id === slip.employeeId);
      if (!rawEmployee) {
        toast({
          variant: "destructive",
          title: "Employee Not Found",
          description: "Could not find the employee record."
        });
        return;
      }

      // Get work entries for this employee
      const employeeWorkEntries = workEntries.filter(
        (entry: any) => entry.employeeId === slip.employeeId
      );

      // Load logo
      const logoDataUrl = await loadLogoAsDataUrl();

      // Build full payslip data using ERP calculation logic
      const payslipData = buildPayslipData({
        employee: rawEmployee,
        workEntries: employeeWorkEntries,
        hrSettings: [...latestSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0],
        startDate: appliedFilters.start,
        endDate: appliedFilters.end,
      });

      // Generate and download PDF
      await generatePayslipPDF(payslipData, logoDataUrl);

      toast({
        title: "Payslip Generated",
        description: `PDF exported for ${slip.employeeName}.`
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate the payslip PDF."
      });
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Salary Slip</h1>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span>Profile</span>
          <span className="opacity-30">/</span>
          <span className="text-[#193A7B]">Salary Slip</span>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-800">
            Salary Slip
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Select Employee Type</Label>
              <Select value={employeeType} onValueChange={setEmployeeType}>
                <SelectTrigger className="h-11 rounded-xl bg-white border border-slate-200 font-medium">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select</SelectItem>
                  <SelectItem value="Fixed CDD">Fixed CDD</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                  <SelectItem value="Fixed CDI">Fixed CDI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Select Location:</Label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-white border border-slate-200 font-medium">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select</SelectItem>
                  {locations?.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Select Employee</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-11 w-full rounded-xl bg-white border border-slate-200 font-medium justify-between px-3 text-slate-700 hover:text-slate-800 hover:bg-white text-left"
                  >
                    <span className="truncate">{getEmployeeFilterLabel()}</span>
                    <span className="opacity-50 text-[10px]">▼</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl p-1">
                  <div className="p-2 border-b border-slate-100">
                    <Input 
                      placeholder="Search staff..." 
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-8 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs"
                    />
                  </div>
                  <DropdownMenuCheckboxItem
                    checked={employeeFilter === 'all'}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleSelectAllEmployees();
                    }}
                    className="font-bold py-2"
                  >
                    Select All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  {employees
                    ?.filter(emp => `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(staffSearch.toLowerCase()))
                    .map(emp => (
                      <DropdownMenuCheckboxItem
                        key={emp.id}
                        checked={Array.isArray(employeeFilter) && employeeFilter.includes(emp.id)}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleToggleEmployee(emp.id);
                        }}
                        className="py-2"
                      >
                        {emp.firstName} {emp.lastName}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Select Shift</Label>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-white border border-slate-200 font-medium">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select</SelectItem>
                  <SelectItem value="Shift 1">Shift 1</SelectItem>
                  <SelectItem value="Shift 2">Shift 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 rounded-xl bg-white border border-slate-200 font-medium px-4" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 rounded-xl bg-white border border-slate-200 font-medium px-4" />
            </div>
            <Button 
              onClick={handleGenerate}
              className="h-11 rounded-xl bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2"
            >
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons Row */}
      <div className="flex justify-end items-center gap-3">
        <Button 
          variant="ghost" 
          onClick={handleClearFilters}
          className="font-bold text-xs uppercase text-slate-500 hover:bg-slate-100"
        >
          Clear Filters
        </Button>
        <Button 
          onClick={handleGenerateBatchPDFs}
          disabled={!startDate || !endDate || isGeneratingBatchPDF || calculatedSlips.length === 0}
          className="h-11 px-6 rounded-xl bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50"
        >
          {isGeneratingBatchPDF ? <Loader2 size={16} className="animate-spin mr-2 inline" /> : null}
          Generate PDFs
        </Button>
        <Button 
          onClick={handleExportBankTransfer}
          disabled={!startDate || !endDate || isExporting}
          className="h-11 px-6 rounded-xl bg-[#0284C7] hover:bg-[#0369a1] text-white font-bold flex items-center gap-2 uppercase tracking-wider text-xs transition-all shadow-md shadow-[#0284C7]/10 disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
          )}
          Bank Transfer
        </Button>
      </div>

      {!latestSettings?.[0] && (
        <Card className="border-rose-200 bg-rose-50 rounded-2xl">
          <CardContent className="flex items-center gap-4 py-4 text-rose-800">
            <Settings className="animate-pulse" size={24} />
            <div className="flex-1">
              <p className="font-bold uppercase text-xs">Payroll Configuration Missing</p>
              <p className="text-xs opacity-80">You must set the Net Hourly Wage in HR Settings before slips can be calculated.</p>
            </div>
            <Button asChild variant="outline" className="bg-white border-rose-200 text-rose-800 hover:bg-rose-100 font-bold">
              <Link href="/hr/settings">GO TO SETTINGS</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Listings Section */}
      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b bg-muted/30 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-primary">Payroll Registry</CardTitle>
            <CardDescription className="text-xs">
              Live aggregation of attendance data for the selected period.
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search by name..." 
              className="pl-10 h-10 border-primary/10 bg-white shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Employee</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Duration</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Hours</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Gross</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Advances</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Net Due</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Method</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingWork || isUserLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : workError ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                      <div className="bg-destructive/10 p-4 rounded-full">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-primary uppercase tracking-tight">
                          {workError.message.includes('index') ? "Database Index Required" : "System Synchronisation Error"}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">
                          {workError.message.includes('index') 
                            ? "A composite index is required to aggregate attendance data. Please click the button below."
                            : "There was an issue fetching the payroll records from the server."}
                        </p>
                      </div>
                      <div className="flex gap-3 mt-2">
                        <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="font-bold border-primary/20 text-primary uppercase px-6 rounded-lg">
                          Retry
                        </Button>
                        {workError.message.includes('index') && (
                          <Button asChild size="sm" className="font-bold bg-primary hover:bg-primary/90 uppercase px-6 rounded-lg gap-2">
                            <a href={workError.message.split('here: ')[1]} target="_blank" rel="noopener noreferrer">
                              BUILD INDEX <ExternalLink size={14} />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : calculatedSlips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="h-10 w-10 opacity-10" />
                      <span>No active attendance logs found for this period.</span>
                      <Button variant="link" onClick={handleClearFilters} className="text-primary font-bold">Reset Period</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                calculatedSlips.map((slip) => (
                  <TableRow key={slip.id} className="hover:bg-primary/[0.02] transition-colors group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-primary group-hover:underline cursor-default">{slip.employeeName}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{slip.position}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                        <span>{slip.startDate}</span>
                        <ArrowRight size={10} className="opacity-20" />
                        <span>{slip.endDate}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-sm">{slip.totalHours}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">hrs</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-sm">{Number(slip.netEarning).toFixed(2)} DH</TableCell>
                    <TableCell className="text-rose-600 font-bold text-sm">
                      {slip.advanceSalary > 0 ? `-${Number(slip.advanceSalary).toFixed(2)} DH` : '0.00 DH'}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[#0284C7] font-black px-3 py-1 text-[11px] shadow-sm">
                        {(Number(slip.netEarning) - Number(slip.advanceSalary)).toFixed(2)} DH
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary/20 text-primary bg-primary/5">
                        {slip.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => downloadSlip(slip)}
                        disabled={isGeneratingPDF === slip.employeeId}
                        className="text-primary font-bold gap-2 hover:bg-primary/10 rounded-full h-10 px-4 transition-all hover:scale-105"
                      >
                        {isGeneratingPDF === slip.employeeId ? (
                          <><Loader2 size={16} className="animate-spin" /> GENERATING...</>
                        ) : (
                          <><FileText size={16} /> DOWNLOAD PDF</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
