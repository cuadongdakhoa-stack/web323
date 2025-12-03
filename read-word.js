import mammoth from 'mammoth';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const wordPath = 'C:\\Users\\TIEN DUNG\\Documents\\CarePharmaWeb\\Kiểm tra mã ICD thuốc.docx';

mammoth.extractRawText({ path: wordPath })
  .then(result => {
    console.log(result.value);
  })
  .catch(err => {
    console.error('Error:', err);
  });
