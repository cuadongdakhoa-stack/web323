/**
 * Centralized Prompts for Medical Document Extraction
 * Optimized for DeepSeek V3.2-Exp with JSON mode
 * 
 * 6 PROMPTS - 6 LOẠI TÀI LIỆU:
 * 
 * NGOẠI TRÚ (OUTPATIENT):
 * 1. OUTPATIENT_PRESCRIPTION_PROMPT - Đơn thuốc ngoại trú
 * 2. OUTPATIENT_BILLING_PROMPT - Bảng kê chi phí BHYT/Tự túc
 * 3. OUTPATIENT_LAB_PROMPT - Kết quả xét nghiệm ngoại trú
 * 
 * NỘI TRÚ (INPATIENT):
 * 4. BENH_AN_PROMPT - Bệnh án / Hồ sơ vào viện
 * 5. TO_DIEU_TRI_PROMPT - Tờ điều trị / Y lệnh
 * 6. CAN_LAM_SANG_PROMPT - Kết quả cận lâm sàng
 */

export { OUTPATIENT_PRESCRIPTION_PROMPT } from './outpatient-prescription';
export { OUTPATIENT_BILLING_PROMPT } from './outpatient-billing';
export { OUTPATIENT_LAB_PROMPT } from './outpatient-lab';
export { BENH_AN_PROMPT } from './inpatient-admission';
export { TO_DIEU_TRI_PROMPT } from './inpatient-treatment';
export { CAN_LAM_SANG_PROMPT } from './inpatient-lab';
