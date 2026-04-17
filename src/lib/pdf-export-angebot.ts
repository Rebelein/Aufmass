import jsPDF from 'jspdf';
import type { ProcessedSummaryItem } from '@/lib/types';
import type { ProjectSelectedItem, Project } from '@/lib/project-storage';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AngebotPdfExportOptions {
  project: Project;
  sectionItems: ProjectSelectedItem[];
  articleItems: ProcessedSummaryItem[];
}

export function generateAngebotPdf({ project, sectionItems, articleItems }: AngebotPdfExportOptions): void {
  const doc = new jsPDF();
  const BRAND_COLOR: [number, number, number] = [16, 185, 129]; // emerald-500
  const TEXT_DARK: [number, number, number] = [30, 41, 59]; // slate-800
  const TEXT_LIGHT: [number, number, number] = [100, 116, 139]; // slate-500
  
  const formatDate = (dateInput?: string | null) => {
    if (!dateInput) return '';
    try {
      return format(new Date(dateInput), "dd.MM.yyyy", { locale: de });
    } catch { return ''; }
  };

  // --- Global State ---
  let pageNumber = 1;
  let y = 0;

  const addPageLayout = (isFirstPage: boolean) => {
    // Top banner
    doc.setFillColor(...BRAND_COLOR);
    doc.rect(0, 0, 210, 35, 'F');
    
    // Logo / Branding Text
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Rebelein Aufmaß', 20, 23);
    
    // Logo Placeholder
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('[ FIRMEN LOGO PLATZHALTER ]', 142, 22);

    if (isFirstPage) {
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('Angebotsdokumentation', 20, 55);

      // Info Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(20, 65, 170, 40, 'FD'); // Fill and Draw

      doc.setFontSize(14);
      doc.text(`Projekt: ${project.name}`, 25, 75);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_LIGHT);
      
      let infoY = 82;
      if (project.client_name) { doc.text(`Kunde: ${project.client_name}`, 25, infoY); infoY += 6; }
      if (project.address) { doc.text(`Aktionsort: ${project.address}`, 25, infoY); infoY += 6; }
      
      if (project.start_date || project.end_date) {
        doc.text(`Zeitraum: ${formatDate(project.start_date)} - ${formatDate(project.end_date)}`, 25, infoY);
      }
      
      doc.setFontSize(10);
      doc.text(`Erstellt am: ${formatDate(new Date().toISOString())}`, 142, 100);
      y = 125;
    } else {
      y = 50;
    }
  };

  const checkNewPage = (neededSpace = 30) => { 
    if (y + neededSpace > 270) { 
        doc.addPage(); 
        pageNumber++;
        addPageLayout(false);
    } 
  };

  addPageLayout(true);

  const renderSection = (section: ProjectSelectedItem | null, label: string) => {
    const items = articleItems.filter(i => (i as any).section_id === (section ? section.id : null));
    const description = section?.description;
    const images = section?.images || [];
    
    if (items.length === 0 && !description && images.length === 0 && section !== null) return;
    
    checkNewPage(40);
    
    // Section Title with indicator block
    doc.setFillColor(...BRAND_COLOR);
    doc.rect(20, y - 6, 4, 8, 'F');
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(label, 30, y); 
    y += 12;

    // Description text
    if (description) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...TEXT_LIGHT);
      
      const splitText = doc.splitTextToSize(description, 160);
      doc.text(splitText, 30, y);
      y += (splitText.length * 6) + 8;
    }

    // Images Grid (Max 2 per row)
    if (images.length > 0) {
      const imgWidth = 80;
      const imgHeight = 60; // 4:3 aspect ratio roughly
      const spacingX = 10;
      const spacingY = 10;
      let imgX = 30; // Indented alignment
      let rowHeight = 0;
      let imgCountInRow = 0;

      for (let i = 0; i < images.length; i++) {
        if (imgCountInRow >= 2 || imgX + imgWidth > 200) {
          y += imgHeight + spacingY;
          imgX = 30;
          imgCountInRow = 0;
          checkNewPage(imgHeight + spacingY);
        }
        
        try {
          doc.setDrawColor(200);
          doc.rect(imgX, y, imgWidth, imgHeight, 'S'); // border around image
          doc.addImage(images[i], 'JPEG', imgX, y, imgWidth, imgHeight);
          rowHeight = imgHeight;
          imgCountInRow++;
        } catch (e) {
          console.error("PDF Image Error", e);
        }
        imgX += imgWidth + spacingX;
      }
      y += rowHeight + 15;
    }

    // Material List
    if (items.length > 0) {
      checkNewPage(25);
      
      // Mini table header
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(30, y - 5, 160, 8, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT_DARK);
      doc.text("Benötigtes Material & Leistungen", 32, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_DARK);
      
      items.forEach(i => {
        checkNewPage(8);
        const name = i.article?.name ?? (i as any).name ?? 'Manuell';
        const qty = i.quantity ?? 0;
        const artNum = i.article?.articleNumber ?? (i as any).article_number ?? '';
        const unit = i.article?.unit ?? (i as any).unit ?? '';
        
        // Formatted columns
        doc.setFont('helvetica', 'bold');
        doc.text(`${qty} ${unit}`, 32, y);
        
        doc.setFont('helvetica', 'normal');
        doc.text(name, 55, y);
        
        if (artNum) {
          doc.setTextColor(...TEXT_LIGHT);
          doc.text(`Art. ${artNum}`, 160, y);
          doc.setTextColor(...TEXT_DARK);
        }
        
        // Soft underline
        doc.setDrawColor(241, 245, 249);
        doc.line(30, y + 2, 190, y + 2);
        
        y += 7;
      });
      y += 10;
    } else {
      y += 10;
    }
  };

  // Render "Allgemein" section first
  renderSection(null, 'Allgemeines / Projektübergreifend');
  
  // Render explicit sections
  sectionItems.forEach(s => renderSection(s, s.text ?? 'Abschnitt'));

  // Add Pagination Footer to all pages
  const totalPages = pageNumber;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Seite ${i} von ${totalPages}`, 105, 285, { align: 'center' });
    doc.text(`Rebelein Aufmaß - ${project.name}`, 20, 285);
  }

  const filenameName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`angebot_${filenameName}.pdf`);
}
