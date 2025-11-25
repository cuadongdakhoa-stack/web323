import fs from 'fs';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

async function extractTextFromPDF(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n=== PAGE ${i} ===\n${pageText}\n`;
    }
    return fullText;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return '';
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node read-pdf.mjs <path-to-pdf>');
  process.exit(1);
}

const text = await extractTextFromPDF(filePath);
console.log(text);
