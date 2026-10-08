'use client';

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
  RefreshCcw,
  Users,
  Building,
  DollarSign,
  TrendingUp,
  Briefcase,
  Coins,
  ShieldCheck,
  Check,
  ChevronDown,
  Download
} from 'lucide-react';
import { format, endOfMonth, startOfMonth, setDate as setDayOfMonth } from 'date-fns';
import Link from 'next/link';

// Core imports from PDF / Excel libraries
import { generatePayslipPDF, buildPayslipData, loadLogoAsDataUrl } from '@/lib/export-payslip-pdf';
import { exportAuditExcel, AuditRecord } from '@/lib/export-audit-excel';
import { normalizeWorkEntries } from '@/lib/attendance-normalization';
import { exportAuditPDF } from '@/lib/export-audit-pdf';

export default function PaySlipAuditPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  // Filter States
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employeeType, setEmployeeType] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [shiftFilter, setShiftFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  // Local state for results triggered by "Apply Filters"
  const [appliedFilters, setAppliedFilters] = useState<{
    start: string;
    end: string;
    type: string;
    location: string;
    selectedEmployeeIds: string[];
    shift: string;
  }>({
    start: '',
    end: '',
    type: 'all',
    location: 'all',
    selectedEmployeeIds: [],
    shift: 'all'
  });

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAllEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  const getEmployeeFilterLabel = () => {
    if (selectedEmployeeIds.length === 0) return 'Select';
    if (selectedEmployeeIds.length === 1) {
      const emp = employees?.find(e => e.id === selectedEmployeeIds[0]);
      return emp ? `${emp.firstName} ${emp.lastName}` : '1 Selected';
    }
    return `${selectedEmployeeIds.length} Selected`;
  };

  // Export Loading States
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null);

  // Initialize Period Dates (Empty initially until user defines)
  useEffect(() => {
    // Keep initial filters empty until user specifies date range and clicks Apply
  }, []);

  // Data Fetching
  const employeesQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'employees');
  }, [db, user, isUserLoading]);

  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'processing_lines');
  }, [db, user, isUserLoading]);

  const settingsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return query(collection(db, 'hrSettings'));
  }, [db, user, isUserLoading]);

  // Fetch all work entries for the selected period to aggregate in-memory
  const workEntriesQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading || !appliedFilters.start || !appliedFilters.end) return null;
    return query(
      collection(db, 'work_time_tracking'),
      where('date', '>=', appliedFilters.start),
      where('date', '<=', appliedFilters.end)
    );
  }, [db, user, isUserLoading, appliedFilters.start, appliedFilters.end]);

  const { data: employees, isLoading: loadingEmployees } = useCollection(employeesQuery, { where: [], orderBy: [] });
  const { data: locations } = useCollection(locationsQuery, { where: [], orderBy: [] });
  const { data: latestSettings } = useCollection(settingsQuery, { where: [], orderBy: [] });
  const { data: workEntries, isLoading: isLoadingWork, error: workError } = useCollection(workEntriesQuery, { where: [], orderBy: [] });

  // Map locations by ID for quick lookup
  const locationsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (locations) {
      locations.forEach((loc: any) => {
        map[loc.id] = loc.title || loc.name || loc.lineName || loc.id;
      });
    }
    return map;
  }, [locations]);

  // Computed Audit Records based on applied filters
  const auditRecords = useMemo(() => {
    if (!employees || !workEntries || !latestSettings?.[0] || !appliedFilters.start || !appliedFilters.end) return [];

    // Group work entries by employeeId
    const entriesByEmployee = workEntries.reduce((acc, entry) => {
      const id = entry.employeeId;
      if (!acc[id]) acc[id] = [];
      acc[id].push(entry);
      return acc;
    }, {} as Record<string, any[]>);

    return employees
      .filter(emp => {
        const matchesType = appliedFilters.type === 'all' || emp.employeeStatus === appliedFilters.type;
        const matchesLocation = appliedFilters.location === 'all' || emp.locationId === appliedFilters.location;
        const matchesShift = appliedFilters.shift === 'all' || emp.shift === appliedFilters.shift;
        const matchesSelect = appliedFilters.selectedEmployeeIds.length === 0 || appliedFilters.selectedEmployeeIds.includes(emp.id);
        const matchesSearch = !searchTerm || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || (emp.matricule || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesType && matchesLocation && matchesShift && matchesSelect && matchesSearch && emp.status === 'active';
      })
      .map(emp => {
        const empEntries = entriesByEmployee[emp.id] || [];
        
        // Normalize attendance according to Daily, Weekly, Quinzaine and Rest Day rules
        const normalizedEntries = normalizeWorkEntries(empEntries, appliedFilters.start, appliedFilters.end);
        
        // Build Payslip using existing ERP calculation logic
        const payslip = buildPayslipData({
          employee: emp,
          workEntries: normalizedEntries,
          hrSettings: [...latestSettings].sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0],
          startDate: appliedFilters.start,
          endDate: appliedFilters.end,
          applyCap: true,
        });

        return {
          employee: emp,
          payslip,
          locationName: locationsMap[emp.locationId] || emp.locationId || 'N/A',
          workEntries: normalizedEntries
        };
      })
      // Only audit employees who have recorded work in the period
      .filter(record => {
        const totalHours = record.payslip.hours.normalHours + (record.payslip.hours.holidayHours * 8);
        return totalHours > 0;
      });
  }, [employees, workEntries, latestSettings, appliedFilters, locationsMap, searchTerm]);

  // Summary metrics are removed as per user request

  // Filter handlers
  const handleApplyFilters = () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Mandatory Period",
        description: "Please specify both Start Date and End Date."
      });
      return;
    }
    setAppliedFilters({
      start: startDate,
      end: endDate,
      type: employeeType,
      location: locationFilter,
      selectedEmployeeIds: selectedEmployeeIds,
      shift: shiftFilter
    });
    toast({
      title: "Filters Applied",
      description: "Payroll registry updated successfully based on selected inputs."
    });
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setEmployeeType('all');
    setLocationFilter('all');
    setSelectedEmployeeIds([]);
    setShiftFilter('all');
    setSearchTerm('');
    setStaffSearch('');
    
    setAppliedFilters({
      start: '',
      end: '',
      type: 'all',
      location: 'all',
      selectedEmployeeIds: [],
      shift: 'all'
    });
  };

  // Export handlers
  const handleExportExcel = async () => {
    if (auditRecords.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No payroll records calculated for the selected period."
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      await exportAuditExcel(auditRecords, appliedFilters.start, appliedFilters.end);
      toast({
        title: "Excel Export Complete",
        description: "Payroll audit report downloaded successfully."
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate Excel spreadsheet."
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (auditRecords.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No payroll records calculated for the selected period."
      });
      return;
    }

    setIsExportingPDF(true);
    try {
      const logoDataUrl = await loadLogoAsDataUrl();
      await exportAuditPDF(auditRecords, appliedFilters.start, appliedFilters.end, logoDataUrl);
      toast({
        title: "PDF Export Complete",
        description: "Payroll audit PDF downloaded successfully."
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate PDF report."
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const downloadSingleSlip = async (record: AuditRecord) => {
    setIsGeneratingPDF(record.employee.id);
    try {
      const logoDataUrl = await loadLogoAsDataUrl();
      await generatePayslipPDF(record.payslip, logoDataUrl);
      toast({
        title: "Payslip Generated",
        description: `Payslip downloaded for ${record.payslip.employee.employeeName}.`
      });
    } catch (error) {
      console.error('PDF error:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not export payslip PDF."
      });
    } finally {
      setIsGeneratingPDF(null);
    }
  };

  const handleBulkDownload = async () => {
    if (auditRecords.length === 0) {
      toast({
        variant: "destructive",
        title: "No Slips",
        description: "No payroll records calculated for bulk generation."
      });
      return;
    }

    setIsBulkDownloading(true);
    try {
      const logoDataUrl = await loadLogoAsDataUrl();
      for (const rec of auditRecords) {
        await generatePayslipPDF(rec.payslip, logoDataUrl);
        // Add minor sleep to avoid overlapping save prompts
        await new Promise(r => setTimeout(r, 600));
      }
      toast({
        title: "Bulk Downloads Finished",
        description: `Saved ${auditRecords.length} employee payslips successfully.`
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Bulk Download Failed",
        description: "An error occurred during bulk generation."
      });
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const toggleEmployeeSelection = (empId: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Payslip Audit</h1>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span>Profile</span>
          <span className="opacity-30">/</span>
          <span className="text-[#193A7B]">Payslip Audit</span>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-800">
            Payslip Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Employee Type</Label>
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
                  {locations?.map((line: any) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.title || line.name || line.lineName || line.id}
                    </SelectItem>
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
                    checked={selectedEmployeeIds.length === 0}
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
                        checked={selectedEmployeeIds.includes(emp.id)}
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
              onClick={handleApplyFilters}
              className="h-11 rounded-xl bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold transition-all uppercase tracking-wider text-xs"
            >
              Generate
            </Button>
          </div>

          {/* Actions Sub-Row */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={handleClearFilters}
                className="font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 h-11 px-4 rounded-xl"
              >
                Clear Filters
              </Button>
              <Button 
                onClick={handleBulkDownload}
                disabled={auditRecords.length === 0 || isBulkDownloading}
                className="h-11 px-6 rounded-xl bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50"
              >
                {isBulkDownloading ? <Loader2 size={16} className="animate-spin mr-2 inline" /> : null}
                Generate All Payslips
              </Button>
              <Button 
                onClick={handleExportPDF}
                disabled={auditRecords.length === 0 || isExportingPDF}
                className="h-11 px-6 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50"
              >
                {isExportingPDF ? <Loader2 size={16} className="animate-spin mr-2 inline" /> : null}
                PDF Report
              </Button>
            </div>
            <Button 
              onClick={handleExportExcel}
              disabled={auditRecords.length === 0 || isExportingExcel}
              className="h-11 px-6 rounded-xl bg-[#0284C7] hover:bg-[#0369a1] text-white font-bold flex items-center gap-2 uppercase tracking-wider text-xs transition-all shadow-md shadow-[#0284C7]/10 disabled:opacity-50"
            >
              {isExportingExcel ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              )}
              Work Time Audit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Audit Data Registry */}
      <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-800">
              Payslip Audit Listing
            </CardTitle>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Search name or matricule..." 
              className="pl-10 h-10 border-slate-200 bg-white shadow-sm rounded-xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-700">Employee Name</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Employee Position</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Salary Duration</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Net Earning</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Total of hours</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Payment Method</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingWork || isUserLoading || loadingEmployees ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : workError ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-rose-500 font-bold">
                    Error fetching time tracking logs: {workError.message}
                  </TableCell>
                </TableRow>
              ) : auditRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-muted-foreground font-medium">
                    {!appliedFilters.start || !appliedFilters.end
                      ? "No values defined. Select Start and End dates above and click Generate to run payroll audit."
                      : "No matching calculated payroll records found. Please adjust filters."
                    }
                  </TableCell>
                </TableRow>
              ) : (
                auditRecords.map((record) => {
                  const { employee: emp, payslip: slip } = record;
                  const totalH = slip.hours.normalHours + (slip.hours.holidayHours * 8);

                  return (
                    <TableRow key={emp.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="text-xs font-bold text-slate-800">{slip.employee.employeeName}</TableCell>
                      <TableCell className="text-xs text-slate-600">{slip.employee.position}</TableCell>
                      <TableCell className="text-xs text-slate-600">{appliedFilters.start} to {appliedFilters.end}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700">{slip.totals.netToPay.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-slate-600">{totalH}</TableCell>
                      <TableCell className="text-xs text-slate-600 uppercase">{slip.employee.paymentMethod}</TableCell>
                      <TableCell className="py-3">
                        <Button 
                          onClick={() => downloadSingleSlip(record)}
                          disabled={isGeneratingPDF === emp.id}
                          className="h-8 text-xs bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold rounded-lg px-4"
                        >
                          {isGeneratingPDF === emp.id ? (
                            <Loader2 size={14} className="animate-spin mr-1 inline" />
                          ) : null}
                          Download Slip
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
