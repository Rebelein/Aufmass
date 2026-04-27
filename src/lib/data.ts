
export interface Supplier {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  order?: number; // Reihenfolge innerhalb der Ebene
  imageUrl?: string;
  source?: 'own' | 'wholesale';
}

export interface Article {
  id: string;
  name: string;
  // price: number; // Removed price
  categoryId: string;
  categoryName?: string; // Optional: denormalized for convenience
  unit: string; // Einheit z.B. Stück, Meter, kg
  articleNumber: string; // Artikelnummer (fallback or primary)
  supplierArticleNumbers?: Record<string, string>; // Maps supplierId to articleNumber
  order?: number; // Order within the category
  imageUrl?: string;
  supplierName?: string;
  aliases?: string[];
  source?: 'own' | 'wholesale';
}

export interface TypePlate {
  manufacturer_name: string | null;
  manufacturer_address: string | null;
  machine_designation: string | null;
  model_type: string | null;
  serial_number: string | null;
  year_of_construction: number | null;
  ce_marking_present: boolean | null;
  rated_power_kw: number | null;
  voltage_v: string | null;
  frequency_hz: number | null;
  current_a: number | null;
  speed_rpm: number | null;
  protection_class_ip: string | null;
  mass_kg: number | null;
  other_data: Record<string, any> | null;
}

export interface Komponente {
  id: string;
  anlageId: string;
  name: string; // This could be the machine_designation or model_type
  typePlateData: TypePlate;
  imageUrl?: string; // The URL of the nameplate image
}

