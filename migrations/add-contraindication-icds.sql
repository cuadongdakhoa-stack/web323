-- Add contraindication_icds column to drug_formulary table
-- This stores ICD codes that are contraindications for the drug

ALTER TABLE drug_formulary 
ADD COLUMN IF NOT EXISTS contraindication_icds TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN drug_formulary.contraindication_icds IS 'Comma-separated list of ICD patterns that are contraindications for this drug (e.g., K50.x,K51.x,J45.x)';
