'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  collection, 
  addDoc, 
  serverTimestamp 
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  X, 
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  productType: z.string().min(1, "Product Type is required"),
  description: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function AddProductPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // File states
  const [specsFile, setSpecsFile] = useState<{ fileName: string; dataUrl: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      productType: '',
      description: ''
    }
  });

  const handleSpecsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSpecsFile({
          fileName: file.name,
          dataUrl: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: ProductFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      const createdByName = user.displayName || user.email?.split('@')[0] || 'Zakariaa El Yamlahi';

      const productData = {
        name: values.name.trim(),
        productName: values.name.trim(),
        type: values.productType.trim(),
        productType: values.productType.trim(),
        description: values.description || '',
        specsFile: specsFile || null,
        images: images,
        createdAt: serverTimestamp(),
        createdBy: createdByName,
        updatedBy: '',
        updatedAt: serverTimestamp()
      };

      const colRef = collection(db, 'products');

      addDoc(colRef, productData)
        .then(() => {
          toast({
            title: "Product Added",
            description: `Product "${values.name}" has been successfully added.`,
          });
          router.push('/sales/products');
        })
        .catch((error: any) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: productData
          }));
        })
        .finally(() => {
          setLoading(false);
        });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "An error occurred while adding the product.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header section with Breadcrumb */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Product</h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-1">
          <Link href="/profile" className="hover:text-slate-600 transition-colors">Profile</Link>
          <span>/</span>
          <Link href="/sales/products" className="hover:text-slate-600 transition-colors">Products</Link>
          <span>/</span>
          <span className="text-slate-500 font-semibold">Add Product</span>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Main Card */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                Name
              </label>
              <Input
                {...form.register('name')}
                placeholder=""
                className="h-10 rounded-md border-slate-200 focus:border-slate-400 focus:ring-0 text-sm"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-rose-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Product Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                Product Type
              </label>
              <Input
                {...form.register('productType')}
                placeholder=""
                className="h-10 rounded-md border-slate-200 focus:border-slate-400 focus:ring-0 text-sm"
              />
              {form.formState.errors.productType && (
                <p className="text-xs text-rose-500">{form.formState.errors.productType.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              Description
            </label>
            <Textarea
              {...form.register('description')}
              rows={4}
              placeholder=""
              className="min-h-[100px] rounded-md border-slate-200 focus:border-slate-400 focus:ring-0 text-sm resize-y"
            />
          </div>

          {/* Attach Product's specs */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              Attach Product's specs
            </label>
            <div className="flex items-center gap-3">
              <label className="h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300 rounded-md flex items-center justify-center cursor-pointer shadow-2xs transition-colors shrink-0">
                <span>Choose File</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={handleSpecsFileChange}
                />
              </label>
              <span className="text-xs text-slate-500 font-medium">
                {specsFile ? specsFile.fileName : 'No file chosen'}
              </span>
            </div>
          </div>

          {/* Images Section */}
          <div className="space-y-3 pt-2">
            <h2 className="text-lg font-semibold text-[#1a233a]">
              Images
            </h2>

            {/* Drag and drop container */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={e => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  handleImageFiles(e.dataTransfer.files);
                }
              }}
              className={`border border-dashed rounded-lg p-10 text-center transition-colors ${
                isDragging ? 'border-slate-400 bg-slate-50' : 'border-slate-300 bg-white'
              }`}
            >
              <label className="cursor-pointer block">
                <p className="text-xs text-slate-500 font-normal">
                  Drag and drop images, or click to select
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files && handleImageFiles(e.target.files)}
                />
              </label>
            </div>

            {/* Image Preview Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                {images.map((imgUrl, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-50">
                    <img src={imgUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button (Bottom Right) */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="h-10 px-6 bg-[#1a233a] hover:bg-[#111827] text-white text-xs font-semibold rounded-lg shadow-sm transition-all uppercase tracking-wide"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Product'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
