import jsPDF from 'jspdf';
import type { ProcessedSummaryItem } from '@/lib/types';
import type { ProjectSelectedItem } from '@/lib/project-storage';

interface PdfExportOptions {
  projectName: string;
  sectionItems: ProjectSelectedItem[];
  articleItems: ProcessedSummaryItem[];
}

/**
 * Generates and downloads a PDF report for the current Aufmaß.
 * Includes per-section breakdowns and a total summary page.
 */
export function generateAufmassPdf({ projectName, sectionItems, articleItems }: PdfExportOptions): void {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Projekt: ${projectName}`, 15, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 15, 28);
  doc.setTextColor(0);
  let y = 40;

  const checkNewPage = () => { if (y > 270) { doc.addPage(); y = 20; } };

  const renderSection = (sId: string | null, label: string) => {
    const items = articleItems.filter(i => (i as any).section_id === sId);
    if (items.length === 0) return;
    checkNewPage();
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(label, 15, y); y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    items.forEach(i => {
      checkNewPage();
      const name = i.article?.name ?? (i as any).name ?? 'Manuell';
      const qty = i.quantity ?? 0;
      const artNum = i.article?.articleNumber ?? (i as any).article_number ?? '';
      const unit = i.article?.unit ?? (i as any).unit ?? '';
      doc.text(`${qty}${unit ? ' ' + unit : 'x'}`, 20, y);
      doc.text(`${name}${artNum ? '  (' + artNum + ')' : ''}`, 45, y);
      y += 6;
    });
    y += 4;
  };

  // Per-section breakdown
  renderSection(null, 'Allgemein');
  sectionItems.forEach(s => renderSection(s.id, s.text ?? 'Abschnitt'));

  // Total summary page (only if there are sections)
  if (sectionItems.length > 0 && articleItems.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Gesamtübersicht', 15, y); y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('Alle Abschnitte aufsummiert – für die Bestellung', 15, y); y += 8;
    doc.setTextColor(0);
    doc.setFontSize(10);

    const totals = new Map<string, { name: string; artNum: string; unit: string; qty: number }>();
    articleItems.forEach(i => {
      const key = i.article?.articleNumber ?? (i as any).article_number ?? i.article?.name ?? (i as any).name ?? i.id;
      const existing = totals.get(key);
      const qty = i.quantity ?? 0;
      if (existing) {
        totals.set(key, { ...existing, qty: existing.qty + qty });
      } else {
        totals.set(key, {
          name: i.article?.name ?? (i as any).name ?? 'Manuell',
          artNum: i.article?.articleNumber ?? (i as any).article_number ?? '',
          unit: i.article?.unit ?? (i as any).unit ?? '',
          qty,
        });
      }
    });

    totals.forEach(v => {
      checkNewPage();
      doc.setFont('helvetica', 'bold');
      doc.text(`${v.qty}${v.unit ? ' ' + v.unit : 'x'}`, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${v.name}${v.artNum ? '  (' + v.artNum + ')' : ''}`, 45, y);
      y += 6;
    });
  }

  doc.save(`aufmass_${projectName}.pdf`);
}
