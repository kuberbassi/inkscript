import { jsPDF } from 'jspdf';
import { GeneratedPage } from '../types/studio';

/**
 * Generates an edge-to-edge full-bleed A4 PDF (0, 0, width, height)
 * with zero added margins or borders.
 */
export function exportPagesToPDF(pages: GeneratedPage[]): void {
  if (pages.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  pages.forEach((page, idx) => {
    if (idx > 0) {
      doc.addPage();
    }
    doc.addImage(
      page.dataUrl,
      'PNG',
      0,
      0,
      width,
      height,
      `page-${idx + 1}`,
      'FAST'
    );
  });

  doc.save('handwritten-sheet.pdf');
}
