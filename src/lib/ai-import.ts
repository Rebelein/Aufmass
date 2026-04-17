import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateUUID } from '@/lib/utils';
import { createImportDraft, updateImportDraftSuccess, updateImportDraftError } from '@/lib/import-storage';
import type { ProposedCategory } from '@/lib/types';

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

export interface AiImportCallbacks {
  onDraftCreated?: () => void;
  onSuccess?: (draftId: string) => void;
  onError?: (draftId: string, errorMessage: string) => void;
}

/**
 * Starts the AI catalog import process:
 * 1. Creates an import draft in Supabase
 * 2. Sends the file to Gemini for analysis
 * 3. Updates the draft with the extracted data or error
 *
 * Returns the draft ID if the draft was created, or null on failure.
 */
export async function startAiCatalogImport(
  file: File,
  supplierId: string | null,
  callbacks?: AiImportCallbacks
): Promise<string | null> {
  const draftId = await createImportDraft(file.name, supplierId);
  if (!draftId) return null;

  callbacks?.onDraftCreated?.();

  // Background processing – non-blocking
  (async () => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('Gemini API Key fehlt.');
      }

      const base64Data = await readFileAsBase64(file);
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

      const prompt = `Extrahiere Materialdaten aus dieser Katalogseite. Erfasse verschiedene Produktgruppen jeweils als eine eigene Kategorie. Rückgabe als JSON-Array von Objekten: [ { "categoryName": "Name der Gruppe/Kategorie", "articles": [ { "name": "...", "articleNumber": "...", "unit": "..." } ] } ]. Erzeuge KEINE verschachtelten Unterkategorien.`;

      const result = await model.generateContent([
        { inlineData: { data: base64Data, mimeType: file.type } },
        { text: prompt },
      ]);
      const text = (await result.response).text();
      const jsonStr = text.trim().replace(/```json|```/g, '').trim();
      const rawData = JSON.parse(jsonStr);

      const parsedData: ProposedCategory[] = (Array.isArray(rawData) ? rawData : [rawData]).map(
        (cat: any) => ({
          ...cat,
          subCategories: [],
          articles: cat.articles.map((art: any) => ({
            ...art,
            id: art.id || generateUUID(),
          })),
        })
      );

      await updateImportDraftSuccess(draftId, parsedData);
      callbacks?.onSuccess?.(draftId);
    } catch (error: any) {
      await updateImportDraftError(draftId, error.message);
      callbacks?.onError?.(draftId, error.message);
    }
  })();

  return draftId;
}
