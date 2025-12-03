# Hướng dẫn trích xuất mã ICD từ Bảng kê - 03/12/2024

## Vấn đề

Trước đây, hệ thống **chỉ trích xuất mã ICD từ đơn thuốc** (prescription), không trích xuất từ **bảng kê** (billing/invoice). Điều này dẫn đến:

- ❌ Thiếu dữ liệu ICD khi chỉ upload bảng kê
- ❌ Không thể kiểm tra chống chỉ định chính xác
- ❌ Phải upload cả đơn thuốc lẫn bảng kê để có đủ thông tin

## Giải pháp

✅ **Đã cập nhật prompt `outpatient-billing.ts`** để trích xuất đầy đủ:
- Mục 16: Mã bệnh chính
- Mục 18: Mã bệnh kèm theo (secondary ICDs)

## Cấu trúc bảng kê

### Ví dụ thực tế (Bệnh nhân Bạch Thị Huyền):

```
(16) Mã bệnh: M65

(18) Mã bệnh kèm theo:
B19;E07;E14;E78;G55.1*;K21;M10;
M19;N05;N20;N64;N72
```

### Kết quả trích xuất mong đợi:

```json
{
  "diagnosisMain": "Viêm bao hoạt dịch",
  "diagnosisSecondary": ["Viêm gan virus", "Rối loạn tuyến giáp", ...],
  "icdCodes": {
    "main": "M65",
    "secondary": ["B19", "E07", "E14", "E78", "G55.1", "K21", "M10", "M19", "N05", "N20", "N64", "N72"]
  }
}
```

## Quy trình trích xuất

### 1. Upload file bảng kê

**Đường dẫn:** `C:\Users\TIEN DUNG\Documents\CarePharmaWeb\KHOA DƯỢC - SẢN PHẨM DỰ THI\ĐƠN NGOẠI TRÚ\BẠCH THỊ HUYỀN\Bảng kê.pdf`

**Trong giao diện:**
1. Mở case bệnh nhân
2. Tab "Cận lâm sàng" → Upload file
3. Chọn loại: **"Billing/Bảng kê"** (quan trọng!)
4. Upload file PDF

### 2. Hệ thống xử lý

```
1. Phát hiện fileGroup = "billing"
   ↓
2. Sử dụng OUTPATIENT_BILLING_PROMPT
   ↓
3. AI quét mục 16, 18
   ↓
4. Trích xuất: main ICD + secondary ICDs
   ↓
5. Parse format: B19;E07;E14;... → ["B19", "E07", "E14", ...]
   ↓
6. Loại bỏ dấu * (G55.1* → G55.1)
   ↓
7. Lưu vào database
```

### 3. Kiểm tra kết quả

**Tab "ICD Check":**
- Hiển thị tất cả mã ICD từ bệnh nhân
- So sánh với danh sách chỉ định/chống chỉ định của từng thuốc
- Badge màu:
  - 🔴 Đỏ: Có ICD chống chỉ định
  - 🟢 Xanh: Không phát hiện chống chỉ định
  - ⚪ Xám: Chưa cấu hình

## Format mục 18 được hỗ trợ

### Format 1: Dấu chấm phẩy (`;`)
```
(18) Mã bệnh kèm theo:
B19;E07;E14;E78;G55.1*;K21;M10;M19;N05;N20;N64;N72
```

### Format 2: Dấu phẩy (`,`)
```
(18) Mã bệnh kèm theo:
B19, E07, E14, E78, G55.1*, K21, M10, M19
```

### Format 3: Dấu gạch chéo (`/`)
```
(18) Bệnh kèm theo (ICD): N72 / E78 / K21 / M19
```

### Format 4: Xuống dòng
```
(18) Mã bệnh kèm theo:
- B19 (Viêm gan virus)
- E78 (Rối loạn lipid máu)
- K21 (GERD)
```

### Format 5: Xuống nhiều dòng (như ảnh bạn gửi)
```
(18) Mã bệnh kèm theo:
B19;E07;E14;E78;G55.1*;K21;M10;
M19;N05;N20;N64;N72
```

**AI sẽ tự động:**
- Quét tất cả dòng sau mục 18
- Tách mã ICD theo `;` `,` `/` hoặc xuống dòng
- Loại bỏ dấu `*`
- Chuẩn hóa uppercase

## Lưu ý quan trọng

### ⚠️ Phải chọn đúng loại file

Khi upload, **BẮT BUỘC** chọn:
- ✅ **Billing/Bảng kê** → Dùng OUTPATIENT_BILLING_PROMPT (có trích xuất ICD)
- ❌ Lab/Cận lâm sàng → Không trích xuất ICD

### ⚠️ Số lượng mã ICD

**Bình thường:**
- Đơn ngoại trú: 5-15 mã ICD
- Đơn nội trú: 10-20 mã ICD

**Cảnh báo:**
- Nếu < 3 mã → Có thể thiếu, kiểm tra lại
- Nếu = 0 mã → Bảng kê không có mục 18 hoặc AI không parse được

### ⚠️ Xử lý dấu `*`

Một số mã ICD có dấu sao (ví dụ: `G55.1*`):
- AI sẽ tự động loại bỏ → `G55.1`
- Không ảnh hưởng kiểm tra chống chỉ định

## Test case thực tế

### Bệnh nhân: BẠCH THỊ HUYỀN

**Input (từ Bảng kê.pdf):**
```
(16) Mã bệnh: M65
(18) Mã bệnh kèm theo: B19;E07;E14;E78;G55.1*;K21;M10;M19;N05;N20;N64;N72
```

**Expected output:**
```json
{
  "icdCodes": {
    "main": "M65",
    "secondary": ["B19", "E07", "E14", "E78", "G55.1", "K21", "M10", "M19", "N05", "N20", "N64", "N72"]
  }
}
```

**Count:** 12 mã ICD phụ ✅

### Kiểm tra contraindication

**Thuốc: Curam 1000mg**
- Chống chỉ định: N00–N99
- Patient ICDs: ["M65", "B19", "E07", ..., "N72", "N05", "N20", "N64"]
- Kết quả: ⚠️ **Phát hiện N72, N05, N20, N64** (4 mã trong vùng N00-N99)

## Debugging

Nếu không trích xuất được ICD, kiểm tra:

### 1. Console log server
```bash
[Extract] Processing 1 files with fileGroup: billing, caseType: outpatient
[DeepSeek V3.2-Exp] Response in 5000ms
[Medication Count] Extracted X medications
```

Xem `fileGroup` có đúng là `billing` không?

### 2. Response JSON
```javascript
console.log('Extracted data:', JSON.stringify(data, null, 2));
```

Kiểm tra `data.icdCodes.secondary` có bao nhiêu phần tử?

### 3. Prompt được sử dụng
```javascript
console.log('Using prompt:', userPromptTemplate.substring(0, 200));
```

Đảm bảo đang dùng `OUTPATIENT_BILLING_PROMPT`

## Tích hợp với workflow hiện tại

### Trước đây:
```
Upload đơn thuốc → Trích xuất thuốc + ICD
Upload bảng kê → CHỈ trích xuất thuốc (không có ICD)
```

### Bây giờ:
```
Upload đơn thuốc → Trích xuất thuốc + ICD
Upload bảng kê → Trích xuất thuốc + ICD + giá tiền
```

### Best practice:
1. **Upload cả 2 file** (đơn thuốc + bảng kê):
   - Đơn thuốc: Liều dùng, tần suất chi tiết
   - Bảng kê: Số lượng chính xác, giá tiền, ICD đầy đủ

2. **Chỉ upload bảng kê** (nếu không có đơn):
   - Vẫn có đủ ICD để kiểm tra chống chỉ định ✅
   - Thiếu thông tin liều dùng chi tiết

## Files đã cập nhật

| File | Thay đổi | Status |
|------|----------|--------|
| `server/prompts/outpatient-billing.ts` | Thêm section trích xuất ICD | ✅ |
| `server/openrouter.ts` | Đã có logic billing (line 1165) | ✅ |
| `server/routes.ts` | Deduplication đã có | ✅ |

Không cần thay đổi thêm code nào, chỉ cần restart server.

## Kế hoạch tiếp theo

1. ✅ **Đã xong:** Cập nhật prompt billing
2. 🔄 **Test thực tế:** Upload bảng kê của bệnh nhân Huyền
3. 📊 **Giám sát:** Theo dõi accuracy trích xuất ICD từ billing
4. 🔧 **Điều chỉnh:** Nếu AI thiếu mã ICD, tăng cường prompt

---

**Updated:** 03/12/2024  
**Status:** ✅ Ready for testing  
**Server:** Đang chạy trên localhost:5000
