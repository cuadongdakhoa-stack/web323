-- Add variable_dosing and self_supplied columns to medications table
ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS variable_dosing BOOLEAN DEFAULT false;

ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS self_supplied BOOLEAN DEFAULT false;
