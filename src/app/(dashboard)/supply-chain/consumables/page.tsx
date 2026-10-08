'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  deleteDoc,
  doc,
  addDoc,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
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
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Package2,
  BadgeCheck,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ConsumablesListingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // Query
  const consumablesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'consumables'), orderBy('created_at', 'desc'));
  }, [db]);

  const { data: consumables, isLoading: loading } = useCollection(consumablesQuery);

  React.useEffect(() => {
    const seedMissingConsumables = async () => {
      if (!db || !consumables) return;
      if (localStorage.getItem('seed_consumables_v1')) return;

      const NEW_CONSUMABLES = [
        { name: "Corners", critical_level: 520, average_level: 728, is_packaging: false, description: "cardboard corners", created_by: "Logistic Team", updated_by: "" },
        { name: "CHAPEAU PALETTE", critical_level: 130, average_level: 182, is_packaging: false, description: "unite de mesure 1 palette", created_by: "Logistic Team", updated_by: "Logistic Team" },
        { name: "PALLET", critical_level: 130, average_level: 182, is_packaging: false, description: "INTERNATIONAL PALLET / EXPORT", created_by: "Logistic Team", updated_by: "" },
        { name: "FEUILLARD", critical_level: 2, average_level: 5, is_packaging: false, description: "strapping pallets \"unit of measurement roll\"", created_by: "Logistic Team", updated_by: "" },
        { name: "PLASTIC BOXES 10KG", critical_level: 2600, average_level: 7800, is_packaging: false, description: "AXAR FUITS", created_by: "Logistic Team", updated_by: "Logistic Team" },
        { name: "PLASTIC BOXES 20KG", critical_level: 2600, average_level: 7800, is_packaging: false, description: "JOSE LUIS MONTOSA", created_by: "Logistic Team", updated_by: "Logistic Team" }
      ];

      const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
      const existingNames = new Set(consumables.map(c => normalize(c.name || '')));

      let addedCount = 0;
      for (const item of NEW_CONSUMABLES) {
        if (!existingNames.has(normalize(item.name))) {
          const consumableData = {
            name: item.name,
            critical_level: item.critical_level,
            average_level: item.average_level,
            is_packaging: item.is_packaging,
            description: item.description,
            suppliers: [],
            created_at: new Date(),
            updated_at: new Date(),
            created_by: item.created_by,
            updated_by: item.updated_by,
          };
          
          try {
            await addDoc(collection(db, 'consumables'), consumableData);
            addedCount++;
            existingNames.add(normalize(item.name));
          } catch (e) {
            console.error('Error adding consumable', item.name, e);
          }
        }
      }
      
      if (addedCount > 0) {
        toast({
          title: "Consumables Seeded",
          description: `Added ${addedCount} missing consumables.`
        });
      }
      localStorage.setItem('seed_consumables_v1', 'true');
    };

    seedMissingConsumables();
  }, [db, consumables, toast]);

  const filteredConsumables = consumables?.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!db || !window.confirm('Are you sure you want to delete this consumable?')) return;

    try {
      await deleteDoc(doc(db, 'consumables', id));
      toast({
        title: "Success",
        description: "Consumable deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting consumable:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete consumable",
      });
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li>Profile</li>
              <li className="flex items-center">
                <span className="mx-2 opacity-20">/</span>
                <span className="text-primary/60 font-black">Consumables</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Consumables</h1>
        </div>

        <Button 
          onClick={() => router.push('/supply-chain/consumables/add')}
          className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 group"
        >
          <Plus className="size-5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="uppercase tracking-widest text-[10px]">Add Consumable</span>
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search consumables..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="ghost" className="h-11 rounded-2xl gap-2 font-bold text-primary/60 hover:text-primary hover:bg-primary/5">
            <Filter className="size-4" />
            <span className="text-[10px] uppercase tracking-widest">Filters</span>
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FF] hover:bg-[#F8F7FF] border-b border-primary/5">
                <TableHead className="w-[80px] text-center text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 py-5">Actions</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 min-w-[200px]">Consumable Name</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Critical Level</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Average Level</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Packaging</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 min-w-[250px]">Description</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Created By</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Updated By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-64 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                  </TableCell>
                </TableRow>
              ) : filteredConsumables?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-64 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">No consumables found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredConsumables?.map((c) => (
                  <TableRow key={c.id} className="group border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-all">
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary transition-colors">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl border-primary/5 shadow-2xl">

                          <DropdownMenuItem onClick={() => router.push(`/supply-chain/consumables/${c.id}/edit`)} className="rounded-lg font-bold py-2.5 flex items-center gap-2 text-blue-500">
                            <Edit className="size-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(c.id)} className="rounded-lg font-bold py-2.5 flex items-center gap-2 text-rose-500">
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="font-black text-primary uppercase tracking-tight text-[11px] hover:text-emerald-600 transition-colors cursor-pointer">
                      <Link href={`/supply-chain/consumables/${c.id}`} className="block">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-bold text-muted-foreground text-[11px]">
                      {c.critical_level || 0}
                    </TableCell>
                    <TableCell className="font-bold text-muted-foreground text-[11px]">
                      {c.average_level || 0}
                    </TableCell>
                    <TableCell className="font-bold text-muted-foreground text-[11px]">
                      {c.is_packaging ? "YES" : "NO"}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate font-medium text-muted-foreground/80 text-[11px]">
                      {c.description}
                    </TableCell>
                    <TableCell className="text-[11px] font-medium text-muted-foreground/80">
                      {c.created_by || 'Logistic Team'}
                    </TableCell>
                    <TableCell className="text-[11px] font-medium text-muted-foreground/80">
                      {c.updated_by}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
