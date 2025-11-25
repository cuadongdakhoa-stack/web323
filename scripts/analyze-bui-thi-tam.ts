import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      extractedText += `\n=== TRANG ${pageNum} ===\n` + pageText + '\n';
    }

    return extractedText;
  } catch (error: any) {
    console.error(`Lỗi đọc PDF: ${error.message}`);
    return '';
  }
}

const casePath = "C:\\Users\\TIEN DUNG\\Documents\\CarePharmaWeb\\uploads\\test-bui-thi-tam";

console.log("========================================");
console.log("BỆNH ÁN NỘI KHOA");
console.log("========================================");
const benhAnPath = `${casePath}\\Bệnh án nội khoa ( thông tin họ tên, chiều cao cân nặng, giới tính, tuổi, bệnh chính bệnh phụ).pdf`;
const benhAnText = await extractTextFromPDF(benhAnPath);
console.log(benhAnText);

console.log("\n\n========================================");
console.log("TỜ ĐIỀU TRỊ - THÔNG TIN THUỐC");
console.log("========================================");
const todieutriPath = `${casePath}\\Tờ điều trị ( thông tin thuốc, liều dùng).pdf`;
const todieutriText = await extractTextFromPDF(todieutriPath);
console.log(todieutriText);
