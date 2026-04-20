import { supabase } from './supabase';

export interface ImportDraft {
  id: string;
  status: 'processing' | 'ready_for_review' | 'completed' | 'failed';
  file_name: string | null;
  extracted_data: any;
  error_message: string | null;
  default_supplier_id: string | null;
  default_target_category_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function createImportDraft(fileName: string, supplierId?: string | null, targetCategoryId?: string | null): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('import_drafts')
      .insert({ 
        file_name: fileName, 
        status: 'processing',
        default_supplier_id: supplierId === 'none' ? null : supplierId,
        default_target_category_id: targetCategoryId === 'root' ? null : (targetCategoryId || null)
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating import draft:', error);
    return null;
  }
}

export async function updateImportDraftData(id: string, extractedData: any, supplierId?: string | null, targetCategoryId?: string | null): Promise<boolean> {
  try {
    const updateData: any = { extracted_data: extractedData };
    if (supplierId !== undefined) {
      updateData.default_supplier_id = supplierId === 'none' ? null : supplierId;
    }
    if (targetCategoryId !== undefined) {
      updateData.default_target_category_id = targetCategoryId === 'root' ? null : (targetCategoryId || null);
    }

    const { error } = await supabase
      .from('import_drafts')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating import draft data:', error);
    return false;
  }
}

export async function updateImportDraftSuccess(id: string, extractedData: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('import_drafts')
      .update({ status: 'ready_for_review', extracted_data: extractedData })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating import draft to success:', error);
    return false;
  }
}

export async function updateImportDraftError(id: string, errorMessage: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('import_drafts')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating import draft to failed:', error);
    return false;
  }
}

export async function getImportDrafts(): Promise<ImportDraft[]> {
  try {
    const { data, error } = await supabase
      .from('import_drafts')
      .select('*')
      .neq('status', 'completed') // Optional: nur offene anzeigen
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ImportDraft[];
  } catch (error) {
    console.error('Error getting import drafts:', error);
    return [];
  }
}

export async function markImportDraftCompleted(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('import_drafts')
      .update({ status: 'completed' })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking import draft completed:', error);
    return false;
  }
}

export async function deleteImportDraft(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('import_drafts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting import draft:', error);
    return false;
  }
}
