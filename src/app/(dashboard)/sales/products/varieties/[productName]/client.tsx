
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  where, 
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
  ChevronLeft, 
  MoreVertical, 
  Trash2, 
  Package, 
  Tag, 
  History,
  Archive,
  ArrowRight
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

export default function ProductVarietiesPage() {
  const params = useParams<{ productName: string }>();
  const productName = params?.productName;
  const decodedName = decodeURIComponent(productName as string);
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { canDelete } = usePermissions('sales.products');

  const varietiesQuery = useMemoFirebase(() => {
    if (!db || !user || !decodedName) return null;
    return query(
      collection(db, 'products'),
      where('productName', '==', decodedName),
      orderBy('createdAt', 'desc')
    );
  }, [db, user, decodedName]);

  const { data: varieties, isLoading } = useCollection(varietiesQuery);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Are you sure you want to remove this product variety?')) return;
    const docRef = doc(db, 'products', id);
    try {
      await deleteDoc(docRef).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
        throw err;
      });
      toast({ title: "Variety Removed", description: "The product variety has been successfully archived." });
    } catch (error) {
      // Global emitter handled
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/sales/products')} className="rounded-full h-12 w-12 hover:bg-primary/10 transition-all">
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Products</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">{decodedName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Varieties Registry</h1>
          <p className="text-muted-foreground font-medium">Detailed listing of all categories and types for <span className="text-primary font-bold">{decodedName}</span>.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-6 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Package className="size-5" /> {decodedName.toUpperCase()} INVENTORY
              </CardTitle>
              <CardDescription className="text-xs">Specific classification and descriptions for this product group.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[60px] py-4 pl-8"></TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Product ID</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Product Name</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Category</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center">Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4">Description</TableHead>
                <TableHead className="text-right pr-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-none">
                    <TableCell colSpan={7} className="py-6 px-8"><Skeleton className="h-8 w-full rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : varieties?.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={7} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                    <div className="flex flex-col items-center gap-3">
                      <Archive className="h-12 w-12 opacity-10" />
                      <p>No varieties found for this product.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                varieties?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-primary/[0.02] transition-colors border-b border-muted/20 group">
                    <TableCell className="pl-8">
                      {canDelete ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40 p-1 rounded-xl shadow-2xl border-primary/10">
                            <DropdownMenuItem className="gap-2 text-rose-500 cursor-pointer font-bold text-xs uppercase py-2.5" onClick={() => handleDelete(item.id)}>
                              <Trash2 size={14} /> Remove Variety
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-black text-[10px] tracking-widest bg-primary/5 text-primary border-primary/20">
                        {item.productId}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-sm text-primary">{item.productName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag size={12} className="text-muted-foreground opacity-40" />
                        <span className="font-semibold text-xs text-muted-foreground uppercase">{item.category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight bg-accent/10 text-accent border-accent/20">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-xs text-muted-foreground line-clamp-1 italic font-medium">
                        {item.description || 'No additional details provided.'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Created</span>
                        <span className="text-[9px] font-medium">{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Initial'}</span>
                      </div>
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
