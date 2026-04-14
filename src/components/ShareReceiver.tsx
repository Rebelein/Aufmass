
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, FileUp, CheckCircle } from 'lucide-react';
import { findAnlageByNummer, addAnlage, updateAnlage } from '@/lib/anlage-storage';
import { addAbgaswert } from '@/lib/abgaswerte-storage';
import { uploadDokumentFile } from '@/lib/dokument-storage';
import { extractExhaustValuesFromFile } from '@/ai/flows/extract-exhaust-values-flow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ProcessingState = 'idle' | 'processing' | 'manual_input' | 'creating_anlage' | 'success' | 'error';
type FileInfo = { name: string; type: string; dataUri: string };

function ShareReceiverContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [state, setState] = useState<ProcessingState>('idle');
  const [message, setMessage] = useState('Initialisiere Import...');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [manualAnlagennummer, setManualAnlagennummer] = useState('');
  const [newAnlageName, setNewAnlageName] = useState('');
  const [anlageIdToRedirect, setAnlageIdToRedirect] = useState<string | null>(null);

  useEffect(() => {
    const title = searchParams.get('title');
    const text = searchParams.get('text'); 

    if (text && title && state === 'idle') {
      setState('processing');
      setMessage('Lade geteilte Datei...');
      
      fetch(text)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUri = e.target?.result as string;
            const file = { name: title, type: blob.type, dataUri };
            setFileInfo(file);
            processSharedFile(file);
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
            console.error(err);
            setState('error');
            setMessage(`Fehler beim Laden der Datei: ${err.message}`);
        });
    }
  }, [searchParams, state]);

  const extractAnlagennummer = (filename: string): string | null => {
      const match = filename.match(/W20\d+/);
      return match ? match[0] : null;
  };

  const processSharedFile = async (file: FileInfo) => {
    setMessage('Analysiere Datei...');
    const anlagennummer = extractAnlagennummer(file.name);

    if (!anlagennummer) {
      setState('manual_input');
      setMessage('Anlagennummer konnte nicht automatisch erkannt werden. Bitte geben Sie sie manuell ein.');
      return;
    }

    await findAndProcessAnlage(anlagennummer, file);
  };
  
  const handleManualSubmit = async () => {
    if (!manualAnlagennummer.trim() || !fileInfo) return;
    setState('processing');
    setMessage(`Suche Anlage ${manualAnlagennummer}...`);
    await findAndProcessAnlage(manualAnlagennummer.trim(), fileInfo);
  }

  const findAndProcessAnlage = async (anlagennummer: string, file: FileInfo) => {
    const anlage = await findAnlageByNummer(anlagennummer);
    if (anlage) {
      if (anlage.verarbeiteteDateinamen?.includes(file.name)) {
          setState('error');
          setMessage(`Diese Datei (${file.name}) wurde bereits für die Anlage ${anlagennummer} importiert.`);
          return;
      }
      await importDataForAnlage(anlage.id, anlagennummer, file);
    } else {
      setManualAnlagennummer(anlagennummer); 
      setState('creating_anlage');
      setMessage(`Anlage ${anlagennummer} nicht gefunden. Möchten Sie sie neu anlegen?`);
    }
  };

  const handleCreateAnlage = async () => {
      if (!newAnlageName.trim() || !manualAnlagennummer || !fileInfo) return;
      setState('processing');
      setMessage(`Erstelle neue Anlage ${newAnlageName}...`);
      const newAnlage = await addAnlage({ name: newAnlageName, anlagennummer: manualAnlagennummer });
      if (newAnlage) {
          await importDataForAnlage(newAnlage.id, newAnlage.anlagennummer, fileInfo);
      } else {
          setState('error');
          setMessage('Fehler beim Erstellen der neuen Anlage.');
      }
  };
  
  const importDataForAnlage = async (anlageId: string, anlagennummer: string, file: FileInfo) => {
    setMessage('Extrahiere Messwerte aus Datei...');
    try {
        const result = await extractExhaustValuesFromFile({ fileDataUri: file.dataUri, anlagennummer });
        if (!result) {
            setState('error');
            setMessage(`Die Anlagennummer im Dokument stimmt nicht mit "${anlagennummer}" überein oder es konnten keine Daten extrahiert werden.`);
            return;
        }

        setMessage('Speichere Messwerte und lade Dokument hoch...');
        
        const response = await fetch(file.dataUri);
        const blob = await response.blob();
        const fileObject = new File([blob], file.name, { type: file.type });

        const { downloadURL, filePath } = await uploadDokumentFile(anlageId, fileObject, () => {});

        await addAbgaswert({ 
            anlageId: anlageId, 
            source: 'ai',
            messdatum: result.messdatum,
            werte: result.werte,
            fileUrl: downloadURL,
            filePath: filePath,
        });

        const anlageToUpdate = await findAnlageByNummer(anlagennummer);
        if (anlageToUpdate) {
            const updatedFilenames = [...(anlageToUpdate.verarbeiteteDateinamen || []), file.name];
            await updateAnlage(anlageId, { verarbeiteteDateinamen: updatedFilenames });
        }
        
        setAnlageIdToRedirect(anlageId);
        setState('success');
        setMessage(`Import erfolgreich! Die Daten wurden der Anlage ${anlagennummer} hinzugefügt.`);

    } catch (e) {
        setState('error');
        setMessage(`Ein Fehler ist bei der Verarbeitung aufgetreten: ${(e as Error).message}`);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-6 w-6" /> Datei-Import
          </CardTitle>
          <CardDescription>Geteilte Datei wird verarbeitet...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {state === 'processing' && (
                <div className="flex items-center gap-3 text-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p>{message}</p>
                </div>
            )}
            {state === 'manual_input' && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{message}</p>
                    <Label htmlFor="anlagennummer">Anlagennummer</Label>
                    <Input id="anlagennummer" value={manualAnlagennummer} onChange={(e) => setManualAnlagennummer(e.target.value.toUpperCase())} placeholder="z.B. W2024001" autoFocus />
                    <Button onClick={handleManualSubmit} className="w-full">Weiter</Button>
                </div>
            )}
            {state === 'creating_anlage' && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{message}</p>
                    <Label htmlFor="new-anlage-name">Name für neue Anlage</Label>
                    <Input id="new-anlage-name" value={newAnlageName} onChange={(e) => setNewAnlageName(e.target.value)} placeholder="z.B. Familie Mustermann" autoFocus/>
                    <Button onClick={handleCreateAnlage} className="w-full">Anlage erstellen & Importieren</Button>
                </div>
            )}
             {state === 'success' && (
                <div className="flex items-center gap-3 text-green-600">
                    <CheckCircle className="h-6 w-6" />
                    <p>{message}</p>
                </div>
            )}
            {state === 'error' && (
                <div className="flex items-center gap-3 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                    <p>{message}</p>
                </div>
            )}
        </CardContent>
        <CardContent>
            {anlageIdToRedirect ? (
                <Button className="w-full" onClick={() => navigate(`/wartung/${anlageIdToRedirect}?view=installer`)}>
                    Zur Anlage
                </Button>
            ) : (
                <Button className="w-full" variant="outline" onClick={() => navigate('/wartung')}>
                    Zurück zur Übersicht
                </Button>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShareReceiverPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ShareReceiverContent />
        </Suspense>
    )
}
