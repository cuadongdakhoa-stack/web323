-- Add icd_patterns column to drug_formulary table for BHYT checking
-- This column stores JSON array of ICD patterns (e.g., ["K21.x", "K25.0", "M10.x"])

ALTER TABLE drug_formulary 
ADD COLUMN IF NOT EXISTS icd_patterns TEXT;

COMMENT ON COLUMN drug_formulary.icd_patterns IS 'JSON array of ICD-10 patterns allowed by BHYT for this drug (e.g., ["K21.x", "K29.0", "B96.81"])';
