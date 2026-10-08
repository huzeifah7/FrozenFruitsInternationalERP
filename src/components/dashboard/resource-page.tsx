'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Download
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  collection, 
  doc, 
  addDoc,
  updateDoc,
  deleteDoc
} from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/components/auth-provider';
import Link from 'next/link';

interface Column {
  key: string;
  header: string;
  render?: (value: any, item: any) => React.ReactNode;
}

interface ResourcePageProps {
  title: string;
  description: string;
  collectionName: string;
  columns: Column[];
  formFields: {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    options?: { label: string; value: string }[];
  }[];
  addLink?: string;
}

export function ResourcePage({ 
  title, 
  description, 
  collectionName, 
  columns, 
  formFields,
  addLink
}: ResourcePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const db = useFirestore();
  const { profile } = useAuthContext();
  const { toast } = useToast();

  const collectionRef = useMemoFirebase(() => {
    if (!db || !profile?.role) return null;
    return collection(db, collectionName);
  }, [db, collectionName, profile?.role]);

  const { data: items, isLoading } = useCollection(collectionRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    if (editingItem) {
      const docRef = doc(db, collectionName, editingItem.id);
      updateDoc(docRef, formData).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: formData
        }));
      });
      toast({ title: 'Success', description: `${title} updated successfully.` });
    } else {
      const colRef = collection(db, collectionName);
      addDoc(colRef, {
        ...formData,
        createdAt: new Date().toISOString()
      }).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: formData
        }));
      });
      toast({ title: 'Success', description: `New ${title} added successfully.` });
    }
    setIsFormOpen(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to delete this item?')) {
      const docRef = doc(db, collectionName, id);
      deleteDoc(docRef).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      });
      toast({ title: 'Deleted', description: 'Item removed successfully.' });
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setIsFormOpen(true);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredItems = items?.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-primary/5">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-primary tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground/80 font-medium">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 font-bold border-primary/20 text-primary hover:bg-primary/5 transition-all">
            <Download size={14} /> EXPORT CSV
          </Button>
          {addLink ? (
            <Button asChild className="gap-2 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all">
              <Link href={addLink}>
                <Plus size={16} /> ADD {title.toUpperCase()}
              </Link>
            </Button>
          ) : (
            <Button onClick={() => { setEditingItem(null); setFormData({}); setIsFormOpen(true); }} className="gap-2 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 transition-all">
              <Plus size={16} /> ADD {title.toUpperCase()}
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors h-4 w-4" />
              <Input 
                placeholder={`Search records...`} 
                className="pl-10 h-11 border-primary/10 bg-white/50 focus:bg-white transition-all focus:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2 h-11 border-primary/10">
              <Filter size={14} /> FILTER
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5 border-b border-primary/10">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead 
                    key={col.key} 
                    className="font-bold text-[10px] uppercase tracking-widest text-primary/70 h-14 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {sortConfig?.key === col.key && (
                        <span className="text-[8px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className="py-6">
                        <div className="h-4 w-24 bg-primary/5 animate-pulse rounded" />
                      </TableCell>
                    ))}
                    <TableCell><div className="h-4 w-8 bg-primary/5 animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="h-48 text-center text-muted-foreground font-medium italic">
                    {profile?.role ? 'No records found in this collection.' : 'Authenticating profile...'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-primary/[0.04] group transition-colors border-l-4 border-l-transparent hover:border-l-primary/40 cursor-default">
                    {columns.map((col) => (
                      <TableCell key={col.key} className="py-5 font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {col.render ? col.render(item[col.key], item) : (item[col.key] || '-')}
                      </TableCell>
                    ))}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 p-1 border-primary/10 shadow-xl">
                          <DropdownMenuItem onClick={() => openEdit(item)} className="gap-2 cursor-pointer font-medium py-2">
                            <Edit2 size={14} className="text-primary" /> Edit Record
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(item.id)} className="gap-2 text-destructive cursor-pointer font-medium py-2">
                            <Trash2 size={14} /> Remove Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-6 border-t bg-muted/10">
              <p className="text-xs font-bold text-primary/60 uppercase tracking-tighter">
                Page {currentPage} of {totalPages} ({filteredItems.length} records)
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="font-bold border-primary/10"
                >
                  PREVIOUS
                </Button>
                <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                   disabled={currentPage === totalPages}
                   className="font-bold border-primary/10"
                >
                  NEXT
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">{editingItem ? `Update ${title}` : `New ${title} Entry`}</DialogTitle>
            <DialogDescription className="font-medium opacity-70">
              Provide the details below to finalize the record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            {formFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <label className="text-xs font-bold text-primary/70 uppercase tracking-tighter">{field.label}</label>
                {field.type === 'select' ? (
                  <select 
                    className="w-full h-11 px-4 rounded-xl border border-primary/10 bg-muted/30 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  >
                    <option value="">Choose an option...</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input 
                    type={field.type} 
                    placeholder={field.placeholder}
                    className="h-11 rounded-xl border-primary/10 bg-muted/30 focus:bg-white transition-all font-medium"
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    required
                  />
                )}
              </div>
            ))}
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)} className="font-bold">DISCARD</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 font-bold px-8 shadow-lg shadow-primary/20">
                {editingItem ? 'SAVE CHANGES' : 'CREATE RECORD'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
