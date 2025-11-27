import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFParser = require('pdf2json');

async function extractTextFromPDF(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', errData => {
      console.error(`Error reading ${filePath}:`, errData.parserError);
      resolve('');
    });
    
    pdfParser.on('pdfParser_dataReady', pdfData => {
      try {
        let text = '';
        pdfData.Pages.forEach((page, pageIndex) => {
          text += `\n=== PAGE ${pageIndex + 1} ===\n`;
          page.Texts.forEach(textItem => {
            try {
              const decodedText = decodeURIComponent(textItem.R[0].T);
              text += decodedText + ' ';
            } catch (e) {
              // If decoding fails, use raw text
              text += textItem.R[0].T + ' ';
            }
          });
          text += '\n';
        });
        resolve(text);
      } catch (error) {
        console.error(`Error processing PDF data:`, error.message);
        resolve('');
      }
    });
    
    pdfParser.loadPDF(filePath);
  });
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node read-pdf.mjs <path-to-pdf>');
  process.exit(1);
}

const text = await extractTextFromPDF(filePath);
console.log(text);
