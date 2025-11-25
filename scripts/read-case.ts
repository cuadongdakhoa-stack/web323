import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      fullText += `\n=== TRANG ${i} ===\n${pageText}\n`;
    }
    return fullText;
  } catch (error) {
    console.error(`Error:`, error.message);
    return '';
  }
}

const casePath = "C:\\Users\\TIEN DUNG\\Documents\\CarePharmaWeb\\KHOA DƯỢC - SẢN PHẨM DỰ THI\\ĐƠN NỘI TRÚ\\BÙI THỊ TÂM";

console.log("=== BỆNH ÁN NỘI KHOA ===");
const benhAnPath = path.join(casePath, "Bệnh án nội khoa ( thông tin họ tên, chiều cao cân nặng, giới tính, tuổi, bệnh chính bệnh phụ).pdf");
const benhAnText = await extractTextFromPDF(benhAnPath);
console.log(benhAnText);

console.log("\n\n=== TỜ ĐIỀU TRỊ ===");
const todieutriPath = path.join(casePath, "Tờ điều trị ( thông tin thuốc, liều dùng).pdf");
const todieutriText = await extractTextFromPDF(todieutriPath);
console.log(todieutriText);
