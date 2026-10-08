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
import { doc, updateDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useToast } from '@/hooks/use-toast';
import { Clock } from 'lucide-react';

interface EditTimeTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: any;
  employee: any;
}

export function EditTimeTrackingModal({ isOpen, onClose, entry, employee }: EditTimeTrackingModalProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form State
  const [date, setDate] = useState(entry?.date || '');
  const [startTime1, setStartTime1] = useState(entry?.startTime1 || '');
  const [endTime1, setEndTime1] = useState(entry?.endTime1 || '');
  const [startTime2, setStartTime2] = useState(entry?.startTime2 || '');
  const [endTime2, setEndTime2] = useState(entry?.endTime2 || '');
  const [isAbsent, setIsAbsent] = useState(entry?.isAbsent || false);
  const [isHoliday, setIsHoliday] = useState(entry?.isHoliday || false);
  const [shift, setShift] = useState(entry?.shift || 'Shift 1');
  const [advanceSalary, setAdvanceSalary] = useState(entry?.advanceSalary || 0);

  const [totalHours, setTotalHours] = useState(entry?.totalHours || 0);

  useEffect(() => {
    if (isAbsent) {
      setTotalHours(0);
      return;
    }

    const calculateDiff = (start: string, end: string) => {
      if (!start || !end) return 0;
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const diffMinutes = (eH * 60 + eM) - (sH * 60 + sM);
      return Math.max(0, diffMinutes / 60);
    };

    const h1 = calculateDiff(startTime1, endTime1);
    const h2 = calculateDiff(startTime2, endTime2);
    let total = h1 + h2;

    if (isHoliday) {
      total += 8;
    }

    setTotalHours(total);
  }, [startTime1, endTime1, startTime2, endTime2, isAbsent, isHoliday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !entry) return;

    setLoading(true);
    const entryRef = doc(db, 'work_time_tracking', entry.id);
    
    const data = {
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
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(entryRef, data).catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: entryRef.path,
          operation: 'update',
          requestResourceData: data
        }));
        throw err;
      });

      toast({
        title: "Record Updated",
        description: "The work session has been successfully modified.",
      });
      onClose();
    } catch (error) {
      // Global emitter handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] border-none shadow-2xl rounded-2xl overflow-hidden p-0">
        <DialogHeader className="p-4 bg-primary text-white">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Clock size={32} className="text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold uppercase tracking-tight">Edit Work Session</DialogTitle>
              <DialogDescription className="text-white/80 font-medium">
                Modifying record for {employee?.firstName} {employee?.lastName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-primary/70">Recording Date</Label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="h-12 rounded-xl bg-muted/30 border-none font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-primary/70">Shift Designation</Label>
              <Input 
                value={shift} 
                onChange={e => setShift(e.target.value)} 
                placeholder="Shift 1 / Shift 2" 
                className="h-12 rounded-xl bg-muted/30 border-none font-bold"
              />
            </div>
          </div>

          <Separator className="bg-primary/5" />

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${isAbsent ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Session A</h4>
              <div className="flex gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-bold opacity-60">START</Label>
                  <Input type="time" value={startTime1} onChange={e => setStartTime1(e.target.value)} className="h-10 rounded-lg bg-muted/20" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-bold opacity-60">END</Label>
                  <Input type="time" value={endTime1} onChange={e => setEndTime1(e.target.value)} className="h-10 rounded-lg bg-muted/20" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Session B</h4>
              <div className="flex gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-bold opacity-60">START</Label>
                  <Input type="time" value={startTime2} onChange={e => setStartTime2(e.target.value)} className="h-10 rounded-lg bg-muted/20" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-bold opacity-60">END</Label>
                  <Input type="time" value={endTime2} onChange={e => setEndTime2(e.target.value)} className="h-10 rounded-lg bg-muted/20" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center py-2 px-4 bg-primary/5 rounded-2xl border border-primary/5">
            <div className="flex items-center gap-3">
              <Checkbox id="edit-absent" checked={isAbsent} onCheckedChange={(val) => setIsAbsent(!!val)} className="h-5 w-5 border-primary/20" />
              <Label htmlFor="edit-absent" className="text-xs font-bold uppercase tracking-tight text-primary">Absent</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="edit-holiday" checked={isHoliday} onCheckedChange={(val) => setIsHoliday(!!val)} className="h-5 w-5 border-primary/20" />
              <Label htmlFor="edit-holiday" className="text-xs font-bold uppercase tracking-tight text-primary">Holiday</Label>
            </div>
            <div className="col-span-2 flex flex-col items-end">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Calculated Duration</span>
              <div className="flex items-baseline gap-1 text-primary">
                <span className="text-3xl font-black">{totalHours.toFixed(1)}</span>
                <span className="text-xs font-bold">HRS</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-primary/70">Advance on Salary (DH)</Label>
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
              className="h-11 rounded-xl bg-muted/30 border-none font-bold"
              placeholder="0.00"
            />
          </div>

          <DialogFooter className="gap-3 pt-6">
            <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-muted-foreground uppercase tracking-widest">
              CANCEL
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-primary/20 uppercase tracking-widest"
            >
              {loading ? 'SAVING...' : 'SAVE MODIFICATIONS'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}