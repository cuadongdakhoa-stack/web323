import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = "C:\\Users\\TIEN DUNG\\Documents\\CarePharmaWeb\\DMT (3).xls";

console.log("Đọc file danh mục thuốc...\n");

try {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  console.log("Sheets:", workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  console.log(`\nĐọc sheet: ${sheetName}\n`);
  
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Tổng số dòng: ${data.length}`);
  console.log(`\n=== 5 DÒNG ĐẦU TIÊN ===\n`);
  
  data.slice(0, 5).forEach((row: any, idx) => {
    console.log(`\n--- Dòng ${idx + 1} ---`);
    console.log(JSON.stringify(row, null, 2));
  });
  
  console.log(`\n=== CÁC CỘT TRONG FILE ===`);
  if (data.length > 0) {
    console.log(Object.keys(data[0]));
  }
  
} catch (error: any) {
  console.error("Lỗi:", error.message);
}
