'use client';

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from '@/firebase/firestore-override';
import { useToast } from '@/hooks/use-toast';
import { Clock, Users } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  matricule?: string;
}

interface TimeTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
}

export function TimeTrackingModal({ isOpen, onClose, employees }: TimeTrackingModalProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime1, setStartTime1] = useState('');
  const [endTime1, setEndTime1] = useState('');
  const [startTime2, setStartTime2] = useState('');
  const [endTime2, setEndTime2] = useState('');
  const [isAbsent, setIsAbsent] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [shift, setShift] = useState('Shift 1');
  const [advanceSalary, setAdvanceSalary] = useState(0);

  // Derived Values
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    if (isAbsent) {
      setTotalHours(0);
      return;
    }

    const calcSessionHours = (start: string, end: string): number => {
      if (!start || !end) return 0;
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      let diffMinutes = (eH * 60 + eM) - (sH * 60 + sM);
      // Handle cross‑midnight shifts
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      const hrs = diffMinutes / 60;
      // Round each session to two decimals
      return Math.round(hrs * 100) / 100;
    };

    const h1 = calcSessionHours(startTime1, endTime1);
    const h2 = calcSessionHours(startTime2, endTime2);
    let total = h1 + h2;

    if (isHoliday) {
      total += 8;
    }

    // Round final total to two decimal places
    total = Math.round(total * 100) / 100;
    setTotalHours(total);
  }, [startTime1, endTime1, startTime2, endTime2, isAbsent, isHoliday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    setLoading(true);
    const colRef = collection(db, 'work_time_tracking');
    
    try {
      // 1. Check for existing records for this date
      const existingPromises = employees.map(employee => 
        getDocs(query(colRef, where('employeeId', '==', employee.id), where('date', '==', date)))
      );
      const existingResults = await Promise.all(existingPromises);
      
      const conflicts = existingResults
        .map((snap, i) => (!snap.empty ? employees[i] : null))
        .filter(Boolean);

      if (conflicts.length > 0) {
        toast({
          title: "Duplicate Record Detected",
          description: `${conflicts.map(e => e?.firstName).join(', ')} already have work time logged on ${date}.`,
          variant: "destructive"
        });
        setLoading(false);
        return; // Abort
      }

      // 2. Insert records
      const promises = employees.map(employee => {
        const data = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          date,
          startTime1: isAbsent ? null : startTime1,
          endTime1: isAbsent ? null : endTime1,
          startTime2: isAbsent ? null : startTime2,
          endTime2: isAbsent ? null : endTime2,
          totalHours,
          isAbsent,
          isHoliday,
          shift,
          shiftHours: totalHours,
          advanceSalary: Number(advanceSalary),
          createdAt: serverTimestamp(),
        };

        return addDoc(colRef, data).catch((err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data
          }));
          throw err;
        });
      });

      await Promise.all(promises);

      toast({
        title: "Sessions Logged",
        description: `Successfully saved work time for ${employees.length} employees.`,
      });
      onClose();
    } catch (error) {
      // Error handled by central emitter
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] border-none shadow-2xl rounded-2xl overflow-hidden p-0">
        <DialogHeader className="p-4 bg-primary text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
              {employees.length > 1 ? <Users size={20} className="text-white" /> : <Clock size={20} className="text-white" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold uppercase tracking-tight">
                {employees.length > 1 ? `Batch Time Tracking` : `Work Time Tracking`}
              </DialogTitle>
              <DialogDescription className="text-white/80 font-medium text-xs">
                {employees.length > 1 
                  ? `Logging sessions for ${employees.length} selected employees`
                  : `Logging session for ${employees[0].firstName} ${employees[0].lastName}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Recording Date</Label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="h-9 rounded-lg bg-muted/30 border-none font-bold text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Shift Designation</Label>
              <Input 
                value={shift} 
                onChange={e => setShift(e.target.value)} 
                placeholder="Shift 1 / Shift 2" 
                className="h-9 rounded-lg bg-muted/30 border-none font-bold text-xs"
              />
            </div>
          </div>

          <Separator className="bg-primary/5" />

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${isAbsent ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
            <div className="space-y-2">
              <h4 className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Session A</h4>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-[9px] font-bold opacity-60">START</Label>
                  <Input type="time" value={startTime1} onChange={e => setStartTime1(e.target.value)} className="h-8 rounded-md bg-muted/20 text-xs" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[9px] font-bold opacity-60">END</Label>
                  <Input type="time" value={endTime1} onChange={e => setEndTime1(e.target.value)} className="h-8 rounded-md bg-muted/20 text-xs" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Session B</h4>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-[9px] font-bold opacity-60">START</Label>
                  <Input type="time" value={startTime2} onChange={e => setStartTime2(e.target.value)} className="h-8 rounded-md bg-muted/20 text-xs" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[9px] font-bold opacity-60">END</Label>
                  <Input type="time" value={endTime2} onChange={e => setEndTime2(e.target.value)} className="h-8 rounded-md bg-muted/20 text-xs" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-4 bg-primary/5 rounded-xl border border-primary/5">
            <div className="flex items-center gap-2">
              <Checkbox id="holiday" checked={isHoliday} onCheckedChange={(val) => setIsHoliday(!!val)} className="h-4 w-4 border-primary/20" />
              <Label htmlFor="holiday" className="text-[10px] font-bold uppercase tracking-tight text-primary">Holiday</Label>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Calculated Duration</span>
              <div className="flex items-baseline gap-1 text-primary">
                <span className="text-xl font-black">{totalHours.toFixed(2)}</span>
                <span className="text-[10px] font-bold">HRS</span>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Advance on Salary (DH)</Label>
            <Input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={advanceSalary === 0 ? '' : advanceSalary} 
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setAdvanceSalary(val === '' ? 0 : Number(val));
                }
              }} 
              className="h-9 rounded-lg bg-muted/30 border-none font-bold text-xs mt-1"
              placeholder="0.00"
            />
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} size="sm" className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
              DISCARD
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-6 rounded-lg shadow-md shadow-primary/20 uppercase tracking-widest text-[10px]"
            >
              {loading ? 'SAVING...' : `FINALIZE LOG (${employees.length})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}