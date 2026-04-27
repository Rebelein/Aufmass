import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateUUID } from '@/lib/utils';
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
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  let prompt = '';
  if (options?.mode === 'extend' && options.existingArticles && options.existingArticles.length > 0) {
    const articlesJson = JSON.stringify(options.existingArticles.map(a => ({ id: a.id, name: a.name, unit: a.unit, articleNumber: a.articleNumber })));
    prompt = `Du analysierst eine Katalogseite eines Großhändlers. Wir haben bereits bestehende Artikel in unserem System und wollen deren Artikelnummern für diesen Großhändler ergänzen.
Hier sind unsere bestehenden Artikel:
${articlesJson}

Finde diese Artikel auf der Katalogseite. Beachte, dass die Bezeichnungen abweichen können (z.B. "Doppelnippel" statt "Langnippel" oder ähnliche fachliche Synonyme/Abkürzungen).
Ordne die gefundenen Artikel anhand ihrer Dimensionen/Namen den bestehenden 'id's zu. 
Rückgabe MUSS exakt dieses JSON-Format sein: 
[ { "categoryName": "Zugeordnete Artikel", "articles": [ { "name": "Gefundener Name auf Seite", "articleNumber": "Gefundene Art.-Nr.", "unit": "Gefundene Einheit", "matchedArticleId": "id-des-bestehenden-artikels" } ] } ]
Lass Artikel weg, die du keinem bestehenden Artikel zuordnen kannst.`;
  } else {
    prompt = `Extrahiere Materialdaten aus dieser Katalogseite. Erfasse verschiedene Produktgruppen jeweils als eine eigene Kategorie. Rückgabe als JSON-Array von Objekten: [ { "categoryName": "Name der Gruppe/Kategorie", "articles": [ { "name": "...", "articleNumber": "...", "unit": "..." } ] } ]. Erzeuge KEINE verschachtelten Unterkategorien.`;
  }

  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    { text: prompt },
  ]);

  const response = result.response;
  const text = response.text();
  console.log('[KI-Import] Gemini-Antwort erhalten:', text.substring(0, 200) + '…');

  const jsonStr = text.trim().replace(/```json|```/g, '').trim();
  const rawData = JSON.parse(jsonStr);

  const parsedData: ProposedCategory[] = (Array.isArray(rawData) ? rawData : [rawData]).map(
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
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
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
