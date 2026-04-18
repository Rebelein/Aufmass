import jsPDF from 'jspdf';
import type { ProcessedSummaryItem } from '@/lib/types';
import type { ProjectSelectedItem } from '@/lib/project-storage';

interface PdfExportOptions {
  projectName: string;
  sectionItems: ProjectSelectedItem[];
  articleItems: ProcessedSummaryItem[];
}

interface GroupedItem {
  artNum: string;
  name: string;
  unit: string;
  qty: number;
}

export function generateAufmassPdf({ projectName, sectionItems, articleItems }: PdfExportOptions): void {
  const doc = new jsPDF();
  let y = 0;
  let pageNumber = 1;
  const brandColor: [number, number, number] = [41, 182, 133];
  const pageHeight = 297;
  const marginX = 20;

  // --- Helpers ---
  const addPageLayout = () => {
    // Header Banner
    doc.setFillColor(...brandColor);
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MATERIAL-LISTE', marginX, 22);

    // Subtle Brand Text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('AUFMAß DOKUMENTATION', 190, 22, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generiert: ${new Date().toLocaleDateString('de-DE')}`, marginX, 285);
    doc.text(`Seite ${pageNumber}`, 190, 285, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 25) {
      doc.addPage();
      pageNumber++;
      addPageLayout();
      y = 50;
      return true;
    }
    return false;
  };

  // --- Initial Page ---
  addPageLayout();
  y = 55;

  // Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y, 170, 35, 3, 3, 'FD');
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Projektname', marginX + 10, y + 15);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(projectName, marginX + 10, y + 23);
  y += 50;


  // --- 1. GESAMTÜBERSICHT NACH LIEFERANT ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Bestellliste nach Großhändler', marginX, y);
  y += 12;

  // Group items by supplier
  const supplierGroups = new Map<string, GroupedItem[]>();

  articleItems.forEach(i => {
    let rawSupplier = i.article?.supplierName || (i as any).supplier_name;
    if (!rawSupplier || !rawSupplier.trim()) {
      rawSupplier = 'Ohne Zuweisung / Sonstiges';
    }
    const supplier = rawSupplier.trim();
    
    if (!supplierGroups.has(supplier)) supplierGroups.set(supplier, []);
    const group = supplierGroups.get(supplier)!;
    
    const artNum = i.article?.articleNumber ?? (i as any).article_number ?? '';
    const name = i.article?.name ?? (i as any).name ?? 'Manuelle Position';
    const unit = i.article?.unit ?? (i as any).unit ?? '';
    const qty = i.quantity ?? 0;
    
    const existingIdx = group.findIndex(t => t.artNum === artNum && t.name === name);
    if (existingIdx > -1) {
      group[existingIdx].qty += qty;
    } else {
      group.push({ artNum, name, unit, qty });
    }
  });

  // Render Suppliers
  if (supplierGroups.size === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('Keine Artikel erfasst.', marginX, y);
    y += 10;
  } else {
    // Sort suppliers: named suppliers first, 'Ohne Zuweisung' last.
    const sortedSuppliers = Array.from(supplierGroups.keys()).sort((a, b) => {
      if (a === 'Ohne Zuweisung / Sonstiges') return 1;
      if (b === 'Ohne Zuweisung / Sonstiges') return -1;
      return a.localeCompare(b);
    });

    for (const supplier of sortedSuppliers) {
      checkPageBreak(30);
      
      // Supplier Header Bar
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, 170, 10, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      
      // Highlight "Großhändler:" in brand color
      doc.setTextColor(...brandColor);
      doc.text('Großhändler:', marginX + 5, y + 7);
      
      doc.setTextColor(15, 23, 42);
      doc.text(supplier, marginX + 35, y + 7);
      
      y += 18;

      const groupItems = supplierGroups.get(supplier)!;
      groupItems.sort((a, b) => a.name.localeCompare(b.name));

      // Table Header
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Menge', marginX + 5, y);
      doc.text('A-Nr.', marginX + 30, y);
      doc.text('Artikelbeschreibung', marginX + 60, y);
      y += 4;
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, y, marginX + 170, y);
      y += 8;

      // Table body
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      for (const t of groupItems) {
        checkPageBreak(12);
        const cleanUnit = t.unit.replace(/^[0-9xX\s]+/, '').trim(); // Remove leading "1 " or "1x"
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${t.qty} ${cleanUnit}`, marginX + 5, y);
        doc.setFont('helvetica', 'normal');
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(t.artNum || '-', marginX + 30, y);
        
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);

        // Word wrap for long article names
        const splitName = doc.splitTextToSize(t.name, 120);
        doc.text(splitName, marginX + 60, y);
        
        y += (splitName.length * 5) + 3;
        
        // Very subtle separator line between items
        doc.setDrawColor(241, 245, 249);
        doc.line(marginX, y-1.5, marginX + 170, y-1.5);
      }
      y += 10;
    }
  }


  // --- 2. AUFSCHLÜSSELUNG NACH ABSCHNITTEN ---
  
  // Force a new page for the detailed breakdown to keep things clean
  doc.addPage();
  pageNumber++;
  addPageLayout();
  y = 50;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Raumaufschlüsselung', marginX, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Exakte Zuordnung des Materials zu den erfassten Bauabschnitten', marginX, y);
  y += 15;

  const renderDetailedSection = (sId: string | null, label: string) => {
    // Collect all article items that belong to this section_id
    const items = articleItems.filter(i => (i as any).section_id === sId);
    if (items.length === 0) return;

    checkPageBreak(25);

    // Section Title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text(label, marginX, y);
    y += 3;
    doc.setDrawColor(...brandColor);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, marginX + 170, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    for (const i of items) {
      checkPageBreak(12);
      const name = i.article?.name ?? (i as any).name ?? 'Manuell';
      const qty = i.quantity ?? 0;
      const artNum = i.article?.articleNumber ?? (i as any).article_number ?? '';
      const unit = i.article?.unit ?? (i as any).unit ?? '';
      const cleanUnit = unit.replace(/^[0-9xX\s]+/, '').trim();

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${qty} ${cleanUnit}`, marginX + 5, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(artNum, marginX + 25, y);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const splitName = doc.splitTextToSize(name, 120);
      doc.text(splitName, marginX + 50, y);

      y += (splitName.length * 5) + 2;
    }
    y += 10;
  };

  // Render general items first
  renderDetailedSection(null, 'Allgemeines Material (ohne Raumzugehörigkeit)');
  
  // Render specific sections
  sectionItems.forEach(s => {
    renderDetailedSection(s.id, s.text ?? 'Abschnitt');
  });


  // Final Output
  doc.save(`Materialliste_${projectName}.pdf`);
}
