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
- **Case Management**: Allows creation (manual input or AI extraction from PDF/Word), viewing, updating, and deletion of patient cases. Supports attachment management with files categorized into Administrative, Paraclinical, and Prescription groups. Automatically calculates eGFR and renal function classification.
- **AI Analysis**: Performs clinical analysis, drug dose adjustments, and drug-drug/drug-disease interaction checks, with recommendations tailored to renal function.
- **Evidence Search**: Integrates Perplexity to find international guidelines, clinical research, and meta-analyses to support recommendations.
- **Consultation Report Generation**: Creates standardized, exportable PDF consultation reports with version history.
- **Case Library**: Provides filtering, searching, statistics, and trend analysis for past cases.
- **Chat AI Assistant**: A context-aware chatbot for clinical pharmacy questions.
- **Multi-file Upload**: Supports uploading up to 10 files (PDF, DOCX, JPG, PNG) per case, with duplicate prevention and partial failure handling.
- **Structured Diagnosis**: Integrates ICD-10 codes for main and secondary diagnoses, with AI extraction support.
- **Medication Timeline**: Tracks usage start/end dates for medications, enabling timeline-based drug interaction checks.

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
- **Fonts**: Google Fonts (Inter)