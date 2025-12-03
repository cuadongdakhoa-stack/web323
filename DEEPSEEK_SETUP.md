# DEEPSEEK EXTRACTION SETUP

## 1. Lấy API Key (FREE)

1. Truy cập: https://platform.deepseek.com/
2. Đăng ký tài khoản (email + password)
3. Vào **API Keys** → Create new key
4. Copy API key: `sk-...`

**FREE TIER:**
- $5 credit miễn phí
- Đủ test ~35,000 cases
- Không cần thẻ tín dụng

## 2. Test Extraction

### Cài thêm dependency:
```powershell
pip install requests
```

### Test với Bệnh án:
```powershell
$env:DEEPSEEK_API_KEY="sk-456824fe50ca4e77a5863fabc23528b6ere"

python scripts/deepseek_extractor.py "KHOA DƯỢC - SẢN PHẨM DỰ THI/ĐƠN NỘI TRÚ/BÙI THỊ TÂM/Bệnh án nội khoa ( thông tin họ tên, chiều cao cân nặng, giới tính, tuổi, bệnh chính bệnh phụ).pdf" $env:DEEPSEEK_API_KEY
```

### Test với Tờ điều trị:
```powershell
python scripts/deepseek_extractor.py "KHOA DƯỢC - SẢN PHẨM DỰ THI/ĐƠN NỘI TRÚ/BÙI THỊ TÂM/Tờ điều trị ( thông tin thuốc, liều dùng).pdf" $env:DEEPSEEK_API_KEY
```

### Test với Xét nghiệm:
```powershell
python scripts/deepseek_extractor.py "KHOA DƯỢC - SẢN PHẨM DỰ THI/ĐƠN NỘI TRÚ/BÙI THỊ TÂM/Cận lâm sàng và chẩn đoán hình ảnh/1.pdf" $env:DEEPSEEK_API_KEY
```

## 3. Expected Output

```json
{
  "success": true,
  "pdf_path": "...",
  "pdf_pages": 1,
  "text_length": 10614,
  "extracted_data": {
    "caseType": "inpatient",
    "patient": {
      "name": "BÙI THỊ TÂM",
      "age": 72,
      "gender": "Nữ",
      "weight": 43.0,
      "height": 150.0
    },
    "clinical": {
      "admissionDate": "23/10/2025",
      "department": "Khoa Nội 1",
      "diagnosisMain": "Suy tim",
      "diagnosisMainIcd": "I50.9",
      "diagnosisSecondary": [],
      "medicalHistory": "Tăng huyết áp, xơ vữa động mạch...",
      "allergies": "Thuốc lá"
    },
    "medications": [...],
    "labs": [...]
  },
  "tokens_used": {
    "input_tokens": 2800,
    "output_tokens": 450
  },
  "cost_estimate": {
    "total_cost_usd": 0.000518,
    "total_cost_vnd": 12.95
  }
}
```

## 4. Chi phí so sánh

| Model | Input (per 1M) | Output (per 1M) | Cost/Case | Monthly (30/day) |
|-------|----------------|-----------------|-----------|------------------|
| **GPT-4o** | $2.50 | $10.00 | $0.012 | $11 |
| **DeepSeek-V3** | $0.14 | $0.28 | **$0.0005** | **$0.45** |
| **Savings** | -94% | -97% | **-96%** | **$10.55/month** |

## 5. Integration vào Web

File: `server/routes.ts`

```typescript
import { spawn } from "child_process";

// Upload PDF → Extract with DeepSeek
app.post("/api/cases/extract", async (req, res) => {
  const pdfPath = req.body.pdfPath; // From upload
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  const python = spawn("python", [
    "scripts/deepseek_extractor.py",
    pdfPath,
    apiKey
  ]);
  
  let output = "";
  python.stdout.on("data", (data) => output += data);
  
  python.on("close", (code) => {
    if (code === 0) {
      const result = JSON.parse(output);
      res.json(result.extracted_data); // Send to frontend
    } else {
      res.status(500).json({ error: "Extraction failed" });
    }
  });
});
```

## 6. Frontend Auto-fill

```typescript
// client/src/pages/new-case.tsx

const handleExtract = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch("/api/cases/extract", {
    method: "POST",
    body: formData
  });
  
  const data = await response.json();
  
  // Auto-fill form
  setFormData({
    caseType: data.caseType,
    patientName: data.patient.name,
    patientAge: data.patient.age,
    patientGender: data.patient.gender,
    patientWeight: data.patient.weight,
    patientHeight: data.patient.height,
    admissionDate: data.clinical.admissionDate,
    diagnosisMain: data.clinical.diagnosisMain,
    // ...
  });
  
  setMedications(data.medications);
  // Show success toast
};
```
