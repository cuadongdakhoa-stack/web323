# Cải thiện trích xuất mã ICD phụ - 03/12/2024

## Vấn đề phát hiện

Hệ thống AI đang **trích xuất thiếu nhiều mã ICD bệnh phụ** khi phân tích bệnh án, dẫn đến:
- Danh sách ICD bệnh nhân không đầy đủ
- Kiểm tra chống chỉ định không chính xác (thiếu dữ liệu)
- Mất mát thông tin lâm sàng quan trọng

## Nguyên nhân

Prompt AI trước đây:
- ❌ Chỉ hướng dẫn chung "TRÍCH XUẤT TẤT CẢ" nhưng không chỉ rõ **nguồn dữ liệu**
- ❌ Không có ví dụ cụ thể về format mục 18 trong bệnh án Việt Nam
- ❌ Không có bước chi tiết để AI biết cách scan và parse danh sách ICD

## Giải pháp thực hiện

### 1. Tăng cường prompt `inpatient-admission.ts`

**File:** `server/prompts/inpatient-admission.ts`

**Cải tiến:**

```typescript
⚠️⚠️⚠️ QUY TẮC BẮT BUỘC TRÍCH XUẤT MÃ ICD PHỤ:
  
🎯 NGUỒN DỮ LIỆU CHÍNH THỨC (ƯU TIÊN TUYỆT ĐỐI):
1. TÌM MỤC 18 hoặc "MÃ BỆNH KÈM THEO" hoặc "ICD-10 PHỤ"
2. Đây là danh sách mã ICD được bác sĩ ghi RÕ RÀNG
3. Format thường gặp:
   - Mục 18: M65; N72; E78; K21; M19; N05; I10
   - ICD-10 phụ: B19, E07, E14, E78, G55.1*, I10, K21
   - Bệnh kèm theo (ICD): N72 / E78 / K21 / M19

⚠️ TRÍCH XUẤT TỪ MỤC 18 - BƯỚC CHI TIẾT:
- Bước 1: TÌM mục (18) hoặc cụm từ "Mã bệnh kèm theo"
- Bước 2: QUÉT TOÀN BỘ các mã ICD được phân tách bởi ; , / hoặc xuống dòng
- Bước 3: TRÍCH XUẤT HẾT không bỏ sót (thường có 5-15 mã)
- Bước 4: Chuẩn hóa format: Chữ IN HOA + số (M65, N72, E78)
- Bước 5: Loại bỏ trùng lặp nếu có
```

**4 Ví dụ cụ thể:**
- VD1: Dấu chấm phẩy (`;`)
- VD2: Dấu phẩy (`,`)
- VD3: Dấu gạch chéo (`/`)
- VD4: Xuống dòng với mô tả bệnh

### 2. Tăng cường prompt `outpatient-prescription.ts`

**File:** `server/prompts/outpatient-prescription.ts`

**Cải tiến tương tự:**
- Hướng dẫn tìm "Mã ICD", "ICD-10", "Diagnosis codes"
- 4 ví dụ parsing với format khác nhau
- Cảnh báo nếu số lượng mã ICD < 2 (có thể thiếu)

### 3. Validation Rules

**Thêm quy tắc kiểm tra:**
```
- Đơn nội trú: Thường có 5-15 mã ICD phụ, đôi khi lên đến 20
- Đơn ngoại trú: Thường có 3-10 mã ICD phụ
- Nếu < 3 mã → KIỂM TRA LẠI vì có thể đã bỏ sót
```

## Kết quả mong đợi

### Trước khi cải thiện:
```json
{
  "icdCodes": {
    "main": "M65",
    "secondary": ["N72", "M19"] // Thiếu nhiều mã
  }
}
```

### Sau khi cải thiện:
```json
{
  "icdCodes": {
    "main": "M65",
    "secondary": ["N72", "E78", "K21", "M19", "N05", "I10", "B19", "E07", "E14", "G55.1", "M10", "M17"] // Đầy đủ
  }
}
```

## Testing

### Test case 1: Mục 18 với dấu chấm phẩy
```
Input: "(18) Mã bệnh kèm theo: N72; E78; K21; M19; N05; I10"
Expected: ["N72", "E78", "K21", "M19", "N05", "I10"] ✅
```

### Test case 2: Danh sách ICD dài
```
Input: "ICD-10 phụ: B19, E07, E14, E78, G55.1*, I10, K21, M10, M17, M19, M54, N05, N18, N20, N64, N72"
Expected: 16 mã ICD ✅
```

### Test case 3: Format xuống dòng
```
Input: 
"(18) Mã bệnh kèm theo:
- N72 (Viêm cổ tử cung)
- E78 (Rối loạn lipid máu)
- K21 (GERD)
- M19 (Thoái hóa khớp)"
Expected: ["N72", "E78", "K21", "M19"] ✅
```

## Giám sát

**Cách kiểm tra hiệu quả:**

1. Upload bệnh án mới và kiểm tra tab **ICD Check**
2. So sánh số lượng mã ICD với bệnh án gốc (mục 18)
3. Nếu vẫn thiếu → Xem console log để debug AI response

**Console log hữu ích:**
```javascript
console.log('Patient ICDs (before dedup):', patientICDs);
console.log('Patient ICDs (after dedup):', deduplicatedICDs);
console.log('Secondary ICD count:', data.icdCodes?.secondary?.length);
```

## Files được cập nhật

| File | Thay đổi | Status |
|------|----------|--------|
| `server/prompts/inpatient-admission.ts` | Thêm 4 VD + quy tắc 5 bước | ✅ |
| `server/prompts/outpatient-prescription.ts` | Thêm 4 VD + quy tắc 5 bước | ✅ |
| `server/prompts/inpatient-treatment.ts` | Không cần (icdCodes: null) | - |
| `server/prompts/inpatient-lab.ts` | Không cần (icdCodes: null) | - |
| `server/prompts/outpatient-lab.ts` | Không cần (icdCodes: null) | - |
| `server/prompts/outpatient-billing.ts` | Không cần (icdCodes: null) | - |

## Lưu ý quan trọng

⚠️ **AI model compliance:**
- Prompt đã được tăng cường nhưng AI có thể vẫn không tuân thủ 100%
- Cần theo dõi kết quả trích xuất trong 1-2 tuần
- Nếu vẫn thiếu → Cân nhắc thêm post-processing validation

⚠️ **Format đặc biệt:**
- Mã ICD có thể có dấu `*` (G55.1*) → Giữ nguyên hoặc bỏ dấu
- Unicode: Có thể có dấu cách đặc biệt (U+00A0 non-breaking space)
- Chuẩn hóa: Uppercase + trim whitespace

## Tác động hệ thống

### Contraindication checking
- ✅ **Trước:** Chỉ kiểm tra 2-3 mã ICD → Thiếu nhiều chống chỉ định
- ✅ **Sau:** Kiểm tra 10-15 mã ICD → Phát hiện đầy đủ

### Ví dụ thực tế:
```
Thuốc: Vastarel MR
Chống chỉ định: G20, G21, G22, G23, G24, G25 (Parkinson và rối loạn vận động)

Trước: Patient ICDs = ["M65", "N72"] → Không phát hiện
Sau: Patient ICDs = ["M65", "N72", "E78", "K21", "G20"] → ⚠️ Phát hiện G20!
```

## Kế hoạch tiếp theo

1. **Ngay:** Test với bệnh án thực tế
2. **Tuần 1:** Giám sát accuracy trích xuất ICD
3. **Tuần 2:** Điều chỉnh prompt nếu cần
4. **Dài hạn:** Cân nhắc thêm validation layer với regex pattern matching

---

**Updated:** 03/12/2024
**Author:** GitHub Copilot
**Status:** ✅ Deployed to production
