'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { XCircle, Loader2, Flashlight, FlashlightOff } from 'lucide-react';

interface QrScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const QrScannerDialog: React.FC<QrScannerDialogProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-scanner-container";

  // State for torch/flashlight control
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const toggleTorch = async () => {
    if (videoTrackRef.current && torchSupported) {
        try {
            const newTorchState = !isTorchOn;
            const advanced = { torch: newTorchState } as MediaTrackConstraintSet;
            await videoTrackRef.current.applyConstraints({
                advanced: [advanced]
            });
            setIsTorchOn(newTorchState);
        } catch (err) {
            console.error('Error toggling torch:', err);
            toast({
                title: 'Licht-Fehler',
                description: 'Das Kameralicht konnte nicht umgeschaltet werden.',
                variant: 'destructive',
            });
        }
    }
  };

  const cleanupScanner = () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        // Turn off torch before stopping the stream
        if (videoTrackRef.current && torchSupported) {
            const advanced = { torch: false } as MediaTrackConstraintSet;
            videoTrackRef.current.applyConstraints({ advanced: [advanced] }).catch(() => {});
        }
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
      videoTrackRef.current = null;
      setTorchSupported(false);
      setIsTorchOn(false);
  };


  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      return;
    }
    
    // This function will attempt to start the scanner, retrying if the DOM element isn't ready.
    const startScanner = () => {
      const scannerContainer = document.getElementById(containerId);
      if (!scannerContainer) {
        setTimeout(startScanner, 100);
        return;
      }
      
      // Prevent re-initialization if already running
      if (scannerRef.current) return;

      setErrorMessage(null);
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      const qrCodeSuccessCallback = (decodedText: string) => {
        if (scannerRef.current?.isScanning) {
            cleanupScanner();
        }
        
        try {
          const url = new URL(decodedText);
          const pathParts = url.pathname.split('/');
          const anlageIdIndex = pathParts.findIndex(part => part === 'anlagenbuch') + 1;

          if (anlageIdIndex > 0 && pathParts.length > anlageIdIndex) {
            const anlageId = pathParts[anlageIdIndex];
            toast({ title: 'QR-Code erkannt', description: `Anlage ${anlageId} wird geladen...` });
            onClose();
            router.push(`/anlagenbuch/${anlageId}?view=installer`);
          } else {
            throw new Error('Ungültiges URL-Format im QR-Code.');
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Ungültiger QR-Code',
            description: 'Der gescannte Code enthält keinen gültigen Link zu einer Anlage.',
          });
        }
      };
      
      const qrCodeErrorCallback = () => { /* Ignore frequent errors */ };

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      const startPromise = scanner.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
      
      startPromise.catch(() => {
        // Fallback for devices that don't support facingMode but have a camera
        Html5Qrcode.getCameras().then(cameras => {
            if (cameras && cameras.length) {
                scanner.start(
                    cameras[0].id,
                    config,
                    qrCodeSuccessCallback,
                    qrCodeErrorCallback
                ).catch((err) => {
                    console.error('Failed to start scanner with any camera:', err);
                    setErrorMessage("Kamera konnte nicht gestartet werden. Bitte Berechtigungen prüfen.");
                });
            } else {
                setErrorMessage("Keine Kamera gefunden.");
            }
        }).catch(() => {
            setErrorMessage("Kamerazugriff wurde verweigert. Bitte in den Browser-Einstellungen aktivieren.");
        });
      });

      // After starting, find the track to enable torch control
      const checkVideoInterval = setInterval(() => {
          if (!scannerRef.current || !scannerRef.current.isScanning) {
              clearInterval(checkVideoInterval);
              return;
          }
          const videoElement = scannerContainer.querySelector('video');
          if (videoElement && videoElement.srcObject instanceof MediaStream) {
              const track = videoElement.srcObject.getVideoTracks()[0];
              if (track) {
                  videoTrackRef.current = track;
                  const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
                  if (capabilities.torch) {
                      setTorchSupported(true);
                  }
                  clearInterval(checkVideoInterval);
              }
          }
      }, 200); // Check every 200ms
    };

    startScanner();
    
    return () => {
      cleanupScanner();
    };

  }, [isOpen, onClose, router, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR-Code scannen</DialogTitle>
          <DialogDescription>
            Halten Sie den QR-Code der Anlage vor die Kamera.
          </DialogDescription>
        </DialogHeader>
        <div id={containerId} className="w-full rounded-md overflow-hidden aspect-square bg-muted flex items-center justify-center relative">
            {!errorMessage && (
                <div className='text-center text-muted-foreground'>
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Starte Kamera...</p>
                </div>
            )}
             {torchSupported && (
                <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleTorch}
                    className="absolute bottom-4 right-4 z-10 rounded-full h-12 w-12"
                    aria-label="Kameralicht umschalten"
                >
                    {isTorchOn ? <FlashlightOff className="h-6 w-6" /> : <Flashlight className="h-6 w-6" />}
                </Button>
            )}
        </div>
        {errorMessage && (
            <div className="text-center text-destructive flex flex-col items-center gap-2">
                <XCircle className="h-8 w-8"/>
                <p>{errorMessage}</p>
            </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerDialog;
