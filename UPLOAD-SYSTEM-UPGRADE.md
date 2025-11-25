# Upload System Upgrade - 3 Document Types

## Tổng quan thay đổi

Nâng cấp hệ thống upload từ **1 loại tổng hợp** → **3 loại riêng biệt** với prompt chuyên biệt cho từng loại tài liệu.

---

## 1. Thay đổi UI (FileUploadSection.tsx)

### Trước:
- 3 tab: "Hành chính", "Cận lâm sàng", "Đơn thuốc"
- Mô tả chung chung

### Sau:
- 3 tab với tên mới rõ ràng hơn:
  - **"Bệnh án / Hồ sơ vào viện"** (admin)
  - **"Cận lâm sàng"** (lab)  
  - **"Tờ điều trị / Đơn thuốc"** (prescription)

- Mô tả chi tiết:
  - admin: "Bệnh án, giấy nhập viện, thông tin bệnh nhân"
  - lab: "Kết quả xét nghiệm, chẩn đoán hình ảnh, creatinine"
  - prescription: "Tờ điều trị, đơn thuốc, y lệnh"

- CardDescription cập nhật: 
  > "Upload riêng 3 loại: Bệnh án, Cận lâm sàng, Tờ điều trị (không bắt buộc đủ cả 3)"

---

## 2. Prompt chuyên biệt (server/openrouter.ts)

### Đã tạo 3 prompt templates mới:

#### A. `BENH_AN_PROMPT` (Bệnh án / Hồ sơ vào viện)

**Chỉ trích xuất:**
- ✅ patientName, patientAge, patientGender
- ✅ patientWeight, patientHeight
- ✅ admissionDate
- ✅ diagnosisMain, diagnosisSecondary, icdCodes
- ✅ medicalHistory, allergies

**Không trích xuất:**
- ❌ labResults (để null)
- ❌ medications (để null)

**Đặc điểm:**
- Focus vào thông tin bệnh nhân + chẩn đoán
- Xử lý mục (15)-(18) trong bệnh án (chẩn đoán chính + phụ + ICD-10)
- Tách rõ diagnosisSecondary thành mảng

#### B. `CAN_LAM_SANG_PROMPT` (Cận lâm sàng)

**Chỉ trích xuất:**
- ✅ labResults.creatinine + creatinineUnit

**Không trích xuất:**
- ❌ Tất cả các trường khác (để null)

**Đặc điểm:**
- Focus 100% vào creatinine
- Phân biệt mg/dL vs micromol/L
- Tránh nhầm giá tiền với kết quả XN
- Ví dụ:
  - ✅ "Creatinine: 1.2 mg/dL" → creatinine: 1.2
  - ✅ "91,39 µmol/L" → creatinine: 91.39, unit: "micromol/L"
  - ❌ "Creatinine 22,400" → GIÁ TIỀN, bỏ qua

#### C. `TO_DIEU_TRI_PROMPT` (Tờ điều trị / Đơn thuốc)

**Chỉ trích xuất:**
- ✅ medications[] (drugName, dose, frequency, route, startDate, endDate)

**Không trích xuất:**
- ❌ Tất cả các trường khác (để null)

**Đặc điểm:**
- Focus vào timeline thuốc
- QUY TẮC VÀNG: "Ngày 1,2,3/1/2024" → endDate = "2024-01-03" (KHÔNG kéo dài)
- Nhận diện medication switching:
  - "Lovastatin (23-27/10) NGƯNG → Atorvastatin (28/10) BẮT ĐẦU"
  - Nếu thuốc biến mất khỏi tờ điều trị trang sau → switching
- Xử lý đường dùng: Hít/Uống/Tiêm
- Xử lý liều: "0,4mg" → "0.4mg"

### Fallback: `getComprehensivePrompt()`
- Dùng khi **không có fileGroup** (backward compatibility)
- Trích xuất tất cả trường (như cũ)

---

## 3. Backend routing (server/routes.ts + server/openrouter.ts)

### routes.ts - `/api/cases/extract`

**Thay đổi:**
```typescript
// Nhận fileGroup từ request body
const fileGroup = req.body.fileGroup as string | undefined;

// Truyền vào extractDataFromDocument
const extractedData = await extractDataFromDocument(
  combinedTextContent, 
  "pdf", 
  fileGroup  // NEW: "admin" | "lab" | "prescription"
);
```

### openrouter.ts - `extractDataFromDocument()`

**Signature mới:**
```typescript
export async function extractDataFromDocument(
  textContent: string,
  fileType: "pdf" | "docx",
  fileGroup?: string  // NEW: optional parameter
): Promise<any>
```

**Logic routing:**
```typescript
if (fileGroup === "admin") {
  userPromptTemplate = BENH_AN_PROMPT;
} else if (fileGroup === "lab") {
  userPromptTemplate = CAN_LAM_SANG_PROMPT;
} else if (fileGroup === "prescription") {
  userPromptTemplate = TO_DIEU_TRI_PROMPT;
} else {
  userPromptTemplate = getComprehensivePrompt();  // fallback
}
```

---

## 4. Fix tương tác thuốc (server/openrouter.ts)

### Đã thêm vào prompt `analyzePatientCase()`:

#### A. Danh sách KHÔNG BÁO CÁO (false positives):
```
⚠️ DANH SÁCH TƯƠNG TÁC SAI - KHÔNG BÁO CÁO:
  • Spironolactone + Metoprolol → KHÔNG BÁO (phối hợp an toàn trong suy tim)
  • Spironolactone + beta-blocker (bất kỳ) → KHÔNG BÁO
```

**Lý do:** Phối hợp Spironolactone + beta-blocker là điều trị tiêu chuẩn suy tim, không có tương tác có ý nghĩa lâm sàng.

#### B. Tương tác cần lưu ý NHẸ (không cảnh báo nặng):
```
⚠️ TƯƠNG TÁC CẦN LƯU Ý NHẸ (KHÔNG CẢNH BÁO NẶNG):
  • Clopidogrel + PPI: "Lưu ý theo dõi hiệu quả kháng kết tập tiểu cầu. 
    Có thể thay PPI khác nếu cần." (KHÔNG DÙNG từ "cảnh báo" hay "nguy hiểm")
  • Clopidogrel + Aspirin: "Phối hợp điều trị kháng kết tập tiểu cầu kép - 
    giám sát nguy cơ chảy máu." (ngữ điệu nhẹ nhàng)
```

**Lý do:** Đây là phối hợp điều trị thường gặp, chỉ cần lưu ý theo dõi, không phải cảnh báo nghiêm trọng.

#### C. Medication switching (đã có từ trước):
```
⚠️ ĐẶC BIỆT CHÚ Ý MEDICATION SWITCHING:
  • Lovastatin (23-27/10) NGƯNG → Atorvastatin (28/10-04/11) BẮT ĐẦU 
    → KHÔNG tương tác (sequential use)
  • CHỈ BÁO TƯƠNG TÁC KHI 2 THUỐC DÙNG ĐỒNG THỜI (overlap)
```

---

## 5. Workflow mới

### A. Tạo case mới (new-case.tsx):
- Giữ nguyên như cũ (dùng comprehensive prompt)
- Hoặc có thể update sau để dùng 3 loại riêng

### B. Upload file vào case đã tạo (FileUploadSection):

1. **User chọn tab:**
   - Tab "Bệnh án / Hồ sơ vào viện" → fileGroup = "admin"
   - Tab "Cận lâm sàng" → fileGroup = "lab"
   - Tab "Tờ điều trị / Đơn thuốc" → fileGroup = "prescription"

2. **Upload file:**
   - File được lưu vào `/uploads/{caseId}/{fileGroup}/`
   - Database lưu fileGroup vào `uploaded_files.fileGroup`

3. **Extract (nếu gọi /api/cases/extract):**
   - Gửi `fileGroup` trong FormData
   - Backend dùng prompt chuyên biệt tương ứng
   - Chỉ trích xuất trường liên quan

4. **Merge data:**
   - Bệnh án → điền thông tin bệnh nhân + chẩn đoán
   - Cận lâm sàng → điền creatinine
   - Tờ điều trị → điền medications
   - Các trường khác giữ nguyên (không overwrite bằng null)

### C. Phân tích case:
- Dùng API `/api/cases/:id/analyze`
- Prompt đã có rules về:
  - Medication switching
  - Spironolactone + Metoprolol (không báo)
  - Clopidogrel (lưu ý nhẹ)

---

## 6. Testing checklist

### Chuẩn bị:
- [ ] Case BÙI THỊ TÂM (tách 3 loại file):
  - Bệnh án: file giấy nhập viện
  - Cận lâm sàng: file xét nghiệm có creatinine
  - Tờ điều trị: file 32 trang (Lovastatin → Atorvastatin)

### Test case 1: Bệnh án
- [ ] Upload vào tab "Bệnh án / Hồ sơ vào viện"
- [ ] Extract → kiểm tra:
  - ✅ patientName: "BÙI THỊ TÂM"
  - ✅ patientAge: 72
  - ✅ patientGender: "Nữ"
  - ✅ diagnosisMain: "..."
  - ✅ diagnosisSecondary: [...] (tách rõ từng bệnh)
  - ✅ icdCodes.main + icdCodes.secondary
  - ❌ medications: null
  - ❌ labResults: null

### Test case 2: Cận lâm sàng
- [ ] Upload vào tab "Cận lâm sàng"
- [ ] Extract → kiểm tra:
  - ✅ labResults.creatinine: 91.39 (hoặc số khác)
  - ✅ labResults.creatinineUnit: "micromol/L"
  - ❌ Các trường khác: null

### Test case 3: Tờ điều trị
- [ ] Upload vào tab "Tờ điều trị / Đơn thuốc"
- [ ] Extract → kiểm tra:
  - ✅ medications[]: danh sách đầy đủ
  - ✅ Lovastatin: 
    - usageStartDate: "2024-10-23"
    - usageEndDate: "2024-10-27"
  - ✅ Atorvastatin:
    - usageStartDate: "2024-10-28"
    - usageEndDate: "2024-11-04"
  - ❌ Các trường khác: null

### Test case 4: Phân tích case
- [ ] Sau khi upload 3 loại → Analyze case
- [ ] Kiểm tra:
  - ✅ eGFR được tính (dựa vào creatinine từ lab)
  - ✅ Timeline thuốc đúng
  - ✅ Lovastatin + Atorvastatin: KHÔNG BÁO tương tác statin (vì sequential)
  - ✅ Spironolactone + Metoprolol: KHÔNG BÁO tương tác
  - ✅ Clopidogrel: lưu ý nhẹ (nếu có), KHÔNG cảnh báo nặng

---

## 7. Rollback plan

Nếu có vấn đề:

1. **Revert commit:**
   ```bash
   git log --oneline -3
   git revert <commit-hash>
   ```

2. **Hoặc sửa nhanh:**
   - Bỏ `fileGroup` parameter → dùng lại comprehensive prompt
   - Comment out false positive rules

---

## 8. Migration notes

### Case cũ:
- **KHÔNG migrate** dữ liệu cũ
- Case cũ giữ nguyên, vẫn hoạt động bình thường
- Nếu user upload lại file → dùng hệ thống mới

### Case mới:
- Áp dụng ngay khi update code
- Upload file vào 3 tab riêng
- Extract với prompt chuyên biệt

---

## 9. Tóm tắt file đã sửa

| File | Thay đổi | Lines changed |
|------|----------|--------------|
| `client/src/components/FileUploadSection.tsx` | Cập nhật label, description cho 3 tabs | ~10 |
| `server/openrouter.ts` | Thêm 3 prompts + helper function + routing logic + false positive rules | ~180 |
| `server/routes.ts` | Thêm fileGroup parameter vào extract endpoint | ~5 |

**Tổng:** ~195 lines thay đổi

---

## 10. Next steps

1. ✅ Code đã sẵn sàng
2. ⏳ Test với BÙI THỊ TÂM case:
   - Upload 3 loại file riêng
   - Verify extraction accuracy
   - Check interaction warnings
3. ⏳ Monitor production logs:
   - Xem AI có dùng đúng prompt không
   - Kiểm tra false positives
4. 📝 Document learnings:
   - Edge cases mới
   - Accuracy improvements

---

## 11. Known limitations

1. **Không có UI để extract riêng từng file group:**
   - Hiện tại extraction chỉ hoạt động trong new-case.tsx
   - Có thể cần thêm button "Extract" trong FileUploadSection

2. **Merge logic chưa rõ:**
   - Nếu upload bệnh án 2 lần → overwrite hay merge?
   - Nếu có xung đột (VD: tuổi khác nhau) → ưu tiên file nào?

3. **Validation chưa có:**
   - Không validate xem user đã upload đủ 3 loại chưa
   - Không cảnh báo nếu thiếu creatinine khi analyze

---

**Date:** 2024-11-25  
**Author:** GitHub Copilot  
**Status:** ✅ Implementation Complete - Ready for Testing
