'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { collection, query, where, getDocs, orderBy } from '@/firebase/firestore-override';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { WorkTimeRecord } from '@/lib/export-time-tracking-excel';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X, 
  Clock, 
  ChevronRight,
  UserCheck,
  Download,
  Calendar,
  User,
  MapPin,
  CreditCard,
  Users,
  RotateCcw
} from 'lucide-react';
import { TimeTrackingModal } from '@/components/hr/time-tracking-modal';
import { Skeleton } from '@/components/ui/skeleton';

export default function TimeTrackingPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // Temporary Filter States (UI)
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [tempEmployee, setTempEmployee] = useState('all');
  const [tempShift, setTempShift] = useState('all');
  const [tempLocation, setTempLocation] = useState('all');
  const [tempMatricule, setTempMatricule] = useState('all');
  const [tempGender, setTempGender] = useState('all');
  const [tempEquipe, setTempEquipe] = useState('');

  // Applied Filter States (Data)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [matriculeFilter, setMatriculeFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [equipeFilter, setEquipeFilter] = useState('');

  const [staffSearch, setStaffSearch] = useState(''); // Only for the Select combobox internally

  // Selection State
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Data Fetching - Gated by auth-ready state
  const employeesQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'employees');
  }, [db, user, isUserLoading]);

  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'processing_lines');
  }, [db, user, isUserLoading]);

  const { data: employees, isLoading: loadingEmployees } = useCollection(employeesQuery, { where: [], orderBy: [] });
  const { data: locations } = useCollection(locationsQuery, { where: [], orderBy: [] });

  // Filtered Data Logic
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    
    return employees.filter(emp => {
      const matchesLocation = locationFilter === 'all' || emp.locationId === locationFilter;
      const matchesShift = shiftFilter === 'all' || emp.shift === shiftFilter;
      const matchesEmployee = employeeFilter === 'all' || emp.id === employeeFilter;
      const matchesMatricule = matriculeFilter === 'all' || emp.id === matriculeFilter;
      const matchesGender = genderFilter === 'all' || emp.gender === genderFilter;
      const matchesEquipe = !equipeFilter || (emp.equipe || '').toLowerCase().includes(equipeFilter.toLowerCase());
      const isSeasonal = emp.employeeStatus === 'Seasonal';

      return isSeasonal && matchesLocation && matchesShift && matchesEmployee && matchesMatricule && matchesGender && matchesEquipe;
    });
  }, [employees, locationFilter, shiftFilter, employeeFilter, matriculeFilter, genderFilter, equipeFilter]);

  const selectedEmployees = useMemo(() => {
    return employees?.filter(e => selectedEmployeeIds.includes(e.id)) || [];
  }, [employees, selectedEmployeeIds]);

  const handleExport = useCallback(async () => {
    if (!startDate || !endDate) {
      toast({ title: 'Validation', description: 'Please select Start Date and End Date before downloading.', variant: 'destructive' });
      return;
    }
    if (!db) return;

    setIsExporting(true);
    try {
      // Build Firestore query with date range
      const colRef = collection(db, 'work_time_tracking');
      const constraints: any[] = [
        where('date', '>=', startDate),
        where('date', '<=', endDate),
      ];

      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);

      console.log('Loaded records:', snapshot.size);

      // Map Firestore documents to WorkTimeRecord[]
      let records: WorkTimeRecord[] = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          employeeId: d.employeeId ?? '',
          employeeName: d.employeeName ?? '',
          date: d.date ?? '',
          startTime1: d.startTime1 ?? undefined,
          endTime1: d.endTime1 ?? undefined,
          startTime2: d.startTime2 ?? undefined,
          endTime2: d.endTime2 ?? undefined,
          shift: d.shift ?? '',
          isAbsent: d.isAbsent ?? false,
          isHoliday: d.isHoliday ?? false,
          advanceSalary: Number(d.advanceSalary ?? 0),
        };
      });

      // Apply optional filters
      if (selectedEmployeeIds.length > 0) {
        records = records.filter(r => selectedEmployeeIds.includes(r.employeeId));
      } else {
        if (employeeFilter !== 'all') {
          records = records.filter(r => r.employeeId === employeeFilter);
        }
      }
      if (shiftFilter !== 'all') {
        records = records.filter(r => r.shift === shiftFilter);
      }
      if (locationFilter !== 'all') {
        // Match employee location via employees list
        const employeeIdsInLocation = employees?.filter(e => e.locationId === locationFilter).map(e => e.id) ?? [];
        records = records.filter(r => employeeIdsInLocation.includes(r.employeeId));
      }
      if (matriculeFilter !== 'all') {
        records = records.filter(r => r.employeeId === matriculeFilter);
      }
      if (genderFilter !== 'all') {
        const matchIds = employees?.filter(e => e.gender === genderFilter).map(e => e.id) ?? [];
        records = records.filter(r => matchIds.includes(r.employeeId));
      }
      if (equipeFilter) {
        const matchIds = employees?.filter(e => (e.equipe || '').toLowerCase().includes(equipeFilter.toLowerCase())).map(e => e.id) ?? [];
        records = records.filter(r => matchIds.includes(r.employeeId));
      }

      console.log('Filtered records:', records.length);

      if (records.length === 0) {
        toast({ title: 'No Data', description: 'No working hours found for the selected filters.', variant: 'destructive' });
        return;
      }

      // Count unique employees for debugging
      const uniqueEmployees = new Set(records.map(r => r.employeeId));
      console.log('Total employees included in Sheet 2:', uniqueEmployees.size);

      const { exportTimeTrackingExcel } = await import('@/lib/export-time-tracking-excel');
      await exportTimeTrackingExcel(records, startDate, endDate);
      toast({ title: 'Success', description: `Export complete — ${records.length} records across ${uniqueEmployees.size} employees.` });
    } catch (error) {
      console.error('Export failed:', error);
      toast({ title: 'Error', description: 'Export failed. Check console for details.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }, [db, startDate, endDate, selectedEmployeeIds, shiftFilter, locationFilter, employees, toast]);

  const isAllSelected = filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map(e => e.id));
    }
  };

  const toggleSelectEmployee = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const applyFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setEmployeeFilter(tempEmployee);
    setShiftFilter(tempShift);
    setLocationFilter(tempLocation);
    setMatriculeFilter(tempMatricule);
    setGenderFilter(tempGender);
    setEquipeFilter(tempEquipe);
  };

  const resetFilters = () => {
    setTempStartDate('');
    setTempEndDate('');
    setTempEmployee('all');
    setTempShift('all');
    setTempLocation('all');
    setTempMatricule('all');
    setTempGender('all');
    setTempEquipe('');
    
    setStartDate('');
    setEndDate('');
    setEmployeeFilter('all');
    setShiftFilter('all');
    setLocationFilter('all');
    setMatriculeFilter('all');
    setGenderFilter('all');
    setEquipeFilter('');
    
    setSelectedEmployeeIds([]);
  };

  const handleRowClick = (employeeId: string) => {
    setSelectedEmployeeIds([employeeId]);
    setIsModalOpen(true);
  };

  const handleViewDetails = (employeeId: string) => {
    router.push(`/hr/time-tracking/${employeeId}`);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Employees Work Time Tracking</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Profile / Employees Work Time Tracking</p>
      </div>

      {/* Filters Section */}
      <Card className="border border-slate-200/80 shadow-md rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#193A7B]/10 text-[#193A7B] flex items-center justify-center">
              <Filter className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Filter Attendance Logs</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">Refine work time records by period, employee, shift, and team.</CardDescription>
            </div>
          </div>
          {(tempStartDate || tempEndDate || tempEmployee !== 'all' || tempShift !== 'all' || tempLocation !== 'all' || tempMatricule !== 'all' || tempGender !== 'all' || tempEquipe) && (
            <Badge variant="outline" className="bg-[#193A7B]/10 text-[#193A7B] border-[#193A7B]/20 font-bold text-[10px] px-2.5 py-1">
              Active Filters
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[#193A7B]" /> Start Date:
              </label>
              <Input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[#193A7B]" /> End Date:
              </label>
              <Input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <User className="size-3.5 text-[#193A7B]" /> Select Employee:
              </label>
              <Select value={tempEmployee} onValueChange={setTempEmployee}>
                <SelectTrigger className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <div className="p-2 border-b border-slate-100">
                    <Input 
                      placeholder="Search..." 
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-8 focus-visible:ring-0 text-xs rounded-lg"
                    />
                  </div>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees
                    ?.filter(emp => emp.employeeStatus === 'Seasonal')
                    ?.filter(emp => {
                      const search = staffSearch.toLowerCase();
                      return `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search) || 
                             (emp.matricule || '').toLowerCase().includes(search);
                    })
                    .map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#193A7B]" /> Select Shift:
              </label>
              <Select value={tempShift} onValueChange={setTempShift}>
                <SelectTrigger className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20">
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="Shift 1">Shift 1</SelectItem>
                  <SelectItem value="Shift 2">Shift 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <MapPin className="size-3.5 text-[#193A7B]" /> Select Location:
              </label>
              <Select value={tempLocation} onValueChange={setTempLocation}>
                <SelectTrigger className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations?.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.title || loc.name || loc.lineName || loc.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-[#193A7B]" /> Select Matricule:
              </label>
              <Select value={tempMatricule} onValueChange={setTempMatricule}>
                <SelectTrigger className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20">
                  <SelectValue placeholder="All Matricules" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="all">All Matricules</SelectItem>
                  {Array.from(new Set(employees?.filter(e => e.employeeStatus === 'Seasonal').map(e => e.id).filter(Boolean))).map(id => (
                    <SelectItem key={id as string} value={id as string}>{id as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Users className="size-3.5 text-[#193A7B]" /> Select Gender:
              </label>
              <Select value={tempGender} onValueChange={setTempGender}>
                <SelectTrigger className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Users className="size-3.5 text-[#193A7B]" /> Equipe:
              </label>
              <Input placeholder="Enter team name..." value={tempEquipe} onChange={e => setTempEquipe(e.target.value)} className="h-11 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20" />
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button onClick={applyFilters} className="h-11 px-6 rounded-xl bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#193A7B]/20 transition-all hover:scale-[1.02] flex items-center gap-2">
                <Filter className="size-4" /> Filter
              </Button>
              <Button onClick={resetFilters} variant="outline" className="h-11 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all">
                <RotateCcw className="size-4 text-slate-400" /> Clear
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                disabled={selectedEmployeeIds.length === 0}
                onClick={() => setIsModalOpen(true)}
                className="h-11 px-6 rounded-xl bg-[#193A7B] hover:bg-[#0F2552] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#193A7B]/20 transition-all disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.02] flex items-center gap-2"
              >
                <Clock className="size-4" /> Working Hours ({selectedEmployeeIds.length})
              </Button>
              <Button 
                disabled={!startDate || !endDate || isExporting}
                onClick={handleExport}
                className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-50 disabled:hover:scale-100 hover:scale-[1.02] flex items-center gap-2"
              >
                <Download className="size-4 text-[#0284C7]" /> Download Working Hours
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table Section */}
      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b bg-muted/30">
          <CardTitle className="text-lg font-bold text-primary uppercase">Staff Status</CardTitle>
          <CardDescription className="text-xs">Select employees to log batch hours, or click a row for detailed history.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    className="border-primary/20 data-[state=checked]:bg-primary"
                  />
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Full Name</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Position</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Location</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Matricule</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEmployees ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-none">
                    <TableCell colSpan={6} className="py-8"><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEmployees.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-medium italic opacity-60">
                    No employees matching the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow 
                    key={emp.id} 
                    className="hover:bg-primary/[0.04] cursor-pointer transition-all group border-b border-muted/20"
                    onClick={() => handleRowClick(emp.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()} className="py-4">
                      <Checkbox 
                        checked={selectedEmployeeIds.includes(emp.id)}
                        onCheckedChange={() => toggleSelectEmployee(emp.id, { stopPropagation: () => {} } as any)}
                        className="border-primary/20 data-[state=checked]:bg-primary"
                      />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/10 group-hover:border-primary/40 transition-colors shadow-sm">
                          <AvatarImage src={emp.imageUrl || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold uppercase">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">{emp.firstName} {emp.lastName}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">{emp.employeeStatus}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 font-medium text-muted-foreground">{emp.position}</TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="text-[10px] border-primary/10 bg-primary/5 text-primary">
                        {locations?.find(l => l.id === emp.locationId)?.title || locations?.find(l => l.id === emp.locationId)?.name || locations?.find(l => l.id === emp.locationId)?.lineName || emp.locationId || 'Unassigned'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground font-mono text-xs">
                      {emp.matricule || '-'}
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-primary font-bold gap-2 hover:bg-primary/10 rounded-full h-10 px-4 transition-transform group-hover:translate-x-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(emp.id);
                        }}
                      >
                        VIEW DETAILS <ChevronRight size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Time Tracking Modal */}
      {isModalOpen && (
        <TimeTrackingModal 
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmployeeIds([]);
          }}
          employees={selectedEmployees}
        />
      )}
    </div>
  );
}