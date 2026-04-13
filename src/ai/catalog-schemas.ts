/**
 * @fileOverview Defines the shared Zod schemas for catalog data used across different AI flows.
 * This ensures consistency when proposing new categories or articles from various sources.
 */

import { z } from 'zod';

// Schema for a single proposed article
export const ProposedArticleSchema = z.object({
  name: z.string().describe('The full name or title of the article.'),
  articleNumber: z.string().describe('The unique article number or identifier.'),
  unit: z.string().describe('The unit of measurement for the article (e.g., "Stück", "m", "kg").'),
  supplierName: z.string().optional().describe('The name of the supplier or wholesaler for this article.'),
});
export type ProposedArticle = z.infer<typeof ProposedArticleSchema>;

// Recursive schema for a category, which can contain articles and other sub-categories
export const ProposedCategorySchema: z.ZodType<ProposedCategory> = z.object({
  categoryName: z.string().describe('The name of the category.'),
  articles: z.array(ProposedArticleSchema).describe('A list of articles directly within this category.'),
  subCategories: z.lazy(() => z.array(ProposedCategorySchema)).describe('A list of sub-categories nested under this category.'),
});
export type ProposedCategory = {
  categoryName: string;
  articles: ProposedArticle[];
  subCategories: ProposedCategory[];
};
