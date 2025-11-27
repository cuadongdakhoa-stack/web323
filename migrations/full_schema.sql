-- FULL NEON SCHEMA FOR CAREPHARMA

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Cases
CREATE TABLE IF NOT EXISTS cases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  patient_name TEXT NOT NULL,
  patient_age INTEGER NOT NULL,
  patient_gender TEXT NOT NULL,
  patient_weight REAL,
  patient_height REAL,
  admission_date TIMESTAMP NOT NULL,
  diagnosis TEXT NOT NULL,
  diagnosis_main TEXT,
  diagnosis_secondary TEXT[],
  icd_codes JSONB,
  medical_history TEXT,
  allergies TEXT,
  lab_results JSONB,
  creatinine REAL,
  creatinine_unit TEXT DEFAULT 'mg/dL',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Medications
CREATE TABLE IF NOT EXISTS medications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  active_ingredient TEXT,
  strength TEXT,
  unit TEXT,
  prescribed_dose TEXT NOT NULL,
  prescribed_frequency TEXT NOT NULL,
  prescribed_route TEXT NOT NULL,
  indication TEXT,
  usage_start_date TIMESTAMP,
  usage_end_date TIMESTAMP,
  order_index INTEGER DEFAULT 0,
  variable_dosing BOOLEAN DEFAULT FALSE,
  self_supplied BOOLEAN DEFAULT FALSE,
  adjusted_dose TEXT,
  adjusted_frequency TEXT,
  adjusted_route TEXT,
  adjustment_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Analyses
CREATE TABLE IF NOT EXISTS analyses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Uploaded Files
CREATE TABLE IF NOT EXISTS uploaded_files (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_group TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by VARCHAR NOT NULL REFERENCES users(id),
  extracted_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Drug Formulary
CREATE TABLE IF NOT EXISTS drug_formulary (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_code TEXT,
  trade_name TEXT NOT NULL,
  active_ingredient TEXT NOT NULL,
  strength TEXT NOT NULL,
  unit TEXT NOT NULL,
  manufacturer TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Evidence
CREATE TABLE IF NOT EXISTS evidence (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR REFERENCES cases(id) ON DELETE CASCADE,
  analysis_id VARCHAR REFERENCES analyses(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  summary TEXT NOT NULL,
  relevance_score REAL,
  citation_count INTEGER,
  publication_year INTEGER,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Consultation Reports
CREATE TABLE IF NOT EXISTS consultation_reports (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  report_content JSONB NOT NULL,
  generated_by VARCHAR NOT NULL REFERENCES users(id),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  case_id VARCHAR REFERENCES cases(id),
  created_at TIMESTAMP DEFAULT NOW()
);
