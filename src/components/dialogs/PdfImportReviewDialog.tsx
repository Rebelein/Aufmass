
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2 } from 'lucide-react';
import type { ProposedCategory, ProposedArticle } from '@/ai/catalog-schemas';

// The data from the AI flow doesn't have temporary IDs, so we add them for UI state management.
interface ReviewArticle extends ProposedArticle {
  id: string; // Temporary unique ID for React key prop
}
interface ReviewCategory extends ProposedCategory {
  id: string; // Temporary unique ID for React key prop
  articles: ReviewArticle[];
  subCategories: ReviewCategory[];
}

interface PdfImportReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: ProposedCategory[];
  onConfirmImport: (reviewedCatalog: ProposedCategory[]) => void;
}

// Recursively adds temporary unique IDs to the catalog data for stable UI rendering and state updates.
const addTemporaryIds = (data: ProposedCategory[]): ReviewCategory[] => {
  if (!data) return [];
  return data
    .filter(cat => !!cat) // Filter out any null/undefined categories from AI
    .map((cat, catIndex) => ({
      ...cat,
      id: `cat-${Date.now()}-${catIndex}-${Math.random()}`,
      articles: (cat.articles || [])
        .filter(art => !!art) // Filter out any null/undefined articles
        .map((art, artIndex) => ({
          ...art,
          id: `art-${Date.now()}-${catIndex}-${artIndex}-${Math.random()}`,
        })),
      subCategories: addTemporaryIds(cat.subCategories || []),
    }));
};

// Recursively removes the temporary IDs before sending the data back for import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const removeTemporaryIds = (data: any[]): any[] => {
    if (!data) return [];
    return data.map(item => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = item;
        if (rest.subCategories) {
            rest.subCategories = removeTemporaryIds(rest.subCategories);
        }
        if (rest.articles) {
            rest.articles = removeTemporaryIds(rest.articles);
        }
        return rest;
    });
};


const PdfImportReviewDialog: React.FC<PdfImportReviewDialogProps> = ({ isOpen, onClose, initialData, onConfirmImport }) => {
  const [catalog, setCatalog] = useState<ReviewCategory[]>([]);

  useEffect(() => {
    if (isOpen && initialData) {
      setCatalog(addTemporaryIds(initialData));
    }
  }, [isOpen, initialData]);

  const handleUpdate = (path: (string | number)[], field: string, value: string) => {
    setCatalog(currentCatalog => {
      const newCatalog = JSON.parse(JSON.stringify(currentCatalog));
      
      let itemToUpdate: any = newCatalog;
      for (const key of path) {
        if (itemToUpdate === undefined) {
           console.error("Invalid path for update:", path);
           return currentCatalog; // Abort update if path is invalid
        }
        itemToUpdate = itemToUpdate[key];
      }
      
      if (itemToUpdate) {
        itemToUpdate[field] = value;
      } else {
        console.error("Could not find item to update at path:", path);
      }
      
      return newCatalog;
    });
  };
  
  const handleDelete = (pathToArray: (string | number)[], indexToDelete: number) => {
    setCatalog(currentCatalog => {
        const newCatalog = JSON.parse(JSON.stringify(currentCatalog));
        
        let arrayToModify: any = newCatalog;
        // If path is empty, we are deleting from the root catalog array
        if (pathToArray.length > 0) {
            for (const key of pathToArray) {
                if (arrayToModify === undefined) {
                    console.error("Invalid path for delete:", pathToArray);
                    return currentCatalog;
                }
                arrayToModify = arrayToModify[key];
            }
        }

        if (Array.isArray(arrayToModify)) {
            arrayToModify.splice(indexToDelete, 1);
        } else {
            console.error("Target for deletion is not an array at path:", pathToArray);
        }

        return newCatalog;
    });
  };

  const handleConfirm = () => {
    onConfirmImport(removeTemporaryIds(catalog));
  };

  const renderCategory = (category: ReviewCategory, path: (string|number)[]): JSX.Element => (
    <div 
        key={category.id} 
        className="ml-4 pl-4 border-l border-dashed"
        style={{ marginLeft: `${path.length > 1 ? 1 : 0}rem`}}
    >
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
        <Label htmlFor={`cat-name-${category.id}`} className="font-semibold flex-shrink-0">Kategorie:</Label>
        <Input 
          id={`cat-name-${category.id}`} 
          value={category.categoryName} 
          onChange={(e) => handleUpdate(path, 'categoryName', e.target.value)} 
          className="h-8 font-semibold"
        />
         <Button variant="ghost" size="icon" onClick={() => handleDelete(path.slice(0, -1), path[path.length - 1] as number)} aria-label="Kategorie entfernen">
            <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <ul className="mt-2 space-y-2">
        {(category.articles || []).map((article, index) => (
          <li key={article.id} className="p-2 border rounded-md bg-background flex items-start gap-2 group">
            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                    <Label htmlFor={`art-name-${article.id}`} className="text-xs font-body">Name</Label>
                    <Input id={`art-name-${article.id}`} value={article.name || ''} onChange={(e) => handleUpdate([...path, 'articles', index], 'name', e.target.value)} className="h-8 font-body"/>
                </div>
                <div>
                    <Label htmlFor={`art-number-${article.id}`} className="text-xs font-body">Artikel-Nr.</Label>
                    <Input id={`art-number-${article.id}`} value={article.articleNumber || ''} onChange={(e) => handleUpdate([...path, 'articles', index], 'articleNumber', e.target.value)} className="h-8 font-body"/>
                </div>
                <div>
                    <Label htmlFor={`art-unit-${article.id}`} className="text-xs font-body">Einheit</Label>
                    <Input id={`art-unit-${article.id}`} value={article.unit || ''} onChange={(e) => handleUpdate([...path, 'articles', index], 'unit', e.target.value)} className="h-8 font-body"/>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete([...path, 'articles'], index)} className="mt-1 flex-shrink-0" aria-label="Artikel entfernen">
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
      {(category.subCategories || []).map((subCat, index) => renderCategory(subCat, [...path, 'subCategories', index]))}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Import überprüfen</DialogTitle>
          <DialogDescription className="font-body">
            Die KI hat diese Katalogstruktur extrahiert. Überprüfen und bearbeiten Sie die Daten, bevor Sie sie importieren.
          </DialogDescription>
        </DialogHeader>
        
        {catalog.length > 0 ? (
          <ScrollArea className="h-[60vh] mt-4 border rounded-md p-4">
            <div className="space-y-4">
              {catalog.map((cat, index) => renderCategory(cat, [index]))}
            </div>
          </ScrollArea>
        ) : (
          <p className="font-body text-muted-foreground mt-4 text-center">Keine Daten zum Überprüfen vorhanden.</p>
        )}

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" className="font-body" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" className="font-body bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleConfirm} disabled={catalog.length === 0}>
            Katalog Importieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PdfImportReviewDialog;
