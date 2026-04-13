
'use server';
/**
 * @fileOverview Extracts a list of articles from an image using AI.
 *
 * - extractArticlesFromImage - A function that handles the article extraction process.
 * - ExtractArticlesFromImageInput - The input type for the extractArticlesFromImage function.
 * - ExtractArticlesFromImageOutput - The return type for the extractArticlesFromImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the input schema for the AI flow
const ExtractArticlesFromImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a document or a list of articles, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  categoryContext: z.string().describe('The name of the catalog category this image belongs to, providing context for the types of articles to expect.'),
});
export type ExtractArticlesFromImageInput = z.infer<typeof ExtractArticlesFromImageInputSchema>;

// Define the output schema for a single article
const ArticleSchema = z.object({
  name: z.string().describe('The full name or description of the article.'),
  articleNumber: z.string().describe('The unique article number or identifier.'),
  unit: z.string().describe('The unit of measurement for the article (e.g., "Stück", "m", "kg", "m²").'),
});

// Define the final output schema for the entire flow
const ExtractArticlesFromImageOutputSchema = z.object({
  articles: z.array(ArticleSchema).describe('An array of all articles extracted from the image.'),
});
export type ExtractArticlesFromImageOutput = z.infer<typeof ExtractArticlesFromImageOutputSchema>;

// Exported wrapper function that calls the Genkit flow
export async function extractArticlesFromImage(input: ExtractArticlesFromImageInput): Promise<ExtractArticlesFromImageOutput> {
  return extractArticlesFlow(input);
}

// Define the Genkit prompt for the AI
const extractPrompt = ai.definePrompt({
  name: 'extractArticlesPrompt',
  input: { schema: ExtractArticlesFromImageInputSchema },
  output: { schema: ExtractArticlesFromImageOutputSchema },
  prompt: `You are an expert data entry assistant for a German tradesperson's catalog.
Your task is to analyze the provided image, which could be a photo of a document, a computer screen, or a physical catalog page.
The image contains a list of articles for the category "{{categoryContext}}".
Extract all articles from the image. Each article must have a name, an article number, and a unit.
Pay close attention to the structure and labels to correctly identify each piece of information.
Return the data as a structured list of articles. If no articles can be found, return an empty array.`,
});

// Define the Genkit flow
const extractArticlesFlow = ai.defineFlow(
  {
    name: 'extractArticlesFlow',
    inputSchema: ExtractArticlesFromImageInputSchema,
    outputSchema: ExtractArticlesFromImageOutputSchema,
  },
  async (input) => {
    // Call the prompt with the input data
    const { output } = await extractPrompt({
      imageDataUri: input.imageDataUri,
      categoryContext: input.categoryContext,
    });

    // Ensure we always return a valid output structure, even if the AI fails
    return output || { articles: [] };
  }
);
