import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const BASE_PATH = 'KHOA DƯỢC - SẢN PHẨM DỰ THI';

async function readPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return '';
  }
}

async function analyzePDFs() {
  console.log('='.repeat(80));
  console.log('PHÂN TÍCH ĐƠN NGOẠI TRÚ - BẠCH THỊ HUYỀN');
  console.log('='.repeat(80));
  
  // Đơn ngoại trú - Bạch Thị Huyền
  const outpatient1 = path.join(BASE_PATH, 'ĐƠN NGOẠI TRÚ', 'BẠCH THỊ HUYỀN');
  
  console.log('\n--- BẢNG KÊ ---');
  const bangKe1 = await readPDF(path.join(outpatient1, 'Bảng kê.pdf'));
  console.log(bangKe1.substring(0, 2000));
  
  console.log('\n--- ĐƠN THUỐC ---');
  const donThuoc1 = await readPDF(path.join(outpatient1, 'Đơn thuốc.pdf'));
  console.log(donThuoc1.substring(0, 2000));
  
  console.log('\n--- XÉT NGHIỆM HÓA SINH ---');
  const hoaSinh1 = await readPDF(path.join(outpatient1, 'xét nghiệm hóa sinh.pdf'));
  console.log(hoaSinh1.substring(0, 2000));
  
  console.log('\n--- XÉT NGHIỆM MÁU ---');
  const mau1 = await readPDF(path.join(outpatient1, 'Xét nghiệm máu.pdf'));
  console.log(mau1.substring(0, 2000));
  
  console.log('\n\n' + '='.repeat(80));
  console.log('PHÂN TÍCH ĐƠN NGOẠI TRÚ - NGUYỄN VĂN BÌNH');
  console.log('='.repeat(80));
  
  // Đơn ngoại trú - Nguyễn Văn Bình
  const outpatient2 = path.join(BASE_PATH, 'ĐƠN NGOẠI TRÚ', 'NGUYỄN VĂN BÌNH');
  
  console.log('\n--- BẢNG KÊ ---');
  const bangKe2 = await readPDF(path.join(outpatient2, 'Bảng kê.pdf'));
  console.log(bangKe2.substring(0, 2000));
  
  console.log('\n--- ĐƠN THUỐC ---');
  const donThuoc2 = await readPDF(path.join(outpatient2, 'Đơn thuốc.pdf'));
  console.log(donThuoc2.substring(0, 2000));
  
  console.log('\n--- HUYẾT HỌC ---');
  const huyetHoc2 = await readPDF(path.join(outpatient2, 'Huyết học.pdf'));
  console.log(huyetHoc2.substring(0, 2000));
  
  console.log('\n\n' + '='.repeat(80));
  console.log('PHÂN TÍCH ĐƠN NỘI TRÚ - BÙI THỊ TÂM');
  console.log('='.repeat(80));
  
  // Đơn nội trú - Bùi Thị Tâm
  const inpatient1 = path.join(BASE_PATH, 'ĐƠN NỘI TRÚ', 'BÙI THỊ TÂM');
  
  console.log('\n--- BỆNH ÁN NỘI KHOA ---');
  const benhAn1 = await readPDF(path.join(inpatient1, 'Bệnh án nội khoa ( thông tin họ tên, chiều cao cân nặng, giới tính, tuổi, bệnh chính bệnh phụ).pdf'));
  console.log(benhAn1.substring(0, 3000));
  
  console.log('\n--- TỜ ĐIỀU TRỊ ---');
  const toDieuTri1 = await readPDF(path.join(inpatient1, 'Tờ điều trị ( thông tin thuốc, liều dùng).pdf'));
  console.log(toDieuTri1.substring(0, 3000));
  
  console.log('\n\n' + '='.repeat(80));
  console.log('PHÂN TÍCH ĐƠN NỘI TRÚ - BẠCH SĨ NHU');
  console.log('='.repeat(80));
  
  // Đơn nội trú - Bạch Sĩ Nhu
  const inpatient2 = path.join(BASE_PATH, 'ĐƠN NỘI TRÚ', 'BẠCH SĨ NHU');
  
  console.log('\n--- BỆNH ÁN NỘI KHOA ---');
  const benhAn2 = await readPDF(path.join(inpatient2, 'Bệnh án nội khoa.pdf'));
  console.log(benhAn2.substring(0, 3000));
  
  console.log('\n--- TỜ ĐIỀU TRỊ ---');
  const toDieuTri2 = await readPDF(path.join(inpatient2, 'Tờ điều trị.pdf'));
  console.log(toDieuTri2.substring(0, 3000));
  
  console.log('\n--- XÉT NGHIỆM HUYẾT HỌC ---');
  const xnHuyetHoc = await readPDF(path.join(inpatient2, 'Xét nghiệm huyết học.pdf'));
  console.log(xnHuyetHoc.substring(0, 2000));
  
  console.log('\n--- XÉT NGHIỆM HÓA SINH ---');
  const xnHoaSinh = await readPDF(path.join(inpatient2, 'Xét nghiệm hóa sinh.pdf'));
  console.log(xnHoaSinh.substring(0, 2000));
}

analyzePDFs().catch(console.error);
