'use client';

import React, { useState } from 'react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  deleteDoc,
  doc
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  History,
  Calendar,
  User,
  Download,
  Filter,
  XCircle
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentTermsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const termsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'payment_terms'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const { data: terms, isLoading } = useCollection(termsQuery);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Are you sure you want to delete this payment term?')) return;
    const docRef = doc(db, 'payment_terms', id);
    try {
      await deleteDoc(docRef).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
        throw err;
      });
      toast({
        title: "Term Deleted",
        description: "The payment configuration has been removed."
      });
    } catch (error) {
      // Handled by emitter
    }
  };

  const filteredTerms = terms?.filter(term =>
    term.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-primary">Payment Terms</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Payment Terms</h1>
          <p className="text-muted-foreground font-medium">Manage corporate billing split, advance percentages, and delay logic.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 rounded-xl font-bold">
            <Download size={18} /> EXPORT CSV
          </Button>
          <Button asChild className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all">
            <Link href="/settings/payment-terms/add">
              <Plus size={18} /> ADD TERM
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b bg-muted/30 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
              <FileText className="size-5" /> Terms Registry
            </CardTitle>
            <CardDescription className="text-xs">Live configuration of payment schedules for customers.</CardDescription>
          </div>
          <div className="relative w-72 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors h-4 w-4" />
            <Input
              placeholder="Search by term name..."
              className="pl-10 h-11 border-primary/10 bg-white/50 focus:bg-white transition-all focus:ring-primary/20"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Term Name</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Amount 1 (%)</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Delay 1 (Wks)</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Amount 2 (%)</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Delay 2 (Wks)</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Created By</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Created At</TableHead>
                <TableHead className="py-4 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-none">
                    <TableCell colSpan={8} className="py-6"><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTerms.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={8} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                    <div className="flex flex-col items-center gap-3">
                      <History className="h-10 w-10 opacity-10" />
                      <span>No payment terms found. Create your first configuration.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTerms.map((term) => (
                  <TableRow key={term.id} className="hover:bg-primary/[0.02] transition-colors border-b border-muted/20 group">
                    <TableCell className="font-bold text-sm text-primary max-w-xs truncate">{term.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-black">
                        {term.amount1}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-muted-foreground">
                      {term.delay1 || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-accent/5 text-accent border-accent/10 font-black">
                        {term.amount2}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-muted-foreground">
                      {term.delay2 || 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <User size={12} className="opacity-50" />
                        {term.createdBy?.split('@')[0] || 'System'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Calendar size={12} className="opacity-50" />
                        {term.createdAt ? new Date(term.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-2xl border-primary/10">
                          <DropdownMenuItem asChild className="gap-2 cursor-pointer py-2 font-bold text-xs uppercase text-primary">
                            <Link href={`/settings/payment-terms/${term.id}/edit`}>
                              <Edit2 size={14} /> Edit Term
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer py-2 font-bold text-xs uppercase text-destructive focus:text-destructive" onClick={() => handleDelete(term.id)}>
                            <Trash2 size={14} /> Delete Term
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
