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
