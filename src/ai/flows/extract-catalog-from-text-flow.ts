
'use server';
/**
 * @fileOverview Extracts a structured catalog from unstructured text content using AI.
 *
 * - extractCatalogFromText - A function that handles the catalog extraction process.
 * - ExtractCatalogFromTextInput - The input type for the extractCatalogFromText function.
 * - ExtractCatalogFromTextOutput - The return type for the extractCatalogFromText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ProposedCategorySchema } from '@/ai/catalog-schemas';

// Define the input schema for the AI flow
const ExtractCatalogFromTextInputSchema = z.object({
  fileContent: z.string().describe('The unstructured text content from a file, which could be a CSV, TXT, or any other plain text format.'),
});
export type ExtractCatalogFromTextInput = z.infer<typeof ExtractCatalogFromTextInputSchema>;

// Define the final output schema for the entire flow
const ExtractCatalogFromTextOutputSchema = z.object({
  catalog: z.array(ProposedCategorySchema).describe('The full, hierarchical catalog structure extracted from the text content.'),
});
export type ExtractCatalogFromTextOutput = z.infer<typeof ExtractCatalogFromTextOutputSchema>;

// Exported wrapper function that calls the Genkit flow
export async function extractCatalogFromText(input: ExtractCatalogFromTextInput): Promise<ExtractCatalogFromTextOutput> {
  return extractCatalogFlow(input);
}

// Define the Genkit prompt for the AI
const extractPrompt = ai.definePrompt({
  name: 'extractCatalogFromTextPrompt',
  input: { schema: ExtractCatalogFromTextInputSchema },
  output: { schema: ExtractCatalogFromTextOutputSchema },
  prompt: `You are an expert data entry assistant for a German tradesperson's catalog.
Your task is to analyze the provided text content and structure it into a catalog.
The text can be in various formats, such as a simple list, a CSV-like structure, or copied text from another program.
Identify the hierarchical structure of categories and sub-categories.
For each category, extract all listed articles with their name, article number, and unit of measurement.
Some articles might have a supplier name associated with them.
Preserve the order of categories and articles as they appear in the document.
Accurately parse the data, paying close attention to formatting, tables, lists, and separators like semicolons or tabs.
Return a complete, nested catalog structure. If no valid catalog data can be found, return an empty array.

Here is the text content to analyze:
---
{{fileContent}}
---`,
});

// Define the Genkit flow
const extractCatalogFlow = ai.defineFlow(
  {
    name: 'extractCatalogFromTextFlow',
    inputSchema: ExtractCatalogFromTextInputSchema,
    outputSchema: ExtractCatalogFromTextOutputSchema,
  },
  async (input) => {
    // Call the prompt with the input data
    const { output } = await extractPrompt(input);

    // Ensure we always return a valid output structure, even if the AI fails
    return output || { catalog: [] };
  }
);
