'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  useDoc, 
  useFirestore, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { doc } from '@/firebase/firestore-override';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Download, 
  Edit, 
  ChevronLeft,
  Package
} from 'lucide-react';
import { generateProductPDF } from '@/lib/export-product-pdf';

export default function ProductViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const productId = params?.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : '';
  const decodedId = decodeURIComponent(productId || '');

  const docRef = useMemoFirebase(() => {
    if (!db || !user || !decodedId) return null;
    return doc(db, 'products', decodedId);
  }, [db, user, decodedId]);

  const { data: product, isLoading } = useDoc(docRef);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const name = product?.name || product?.productName || decodedId || 'Product';
  const type = product?.type || product?.productType || '-';
  const description = product?.description || '';
  const specsFile = product?.specsFile || null;
  const images: string[] = product?.images || [];

  const handleDownloadSpecs = () => {
    if (specsFile && specsFile.dataUrl) {
      const a = document.createElement('a');
      a.href = specsFile.dataUrl;
      a.download = specsFile.fileName || `${name}_specs.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: 'Downloading Specifications', description: specsFile.fileName });
    } else {
      toast({
        variant: 'destructive',
        title: 'No File Attached',
        description: 'No specification document was attached to this product.',
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!product) return;
    toast({ title: 'Generating PDF...', description: 'Preparing product specification datasheet.' });
    await generateProductPDF(product);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header section with Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Products View Page</h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-1">
            <Link href="/profile" className="hover:text-slate-600 transition-colors">Profile</Link>
            <span>/</span>
            <Link href="/sales/products" className="hover:text-slate-600 transition-colors">Products</Link>
            <span>/</span>
            <span className="text-slate-500 font-semibold">Products View Page</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            className="h-9 px-3 text-xs font-semibold gap-1.5 rounded-md text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            PDF
          </Button>

          <Button
            onClick={() => router.push(`/sales/products/${decodedId}/edit`)}
            className="h-9 px-4 text-xs font-semibold gap-1.5 rounded-md bg-[#1a233a] hover:bg-[#111827] text-white shadow-2xs"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* Main Info Card matching Screenshot 2 */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 md:p-10 space-y-8">
        <div className="space-y-6 max-w-4xl">
          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 items-start">
            <span className="text-xs font-semibold text-slate-700">Name</span>
            <span className="text-xs font-normal text-slate-900 md:col-span-2">{name}</span>
          </div>

          {/* Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 items-start">
            <span className="text-xs font-semibold text-slate-700">Description</span>
            <span className="text-xs font-normal text-slate-900 md:col-span-2 whitespace-pre-wrap">
              {description || ''}
            </span>
          </div>

          {/* Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 items-start">
            <span className="text-xs font-semibold text-slate-700">Type</span>
            <span className="text-xs font-normal text-slate-900 md:col-span-2">{type}</span>
          </div>

          {/* Attach Product's specs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 items-start">
            <span className="text-xs font-semibold text-slate-700">Attach Product's specs</span>
            <div className="md:col-span-2">
              {specsFile ? (
                <button
                  onClick={handleDownloadSpecs}
                  className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>{specsFile.fileName || 'Download Specifications'}</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">No specification file attached.</span>
              )}
            </div>
          </div>
        </div>

        {/* Images Header and Display */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h2 className="text-lg font-semibold text-[#1a233a]">
            Images
          </h2>

          {images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className="rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-50 shadow-2xs group relative"
                >
                  <img
                    src={imgUrl}
                    alt={`${name} Image ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <a
                    href={imgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold"
                  >
                    View Full
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No images uploaded for this product.</p>
          )}
        </div>
      </div>
    </div>
  );
}
