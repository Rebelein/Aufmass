
"use client";

import React, { useState, useEffect } from 'react';
import type { Supplier } from '@/lib/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

interface SupplierManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onAddSupplier: (name: string) => Promise<void>;
  onUpdateSupplier: (id: string, name: string) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
}

const SupplierManagementDialog: React.FC<SupplierManagementDialogProps> = ({
  isOpen,
  onClose,
  suppliers,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) => {
  const [newSupplierName, setNewSupplierName] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog is closed
      setNewSupplierName('');
      setEditingSupplier(null);
      setSupplierToDelete(null);
    }
  }, [isOpen]);

  const handleFormSubmit = async () => {
    if (newSupplierName.trim() === '') return;

    if (editingSupplier) {
      await onUpdateSupplier(editingSupplier.id, newSupplierName.trim());
      toast({ title: "Großhändler aktualisiert" });
    } else {
      await onAddSupplier(newSupplierName.trim());
      toast({ title: "Großhändler hinzugefügt" });
    }
    setNewSupplierName('');
    setEditingSupplier(null);
  };

  const handleStartEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplierName(supplier.name);
  };

  const handleCancelEdit = () => {
    setEditingSupplier(null);
    setNewSupplierName('');
  };
  
  const confirmDelete = async () => {
      if(supplierToDelete) {
          await onDeleteSupplier(supplierToDelete.id);
          toast({ title: "Großhändler gelöscht", description: `Der Großhändler "${supplierToDelete.name}" wurde gelöscht.`});
          setSupplierToDelete(null);
      }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline">Großhändler Verwalten</DialogTitle>
            <DialogDescription className="font-body">
              Fügen Sie die Großhändler hinzu, von denen Sie Artikel beziehen, oder bearbeiten Sie bestehende.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 p-4 border rounded-md bg-muted/20">
              <Input
                type="text"
                placeholder="Name des Großhändlers"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFormSubmit()}
                className="flex-grow font-body"
              />
              {editingSupplier ? (
                <div className="flex gap-2">
                  <Button onClick={handleFormSubmit} className="bg-accent text-accent-foreground hover:bg-accent/90 font-body">Aktualisieren</Button>
                  <Button variant="outline" onClick={handleCancelEdit} className="font-body">Abbrechen</Button>
                </div>
              ) : (
                <Button onClick={handleFormSubmit} className="font-body">
                  <PlusCircle className="mr-2 h-4 w-4" /> Hinzufügen
                </Button>
              )}
            </div>

            <ul className="space-y-2 pt-4 max-h-[50vh] overflow-y-auto">
              {suppliers.map(supplier => (
                <li key={supplier.id} className="flex justify-between items-center p-2 rounded-md bg-muted/50 hover:bg-muted">
                  <span className="font-body">{supplier.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleStartEdit(supplier)} aria-label="Großhändler bearbeiten">
                      <Edit3 className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSupplierToDelete(supplier)} aria-label="Großhändler löschen">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
              {suppliers.length === 0 && (
                <p className="text-center text-muted-foreground font-body py-4">Keine Großhändler vorhanden.</p>
              )}
            </ul>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} className="font-body">
                Schließen
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!supplierToDelete} onOpenChange={(open) => { if (!open) setSupplierToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Großhändler "{supplierToDelete?.name}" wirklich unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSupplierToDelete(null)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SupplierManagementDialog;
