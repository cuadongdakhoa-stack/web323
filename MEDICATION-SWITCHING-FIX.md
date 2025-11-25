# Medication Switching Detection - Fix Documentation

## Vấn đề (Customer Feedback)

**Ca bệnh:** BÙI THỊ TÂM (Nội trú)

**Lỗi phát hiện:** 
AI báo tương tác giữa **Lovastatin** và **Atorvastatin** (statin-statin interaction), nhưng thực tế 2 thuốc này dùng **TUẦN TỰ** (sequential), không dùng đồng thời.

**Thực tế từ Tờ điều trị:**
- **Lovastatin DWP 10mg**: Ngày 23-27/10/2025 (tối 1 viên)
- **Atorvastatin TP 10mg**: Ngày 28/10-04/11/2025 (tối 2 viên)

→ Lovastatin **NGƯNG** ngày 27/10, Atorvastatin **BẮT ĐẦU** ngày 28/10 (medication switching)

## Root Cause Analysis

### 1. AI Date Parsing Issues
AI đọc sai hoặc không nhận diện được pattern:
- Lovastatin xuất hiện trang 1-7 của Tờ điều trị
- Atorvastatin xuất hiện từ trang 8+ (ngày 28/10)
- AI không nhận ra đây là **medication switch**, tưởng là dùng đồng thời

### 2. Thiếu Overlap Validation
Code cũ không có logic kiểm tra:
- Thời gian 2 thuốc có thực sự overlap không?
- Có phải medication switching (sequential) không?

### 3. False Positive Warnings
System báo lỗi tương tác thuốc cho cả trường hợp:
- Thuốc A: 01/01-03/01
- Thuốc B: 04/01-06/01
→ Không overlap nhưng vẫn báo lỗi

## Giải pháp triển khai

### 1. Enhanced AI Prompt (server/openrouter.ts)

**Thêm hướng dẫn medication switching:**

```typescript
VÍ DỤ NHẬN DIỆN NGÀY THÁNG:
6. ⚠️ MEDICATION SWITCHING (rất quan trọng):
   - "Ngày 23-27/10: Lovastatin 10mg (tối 1 viên). Ngày 28/10: Lovastatin NGƯNG, Atorvastatin 10mg BẮT ĐẦU"
     → Lovastatin: startDate: "2024-10-23", endDate: "2024-10-27"
     → Atorvastatin: startDate: "2024-10-28", endDate: null
   - CHÚ Ý: Nếu trong "Tờ điều trị" có nhiều trang:
     • Trang 1 (ngày 23/10): Lovastatin x1 viên
     • Trang 5 (ngày 28/10): KHÔNG CÓ Lovastatin, CHỈ CÓ Atorvastatin
     → ĐÂY LÀ SWITCHING! Lovastatin endDate = 27/10, Atorvastatin startDate = 28/10

❌ SAI: Lovastatin (23-27/10) và Atorvastatin (28/10-04/11) → Báo tương tác statin
✅ ĐÚNG: Lovastatin NGƯNG 27/10, Atorvastatin BẮT ĐẦU 28/10 → Sequential, KHÔNG tương tác
```

**Cập nhật quy tắc kiểm tra tương tác:**

```typescript
QUAN TRỌNG - QUY TẮC KIỂM TRA TƯƠNG TÁC THUỐC:
- ⚠️ ĐẶC BIỆT CHÚ Ý MEDICATION SWITCHING:
  • Nếu thuốc A kết thúc ngày X và thuốc B bắt đầu ngày X+1 → ĐÂY LÀ THAY THUỐC
  • Ví dụ: Lovastatin (23-27/10) NGƯNG, Atorvastatin (28/10-04/11) BẮT ĐẦU → KHÔNG tương tác
  • CHỈ BÁO TƯƠNG TÁC KHI 2 THUỐC DÙNG ĐỒNG THỜI (overlap thời gian)
```

### 2. Overlap Validation Logic (server/medicationTimeline.ts)

**Hàm kiểm tra overlap:**

```typescript
export function checkMedicationOverlap(med1: Medication, med2: Medication): boolean {
  if (!med1.usageStartDate || !med2.usageStartDate) {
    return false;
  }

  const start1 = new Date(med1.usageStartDate);
  const end1 = med1.usageEndDate ? new Date(med1.usageEndDate) : new Date();
  const start2 = new Date(med2.usageStartDate);
  const end2 = med2.usageEndDate ? new Date(med2.usageEndDate) : new Date();

  // Overlap if: start1 <= end2 AND start2 <= end1
  return start1 <= end2 && start2 <= end1;
}
```

**Hàm phát hiện medication switching:**

```typescript
export function detectMedicationSwitching(med1: Medication, med2: Medication): boolean {
  if (!med1.usageStartDate || !med1.usageEndDate || !med2.usageStartDate) {
    return false;
  }

  const end1 = new Date(med1.usageEndDate);
  const start2 = new Date(med2.usageStartDate);

  // Calculate day difference
  const dayDiff = Math.floor((start2.getTime() - end1.getTime()) / (1000 * 60 * 60 * 24));

  // Sequential if med2 starts 0-2 days after med1 ends
  return dayDiff >= 0 && dayDiff <= 2;
}
```

**Hàm validation tổng hợp:**

```typescript
export function validateDrugInteraction(
  med1: Medication, 
  med2: Medication, 
  interactionMessage: string
): { isValid: boolean; reason?: string } {
  // Check if medications actually overlap
  if (!checkMedicationOverlap(med1, med2)) {
    return {
      isValid: false,
      reason: `Thuốc ${med1.drugName} và ${med2.drugName} không dùng đồng thời (sequential use)`
    };
  }

  // Check if this is medication switching (same drug class, sequential)
  if (detectMedicationSwitching(med1, med2)) {
    const isSameDrugClass = 
      (med1.drugName.toLowerCase().includes('statin') && med2.drugName.toLowerCase().includes('statin')) ||
      // ... other drug classes

    if (isSameDrugClass) {
      return {
        isValid: false,
        reason: `Thuốc ${med1.drugName} được thay bằng ${med2.drugName} (medication switching)`
      };
    }
  }

  return { isValid: true };
}
```

### 3. Test Suite (scripts/test-medication-switching.ts)

**Test coverage:**

| Test Case | Thuốc 1 | Thuốc 2 | Overlap | Switching | Valid Interaction |
|-----------|---------|---------|---------|-----------|-------------------|
| Test 1 | Lovastatin (23-27/10) | Atorvastatin (28/10-04/11) | ❌ False | ✅ True | ❌ False (switching) |
| Test 2 | Aspirin (23/10-04/11) | Plavix (25/10-01/11) | ✅ True | ❌ False | ✅ True (real overlap) |
| Test 3 | Ceftazidime (27/10-03/11) | Ceftriaxone (04-10/11) | ❌ False | ✅ True | ❌ False (switching) |
| Test 4 | Lovastatin (23-30/10) | Atorvastatin (28/10-04/11) | ✅ True | ❌ False | ✅ True (hypothetical) |

**Test results:** ✅ ALL PASSED

## Impact & Benefits

### Before Fix
```
❌ Lovastatin (23-27/10) + Atorvastatin (28/10+)
   → Báo lỗi: "Statin-statin interaction - Increased risk of myopathy"
   → FALSE POSITIVE
```

### After Fix
```
✅ Lovastatin (23-27/10) + Atorvastatin (28/10+)
   → Detected: Medication switching (sequential use)
   → No interaction warning
   → ACCURATE
```

### Customer Impact
- ✅ Giảm false positive warnings
- ✅ Cải thiện độ chính xác phân tích
- ✅ Nhận diện đúng medication switching pattern
- ✅ Hỗ trợ clinical decision making tốt hơn

## Edge Cases Handled

1. **Gap trong switching:** 0-2 ngày được chấp nhận
   - Lovastatin end 27/10 → Atorvastatin start 28/10 (gap 1 day) ✅
   - Lovastatin end 27/10 → Atorvastatin start 30/10 (gap 3 days) ❌ (not switching)

2. **Same drug class detection:**
   - Statins: Lovastatin, Atorvastatin, Simvastatin, Rosuvastatin
   - Azoles: Fluconazole, Itraconazole, Voriconazole
   - Similar names: Ceftazidime, Ceftriaxone (heuristic)

3. **Real overlap vs switching:**
   - Lovastatin (23-30/10) + Atorvastatin (28/10+) → Real overlap ⚠️
   - Lovastatin (23-27/10) + Atorvastatin (28/10+) → Switching ✅

## Deployment Notes

**Files changed:**
- `server/openrouter.ts` - Enhanced prompts
- `server/medicationTimeline.ts` - Validation functions
- `scripts/test-medication-switching.ts` - Test suite

**Git commits:**
- `082f42c` - feat: Improve medication switching detection
- `c811cb4` - test: Add test suite

**Testing:**
```bash
npx tsx scripts/test-medication-switching.ts
# All tests PASSED ✅
```

## Future Enhancements

1. **Machine learning:** Train model to detect medication patterns
2. **Drug database:** Expand same-drug-class detection với comprehensive drug taxonomy
3. **Timeline visualization:** Show medication timeline graph trong UI
4. **Automatic switching notes:** Generate clinical notes cho medication changes

## References

- Customer feedback: BÙI THỊ TÂM case analysis
- Medical guideline: KDIGO, AHA medication management
- Code review: Medication timeline algorithm optimization
