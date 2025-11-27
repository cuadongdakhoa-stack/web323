-- Add caseType column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_type TEXT NOT NULL DEFAULT 'inpatient';

-- Add comment
COMMENT ON COLUMN cases.case_type IS 'Type of case: inpatient (nội trú) or outpatient (ngoại trú)';
