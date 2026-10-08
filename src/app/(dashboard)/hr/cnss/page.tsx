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
  Filter, 
  Search, 
  FileSpreadsheet,
  Loader2,
  Settings,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  XCircle
} from 'lucide-react';
import { format, endOfMonth, startOfMonth } from 'date-fns';
import Link from 'next/link';
import { buildPayslipData } from '@/lib/export-payslip-pdf';

export default function CNSSPage() {
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
  const [genderFilter, setGenderFilter] = useState('all');
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
    gender: string;
  }>({
    start: firstDay,
    end: lastDay,
    type: 'all',
    location: 'all',
    staff: 'all',
    shift: 'all',
    gender: 'all'
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

  // Initialize Period Dates (Start to End of month)
  useEffect(() => {
    const today = new Date();
    const s = format(startOfMonth(today), 'yyyy-MM-dd');
    const e = format(endOfMonth(today), 'yyyy-MM-dd');
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

  const calculatedCNSS = useMemo(() => {
    if (!employees || !workEntries || !latestSettings?.[0]) return [];

    const hrSettings = latestSettings.sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())[0];
    const monthlyPlafond = Number(hrSettings.plafondCNSS || 0);
    const quinzainePlafond = monthlyPlafond / 2;

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
        const matchesEmployee = appliedFilters.staff === 'all' || 
          (Array.isArray(appliedFilters.staff) 
            ? appliedFilters.staff.includes(emp.id) 
            : emp.id === appliedFilters.staff);
        const matchesShift = appliedFilters.shift === 'all' || emp.shift === appliedFilters.shift;
        const matchesGender = appliedFilters.gender === 'all' || emp.gender === appliedFilters.gender;
        const matchesSearch = !searchTerm || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesLocation && matchesEmployee && matchesShift && matchesGender && matchesSearch && emp.status === 'active';
      })
      .map(emp => {
        const employeeEntries = entriesByEmployee[emp.id] || [];
        if (employeeEntries.length === 0) return null;

        // Total hours and days
        let totalHours = 0;
        const workedDays = new Set<string>();
        
        const q1Entries: any[] = [];
        const q2Entries: any[] = [];
        let q1TotalHours = 0;
        let q2TotalHours = 0;

        employeeEntries.forEach((entry: any) => {
          const isHoliday = entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes';
          const rawValue = Number(entry.totalHours || 0);
          // If rawValue is days (e.g. <= 5), convert to hours by multiplying by 8 (8h per day). If already hours (e.g. 8), keep as is.
          const hours = isHoliday ? (rawValue > 0 && rawValue <= 5 ? rawValue * 8 : (rawValue > 0 ? rawValue : 8)) : rawValue;
          totalHours += hours;
          if (entry.date) workedDays.add(entry.date);
          
          const entryDateStr = entry.date;
          if (entryDateStr) {
            const day = parseInt(entryDateStr.split('-')[2], 10);
            if (day <= 15) {
              q1Entries.push(entry);
              q1TotalHours += hours;
            } else {
              q2Entries.push(entry);
              q2TotalHours += hours;
            }
          }
        });

        // QUINZ 1
        const slipQ1 = buildPayslipData({
          employee: emp,
          workEntries: q1Entries,
          hrSettings,
          startDate: appliedFilters.start,
          endDate: appliedFilters.end
        });
        const quinz1Raw = slipQ1.earnings.grossSalary;
        const quinz1 = Math.min(quinz1Raw, quinzainePlafond);

        // QUINZ 2
        const slipQ2 = buildPayslipData({
          employee: emp,
          workEntries: q2Entries,
          hrSettings,
          startDate: appliedFilters.start,
          endDate: appliedFilters.end
        });
        const quinz2Raw = slipQ2.earnings.grossSalary;
        const quinz2 = Math.min(quinz2Raw, quinzainePlafond);

        const nh = Math.min(q1TotalHours, 95.5) + Math.min(q2TotalHours, 95.5);
        const nb = Math.floor(nh / 7.34);

        const salaireDeclare = quinz1 + quinz2;
        const salaireBase = salaireDeclare;

        const situation = ""; // Leave situation completely empty as requested

        // Matricule should be employee matricule (e.g. 051, 052...), not CNSS number
        const empMatricule = (emp.matricule && emp.matricule !== emp.cnssNumber && emp.matricule !== emp.cnss) 
          ? emp.matricule 
          : (emp.id || '—');

        return {
          id: emp.id,
          matricule: empMatricule,
          cnss: emp.cnssNumber || emp.cnss || '—',
          nom: (emp.lastName || '').toUpperCase(),
          prenom: (emp.firstName || '').toUpperCase(),
          cin: emp.cin || '—',
          nh,
          nb,
          quinz1,
          quinz2,
          salaireBase,
          salaireDeclare,
          plafond: monthlyPlafond,
          situation
        };
      })
      .filter(Boolean);
  }, [employees, workEntries, latestSettings, appliedFilters, searchTerm]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
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
        description: "Data is still loading."
      });
      return;
    }

    if (calculatedCNSS.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No eligible employees found for this period."
      });
      return;
    }

    setIsExporting(true);
    try {
      const { exportCNSSExcel } = await import('@/lib/export-cnss');
      await exportCNSSExcel(
        calculatedCNSS,
        appliedFilters.start,
        appliedFilters.end
      );
      toast({
        title: "Excel Exported",
        description: "The CNSS export file has been generated successfully."
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate the Excel file."
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
      shift: shiftFilter,
      gender: genderFilter
    });
    toast({
      title: "Filters Applied",
      description: "Updating CNSS listing based on selected criteria."
    });
  };

  const handleGenerateAndExport = async () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing Period",
        description: "Please select a start and end date."
      });
      return;
    }

    // 1. Update UI filters
    setAppliedFilters({
      start: startDate,
      end: endDate,
      type: employeeType,
      location: locationFilter,
      staff: employeeFilter,
      shift: shiftFilter,
      gender: genderFilter
    });

    setIsExporting(true);
    try {
      if (!db || !user || isUserLoading) {
        throw new Error("Database or authentication not ready.");
      }

      // 2. Fetch work entries for period manually
      const { getDocs } = await import('firebase/firestore');
      const workEntriesSnap = await getDocs(
        query(
          collection(db, 'work_time_tracking'),
          where('date', '>=', startDate),
          where('date', '<=', endDate)
        )
      );

      const fetchedWorkEntries = workEntriesSnap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));

      const hrSettings = latestSettings?.sort((a: any, b: any) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime())?.[0];
      if (!hrSettings) {
        throw new Error("HR settings are not loaded.");
      }
      const monthlyPlafond = Number(hrSettings.plafondCNSS || 0);
      const quinzainePlafond = monthlyPlafond / 2;

      const entriesByEmployee = fetchedWorkEntries.reduce((acc, entry: any) => {
        const id = entry.employeeId;
        if (!acc[id]) acc[id] = [];
        acc[id].push(entry);
        return acc;
      }, {} as Record<string, any[]>);

      const targetCNSS = (employees || [])
        .filter(emp => {
          const matchesType = employeeType === 'all' || emp.employeeStatus === employeeType;
          const matchesLocation = locationFilter === 'all' || emp.locationId === locationFilter;
          const matchesEmployee = employeeFilter === 'all' || 
            (Array.isArray(employeeFilter) 
              ? employeeFilter.includes(emp.id) 
              : emp.id === employeeFilter);
          const matchesShift = shiftFilter === 'all' || emp.shift === shiftFilter;
          const matchesGender = genderFilter === 'all' || emp.gender === genderFilter;
          const matchesSearch = !searchTerm || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesType && matchesLocation && matchesEmployee && matchesShift && matchesGender && matchesSearch && emp.status === 'active';
        })
        .map(emp => {
          const employeeEntries = entriesByEmployee[emp.id] || [];
          if (employeeEntries.length === 0) return null;

          let totalHours = 0;
          const workedDays = new Set<string>();
          
          const q1Entries: any[] = [];
          const q2Entries: any[] = [];
          let q1TotalHours = 0;
          let q2TotalHours = 0;

          employeeEntries.forEach((entry: any) => {
            const isHoliday = entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes';
            const rawValue = Number(entry.totalHours || 0);
            // If rawValue is days (e.g. <= 5), convert to hours by multiplying by 8 (8h per day). If already hours (e.g. 8), keep as is.
            const hours = isHoliday ? (rawValue > 0 && rawValue <= 5 ? rawValue * 8 : (rawValue > 0 ? rawValue : 8)) : rawValue;
            totalHours += hours;
            if (entry.date) workedDays.add(entry.date);
            
            const entryDateStr = entry.date;
            if (entryDateStr) {
              const day = parseInt(entryDateStr.split('-')[2], 10);
              if (day <= 15) {
                q1Entries.push(entry);
                q1TotalHours += hours;
              } else {
                q2Entries.push(entry);
                q2TotalHours += hours;
              }
            }
          });

          const slipQ1 = buildPayslipData({
            employee: emp,
            workEntries: q1Entries,
            hrSettings,
            startDate,
            endDate
          });
          const quinz1Raw = slipQ1.earnings.grossSalary;
          const quinz1 = Math.min(quinz1Raw, quinzainePlafond);

          const slipQ2 = buildPayslipData({
            employee: emp,
            workEntries: q2Entries,
            hrSettings,
            startDate,
            endDate
          });
          const quinz2Raw = slipQ2.earnings.grossSalary;
          const quinz2 = Math.min(quinz2Raw, quinzainePlafond);

          const nh = Math.min(q1TotalHours, 95.5) + Math.min(q2TotalHours, 95.5);
          const nb = Math.floor(nh / 7.34);

          const salaireDeclare = quinz1 + quinz2;
          const salaireBase = salaireDeclare;

          // Matricule should be employee matricule (e.g. 051, 052...), not CNSS number
          const empMatricule = (emp.matricule && emp.matricule !== emp.cnssNumber && emp.matricule !== emp.cnss) 
            ? emp.matricule 
            : (emp.id || '—');

          return {
            id: emp.id,
            matricule: empMatricule,
            cnss: emp.cnssNumber || emp.cnss || '—',
            nom: (emp.lastName || '').toUpperCase(),
            prenom: (emp.firstName || '').toUpperCase(),
            cin: emp.cin || '—',
            nh,
            nb,
            quinz1,
            quinz2,
            salaireBase,
            salaireDeclare,
            plafond: monthlyPlafond,
            situation: ""
          };
        })
        .filter(Boolean);

      if (targetCNSS.length === 0) {
        toast({
          variant: "destructive",
          title: "No Data",
          description: "No eligible employees found for this period."
        });
        return;
      }

      // 3. Export Excel
      const { exportCNSSExcel } = await import('@/lib/export-cnss');
      await exportCNSSExcel(
        targetCNSS,
        startDate,
        endDate
      );

      toast({
        title: "Excel Exported",
        description: "The CNSS export file has been generated successfully."
      });

    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message || "Could not generate Excel file."
      });
    } finally {
      setIsExporting(false);
    }
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
    setGenderFilter('all');
    setAppliedFilters({
      start,
      end,
      type: 'all',
      location: 'all',
      staff: 'all',
      shift: 'all',
      gender: 'all'
    });
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">CNSS Declarations follow up</h1>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span>Profile</span>
          <span className="opacity-30">/</span>
          <span className="text-[#7a9800]">CNSS Declarations follow up</span>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-800">
            CNSS Declarations follow up
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500">Select Gender</Label>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-white border border-slate-200 font-medium">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3 - Actions */}
          <div className="flex justify-between items-center pt-2">
            <Button 
              onClick={handleGenerateAndExport}
              disabled={isExporting}
              className="h-11 rounded-xl bg-[#7a9800] hover:bg-[#6c8500] text-white font-bold transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 px-6 shadow-md shadow-[#7a9800]/10"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              {isExporting ? 'Exporting...' : 'Suivi CNSS Excel'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleClearFilters}
              className="font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 h-11 px-4 rounded-xl"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {!latestSettings?.[0] && (
        <Card className="border-rose-200 bg-rose-50 rounded-2xl">
          <CardContent className="flex items-center gap-4 py-4 text-rose-800">
            <Settings className="animate-pulse" size={24} />
            <div className="flex-1">
              <p className="font-bold uppercase text-xs">Configuration Missing</p>
              <p className="text-xs opacity-80">You must set the Net Hourly Wage in HR Settings to calculate CNSS declarations.</p>
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
            <CardTitle className="text-lg font-bold text-primary">Preview List</CardTitle>
            <CardDescription className="text-xs">
              Preview of CNSS calculation for the selected period before exporting.
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-primary/5">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Employee</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70">IMM CNSS</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 text-right">NH / NB</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 text-right">Sal. Base</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 text-right">Sal. Déclaré</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 text-right">Situation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingWork || isUserLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : workError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <div className="bg-destructive/10 p-4 rounded-full">
                          <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-primary uppercase tracking-tight">System Synchronisation Error</p>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">{workError.message}</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : calculatedCNSS.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="h-10 w-10 opacity-10" />
                        <span>No records found for the selected period and filters.</span>
                        <Button variant="link" onClick={handleClearFilters} className="text-primary font-bold">Clear Filters</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  calculatedCNSS.map((row: any) => (
                    <TableRow key={row.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-primary group-hover:underline cursor-default">{row.nom} {row.prenom}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{row.matricule} - {row.cin}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-slate-600">{row.cnss}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-slate-700">{row.nh.toLocaleString()} H</span>
                          <span className="text-[10px] text-muted-foreground">{row.nb} Jours</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-slate-700">{row.salaireBase.toLocaleString()} DH</span>
                          <span className="text-[10px] text-muted-foreground">Q1: {row.quinz1.toLocaleString()} | Q2: {row.quinz2.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {row.salaireDeclare.toLocaleString()} DH
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={row.situation === 'PLAFONNÉ' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"}>
                          {row.situation}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
