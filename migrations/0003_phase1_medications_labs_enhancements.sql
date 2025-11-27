-- Migration: Phase 1 - Medications & Labs Enhancements
-- Date: 2025-01-20

-- ===== MEDICATIONS TABLE ENHANCEMENTS =====

-- Add form field (viên, gói, ống, bình xịt, dung dịch)
ALTER TABLE medications ADD COLUMN IF NOT EXISTS form TEXT;

-- Add parsed dose information
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dose_per_admin REAL;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS frequency_per_day INTEGER;

-- Add admin times (JSONB array for inpatient schedules: ["08:00", "14:00", "20:00"])
ALTER TABLE medications ADD COLUMN IF NOT EXISTS admin_times JSONB;

-- Add medication status (ACTIVE, STOPPED, CHANGED)
ALTER TABLE medications ADD COLUMN IF NOT EXISTS medication_status TEXT;

-- Add order sheet number (Số tờ điều trị for inpatient)
ALTER TABLE medications ADD COLUMN IF NOT EXISTS order_sheet_number TEXT;

COMMENT ON COLUMN medications.form IS 'Dạng thuốc: viên, gói, ống, bình xịt, dung dịch';
COMMENT ON COLUMN medications.dose_per_admin IS 'Số lượng mỗi lần dùng (parsed from prescribedDose)';
COMMENT ON COLUMN medications.frequency_per_day IS 'Số lần dùng mỗi ngày (parsed from prescribedFrequency)';
COMMENT ON COLUMN medications.admin_times IS 'Giờ uống thuốc cụ thể (inpatient): ["08:00", "14:00", "20:00"]';
COMMENT ON COLUMN medications.medication_status IS 'Trạng thái: ACTIVE, STOPPED, CHANGED';
COMMENT ON COLUMN medications.order_sheet_number IS 'Số tờ điều trị (cho nội trú)';

-- ===== CASES TABLE - LABS EXPANSION =====

-- Add labs array field (new comprehensive lab results)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS labs JSONB;

COMMENT ON COLUMN cases.labs IS 'Array of lab test results: [{ test_group, test_name, result_value, unit, reference_range, abnormal_flag, collected_at }]';
COMMENT ON COLUMN cases.lab_results IS 'Legacy field (single creatinine object), kept for backward compatibility';

-- Note: lab_results is kept for backward compatibility
-- New extractions should populate both lab_results (for creatinine) and labs (for all tests)
