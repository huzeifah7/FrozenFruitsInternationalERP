import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';

interface ERPInvoiceItemsTableProps {
  fields: any[];
  register: any;
  append: (value: any) => void;
  remove: (index: number) => void;
  watch: any;
  errors?: any;
  invoiceType?: 'invoice' | 'produce' | 'credit_note' | 'proforma';
}

export function ERPInvoiceItemsTable({
  fields,
  register,
  append,
  remove,
  watch,
  errors,
  invoiceType = 'invoice'
}: ERPInvoiceItemsTableProps) {

  const handleAddRow = () => {
    if (invoiceType === 'invoice') {
      append({ description: '', quantity: 0, price: 0 });
    } else if (invoiceType === 'produce' || invoiceType === 'proforma') {
      append({ product: '', calibre: '', quantity: 0, price: 0 });
    } else { // credit_note
      append({ product: '', description: '', quantity: 0, price: 0 });
    }
  };

  // Watch values to calculate row totals dynamically
  const watchItems = watch('items') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-widest text-[#0F172A] ml-1">
          Items Section
        </Label>
        <Button
          type="button"
          onClick={handleAddRow}
          className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#193A7B] hover:bg-[#0F2552] text-white flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 shadow-sm"
        >
          <Plus size={12} className="stroke-[3]" /> Add Row
        </Button>
      </div>

      <div className="overflow-x-auto w-full scroll-smooth custom-scrollbar border border-slate-100 rounded-2xl bg-white shadow-inner">
        <table className="w-full border-collapse text-left min-w-[800px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              {/* Conditional columns */}
              {(invoiceType === 'produce' || invoiceType === 'proforma' || invoiceType === 'credit_note') && (
                <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40">Product</th>
              )}
              {(invoiceType === 'produce' || invoiceType === 'proforma') && (
                <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40">Calibre</th>
              )}
              {(invoiceType === 'invoice' || invoiceType === 'credit_note') && (
                <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40">Description</th>
              )}
              
              {/* Common columns */}
              <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40 text-right w-32">Quantity</th>
              <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40 text-right w-32">Price (€)</th>
              <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40 text-right w-36">Total (€)</th>
              <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40 text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.length === 0 ? (
              <tr>
                <td 
                  colSpan={
                    invoiceType === 'produce' || invoiceType === 'proforma' ? 6 : 
                    invoiceType === 'credit_note' ? 6 : 5
                  } 
                  className="py-12 text-center text-slate-400 font-medium italic opacity-60 text-xs"
                >
                  No items added yet. Click 'Add Row' to add items.
                </td>
              </tr>
            ) : (
              fields.map((field, index) => {
                const qty = Number(watchItems[index]?.quantity || 0);
                const price = Number(watchItems[index]?.price || 0);
                const total = qty * price;

                return (
                  <tr key={field.id} className="hover:bg-slate-50/20 transition-colors">
                    {/* Product Input */}
                    {(invoiceType === 'produce' || invoiceType === 'proforma' || invoiceType === 'credit_note') && (
                      <td className="p-2">
                        <Input
                          type="text"
                          placeholder="e.g., Avocado Hass"
                          className={cn(
                            "h-10 rounded-lg border-slate-200 bg-white font-semibold text-xs text-[#2e1d52]",
                            errors?.items?.[index]?.product && "border-rose-500"
                          )}
                          {...register(`items.${index}.product` as const, { required: "Required" })}
                        />
                        <FieldError message={errors?.items?.[index]?.product?.message as string} />
                      </td>
                    )}

                    {/* Calibre Input */}
                    {(invoiceType === 'produce' || invoiceType === 'proforma') && (
                      <td className="p-2">
                        <Input
                          type="text"
                          placeholder="e.g., 12"
                          className={cn(
                            "h-10 rounded-lg border-slate-200 bg-white font-semibold text-xs text-[#2e1d52]",
                            errors?.items?.[index]?.calibre && "border-rose-500"
                          )}
                          {...register(`items.${index}.calibre` as const, { required: "Required" })}
                        />
                        <FieldError message={errors?.items?.[index]?.calibre?.message as string} />
                      </td>
                    )}

                    {/* Description Input */}
                    {(invoiceType === 'invoice' || invoiceType === 'credit_note') && (
                      <td className="p-2">
                        <Input
                          type="text"
                          placeholder="e.g., Logistics / Packaging services"
                          className={cn(
                            "h-10 rounded-lg border-slate-200 bg-white font-semibold text-xs text-[#2e1d52]",
                            errors?.items?.[index]?.description && "border-rose-500"
                          )}
                          {...register(`items.${index}.description` as const, { required: "Required" })}
                        />
                        <FieldError message={errors?.items?.[index]?.description?.message as string} />
                      </td>
                    )}

                    {/* Quantity Input */}
                    <td className="p-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="0"
                        className={cn(
                          "h-10 rounded-lg border-slate-200 bg-white font-black text-xs text-[#2e1d52] text-right",
                          errors?.items?.[index]?.quantity && "border-rose-500"
                        )}
                        {...register(`items.${index}.quantity` as const, { 
                          required: "Required", 
                          valueAsNumber: true,
                          validate: (val: number) => val > 0 || "Must be > 0"
                        })}
                      />
                      <FieldError message={errors?.items?.[index]?.quantity?.message as string} />
                    </td>

                    {/* Price Input */}
                    <td className="p-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className={cn(
                          "h-10 rounded-lg border-slate-200 bg-white font-black text-xs text-[#2e1d52] text-right",
                          errors?.items?.[index]?.price && "border-rose-500"
                        )}
                        {...register(`items.${index}.price` as const, { 
                          required: "Required", 
                          valueAsNumber: true, 
                          validate: (val: number) => val > 0 || "Must be > 0"
                        })}
                      />
                      <FieldError message={errors?.items?.[index]?.price?.message as string} />
                    </td>

                    {/* Dynamic Row Total */}
                    <td className="p-4 text-right font-black text-xs text-[#0284C7]">
                      {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>

                    {/* Remove Row Action */}
                    <td className="p-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50/50 rounded-lg transition-transform active:scale-90"
                      >
                        <Trash2 size={14} className="stroke-[2.5]" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
