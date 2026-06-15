import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateUUID, compareArticleNames } from '@/lib/utils';
import { createImportDraft, updateImportDraftSuccess, updateImportDraftError } from '@/lib/import-storage';
import type { ProposedCategory } from '@/lib/types';
import type { Article } from '@/lib/data';

/**
 * Reads a file as base64 data URI and returns only the base64 portion.
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a Blob as base64 (data portion only).
 */
function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface AiImportCallbacks {
  onDraftCreated?: () => void;
  onSuccess?: (draftId: string) => void;
  onError?: (draftId: string, errorMessage: string) => void;
}

export interface AiImportOptions {
  mode?: 'import' | 'extend';
  existingArticles?: Article[];
}

/**
 * Core function: sends base64 image data to Gemini and parses the result.
 */
async function runGeminiExtraction(base64Data: string, mimeType: string, options?: AiImportOptions): Promise<ProposedCategory[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API Key fehlt.');
  }

  console.log('[KI-Import] Starte Gemini-Anfrage…', { mimeType, dataLength: base64Data.length, mode: options?.mode });

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  let prompt = '';
  if (options?.mode === 'extend' && options.existingArticles && options.existingArticles.length > 0) {
    const articlesJson = JSON.stringify(options.existingArticles.map(a => ({ id: a.id, name: a.name, unit: a.unit, articleNumber: a.articleNumber })));
    prompt = `Du bist ein Assistent zur Datenanreicherung für Sanitär-, Heizungs- und Materialkataloge.
Deine Aufgabe ist es, bestehende Artikel aus unserem System in der Katalogseite des Großhändlers wiederzufinden und deren Artikelnummer für diesen Großhändler zu extrahieren.

Hier sind unsere bereits im System angelegten Artikel als JSON-Array:
${articlesJson}

Richtlinien für den Abgleich und die Extraktion:
1. **Fuzzy-Matching & Synonyme**:
   - Die Bezeichnungen auf der Katalogseite können von unseren Systemnamen abweichen.
   - Gleiche Bezeichnungen fachlich ab. Nutze branchenspezifische Synonyme und Abkürzungen (z. B. "Doppelnippel" statt "Langnippel", "Bogen" statt "Winkel", "Muffe", "Reduzierung" etc.).
   - Achte extrem präzise auf die Dimensionen (z. B. "1/2\"", "15mm", "dn20", "16 x 2.0"). Ein Abgleich ist nur dann korrekt, wenn auch die Dimension exakt übereinstimmt!
2. **Keine neuen Artikel**:
   - Erfasse ausschließlich Artikel, die du eindeutig einem unserer bestehenden Artikel zuordnen kannst.
   - Füge keine Artikel hinzu, die nicht in der obigen Liste vorhanden sind.
3. **Rückgabeformat**:
   Gib ein JSON-Array zurück, in dem alle zugeordneten Artikel unter einer einzigen Kategorie "Zugeordnete Artikel" zusammengefasst sind. Die Artikel müssen über das Feld "matchedArticleId" mit der 'id' des bestehenden Artikels verknüpft werden.
   
   TypeScript-Typ:
   \`\`\`typescript
   type Output = Array<{
     categoryName: "Zugeordnete Artikel";
     articles: Array<{
       name: string; // Name des gefundenen Artikels auf der Seite
       articleNumber: string; // Die auf der Seite gefundene Artikelnummer für diesen Großhändler
       unit: string; // Die auf der Seite gefundene Einheit
       matchedArticleId: string; // Die 'id' des bestehenden Artikels aus unserem System
     }>;
   }>;
   \`\`\`
   Da die Ausgabe direkt als JSON erzwungen wird, antworte AUSSCHLIESSLICH mit diesem validen JSON-Array. Gib keinen zusätzlichen Text, Präambeln oder Erklärungen aus.`;
  } else {
    prompt = `Du bist ein hochpräziser Assistent für die Beleg- und Katalogextraktion im Sanitär-, Heizungs- und Baubereich.
Deine Aufgabe ist es, Produkt- und Materialdaten von dieser Katalogseite des Großhändlers zu extrahieren.

Hier sind die strengen Richtlinien für die Extraktion:
1. **Produktgruppen & Kategorien**: 
   - Erfasse zusammengehörige Produktfamilien oder Gruppen als jeweils eigene Kategorie mit einem aussagekräftigen "categoryName" (z. B. "Geberit Mepla Rohr", "Kupfer Press-T-Stück").
   - Erzeuge KEINE verschachtelten Unterkategorien. Jedes Element im Root-Array repräsentiert eine flache Kategorie.

2. **Vollständige Produktnamen (Namensverkettung)**:
   - In Tabellen oder Katalogen ist der Hauptproduktname (die Produktfamilie) oft nur einmal im Kopfbereich oder Titel genannt (z. B. "Sanpress Bogen 90°"). In den einzelnen Tabellenzeilen stehen dann nur Dimensionen (z. B. "d=15", "d=18", "d=22") und die Artikelnummern.
   - **WICHTIG**: Du MUSST den Hauptnamen/Familiennamen immer mit der spezifischen Dimension oder Ausführung verketten, um einen vollständigen, aussagekräftigen Namen zu bilden (z. B. "Sanpress Bogen 90° d=15" oder "Geberit Mepla T-Stück 16x20x16"). Ein einzelner Artikelname darf NIEMALS nur aus einer reinen Dimension oder einer Artikelnummer bestehen!

3. **Präzise Artikelnummern**:
   - Extrahiere die exakte Bestellnummer oder Artikelnummer des Großhändlers.
   - Verwechsle diese nicht mit EAN-Codes, Preisen, Verpackungsgrößen (VPE) oder Seitenzahlen. Falls keine Artikelnummer für das Produkt existiert, setze sie auf einen leeren String ("").

4. **Einheiten-Normalisierung**:
   - Lies die Einheit (Unit) aus und normalisiere sie auf genau einen der folgenden Werte in deutscher Abkürzung:
     - "Stk" (für Stück, St., Stk., Pcs)
     - "m" (für Meter, m., Mtr.)
     - "Set" (für Sets, Sätze, Garnituren)
     - "Rolle" (für Rollen, Rol.)
     - "Karton" (für Kartons, Krt., Crt.)
     - "Pkg" (für Packungen, Pkg., VPE, Pkt.)
     - "Paar" (für Paare, Pr.)
   - Falls die Einheit unklar oder nicht angegeben ist, verwende standardmäßig "Stk".

5. **JSON-Format**:
   Gib ein JSON-Array zurück, das exakt diesem TypeScript-Typ entspricht:
   \`\`\`typescript
   type Output = Array<{
     categoryName: string;
     articles: Array<{
       name: string; // Vollständiger, verketteter Name
       articleNumber: string; // Saubere Artikelnummer
       unit: "Stk" | "m" | "Set" | "Rolle" | "Karton" | "Pkg" | "Paar";
     }>;
   }>;
   \`\`\`
   Da die Ausgabe direkt als JSON erzwungen wird, antworte AUSSCHLIESSLICH mit diesem validen JSON-Array. Gib keinen zusätzlichen Text, Präambeln oder Erklärungen aus.`;
  }

  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    { text: prompt },
  ]);

  const response = result.response;
  const text = response.text();
  console.log('[KI-Import] Gemini-Antwort erhalten:', text.substring(0, 200) + '…');

  const jsonStr = text.trim().replace(/```json|```/g, '').trim();
  let rawData = JSON.parse(jsonStr);

  // Robustheit: Falls das Modell ein Objekt mit einer Liste zurückgibt statt eines Arrays
  if (rawData && !Array.isArray(rawData)) {
    if (Array.isArray(rawData.categories)) {
      rawData = rawData.categories;
    } else if (Array.isArray(rawData.data)) {
      rawData = rawData.data;
    } else if (Array.isArray(rawData.articles)) {
      // Falls nur ein flaches Artikel-Array zurückgegeben wurde
      rawData = [{ categoryName: 'Extrahierte Artikel', articles: rawData.articles }];
    } else if (rawData.categoryName && Array.isArray(rawData.articles)) {
      // Falls ein einzelnes Kategorie-Objekt zurückgegeben wurde
      rawData = [rawData];
    } else {
      rawData = [];
    }
  }

  const parsedData: ProposedCategory[] = rawData.map(
    (cat: any) => ({
      ...cat,
      id: generateUUID(),
      subCategories: [],
      articles: (cat.articles || [])
        .map((art: any) => ({
          ...art,
          id: generateUUID(),
        }))
        .sort((a: any, b: any) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return compareArticleNames(nameA, nameB);
        }),
    })
  );

  console.log('[KI-Import] Erfolgreich geparst:', parsedData.length, 'Kategorien');
  return parsedData;
}

/**
 * Starts the AI catalog import process from a File (PDF or image).
 */
export async function startAiCatalogImport(
  file: File,
  supplierId: string | null,
  targetCategoryId: string | null,
  callbacks?: AiImportCallbacks,
  options?: AiImportOptions
): Promise<string | null> {
  const draftId = await createImportDraft(file.name, supplierId, targetCategoryId, options);
  if (!draftId) return null;

  callbacks?.onDraftCreated?.();

  // Background processing – non-blocking
  (async () => {
    try {
      const base64Data = await readFileAsBase64(file);
      const parsedData = await runGeminiExtraction(base64Data, file.type || 'image/png', options);

      await updateImportDraftSuccess(draftId, parsedData);
      callbacks?.onSuccess?.(draftId);
    } catch (error: any) {
      console.error('[KI-Import] Fehler:', error);
      await updateImportDraftError(draftId, error.message);
      callbacks?.onError?.(draftId, error.message);
    }
  })();

  return draftId;
}

/**
 * Starts the AI catalog import from a Blob (e.g. clipboard image).
 */
export async function startAiCatalogImportFromBlob(
  blob: Blob,
  supplierId: string | null,
  targetCategoryId: string | null,
  callbacks?: AiImportCallbacks,
  options?: AiImportOptions
): Promise<string | null> {
  const draftId = await createImportDraft('Zwischenablage_' + new Date().toLocaleTimeString('de-DE').replace(/:/g, ''), supplierId, targetCategoryId, options);
  if (!draftId) return null;

  callbacks?.onDraftCreated?.();

  // Background processing – non-blocking
  (async () => {
    try {
      const base64Data = await readBlobAsBase64(blob);
      const parsedData = await runGeminiExtraction(base64Data, blob.type || 'image/png', options);

      await updateImportDraftSuccess(draftId, parsedData);
      callbacks?.onSuccess?.(draftId);
    } catch (error: any) {
      console.error('[KI-Import] Fehler:', error);
      await updateImportDraftError(draftId, error.message);
      callbacks?.onError?.(draftId, error.message);
    }
  })();

  return draftId;
}
