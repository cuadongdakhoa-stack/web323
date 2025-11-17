# Cửa Đông Care+ Pharma

## Overview

Cửa Đông Care+ Pharma is a comprehensive web application designed to assist pharmacists and doctors in clinical pharmacy tasks within hospitals. The system leverages AI (DeepSeek and Perplexity) to analyze patient cases, check drug interactions, retrieve medical evidence, and generate standardized consultation reports. The project aims to enhance the efficiency and accuracy of clinical pharmacy practices in Vietnamese hospitals, ultimately improving patient care. Key capabilities include patient case management, AI-driven clinical analysis, evidence-based medicine search, and automated report generation.

## User Preferences

- I prefer simple language and clear explanations.
- I like functional programming paradigms.
- I want an iterative development approach with frequent updates.
- Please ask for my approval before implementing major architectural changes or feature removals.
- I prefer detailed explanations for complex logic or design decisions.
- Do not make changes to the `shared/` folder without explicit instruction.
- Do not make changes to the `design_guidelines.md` file.

## System Architecture

The application follows a client-server architecture.

### UI/UX Decisions
- **Design System**: Incorporates principles from Carbon Design System and Ant Design.
- **Color Scheme**: Uses a "Medical Blue Theme" with `hsl(203 85% 42%)` as the primary color, `hsl(210 5% 98%)` for backgrounds, and neutral tones for muted elements.
- **Typography**: Uses the Inter font from Google Fonts, with various sizes and weights.
- **Components**: Features elevated, rounded cards, medical blue primary buttons, sticky-header tables, and clear form elements.
- **Layout**: Fixed 20rem sidebar, max content width of 1280px (7xl), and mobile-first responsiveness.

### Technical Implementations
- **Frontend**: Built with React 18 and TypeScript, using Wouter for routing, TanStack Query for state management, Shadcn/ui + Radix UI for components, and Tailwind CSS for styling.
- **Backend**: Developed with Node.js and Express.js.
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Authentication**: Implemented using Passport.js with `express-session` and `connect-pg-simple` for session storage.
- **AI Integration**: Leverages OpenRouter API to orchestrate calls to DeepSeek Chat for clinical analysis and Perplexity Sonar Pro for medical evidence search.
- **AI Verification Pipeline**: A 3-step process: initial analysis by DeepSeek, evidence search by Perplexity, and final refinement by DeepSeek for accuracy.
- **Data Encoding**: UTF-8 charset is used for proper handling of Vietnamese characters across the system.
- **Security**: Includes password hashing (bcrypt), session-based authentication, CSRF protection, and SQL injection prevention via Drizzle ORM.
- **Performance**: Utilizes React Query caching, database indexing, lazy loading, and optimistic UI updates.

### Feature Specifications
- **Case Management**: Allows creation (manual input or AI extraction from PDF/Word), viewing, updating, and deletion of patient cases. Supports attachment management with files categorized into Administrative, Paraclinical, and Prescription groups.
- **eGFR Auto-Calculation**: Automatically calculates estimated Glomerular Filtration Rate (eGFR) using the CKD-EPI 2021 formula (without race factor) when serum creatinine, age, and gender are provided. Classifies renal function into G1-G5 categories with Vietnamese descriptions. Formula: For males (SCr ≤0.9: 141×(SCr/0.9)^-0.411×0.993^age; SCr>0.9: 141×(SCr/0.9)^-1.209×0.993^age) and females (SCr≤0.7: 144×(SCr/0.7)^-0.329×0.993^age; SCr>0.7: 144×(SCr/0.7)^-1.209×0.993^age). Results include eGFR value (mL/min/1.73m²), category (G1-G5), and Vietnamese renal function description.
- **AI Analysis**: Performs clinical analysis, drug dose adjustments, and drug-drug/drug-disease interaction checks, with recommendations tailored to renal function. **Timeout: 300 seconds (5 minutes)** to handle complex cases with 30+ medications.
- **Evidence Search**: Integrates Perplexity to find international guidelines, clinical research, and meta-analyses to support recommendations. **Auto-triggered during AI analysis** (synchronous execution before response) to ensure completion in production/serverless environments. Frontend automatically refetches evidence immediately after analysis completes.
- **Consultation Report Generation**: Creates standardized consultation reports with version history. **Export formats: PDF and DOCX** with embedded Noto Sans Vietnamese font for proper diacritic rendering. Files named: `phieu-tu-van-{patient-name}-{date}.{ext}`.
- **Case Library**: Provides filtering, searching, statistics, and trend analysis for past cases.
- **Chat AI Assistant**: A context-aware chatbot for clinical pharmacy questions.
- **Multi-file Upload & AI Extraction**: Supports uploading up to 10 files (PDF, DOCX, JPG, PNG) per case, with duplicate prevention and partial failure handling. **Intelligent data merging**: Extracts patient demographics (name, age, gender, weight, height, admission date), clinical data (creatinine + unit, diagnoses with ICD-10, medical history, allergies), and medications from each file, then merges using smart priority logic (new non-null values override previous values). **Batch processing**: Handles multiple files sequentially, accumulates extracted data, and applies comprehensive field mapping including `labResults.creatinine`, `labResults.creatinineUnit`, and `admissionDate`.
- **Structured Diagnosis**: Integrates ICD-10 codes for main and secondary diagnoses, with AI extraction support.
- **Medication Timeline**: Tracks usage start/end dates for medications, enabling **timeline-based drug interaction checks**. Implementation uses sweep-line algorithm (`server/medicationTimeline.ts`) to group medications by overlapping date ranges, ensuring AI only checks interactions between drugs used simultaneously. **Key features**: (1) Start date required for new medications to ensure data quality, (2) Backward-compatible handling of legacy medications without dates via conservative fallback strategies, (3) Three-case fallback logic: catch-all segment for mixed/undated medications, warning segments for undated entries, and general interaction review for sequential non-overlapping medications. This prevents false-negative interaction alerts while respecting actual medication timelines during hospital stays with changing regimens.
- **Drug Formulary Management**: Hospital-specific drug database with trade names, active ingredients, strengths, units, and manufacturers. **Admin-only upload** via Excel/CSV (supports both Vietnamese and English column headers). **Features**: (1) Case-insensitive search (`ilike`) for Vietnamese drug names, (2) AI integration: formulary data automatically enriches medication context in clinical analysis prompts, (3) Row-level validation with Zod schema prevents data corruption, (4) Nullish coalescing preserves zero-strength values during import, (5) Read access for all authenticated users, write access restricted to admin role. Implementation in `server/storage.ts`, `server/routes.ts`, and `client/src/pages/drug-formulary.tsx`.

## External Dependencies

- **Database**: PostgreSQL (specifically Neon for deployment)
- **AI Services (via OpenRouter API)**:
    - DeepSeek Chat (`deepseek/deepseek-chat`)
    - Perplexity Sonar Pro (`perplexity/sonar-pro`)
- **Frontend Libraries**:
    - React 18
    - TypeScript
    - Wouter
    - TanStack Query (React Query v5)
    - Shadcn/ui
    - Radix UI
    - Tailwind CSS
    - Lucide React (Icons)
- **Backend Libraries**:
    - Node.js
    - Express.js
    - Drizzle ORM
    - Passport.js
    - express-session
    - connect-pg-simple
    - bcrypt (for password hashing)
    - Zod (for validation)
    - PDFKit (PDF generation with Vietnamese font support)
    - docx (DOCX generation)
    - xlsx (Excel/CSV parsing for drug formulary import)
- **Fonts**: 
    - Google Fonts (Inter) - UI typography
    - Noto Sans (Regular + Bold TTF) - Vietnamese PDF export support