
'use server';
/**
 * @fileOverview Extracts a structured catalog from a series of PDF page images using AI.
 *
 * - extractCatalogFromPdf - A function that handles the catalog extraction process.
 * - ExtractCatalogFromPdfInput - The input type for the extractCatalogFromPdf function.
 * - ExtractCatalogFromPdfOutput - The return type for the extractCatalogFromPdf function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ProposedCategorySchema } from '@/ai/catalog-schemas';

// Define the input schema for the AI flow
const ExtractCatalogFromPdfInputSchema = z.object({
  pageImages: z.array(z.string()).describe(
    "An array of image data URIs, where each string represents one page of a PDF document. Each URI must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type ExtractCatalogFromPdfInput = z.infer<typeof ExtractCatalogFromPdfInputSchema>;

// Define the final output schema for the entire flow
const ExtractCatalogFromPdfOutputSchema = z.object({
  catalog: z.array(ProposedCategorySchema).describe('The full, hierarchical catalog structure extracted from the PDF pages.'),
});
export type ExtractCatalogFromPdfOutput = z.infer<typeof ExtractCatalogFromPdfOutputSchema>;

// Exported wrapper function that calls the Genkit flow
export async function extractCatalogFromPdf(input: ExtractCatalogFromPdfInput): Promise<ExtractCatalogFromPdfOutput> {
  return extractCatalogFlow(input);
}

// Define the Genkit prompt for the AI
const extractPrompt = ai.definePrompt({
  name: 'extractCatalogFromPdfPrompt',
  input: { schema: ExtractCatalogFromPdfInputSchema },
  output: { schema: ExtractCatalogFromPdfOutputSchema },
  prompt: `You are an expert data entry assistant for a German tradesperson's catalog.
Your task is to analyze the provided sequence of page images from a PDF document.
These pages contain a structured catalog with categories, sub-categories, and articles.
Each article has a name, an article number, and a unit.

- Identify the hierarchical structure of categories and sub-categories.
- For each category, extract all listed articles with their name, article number, and unit of measurement.
- Preserve the order of categories and articles as they appear in the document.
- Accurately parse the data, paying close attention to formatting, tables, and lists.
- Return a complete, nested catalog structure. If no valid catalog data can be found, return an empty array.`,
});

// Define the Genkit flow
const extractCatalogFlow = ai.defineFlow(
  {
    name: 'extractCatalogFlow',
    inputSchema: ExtractCatalogFromPdfInputSchema,
    outputSchema: ExtractCatalogFromPdfOutputSchema,
  },
  async (input) => {
    const promptParts = [
      ...input.pageImages.map(imageDataUri => ({ media: { url: imageDataUri } }))
    ];

    const llmResponse = await ai.generate({
        prompt: promptParts,
        model: 'googleai/gemini-1.5-pro', // A powerful model suitable for complex document analysis
        config: {
            temperature: 0.1, // Lower temperature for more deterministic output
        },
        output: {
            schema: ExtractCatalogFromPdfOutputSchema,
        },
    });

    const output = llmResponse.output();

    // Ensure we always return a valid output structure, even if the AI fails
    return output || { catalog: [] };
  }
);
