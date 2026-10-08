'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  useDoc, 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  deleteDoc 
} from '@/firebase/firestore-override';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  ChevronLeft, 
  Edit2, 
  Trash2, 
  Clock, 
  MapPin, 
  Briefcase,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { EditTimeTrackingModal } from '@/components/hr/edit-time-tracking-modal';

export default function EmployeeTimeTrackingDetailsPage() {
  const { employeeId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 1. Employee Identification
  const employeeRef = useMemoFirebase(() => {
    if (!db || !employeeId || !user || isUserLoading) return null;
    return doc(db, 'employees', employeeId as string);
  }, [db, employeeId, user, isUserLoading]);
  
  const { data: employee, isLoading: isLoadingEmployee, error: employeeError } = useDoc(employeeRef);

  // 2. Locations for lookup
  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, 'locations');
  }, [db, user, isUserLoading]);
  const { data: locations } = useCollection(locationsQuery, { where: [], orderBy: [] });

  // 3. Work Entries Query
  const workEntriesQuery = useMemoFirebase(() => {
    if (!db || !employeeId || !user || isUserLoading) return null;
    // Uses 'work_time_tracking' as defined in backend.json
    return query(
      collection(db, 'work_time_tracking'),
      where('employeeId', '==', employeeId)
    );
  }, [db, employeeId, user, isUserLoading]);

  const { data: rawEntries, isLoading: isLoadingEntries, error: entriesError } = useCollection(workEntriesQuery, { where: [], orderBy: [] });

  const entries = useMemo(() => {
    if (!rawEntries) return [];
    return [...rawEntries].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [rawEntries]);

  const handleDelete = async (entryId: string) => {
    if (!db || !confirm('Are you sure you want to delete this attendance record?')) return;
    const entryRef = doc(db, 'work_time_tracking', entryId);
    try {
      await deleteDoc(entryRef).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: entryRef.path,
          operation: 'delete'
        }));
        throw err;
      });
      toast({
        title: "Record Deleted",
        description: "The work session has been removed successfully."
      });
    } catch (error) {
      // Handled by emitter
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const locationName = useMemo(() => {
    if (!employee || !locations) return 'N/A';
    return locations.find(l => l.id === employee.locationId)?.name || employee.locationId || 'N/A';
  }, [employee, locations]);

  // Auth & Error Gating
  const authReady = !isUserLoading && !!user;
  const hasRealError = authReady && (!!entriesError || !!employeeError);

  if (hasRealError) {
    const isIndexError = entriesError?.message?.includes('index');
    
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
        <div className="bg-destructive/10 p-6 rounded-full">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-primary uppercase tracking-tight">
            {isIndexError ? "Database Index Required" : "Access Restricted"}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto font-medium">
            {isIndexError 
              ? "This query requires a composite index to display historical data correctly. Please click the link below to generate it in the Firebase Console."
              : (entriesError?.message?.includes('permissions') || employeeError?.message?.includes('permissions'))
                ? "Your account does not have sufficient permissions to view these records. Please contact the administrator."
                : "There was an issue synchronizing the data from the secure server."}
          </p>
          {isIndexError && entriesError && (
            <div className="mt-4 p-4 bg-muted/50 rounded-xl text-xs font-mono break-all text-left border border-primary/5">
              {entriesError.message}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="font-bold border-primary/20 text-primary uppercase h-12 px-8 rounded-xl"
          >
            Try Again
          </Button>
          {isIndexError && entriesError && (
            <Button 
              asChild
              className="font-bold bg-primary hover:bg-primary/90 uppercase h-12 px-8 rounded-xl gap-2"
            >
              <a href={entriesError.message.split('here: ')[1]} target="_blank" rel="noopener noreferrer">
                CREATE INDEX <ExternalLink size={16} />
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isUserLoading || !user) {
    return (
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-72" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-12 w-12 hover:bg-primary/10 transition-all">
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Staff History</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Registry Audit</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Individual Attendance</h1>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                <AvatarImage src={employee?.imageUrl || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold uppercase">
                  {employee?.firstName?.[0]}{employee?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl font-bold text-primary">
                  {isLoadingEmployee ? <Skeleton className="h-8 w-48" /> : `${employee?.firstName} ${employee?.lastName}`}
                </CardTitle>
                <div className="flex items-center gap-3 mt-1 text-sm font-medium text-muted-foreground">
                  <span className="flex items-center gap-1"><Briefcase size={14} /> {employee?.position}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} /> {locationName}</span>
                </div>
              </div>
            </div>
            {!isLoadingEmployee && (
              <Badge variant={employee?.status === 'active' ? 'default' : 'secondary'} className="font-bold uppercase tracking-widest px-4 py-1.5 h-auto">
                {employee?.status || 'Active'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-8 px-8">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Matricule</span>
            {isLoadingEmployee ? <Skeleton className="h-6 w-20" /> : <p className="font-bold text-primary text-lg">{employee?.matricule || 'N/A'}</p>}
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Employment Status</span>
            {isLoadingEmployee ? <Skeleton className="h-6 w-24" /> : <p className="font-bold text-primary text-lg">{employee?.employeeStatus || 'N/A'}</p>}
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date of Birth</span>
            {isLoadingEmployee ? <Skeleton className="h-6 w-24" /> : <p className="font-bold text-primary text-lg">{employee?.birthday || 'N/A'}</p>}
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</span>
            {isLoadingEmployee ? <Skeleton className="h-6 w-32" /> : <p className="font-bold text-primary text-lg">{locationName}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Clock className="size-5" /> Work Sessions Registry
              </CardTitle>
              <CardDescription>Comprehensive log of daily shifts, overtime, and salary advances.</CardDescription>
            </div>
            {isLoadingEntries && <Loader2 className="animate-spin text-primary opacity-50" size={24} />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Date</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Start 1</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">End 1</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Start 2</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">End 2</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Total Duration</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Shift Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Advance Paid</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Holiday</TableHead>
                <TableHead className="py-4 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingEntries ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-none">
                    <TableCell colSpan={10} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : !entries || entries.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={10} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                    <div className="flex flex-col items-center gap-4 justify-center h-full">
                      <div className="bg-muted p-4 rounded-full">
                        <AlertCircle className="h-12 w-12 opacity-20" />
                      </div>
                      <p className="text-sm">No recorded attendance logs were found for this employee.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-primary/[0.02] transition-colors border-b border-muted/20 group">
                    <TableCell className="font-bold text-sm text-primary">{entry.date}</TableCell>
                    <TableCell className="text-center text-xs font-semibold text-muted-foreground">{entry.startTime1 || '-'}</TableCell>
                    <TableCell className="text-center text-xs font-semibold text-muted-foreground">{entry.endTime1 || '-'}</TableCell>
                    <TableCell className="text-center text-xs font-semibold text-muted-foreground">{entry.startTime2 || '-'}</TableCell>
                    <TableCell className="text-center text-xs font-semibold text-muted-foreground">{entry.endTime2 || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-black text-sm text-primary">{Number(entry.totalHours || 0).toFixed(1)}</span>
                        <span className="text-[10px] font-bold opacity-30">HRS</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary/20 text-primary bg-primary/5">
                        {entry.shift || 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-rose-600 font-black text-sm">
                      {entry.advanceSalary > 0 ? `${Number(entry.advanceSalary).toLocaleString()} DH` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={entry.isHoliday ? 'default' : 'secondary'} className={entry.isHoliday ? 'bg-amber-500 text-white font-black text-[9px]' : 'opacity-40 text-[9px]'}>
                        {entry.isHoliday ? 'YES' : 'NO'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full transition-all" onClick={() => handleEdit(entry)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full transition-all" onClick={() => handleDelete(entry.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isEditModalOpen && (
        <EditTimeTrackingModal 
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingEntry(null);
          }}
          entry={editingEntry}
          employee={employee}
        />
      )}
    </div>
  );
}
