import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string } | void;
}

export function ScannerModal({ isOpen, onClose, onScan }: ScannerModalProps) {
  const [error, setError] = useState<string>('');
  const [scanError, setScanError] = useState<string>('');
  const [isStarting, setIsStarting] = useState<boolean>(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessing = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    const stopScannerSafe = async () => {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          // 2 = Html5QrcodeScannerState.SCANNING
          if (scanner.getState() === 2) {
            await scanner.stop();
          }
          scanner.clear();
        } catch (e: any) {
          // Ignore state transition errors which are common when closing modal quickly
          if (e?.message?.includes('transition') || (typeof e === 'string' && e.includes('transition'))) {
            return;
          }
          console.warn('Scanner stop warning:', e);
        } finally {
          scannerRef.current = null;
        }
      }
    };

    if (!isOpen) {
      stopScannerSafe();
      return;
    }

    setIsStarting(true);
    setError('');
    setScanError('');
    isProcessing.current = false;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            if (!isMounted || isProcessing.current) return;
            isProcessing.current = true;
            setScanError('');
            
            try {
              const result = await Promise.resolve(onScan(decodedText));
              if (result && typeof result === 'object' && result.success === false) {
                setScanError(result.message || 'Invalid barcode');
                setTimeout(() => {
                  if (isMounted) isProcessing.current = false;
                }, 2000); // Wait 2s before accepting another scan
              } else {
                isMounted = false;
                onClose(); // The cleanup function will handle stopping the camera
              }
            } catch (e) {
              setScanError('Failed to process barcode');
              setTimeout(() => {
                if (isMounted) isProcessing.current = false;
              }, 2000);
            }
          },
          (errorMessage) => {
            // Ignore frame failures
          }
        );
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to start camera. Please ensure you have granted camera permissions.');
        }
      } finally {
        if (isMounted) {
          setIsStarting(false);
        }
      }
    };

    // Small delay to ensure the DOM element is rendered
    setTimeout(startScanner, 200);

    return () => {
      isMounted = false;
      stopScannerSafe();
    };
  }, [isOpen, onScan, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6 border-0 rounded-3xl shadow-2xl bg-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
          {isStarting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Starting Camera...</p>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50 p-6 text-center z-10">
              <p className="text-rose-600 font-bold text-sm mb-2">Camera Error</p>
              <p className="text-rose-500/80 text-xs font-medium">{error}</p>
            </div>
          )}

          {scanError && (
            <div className="absolute bottom-4 left-4 right-4 bg-rose-500/95 text-white px-4 py-3 rounded-xl text-center text-xs font-bold shadow-lg z-20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
              {scanError}
            </div>
          )}

          <div id="reader" className="w-full h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
