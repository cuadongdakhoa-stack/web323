-- Migration: Add comprehensive fields for better case management
-- Date: 2025-01-20

-- Add patient contact information
ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_phone TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_address TEXT;

-- Add clinical details
ALTER TABLE cases ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS admission_reason TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS prescribing_doctor TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS clinical_status TEXT;

-- Add metadata fields
ALTER TABLE cases ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'routine';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- Add comments
COMMENT ON COLUMN cases.patient_phone IS 'Patient contact phone number';
COMMENT ON COLUMN cases.patient_address IS 'Patient residential address';
COMMENT ON COLUMN cases.chief_complaint IS 'Main symptom or reason for visit/admission';
COMMENT ON COLUMN cases.admission_reason IS 'Detailed reason for inpatient admission';
COMMENT ON COLUMN cases.department IS 'Department or clinic name';
COMMENT ON COLUMN cases.prescribing_doctor IS 'Name of prescribing/attending physician';
COMMENT ON COLUMN cases.clinical_status IS 'Patient clinical status: stable, critical, moderate';
COMMENT ON COLUMN cases.priority_level IS 'Case priority: urgent, routine, follow-up';
COMMENT ON COLUMN cases.referral_source IS 'Source of referral: emergency, outpatient, transfer, etc.';
