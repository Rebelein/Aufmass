import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getInheritedCategoryImageUrl(categoryId: string | null | undefined, categories: any[]): string | undefined {
  if (!categoryId || !categories || categories.length === 0) return undefined;
  
  let currentId: string | null | undefined = categoryId;
  const visited = new Set<string>(); // Prevent infinite loops
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const cat = categories.find(c => c.id === currentId);
    if (!cat) break;
    if (cat.imageUrl) return cat.imageUrl;
    currentId = cat.parentId;
  }
  
  return undefined;
}

export function normalizeArticleNameForSort(name: string | null | undefined): string {
  if (!name) return "";
  
  let normalized = name.replace(/\s+/g, " ").trim();
  
  // Replace fractions first e.g. "1 1/4"" or "3/4""
  normalized = normalized.replace(/(?:(\d+)\s+)?(\d+)\/(\d+)\s*("|zoll|inch)/gi, (match, whole, num, den, unit) => {
    const w = whole ? parseInt(whole, 10) : 0;
    const n = parseInt(num, 10);
    const d = parseInt(den, 10);
    if (d === 0) return match;
    const decimal = w + (n / d);
    const paddedDecimal = decimal.toFixed(3).padStart(8, "0");
    return ` __INCH_${paddedDecimal}_${unit}`;
  });
  
  // Then replace whole inches e.g. "1"" or "2""
  normalized = normalized.replace(/(\d+)\s*("|zoll|inch)/gi, (match, whole, unit) => {
    const w = parseInt(whole, 10);
    const paddedDecimal = w.toFixed(3).padStart(8, "0");
    return ` __INCH_${paddedDecimal}_${unit}`;
  });

  return normalized.replace(/\s+/g, " ").trim();
}

export function compareArticleNames(nameA: string | null | undefined, nameB: string | null | undefined): number {
  const normA = normalizeArticleNameForSort(nameA);
  const normB = normalizeArticleNameForSort(nameB);
  return normA.localeCompare(normB, undefined, { numeric: true, sensitivity: 'base' });
}

