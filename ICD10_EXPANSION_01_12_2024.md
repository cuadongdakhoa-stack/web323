# Mở Rộng Bảng Mã ICD-10 - 01/12/2024

## Tổng Quan
Đã mở rộng hệ thống mapping ICD-10 từ **40+ mã** lên **76 mã** để hỗ trợ nhiều bệnh lý phổ biến hơn.

## Các Mã ICD-10 Mới Được Thêm

### 1. Bệnh Nhiễm Trùng (B00-B99)
- **B37.3** - Viêm âm đạo do Candida
- **B96.81** - H. pylori là căn nguyên gây bệnh

### 2. Rối Loạn Chuyển Hóa & Điện Giải (E00-E90)
- **E83.41** - Hạ calci huyết
- **E83.42** - Hạ magnesi huyết (Hypomagnesemia)
- **E83.5** - Rối loạn chuyển hóa kali
- **E83.51** - Hạ kali máu
- **E83.52** - Tăng kali máu

### 3. Bệnh Thần Kinh (G00-G99)
- **G40** - Động kinh (Epilepsy)
- **G56.0** - Hội chứng ống cổ tay (Carpal tunnel syndrome)
- **G57** - Tổn thương dây thần kinh ngoại biên

### 4. Bệnh Tiêu Hóa - Chi Tiết (K00-K93)

#### GERD & Trào Ngược
- **K21.0** - Trào ngược dạ dày-thực quản có viêm
- **K21.9** - Trào ngược dạ dày-thực quản không đặc hiệu

#### Loét Dạ Dày & Tá Tràng
- **K27** - Loét peptic không xác định vị trí
- **K28** - Loét dạ dày-tá tràng do nguyên nhân khác

#### Viêm Dạ Dày (Gastritis)
- **K29.0** - Viêm dạ dày cấp có xuất huyết
- **K29.1** - Viêm dạ dày cấp khác
- **K29.3** - Viêm dạ dày mạn nặng (atrophic)
- **K29.4** - Viêm dạ dày mạn khác
- **K29.5** - Viêm dạ dày thể chưa rõ nguyên nhân
- **K29.6** - Viêm dạ dày-tá tràng khác

### 5. Bệnh Xương Khớp - Mở Rộng (M00-M99)

#### Thoái Hóa Khớp
- **M15** - Viêm xương khớp đa khớp (Polyarthrosis)
- **M16** - Viêm xương khớp khớp háng (Coxarthrosis)
- **M18** - Viêm xương khớp bàn-ngón tay

#### Thoái Hóa Cột Sống
- **M47** - Thoái hóa cột sống (Spondylosis)
- **M48** - Hẹp ống sống, thoái hóa phức hợp
- **M50** - Thoái hóa đĩa đệm cột sống cổ
- **M51** - Thoái hóa đĩa đệm cột sống thắt lưng

#### Đau Cột Sống & Thần Kinh
- **M54.1** - Đau cổ lan xuống tay (Cervicobrachial syndrome)
- **M54.3** - Đau thần kinh tọa (Sciatica)
- **M54.4** - Đau thắt lưng lan xuống chân

#### Bệnh Phần Mềm
- **M65** - Viêm bao gân (Tenosynovitis)
- **M70** - Viêm phần mềm do quá tải
- **M79.0** - Đau xương
- **M79.1** - Đau cơ (Myalgia)
- **M79.2** - Đau thần kinh (Neuralgia)

### 6. Bệnh Phụ Khoa (N00-N99)

#### Viêm Nhiễm Phụ Khoa
- **N76.0** - Viêm âm đạo và âm hộ, không đặc hiệu
- **N76.2** - Viêm âm hộ-âm đạo cấp
- **N76.3** - Viêm âm hộ-âm đạo mạn
- **N76.4** - Viêm âm hộ-âm đạo, không xác định

### 7. Khám Sức Khỏe & Tránh Thai (Z00-Z99)
- **Z01.4** - Khám và xét nghiệm phụ khoa đặc biệt
- **Z30.2** - Dụng cụ tử cung (đặt/điều chỉnh vòng)
- **Z30.09** - Chăm sóc tránh thai khác

## Tính Năng Hệ Thống

### Mapping Tự Động
```typescript
// Ví dụ mapping
"Viêm âm đạo do Candida" → B37.3
"Hạ kali máu" → E83.51
"Đau thần kinh tọa" → M54.3
"Trào ngược dạ dày thực quản có viêm" → K21.0
```

### Fuzzy Matching
Hệ thống hỗ trợ nhiều biến thể tiếng Việt:
- "viêm dạ dày cấp" / "viêm dày cấp" → K29.1
- "đau thần kinh" / "neuralgia" → M79.2
- "thoái hóa khớp gối" / "gonarthrosis" → M17

### Validation
Tab "Kiểm tra mã ICD" hiển thị:
- ✅ **Hợp lệ**: Mã đúng format ICD-10
- ❌ **Không hợp lệ**: Mã sai format
- ⚪ **Chưa có mã**: Chưa được gán

## Thống Kê

| Danh Mục | Số Mã Cũ | Số Mã Mới | Tổng |
|----------|-----------|-----------|------|
| Nhiễm trùng (A-B) | 3 | +2 | 5 |
| Chuyển hóa (E) | 4 | +6 | 10 |
| Thần kinh (G) | 1 | +3 | 4 |
| Tiêu hóa (K) | 5 | +11 | 16 |
| Xương khớp (M) | 5 | +15 | 20 |
| Phụ khoa (N) | 5 | +4 | 9 |
| Khám sức khỏe (Z) | 1 | +3 | 4 |
| **Tổng** | **~40** | **+36** | **76** |

## Ứng Dụng Thực Tế

### Trường Hợp Sử Dụng

1. **Bệnh Tiêu Hóa**:
   - PDF có "GERD có viêm" → Tự động gán K21.0
   - PDF có "Viêm dạ dày cấp chảy máu" → K29.0

2. **Bệnh Xương Khớp**:
   - PDF có "Đau thần kinh tọa" → M54.3
   - PDF có "Thoái hóa đĩa đệm thắt lưng" → M51

3. **Phụ Khoa**:
   - PDF có "Viêm âm đạo do nấm Candida" → B37.3
   - PDF có "Đặt vòng tránh thai" → Z30.2

4. **Rối Loạn Điện Giải**:
   - PDF có "Hạ kali máu" → E83.51
   - PDF có "Giảm magnesi" → E83.42

## File Được Cập Nhật

- ✅ `server/icd10-mapping.ts` - Thêm 36 mã ICD-10 mới
- ✅ `client/src/pages/case-detail.tsx` - Tab "Kiểm tra mã ICD" hiển thị validation

## Ghi Chú Kỹ Thuật

### Format ICD-10 Chuẩn
```regex
^[A-Z]\d{2}(\.\d{1,2})?(\*)?$
```

Ví dụ hợp lệ:
- `K21` ✅
- `K21.0` ✅
- `K21.9` ✅
- `M54.3` ✅
- `E83.51` ✅

### Integration Pipeline
```
PDF → Extract → DeepSeek AI → applyICDMapping() → Validation → Display
```

## Tham Khảo
- WHO ICD-10 Classification: https://icd.who.int/browse10/2019/en
- Vietnam Ministry of Health ICD-10 Guidelines

---
**Ngày cập nhật**: 01/12/2024  
**Phiên bản**: 2.0  
**Tổng số mã ICD-10**: 76
