import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import { storage } from "./storage";
import { db } from "./db";
import passport from "passport";
import { requireAuth, requireRole } from "./auth";
import { 
  insertCaseSchema, 
  insertMedicationSchema,
  insertAnalysisSchema,
  insertEvidenceSchema,
  insertChatMessageSchema,
  insertConsultationReportSchema,
  insertUploadedFileSchema,
  insertDrugFormularySchema,
  insertReferenceDocumentSchema,
  reportContentSchema,
  analysisResultSchema,
  cases,
  medications,
  analyses,
  evidence,
  uploadedFiles,
  drugFormulary,
  type Medication,
  type MedicationWithStatus,
  type DrugFormulary
} from "@shared/schema";
import { eq, or, ilike, and, gte, lte, inArray, sql } from "drizzle-orm";
import { 
  analyzePatientCase,
  searchMedicalEvidence,
  generateConsultationForm,
  chatWithAI,
  extractDataFromDocument,
  verifyWithPipeline,
  suggestDocuments,
  extractDrugDataFromFile
} from "./openrouter";
import { generatePDF, generateDOCX } from "./reportExport";
import { calculateEGFR, extractCreatinine } from "./egfrCalculator";
import { calculateMedicationDuration, calculateMedicationStatus } from "./medicationDuration";
import { mapDiagnosisToICD, mapDiagnosesArrayToICD } from "./icd10-mapping";
import { isDrugCoveredByICD, checkContraindication, parseICDPatterns, buildIcdSummaryText, deduplicateICDs, type ICDCode, type CheckedPrescriptionItem } from "./icdChecker";
import multer from "multer";
import mammoth from "mammoth";
import officeParser from "officeparser";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory cache for drug formulary (performance optimization)
let drugFormularyCache: { data: DrugFormulary[] | null, timestamp: number } = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateDrugFormularyCache() {
  drugFormularyCache.data = null;
  drugFormularyCache.timestamp = 0;
}

// Parse strength/unit from prescribedDose (e.g., "500mg" → { strength: "500", unit: "mg" })
function parseStrengthUnit(dose: string): { strength?: string; unit?: string } {
  if (!dose) return {};
  const match = dose.match(/(\d+\.?\d*)\s*([a-zA-Zμ/]+)/);
  if (match) {
    return { strength: match[1], unit: match[2] };
  }
  return {};
}

type MedicationStatus = "active" | "stopped" | "unknown";

function getTodayInVietnam(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

function extractDateString(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  
  try {
    if (typeof input === 'string') {
      const match = input.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : null;
    } else {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(input);
      const year = parts.find(p => p.type === 'year')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      return `${year}-${month}-${day}`;
    }
  } catch {
    return null;
  }
}

function computeMedicationStatus(medication: Medication): MedicationStatus {
  const startDateStr = extractDateString(medication.usageStartDate);
  const endDateStr = extractDateString(medication.usageEndDate);
  
  if (!startDateStr) return "unknown";
  
  const todayStr = getTodayInVietnam();
  
  if (startDateStr > todayStr) {
    return "unknown";
  }
  
  if (!endDateStr) {
    return "active";
  }
  
  return endDateStr >= todayStr ? "active" : "stopped";
}

export async function registerRoutes(app: Express): Promise<Server> {
    // Batch insert medications for a case
    app.post("/api/medications/batch", requireAuth, async (req, res) => {
      try {
        const { caseId, medications } = req.body;
        console.log("[Medications Batch] Payload:", JSON.stringify(req.body, null, 2));
        if (!caseId || !Array.isArray(medications) || medications.length === 0) {
          console.error("[Medications Batch] Thiếu caseId hoặc danh sách thuốc", req.body);
          return res.status(400).json({ message: "Thiếu caseId hoặc danh sách thuốc", payload: req.body });
        }
        // Validate & enrich all medications
        // Lọc bỏ phần tử undefined hoặc thiếu drugName
        const validMeds = Array.isArray(medications)
          ? medications.filter(med => med && med.drugName)
          : [];
        if (validMeds.length === 0) {
          console.error("[Medications Batch] Không có thuốc hợp lệ để lưu", medications);
          return res.status(400).json({ message: "Không có thuốc hợp lệ để lưu", medications });
        }
        try {
          // Parse và validate từng medication để transform date strings
          const validatedMeds = validMeds.map(med => {
            const parsed = insertMedicationSchema.parse({ ...med, caseId });
            return parsed;
          });
          const enrichedMeds = await enrichMedicationsWithActiveIngredients(validatedMeds);
          // Lưu hàng loạt
          const savedMeds = await storage.createMedicationsBatch(enrichedMeds);
          res.status(201).json(savedMeds);
        } catch (validateError) {
          console.error("[Medications Batch] Validate error:", validateError);
          return res.status(400).json({ message: "Lỗi validate khi lưu thuốc", error: validateError, medications: validMeds });
        }
      } catch (error) {
        console.error("[Medications Batch] Unknown error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(400).json({ message: errorMessage, error });
      }
    });
  const require = createRequire(import.meta.url);
  
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Đăng nhập thất bại" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ user });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Đăng xuất thất bại" });
      }
      res.json({ message: "Đăng xuất thành công" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Chưa đăng nhập" });
    }
  });

  app.get("/api/admin/seed-users", async (req, res) => {
    try {
      const FIXED_USERS = [
        { username: "admin_cd", password: "admin123", fullName: "Quản trị viên Cửa Đông", role: "admin", department: "Quản lý hệ thống" },
        { username: "duoc1", password: "duoc123", fullName: "Dược sĩ Nguyễn Văn A", role: "pharmacist", department: "Khoa Dược" },
        { username: "duoc2", password: "duoc123", fullName: "Dược sĩ Trần Thị B", role: "pharmacist", department: "Khoa Dược" },
        { username: "bsnoi", password: "bsnoi123", fullName: "Bác sĩ Lê Văn C", role: "doctor", department: "Khoa Nội" },
        { username: "bsicu", password: "bsicu123", fullName: "Bác sĩ Phạm Thị D", role: "doctor", department: "Khoa Hồi sức cấp cứu" }
      ];

      const results = [];
      for (const userData of FIXED_USERS) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (!existingUser) {
          await storage.createUser(userData);
          results.push({ username: userData.username, status: "created" });
        } else {
          results.push({ username: userData.username, status: "already_exists" });
        }
      }

      res.json({ 
        message: "Seed users completed", 
        results 
      });
    } catch (error: any) {
      console.error("Error seeding users:", error);
      res.status(500).json({ message: "Failed to seed users", error: error.message });
    }
  });

  // Helper function: Enrich medications with active ingredients from drug formulary
  async function enrichMedicationsWithActiveIngredients(medications: any[]): Promise<any[]> {
    if (!medications || medications.length === 0) return medications;

    const enrichedMedications = await Promise.all(medications.map(async (med) => {
      // Skip if already has activeIngredient
      if (med.activeIngredient && med.activeIngredient.trim() !== '') {
        return med;
      }

      // Try to find drug in formulary by drugName (case-insensitive, fuzzy match)
      try {
        const drugName = med.drugName || med.tradeName || med.name || '';
        if (!drugName.trim()) return med;

        // Clean drug name: remove dosage, route, etc.
        const cleanName = drugName
          .replace(/\s+\d+\s*(mg|g|ml|mcg|µg|IU|%)\b.*/i, '') // Remove "500mg", "10ml", etc.
          .replace(/\s+(viên|ống|chai|lọ|túi|gói)\b.*/i, '') // Remove unit
          .replace(/\s+(uống|tiêm|bôi|nhỏ)\b.*/i, '') // Remove route
          .trim();

        if (!cleanName) return med;

        // Search in database (fuzzy match with ILIKE)
        try {
          const foundDrugs = await db
            .select()
            .from(drugFormulary)
            .where(
              or(
                ilike(drugFormulary.tradeName, `%${cleanName}%`),
                ilike(drugFormulary.tradeName, cleanName)
              )
            )
            .limit(1);

          if (foundDrugs.length > 0) {
            console.log(`[Enrichment] Found active ingredient for "${drugName}": ${foundDrugs[0].activeIngredient}`);
            return {
              ...med,
              activeIngredient: foundDrugs[0].activeIngredient,
              // Also update strength and unit if missing
              strength: med.strength || foundDrugs[0].strength,
              unit: med.unit || foundDrugs[0].unit,
            };
          }
        } catch (dbError: any) {
          // If the database schema is out-of-sync (missing columns), attempt a safer raw query
          console.error(`[Enrichment DB Error] Primary lookup failed for "${drugName}":`, dbError?.message || dbError);
          if (dbError && (dbError.code === '42703' || (dbError.message && dbError.message.includes('does not exist')))) {
            try {
              const raw = await db.execute(sql`
                SELECT trade_name, active_ingredient, strength, unit
                FROM drug_formulary
                WHERE trade_name ILIKE ${`%${cleanName}%`}
                LIMIT 1
              `);
              const rows = raw?.rows || [];
              const row = rows[0] as any;
              if (row) {
                console.log(`[Enrichment Fallback] Found active ingredient for "${drugName}": ${row.active_ingredient}`);
                return {
                  ...med,
                  activeIngredient: row.active_ingredient,
                  strength: med.strength || row.strength,
                  unit: med.unit || row.unit,
                };
              }
            } catch (fallbackErr) {
              console.error(`[Enrichment Fallback Error]`, fallbackErr);
            }
          }
          // If fallback not possible or failed, continue without enrichment
          return med;
        }

        return med;
      } catch (error) {
        console.error(`[Enrichment Error] Failed to enrich medication "${med.drugName || med.tradeName || 'unknown'}":`, error);
        return med;
      }
    }));

    return enrichedMedications;
  }

  // Helper function: Calculate medication duration and status
  async function applyMedicationDuration(medications: any[]): Promise<any[]> {
    if (!medications || medications.length === 0) return medications;

    return medications.map(med => {
      // Skip if no start date
      if (!med.usageStartDate) return med;

      // If already has endDate and it's different from startDate, keep it
      if (med.usageEndDate && med.usageEndDate !== med.usageStartDate) {
        const status = calculateMedicationStatus(med.usageStartDate, med.usageEndDate);
        return {
          ...med,
          medicationStatus: status
        };
      }

      // Calculate duration from quantity (use prescribedDose and prescribedFrequency)
      const duration = calculateMedicationDuration(
        med.quantity || med.dosePerAdmin || null,
        med.dose || med.prescribedDose || null,
        med.frequency || med.prescribedFrequency || null,
        med.usageStartDate
      );

      // Calculate status
      const status = calculateMedicationStatus(duration.usageStartDate, duration.usageEndDate);

      return {
        ...med,
        usageEndDate: duration.usageEndDate,
        estimatedDays: duration.estimatedDays,
        durationIsEstimated: duration.isEstimated,
        medicationStatus: status
      };
    });
  }

  // Helper function: Apply ICD-10 mapping to diagnoses
  function applyICDMapping(caseData: any): any {
    if (!caseData) return caseData;

    // Map main diagnosis (chỉ khi chưa có main ICD)
    if (caseData.diagnosisMain && (!caseData.icdCodes || !caseData.icdCodes.main)) {
      const mainICD = mapDiagnosisToICD(caseData.diagnosisMain);
      if (mainICD) {
        caseData.icdCodes = caseData.icdCodes || {};
        caseData.icdCodes.main = mainICD;
      }
    }

    // Map secondary diagnoses (MERGE với ICDs đã có từ AI extraction)
    if (caseData.diagnosisSecondary && Array.isArray(caseData.diagnosisSecondary)) {
      const mappedICDs = mapDiagnosesArrayToICD(caseData.diagnosisSecondary);
      
      if (mappedICDs.length > 0) {
        caseData.icdCodes = caseData.icdCodes || {};
        
        // MERGE: Kết hợp ICDs từ AI extraction và mapping
        const existingICDs = (caseData.icdCodes.secondary && Array.isArray(caseData.icdCodes.secondary)) 
          ? caseData.icdCodes.secondary 
          : [];
        
        // Deduplicate và merge
        const allICDs = [...existingICDs, ...mappedICDs];
        caseData.icdCodes.secondary = Array.from(new Set(allICDs.map(icd => icd.toUpperCase())));
        
        console.log('[ICD Mapping] Merged secondary ICDs:', {
          fromAI: existingICDs.length,
          fromMapping: mappedICDs.length,
          total: caseData.icdCodes.secondary.length
        });
      }
    }

    return caseData;
  }

  // Multer config for case documents (PDF, DOC, PPT, images)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint', // .ppt
        'image/jpeg', // .jpg, .jpeg
        'image/png', // .png
        'image/jpg' // alternative MIME for .jpg
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file PDF, DOC, DOCX, PPT, PPTX, JPG, PNG'));
      }
    }
  });

  // Multer config for drug formulary upload (Excel, CSV)
  const uploadDrug = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/csv', // alternative CSV MIME
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV'));
      }
    }
  });

  app.post("/api/cases/extract", requireAuth, upload.array('files', 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Không có file được tải lên" });
      }

      // Get fileGroup and caseType from request body
      const fileGroup = req.body.fileGroup as string | undefined;
      const caseType = req.body.caseType as string | undefined; // "inpatient" or "outpatient"
      console.log(`[Extract] Processing ${files.length} files with fileGroup: ${fileGroup || 'none'}, caseType: ${caseType || 'none'}`);

      // ✅ XỬ LÝ TỪNG FILE RIÊNG BIỆT với prompt phù hợp
      const extractedDataArray: any[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let textContent = "";

        if (file.mimetype === 'application/pdf') {
          // Parse PDF using pdfjs-dist
          try {
            const loadingTask = pdfjsLib.getDocument({
              data: new Uint8Array(file.buffer),
              useSystemFonts: true,
              disableFontFace: false,
            });
            
            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              const page = await pdfDocument.getPage(pageNum);
              const textData = await page.getTextContent();
              const pageText = textData.items.map((item: any) => item.str).join(' ');
              textContent += pageText + '\n';
            }
            
            // If extracted text is too short, it might be a scan/image
            if (textContent.trim().length < 50) {
              console.warn(`[PDF] Low text content from ${file.originalname} (${textContent.length} chars). File might be scanned.`);
              textContent = `[PDF: ${file.originalname}]\nCảnh báo: File có thể là ảnh scan hoặc không có text layer.\n\n${textContent}`;
            }
          } catch (pdfError: any) {
            console.error('[PDF Parse Error]', pdfError);
            // Instead of failing, send minimal info to AI
            textContent = `[PDF: ${file.originalname}]\nLỗi trích xuất text: ${pdfError.message}\nKích thước file: ${file.size} bytes`;
          }
          
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // Parse DOCX using mammoth
          try {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            textContent = result.value;
          } catch (docxError) {
            console.error('[DOCX Parse Error]', docxError);
            return res.status(500).json({ message: `Không thể đọc file DOCX: ${file.originalname}` });
          }
        } else if (
          file.mimetype === 'application/msword' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.mimetype === 'application/vnd.ms-powerpoint'
        ) {
          // Parse DOC, PPTX, PPT using officeParser
          try {
            textContent = await officeParser.parseOfficeAsync(file.buffer);
          } catch (officeError) {
            console.error('[Office Parse Error]', officeError);
            return res.status(500).json({ message: `Không thể đọc file ${file.originalname}. Vui lòng thử lại hoặc convert sang PDF.` });
          }
        } else {
          return res.status(400).json({ message: `Định dạng file không được hỗ trợ: ${file.originalname}` });
        }

        // ✅ GỌI AI CHO TỪNG FILE với prompt riêng biệt
        console.log(`[Extract] File ${i + 1}/${files.length}: ${file.originalname} (${textContent.length} chars)`);
        const fileData = await extractDataFromDocument(textContent, "pdf", fileGroup, caseType);
        extractedDataArray.push(fileData);
      }

      // ✅ MERGE DỮ LIỆU THÔNG MINH từ nhiều file
      console.log(`[Merge] Merging data from ${extractedDataArray.length} files...`);
      let extractedData = extractedDataArray[0]; // Bắt đầu từ file đầu tiên
      
      // Merge từ các file còn lại
      for (let i = 1; i < extractedDataArray.length; i++) {
        const fileData = extractedDataArray[i];
        
        // Thông tin bệnh nhân: ưu tiên file có dữ liệu
        if (!extractedData.patientName && fileData.patientName) extractedData.patientName = fileData.patientName;
        if (!extractedData.patientAge && fileData.patientAge) extractedData.patientAge = fileData.patientAge;
        if (!extractedData.patientGender && fileData.patientGender) extractedData.patientGender = fileData.patientGender;
        if (!extractedData.patientWeight && fileData.patientWeight) extractedData.patientWeight = fileData.patientWeight;
        if (!extractedData.patientHeight && fileData.patientHeight) extractedData.patientHeight = fileData.patientHeight;
        if (!extractedData.admissionDate && fileData.admissionDate) extractedData.admissionDate = fileData.admissionDate;
        
        // Chẩn đoán: ưu tiên file có dữ liệu đầy đủ hơn
        if (!extractedData.diagnosisMain && fileData.diagnosisMain) extractedData.diagnosisMain = fileData.diagnosisMain;
        if (fileData.diagnosisSecondary && fileData.diagnosisSecondary.length > 0) {
          extractedData.diagnosisSecondary = [...(extractedData.diagnosisSecondary || []), ...fileData.diagnosisSecondary];
        }
        
        // ICD codes: merge và loại trùng
        if (fileData.icdCodes) {
          if (!extractedData.icdCodes) extractedData.icdCodes = { main: null, secondary: [] };
          if (!extractedData.icdCodes.main && fileData.icdCodes.main) {
            extractedData.icdCodes.main = fileData.icdCodes.main;
          }
          if (fileData.icdCodes.secondary && fileData.icdCodes.secondary.length > 0) {
            const existingSecondary = new Set(extractedData.icdCodes.secondary || []);
            fileData.icdCodes.secondary.forEach((icd: string) => {
              if (icd && icd.trim()) existingSecondary.add(icd.trim());
            });
            extractedData.icdCodes.secondary = Array.from(existingSecondary);
          }
        }
        
        // Lab results: merge
        if (!extractedData.labResults && fileData.labResults) extractedData.labResults = fileData.labResults;
        
        // Medications: CHỈ merge nếu fileGroup = "prescription"
        // Nếu fileGroup = "billing" → không lấy medications
        if (fileGroup === "prescription" && fileData.medications && fileData.medications.length > 0) {
          if (!extractedData.medications) extractedData.medications = [];
          extractedData.medications.push(...fileData.medications);
        }
        
        // Medical history & allergies
        if (!extractedData.medicalHistory && fileData.medicalHistory) extractedData.medicalHistory = fileData.medicalHistory;
        if (!extractedData.allergies && fileData.allergies) extractedData.allergies = fileData.allergies;
      }
      
      console.log(`[Merge] Final data - Medications: ${extractedData.medications?.length || 0}, Secondary ICDs: ${extractedData.icdCodes?.secondary?.length || 0}`);
      console.log(`[Merge] Final data - Medications: ${extractedData.medications?.length || 0}, Secondary ICDs: ${extractedData.icdCodes?.secondary?.length || 0}`);
      
      if (!extractedData || typeof extractedData !== 'object') {
        return res.status(500).json({ message: "AI không trả về dữ liệu hợp lệ" });
      }

      // 🔍 DEBUG: Log extracted ICD codes
      console.log('[Extract] ICD Codes from AI:');
      console.log('  - Main ICD:', extractedData.icdCodes?.main);
      console.log('  - Secondary ICDs:', extractedData.icdCodes?.secondary);
      console.log('  - Secondary count:', extractedData.icdCodes?.secondary?.length || 0);

      // ✨ ENRICH: Auto-fill activeIngredient from drug formulary database
      if (extractedData.medications && Array.isArray(extractedData.medications)) {
        console.log(`[Enrichment] Processing ${extractedData.medications.length} medications...`);
        extractedData.medications = await enrichMedicationsWithActiveIngredients(extractedData.medications);
        
        // ✨ CALCULATE DURATION: Auto-calculate usage end date
        console.log(`[Duration] Calculating medication duration...`);
        extractedData.medications = await applyMedicationDuration(extractedData.medications);
      }

      // ✨ ICD MAPPING: Auto-map diagnoses to ICD-10 codes
      if (extractedData.diagnosisMain || extractedData.diagnosisSecondary) {
        console.log(`[ICD Mapping] Applying ICD-10 mapping...`);
        extractedData = applyICDMapping(extractedData);
        console.log('[ICD Mapping] After mapping:');
        console.log('  - Main ICD:', extractedData.icdCodes?.main);
        console.log('  - Secondary ICDs:', extractedData.icdCodes?.secondary);
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(extractedData);
    } catch (error: any) {
      console.error("[Extract Error]", error);
      
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return res.status(500).json({ message: "Lỗi cấu hình API key" });
      }
      
      if (error.message.includes("phân tích dữ liệu từ AI")) {
        return res.status(500).json({ message: "AI không thể xử lý file này. Vui lòng thử file khác hoặc nhập thủ công." });
      }
      
      res.status(500).json({ message: "Lỗi xử lý file. Vui lòng thử lại hoặc nhập thủ công." });
    }
  });

  app.get("/api/cases", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      let cases;
      
      if (user.role === "admin") {
        cases = await storage.getAllCases();
      } else {
        cases = await storage.getCasesByUser(user.id);
      }
      
      res.json(cases);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền truy cập ca bệnh này" });
      }
      
      res.json(caseData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cases", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCaseSchema.parse({
        ...req.body,
        userId: req.user!.id,
        admissionDate: new Date(req.body.admissionDate),
      });
      
      // Auto-calculate eGFR if creatinine, age, gender, and weight are provided
      // Weight is REQUIRED for Cockcroft-Gault - no calculation if missing
      if (validatedData.creatinine !== undefined && validatedData.creatinine !== null && validatedData.patientAge && validatedData.patientGender && validatedData.patientWeight && validatedData.patientWeight > 0) {
        const egfrResult = calculateEGFR({
          creatinine: validatedData.creatinine,
          creatinineUnit: validatedData.creatinineUnit || "mg/dL",
          age: validatedData.patientAge,
          gender: validatedData.patientGender,
          weight: validatedData.patientWeight ?? undefined,
        });
        
        if (egfrResult) {
          validatedData.egfr = egfrResult.egfr;
          validatedData.egfrCategory = egfrResult.egfrCategory;
          validatedData.renalFunction = egfrResult.renalFunction;
        }
      }
      
      const newCase = await storage.createCase(validatedData);
      res.status(201).json(newCase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền chỉnh sửa ca bệnh này" });
      }
      
      const validatedData = insertCaseSchema.partial().omit({ userId: true }).parse(req.body);
      
      // Auto-calculate eGFR if creatinine, age, gender, and weight are available
      // Use updated values if provided, otherwise fall back to existing case data
      // Weight is REQUIRED for Cockcroft-Gault - skip calculation if missing or invalid
      const creatinine = validatedData.creatinine ?? caseData.creatinine;
      const creatinineUnit = validatedData.creatinineUnit ?? caseData.creatinineUnit ?? "mg/dL";
      const age = validatedData.patientAge ?? caseData.patientAge;
      const gender = validatedData.patientGender ?? caseData.patientGender;
      const weight = validatedData.patientWeight ?? caseData.patientWeight;
      
      // Skip eGFR calculation for legacy cases with null age/gender or missing/invalid weight
      if (creatinine !== undefined && creatinine !== null && age && age > 0 && gender && weight && weight > 0) {
        const egfrResult = calculateEGFR({
          creatinine,
          creatinineUnit,
          age,
          gender,
          weight: weight ?? undefined,
        });
        
        if (egfrResult) {
          validatedData.egfr = egfrResult.egfr;
          validatedData.egfrCategory = egfrResult.egfrCategory;
          validatedData.renalFunction = egfrResult.renalFunction;
        }
      }
      
      const updatedCase = await storage.updateCase(req.params.id, validatedData);
      res.json(updatedCase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/cases/:id", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xóa ca bệnh này" });
      }
      
      const files = await storage.getUploadedFilesByCase(req.params.id);
      for (const file of files) {
        try {
          const fullPath = path.resolve(__dirname, '..', file.filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (fileError) {
          console.error('[File Delete Error]', fileError);
        }
      }
      
      const caseDir = path.resolve(uploadsDir, path.basename(req.params.id));
      if (fs.existsSync(caseDir)) {
        try {
          fs.rmSync(caseDir, { recursive: true, force: true });
        } catch (dirError) {
          console.error('[Directory Delete Error]', dirError);
        }
      }
      
      await storage.deleteCase(req.params.id);
      res.json({ message: "Đã xóa ca bệnh" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const uploadFiles = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint', // .ppt
        'image/jpeg',
        'image/png'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file PDF, DOC, DOCX, PPT, PPTX, JPG, PNG'));
      }
    }
  });

  function validateFileGroup(fileGroup: string, mimetype: string): boolean {
    const groupRules: Record<string, string[]> = {
      admin: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'],
      lab: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'],
      prescription: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
    };
    return groupRules[fileGroup]?.includes(mimetype) || false;
  }

  app.post("/api/cases/:id/files", requireAuth, uploadFiles.array('files', 10), async (req, res) => {
    try {
      const caseId = req.params.id;
      
      if (!/^[a-f0-9-]{36}$/i.test(caseId)) {
        return res.status(400).json({ message: "Case ID không hợp lệ" });
      }

      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca lâm sàng" });
      }

      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền upload file cho case này" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Không có file nào được tải lên" });
      }

      const fileGroup = req.body.fileGroup;
      if (!['admin', 'lab', 'prescription'].includes(fileGroup)) {
        return res.status(400).json({ message: "Nhóm file không hợp lệ" });
      }

      const safeCaseId = path.basename(caseId);
      const caseDir = path.resolve(uploadsDir, safeCaseId, fileGroup);
      
      if (!caseDir.startsWith(path.resolve(uploadsDir))) {
        return res.status(400).json({ message: "Path traversal detected" });
      }

      if (!fs.existsSync(caseDir)) {
        fs.mkdirSync(caseDir, { recursive: true });
      }

      const uploadedFiles = [];
      const writtenFiles: string[] = [];

      try {
        for (const file of files) {
          if (!validateFileGroup(fileGroup, file.mimetype)) {
            throw new Error(`File ${file.originalname} không phù hợp với nhóm ${fileGroup}`);
          }

          const fileExtension = path.extname(file.originalname);
          const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
          const filePath = path.resolve(caseDir, uniqueFilename);
          
          if (!filePath.startsWith(caseDir)) {
            throw new Error("Invalid file path");
          }
          
          fs.writeFileSync(filePath, file.buffer);
          writtenFiles.push(filePath);

          const relativePath = path.join('uploads', safeCaseId, fileGroup, uniqueFilename);
          
          const uploadedFile = await storage.createUploadedFile({
            caseId: caseId,
            fileName: file.originalname,
            fileType: fileExtension.substring(1),
            fileGroup: fileGroup,
            filePath: relativePath,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: user.id,
            extractedData: null
          });

          uploadedFiles.push(uploadedFile);
        }

        res.status(201).json(uploadedFiles.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileType: f.fileType,
          fileGroup: f.fileGroup,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          createdAt: f.createdAt
        })));
      } catch (error: any) {
        for (const filePath of writtenFiles) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (cleanupError) {
            console.error('[File Cleanup Error]', cleanupError);
          }
        }
        throw error;
      }
    } catch (error: any) {
      console.error('[File Upload Error]', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id/files", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca lâm sàng" });
      }

      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xem file của case này" });
      }

      const fileGroup = req.query.group as string | undefined;
      const files = await storage.getUploadedFilesByCase(req.params.id, fileGroup);
      
      const safeFiles = files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        fileGroup: f.fileGroup,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        createdAt: f.createdAt
      }));
      
      res.json(safeFiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/files/:id/download", requireAuth, async (req, res) => {
    try {
      const files = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, req.params.id)).limit(1);
      const fileRecord = files[0];
      
      if (!fileRecord) {
        return res.status(404).json({ message: "Không tìm thấy file" });
      }

      const caseData = await storage.getCase(fileRecord.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca lâm sàng" });
      }

      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền tải file này" });
      }

      const fullPath = path.resolve(__dirname, '..', fileRecord.filePath);
      
      if (!fullPath.startsWith(path.resolve(uploadsDir))) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: "File không tồn tại trên server" });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.fileName)}"`);
      res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('[File Download Error]', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const files = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, req.params.id)).limit(1);
      const fileRecord = files[0];
      
      if (!fileRecord) {
        return res.status(404).json({ message: "Không tìm thấy file" });
      }

      const caseData = await storage.getCase(fileRecord.caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca lâm sàng" });
      }

      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xóa file này" });
      }

      const fullPath = path.resolve(__dirname, '..', fileRecord.filePath);
      
      if (!fullPath.startsWith(path.resolve(uploadsDir))) {
        return res.status(403).json({ message: "Invalid file path" });
      }

      let fileDeleted = false;
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          fileDeleted = true;
        } catch (fsError) {
          console.error('[FS Delete Error]', fsError);
          throw new Error('Không thể xóa file khỏi disk');
        }
      }

      await storage.deleteUploadedFile(req.params.id);
      res.json({ message: "Đã xóa file" });
    } catch (error: any) {
      console.error('[File Delete Error]', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id/medications", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xem thuốc của ca bệnh này" });
      }
      
      const medications = await storage.getMedicationsByCase(req.params.id);
      
      // Lookup active ingredients from drug formulary (case-insensitive match)
      // Use cached formulary to avoid repeated full-table scans
      const now = Date.now();
      if (!drugFormularyCache.data || (now - drugFormularyCache.timestamp) > CACHE_TTL) {
        drugFormularyCache.data = await storage.getAllDrugs();
        drugFormularyCache.timestamp = now;
      }
      
      const drugMap = new Map<string, DrugFormulary>(
        drugFormularyCache.data
          .filter(drug => drug.tradeName) // Skip null/undefined trade names
          .map(drug => [drug.tradeName.toLowerCase().trim(), drug])
      );
      
      // Get patient's ICD codes for BHYT check
      let patientICDs: ICDCode[] = [];
      
      // Priority 1: Use icdCodes if exists (jsonb object: {main: string, secondary: string[]})
      if (caseData.icdCodes && typeof caseData.icdCodes === 'object') {
        const icdObj = caseData.icdCodes as { main?: string; secondary?: string[] };
        const mainICD = icdObj.main && icdObj.main.trim() ? [icdObj.main] : [];
        const secondaryICDs = Array.isArray(icdObj.secondary) ? icdObj.secondary : [];
        patientICDs = [...mainICD, ...secondaryICDs].filter((code: string) => code && code.trim().length > 0);
      }
      // Priority 2: Parse from diagnosisMain and diagnosisSecondary (text fields) - fallback
      else {
        const mainICD = caseData.diagnosisMain?.match(/[A-Z]\d{2}(\.\d+)?/)?.[0];
        const secondaryICDs = caseData.diagnosisSecondary 
          ? caseData.diagnosisSecondary.flatMap(d => 
              d.match(/[A-Z]\d{2}(\.\d+)?/g) || []
            )
          : [];
        patientICDs = [mainICD, ...secondaryICDs].filter((icd): icd is string => Boolean(icd));
      }
      
      // ⭐ DEDUPLICATE: Remove duplicate ICDs
      patientICDs = deduplicateICDs(patientICDs);
      
      const medicationsWithStatus: MedicationWithStatus[] = medications.map(med => {
        // Extract trade name from drug name (e.g., "Amoxicilin + acid clavulanic (Curam 1000mg) 875mg" -> "Curam 1000mg")
        let drugNameToMatch = med.drugName.toLowerCase().trim();
        
        // Try to extract from parentheses first
        const parenMatch = med.drugName.match(/\(([^)]+)\)/);
        if (parenMatch) {
          drugNameToMatch = parenMatch[1].toLowerCase().trim();
        }
        
        // Try exact match first
        let matchedDrug = drugMap.get(drugNameToMatch);
        
        // If not found, try fuzzy match by checking if drugFormulary name is contained in medication name
        if (!matchedDrug) {
          for (const [formularyName, drug] of Array.from(drugMap.entries())) {
            if (drugNameToMatch.includes(formularyName) || formularyName.includes(drugNameToMatch)) {
              matchedDrug = drug;
              break;
            }
          }
        }
        
        // Dual-source approach: formulary (priority) + fallback from existing fields
        const fallbackParsed = parseStrengthUnit(med.prescribedDose);
        
        // Check ICD-Drug compliance (BHYT)
        let icdValid = undefined;
        let matchedICD = undefined;
        let matchedPattern = undefined;
        let icdMessage = undefined;
        
        if (matchedDrug && matchedDrug.icdPatterns) {
          const drugPatterns = parseICDPatterns(matchedDrug.icdPatterns);
          if (drugPatterns.length > 0) {
            const icdCheckResult = isDrugCoveredByICD(patientICDs, drugPatterns);
            icdValid = icdCheckResult.icdValid;
            matchedICD = icdCheckResult.matchedICD;
            matchedPattern = icdCheckResult.matchedPattern;
            icdMessage = icdCheckResult.message;
          }
        }
        
        // Get required patterns for display
        const requiredPatterns = matchedDrug?.icdPatterns 
          ? parseICDPatterns(matchedDrug.icdPatterns) 
          : undefined;
        
        return {
          ...med,
          status: computeMedicationStatus(med),
          // Priority: 1) Formulary lookup, 2) Existing activeIngredient in DB, 3) drugName
          activeIngredient: matchedDrug?.activeIngredient || (med as any).activeIngredient || med.drugName,
          strength: matchedDrug?.strength || fallbackParsed.strength,
          unit: matchedDrug?.unit || fallbackParsed.unit,
          // BHYT ICD check
          icdValid,
          matchedICD,
          matchedPattern,
          icdMessage,
          requiredPatterns,
        };
      });
      res.json(medicationsWithStatus);
    } catch (error: any) {
      console.error('[/api/cases/:id/medications ERROR]', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/medications", requireAuth, async (req, res) => {
    try {
      const validatedData = insertMedicationSchema.parse(req.body);
      
      // ✨ ENRICH: Auto-fill activeIngredient from drug formulary before saving
      const enrichedData = await enrichMedicationsWithActiveIngredients([validatedData]);
      const dataToSave = enrichedData[0] || validatedData;
      
      const medication = await storage.createMedication(dataToSave);
      res.status(201).json(medication);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ✅ NEW: Endpoint riêng cho tab "Kiểm tra mã ICD"
  app.get("/api/cases/:id/icd-check", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xem ca bệnh này" });
      }
      
      const medications = await storage.getMedicationsByCase(req.params.id);
      
      // Get drug formulary cache
      const now = Date.now();
      if (!drugFormularyCache.data || (now - drugFormularyCache.timestamp) > CACHE_TTL) {
        drugFormularyCache.data = await storage.getAllDrugs();
        drugFormularyCache.timestamp = now;
      }
      
      const drugMap = new Map<string, DrugFormulary>(
        drugFormularyCache.data
          .filter(drug => drug.tradeName)
          .map(drug => [drug.tradeName.toLowerCase().trim(), drug])
      );
      
      // Get patient's ICD codes from icdCodes (jsonb) or diagnosisMain/diagnosisSecondary
      let patientICDList: ICDCode[] = [];
      
      // Priority 1: Use icdCodes if exists (jsonb object: {main: string, secondary: string[]})
      if (caseData.icdCodes && typeof caseData.icdCodes === 'object') {
        const icdObj = caseData.icdCodes as { main?: string; secondary?: string[] };
        const mainICD = icdObj.main && icdObj.main.trim() ? [icdObj.main] : [];
        const secondaryICDs = Array.isArray(icdObj.secondary) ? icdObj.secondary : [];
        patientICDList = [...mainICD, ...secondaryICDs].filter((code: string) => code && code.trim().length > 0);
      }
      // Priority 2: Parse from diagnosisMain and diagnosisSecondary (text fields) - fallback
      else {
        const mainICD = caseData.diagnosisMain?.match(/[A-Z]\d{2}(\.\d+)?/)?.[0];
        const secondaryICDs = caseData.diagnosisSecondary 
          ? caseData.diagnosisSecondary.flatMap(d => 
              d.match(/[A-Z]\d{2}(\.\d+)?/g) || []
            )
          : [];
        patientICDList = [mainICD, ...secondaryICDs].filter((icd): icd is string => Boolean(icd));
      }
      
      // ⭐ DEDUPLICATE: Remove duplicate ICDs
      patientICDList = deduplicateICDs(patientICDList);
      
      // Build checked items for summary
      const checkedItems: CheckedPrescriptionItem[] = medications.map(med => {
        // Extract trade name from drug name (e.g., "Amoxicilin + acid clavulanic (Curam 1000mg) 875mg" -> "Curam 1000mg")
        let drugNameToMatch = med.drugName.toLowerCase().trim();
        
        // Try to extract from parentheses first
        const parenMatch = med.drugName.match(/\(([^)]+)\)/);
        if (parenMatch) {
          drugNameToMatch = parenMatch[1].toLowerCase().trim();
        }
        
        // Try exact match first
        let matchedDrug = drugMap.get(drugNameToMatch);
        
        // If not found, try fuzzy match by checking if drugFormulary name is contained in medication name
        if (!matchedDrug) {
          for (const [formularyName, drug] of Array.from(drugMap.entries())) {
            if (drugNameToMatch.includes(formularyName) || formularyName.includes(drugNameToMatch)) {
              matchedDrug = drug;
              break;
            }
          }
        }
        
        const drugPatterns = matchedDrug?.icdPatterns ? parseICDPatterns(matchedDrug.icdPatterns) : [];
        const contraindicationPatterns = matchedDrug?.contraindicationIcds ? parseICDPatterns(matchedDrug.contraindicationIcds) : [];
        
        let icdValid = false;
        let matchedICD = undefined;
        let matchedPattern = undefined;
        let hasContraindication = false;
        let contraindicationICD = undefined;
        let contraindicationPattern = undefined;
        
        // Check chỉ định
        if (drugPatterns.length > 0) {
          const result = isDrugCoveredByICD(patientICDList, drugPatterns);
          icdValid = result.icdValid;
          matchedICD = result.matchedICD;
          matchedPattern = result.matchedPattern;
        }
        
        // ⭐ CHỐNG CHỈ ĐỊNH: Tạm thời tắt logic đối chiếu, mặc định = không có chống chỉ định
        // TODO: Sẽ bật lại sau khi có logic đối chiếu chính xác
        hasContraindication = false;
        contraindicationICD = undefined;
        contraindicationPattern = undefined;
        
        // Commented out contraindication check
        // if (contraindicationPatterns.length > 0) {
        //   const contraResult = checkContraindication(patientICDList, contraindicationPatterns);
        //   hasContraindication = contraResult.hasContraindication;
        //   contraindicationICD = contraResult.matchedICD;
        //   contraindicationPattern = contraResult.matchedPattern;
        // }
        
        return {
          drugName: med.drugName,
          isInsurance: med.isInsurance ?? true, // default true nếu chưa set
          icdValid,
          matchedICD,
          matchedPattern,
          requiredPatterns: drugPatterns,
          hasContraindication,
          contraindicationICD,
          contraindicationPattern,
          contraindicationPatterns,
        };
      });
      
      // Generate summary text
      const summaryText = buildIcdSummaryText(checkedItems, patientICDList);
      
      res.json({
        patientICDList,
        items: checkedItems,
        summaryText,
      });
    } catch (error: any) {
      console.error('[/api/cases/:id/icd-check ERROR]', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/medications/:id", requireAuth, async (req, res) => {
    try {
      const medication = await db.select().from(medications).where(eq(medications.id, req.params.id)).limit(1);
      if (!medication[0]) {
        return res.status(404).json({ message: "Không tìm thấy thuốc" });
      }
      
      const caseData = await storage.getCase(medication[0].caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền chỉnh sửa thuốc của ca bệnh này" });
      }
      
      const validatedData = insertMedicationSchema.partial().omit({ caseId: true }).parse(req.body);
      const updatedMed = await storage.updateMedication(req.params.id, validatedData);
      res.json(updatedMed);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/medications/:id", requireAuth, async (req, res) => {
    try {
      const medication = await db.select().from(medications).where(eq(medications.id, req.params.id)).limit(1);
      if (!medication[0]) {
        return res.status(404).json({ message: "Không tìm thấy thuốc" });
      }
      
      const caseData = await storage.getCase(medication[0].caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xóa thuốc của ca bệnh này" });
      }
      
      await storage.deleteMedication(req.params.id);
      res.json({ message: "Đã xóa thuốc" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id/analyses", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xem phân tích của ca bệnh này" });
      }
      
      const analyses = await storage.getAnalysesByCase(req.params.id);
      res.json(analyses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cases/:id/analyze", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền phân tích ca bệnh này" });
      }

      const medications = await storage.getMedicationsByCase(req.params.id);
      
      // Get drug formulary for context
      const allDrugs = await storage.getAllDrugs();

      // 🚀 OPTIMIZED: Run analysis and evidence search in parallel
      const query = `Tương tác thuốc và điều chỉnh liều cho bệnh nhân ${caseData.patientName || 'Unknown'} với chẩn đoán ${caseData.diagnosisMain || caseData.diagnosis || 'Unknown'}`;
      
      console.log(`[Parallel Processing] Starting analysis + evidence search for case ${req.params.id}`);
      
      const [analysisResult, evidenceResults] = await Promise.all([
        // Analysis
        analyzePatientCase({
          ...caseData,
          medications,
        }, allDrugs),
        
        // Evidence search (run in parallel)
        searchMedicalEvidence(query).catch(err => {
          console.error(`[Evidence Search] Failed:`, err.message);
          return []; // Return empty array on error
        })
      ]);

      console.log(`[Parallel Processing] ✅ Both completed. Evidence items: ${evidenceResults.length}`);

      // Save analysis result
      const analysis = await storage.createAnalysis({
        caseId: req.params.id,
        analysisType: "patient_case",
        result: analysisResult,
        model: "gpt-4o",
        status: "completed",
      });

      // Update case status to completed after successful analysis
      await storage.updateCase(req.params.id, { status: "completed" });

      // Save evidence items (already fetched in parallel)
      if (evidenceResults.length > 0) {
        for (const evidence of evidenceResults) {
          await storage.createEvidence({
            caseId: req.params.id,
            query,
            ...evidence,
          }).catch(err => console.error(`[Evidence] Save failed:`, err.message));
        }
        console.log(`[Evidence Search] ✅ Saved ${evidenceResults.length} items`);
      }

      res.json(analysis);
    } catch (error: any) {
      console.error("Analysis error:", error);
      
      try {
        await storage.createAnalysis({
          caseId: req.params.id,
          analysisType: "patient_case",
          result: {},
          model: "gpt-4o",
          status: "failed",
          error: error.message,
        });
      } catch (dbError) {
        console.error("Failed to save error analysis:", dbError);
      }
      
      res.status(500).json({ message: error.message || "Lỗi khi phân tích ca bệnh" });
    }
  });

  app.post("/api/cases/:id/suggest-documents", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền truy cập ca bệnh này" });
      }

      const suggestions = await suggestDocuments(caseData);
      res.json(suggestions);
    } catch (error: any) {
      console.error("Suggest documents error:", error);
      res.status(500).json({
        admin: { needed: false, reason: "Lỗi phân tích" },
        lab: { needed: true, reason: "Cần kết quả xét nghiệm" },
        prescription: { needed: true, reason: "Cần đơn thuốc" },
      });
    }
  });

  app.post("/api/analyses", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAnalysisSchema.parse(req.body);
      const analysis = await storage.createAnalysis(validatedData);
      res.status(201).json(analysis);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const analysis = await db.select().from(analyses).where(eq(analyses.id, req.params.id)).limit(1);
      if (!analysis[0]) {
        return res.status(404).json({ message: "Không tìm thấy phân tích" });
      }
      
      const caseData = await storage.getCase(analysis[0].caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền chỉnh sửa phân tích của ca bệnh này" });
      }
      
      const validatedData = insertAnalysisSchema.partial().omit({ caseId: true }).parse(req.body);
      const updated = await storage.updateAnalysis(req.params.id, validatedData);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/analyses/:id", requireAuth, async (req, res) => {
    try {
      const analysis = await db.select().from(analyses).where(eq(analyses.id, req.params.id)).limit(1);
      if (!analysis[0]) {
        return res.status(404).json({ message: "Không tìm thấy phân tích" });
      }
      
      const caseData = await storage.getCase(analysis[0].caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xóa phân tích của ca bệnh này" });
      }
      
      await db.delete(analyses).where(eq(analyses.id, req.params.id));
      res.json({ message: "Đã xóa phân tích" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id/evidence", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền xem bằng chứng của ca bệnh này" });
      }
      
      const evidence = await storage.getEvidenceByCase(req.params.id);
      res.json(evidence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cases/:id/evidence/search", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }
      
      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền tìm kiếm bằng chứng cho ca bệnh này" });
      }

      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query is required" });
      }

      const evidenceItems = await searchMedicalEvidence(query);

      const savedEvidence = await Promise.all(
        evidenceItems.map(item =>
          storage.createEvidence({
            caseId: req.params.id,
            query,
            title: item.title,
            source: item.source,
            url: item.url || null,
            summary: item.summary,
            relevanceScore: item.relevanceScore || null,
            citationCount: item.citationCount || null,
            publicationYear: item.publicationYear || null,
            verificationStatus: "pending",
          })
        )
      );

      res.json(savedEvidence);
    } catch (error: any) {
      console.error("Evidence search error:", error);
      res.status(500).json({ message: error.message || "Lỗi khi tìm kiếm bằng chứng" });
    }
  });

  app.post("/api/evidence", requireAuth, async (req, res) => {
    try {
      const validatedData = insertEvidenceSchema.parse(req.body);
      const evidence = await storage.createEvidence(validatedData);
      res.status(201).json(evidence);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/evidence/:id", requireAuth, async (req, res) => {
    try {
      const evidenceRecord = await db.select().from(evidence).where(eq(evidence.id, req.params.id)).limit(1);
      if (!evidenceRecord[0]) {
        return res.status(404).json({ message: "Không tìm thấy bằng chứng" });
      }
      
      if (evidenceRecord[0].caseId) {
        const caseData = await storage.getCase(evidenceRecord[0].caseId);
        if (!caseData) {
          return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
        }
        
        const user = req.user!;
        if (user.role !== "admin" && caseData.userId !== user.id) {
          return res.status(403).json({ message: "Không có quyền chỉnh sửa bằng chứng của ca bệnh này" });
        }
      }
      
      const validatedData = insertEvidenceSchema.partial().parse(req.body);
      const updated = await storage.updateEvidence(req.params.id, validatedData);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/chat", requireAuth, async (req, res) => {
    try {
      const caseId = req.query.caseId as string | undefined;
      const messages = await storage.getChatMessagesByUser(req.user!.id, caseId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { message: userMessage, caseId } = req.body;
      
      if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ message: "Tin nhắn không hợp lệ" });
      }

      let caseData;
      if (caseId) {
        caseData = await storage.getCase(caseId);
        if (!caseData) {
          return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
        }
      }

      const systemStats = await storage.getSystemStatistics();

      const aiResponse = await chatWithAI(userMessage, {
        caseData,
        systemStats,
      });

      const validatedData = insertChatMessageSchema.parse({
        userId: req.user!.id,
        message: userMessage,
        response: aiResponse,
        caseId: caseId || null,
      });

      const savedMessage = await storage.createChatMessage(validatedData);
      res.status(201).json(savedMessage);
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ message: error.message || "Lỗi khi xử lý chat" });
    }
  });

  app.get("/api/cases/:id/consultation-report", requireAuth, async (req, res) => {
    try {
      const report = await storage.getConsultationReportByCase(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Chưa có phiếu tư vấn" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cases/:id/consultation-report/export/pdf", requireAuth, async (req, res) => {
    try {
      const report = await storage.getConsultationReportByCase(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Chưa có phiếu tư vấn" });
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }

      const pdfBuffer = await generatePDF(report, caseData);
      
      const patientName = (caseData.patientName || 'benh-nhan').replace(/\s+/g, '-');
      const fileName = `phieu-tu-van-${patientName}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("PDF export error:", error);
      res.status(500).json({ message: error.message || "Lỗi khi xuất PDF" });
    }
  });

  app.get("/api/cases/:id/consultation-report/export/docx", requireAuth, async (req, res) => {
    try {
      const report = await storage.getConsultationReportByCase(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Chưa có phiếu tư vấn" });
      }

      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }

      const docxBuffer = await generateDOCX(report, caseData);
      
      const patientName = (caseData.patientName || 'benh-nhan').replace(/\s+/g, '-');
      const fileName = `phieu-tu-van-${patientName}-${new Date().toISOString().split('T')[0]}.docx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(docxBuffer);
    } catch (error: any) {
      console.error("DOCX export error:", error);
      res.status(500).json({ message: error.message || "Lỗi khi xuất DOCX" });
    }
  });

  app.post("/api/cases/:id/reports/generate", requireAuth, async (req, res) => {
    try {
      const caseData = await storage.getCase(req.params.id);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }

      const user = req.user!;
      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền tạo phiếu tư vấn cho ca bệnh này" });
      }

      const analyses = await storage.getAnalysesByCase(req.params.id);
      if (!analyses || analyses.length === 0) {
        return res.status(400).json({ 
          message: "Chưa có phân tích AI nào cho ca bệnh này. Vui lòng phân tích trước khi tạo phiếu tư vấn." 
        });
      }

      const latestAnalysis = analyses[analyses.length - 1];
      if (!latestAnalysis.result || latestAnalysis.status !== "completed") {
        return res.status(400).json({ 
          message: "Phân tích gần nhất chưa hoàn thành. Vui lòng chạy lại phân tích." 
        });
      }

      try {
        analysisResultSchema.parse(latestAnalysis.result);
      } catch (validationError: any) {
        return res.status(400).json({
          message: "Kết quả phân tích không hợp lệ. Vui lòng chạy lại phân tích.",
          details: validationError.errors
        });
      }

      const reportContent = await generateConsultationForm(caseData, latestAnalysis.result);

      try {
        reportContentSchema.parse(reportContent);
      } catch (validationError: any) {
        console.error("Report content validation failed:", validationError);
        return res.status(400).json({
          message: "Nội dung phiếu tư vấn không hợp lệ",
          details: validationError.errors
        });
      }

      const validatedData = insertConsultationReportSchema.parse({
        caseId: req.params.id,
        reportContent,
        generatedBy: user.id,
        approved: false,
      });

      const report = await storage.createConsultationReport(validatedData);

      res.json(report);
    } catch (error: any) {
      console.error("Report generation error:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dữ liệu phiếu tư vấn không hợp lệ",
          details: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Lỗi khi tạo phiếu tư vấn" });
    }
  });

  app.post("/api/consultation-reports", requireAuth, async (req, res) => {
    try {
      const validatedData = insertConsultationReportSchema.parse({
        ...req.body,
        generatedBy: req.user!.id,
      });
      const report = await storage.createConsultationReport(validatedData);
      res.status(201).json(report);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/consultation-reports/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertConsultationReportSchema.partial().parse(req.body);
      
      if (validatedData.reportContent) {
        reportContentSchema.parse(validatedData.reportContent);
      }
      
      const report = await storage.updateConsultationReport(req.params.id, validatedData);
      res.json(report);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dữ liệu không hợp lệ",
          details: error.errors 
        });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/ai/analyze-case", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== "admin" && user.role !== "pharmacist" && user.role !== "doctor") {
        return res.status(403).json({ message: "Chỉ dược sĩ, bác sĩ và admin mới có quyền sử dụng AI phân tích" });
      }

      const { caseId } = req.body;
      if (!caseId) {
        return res.status(400).json({ message: "Thiếu caseId" });
      }

      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }

      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền phân tích ca bệnh này" });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ message: "Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên." });
      }

      const medications = await storage.getMedicationsByCase(caseId);
      const analysisResult = await analyzePatientCase({
        ...caseData,
        medications,
      });

      const analysis = await storage.createAnalysis({
        caseId,
        analysisType: "clinical_analysis",
        result: analysisResult,
        model: "gpt-4o",
        status: "completed",
      });

      res.json({ analysis, result: analysisResult });
    } catch (error: any) {
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return res.status(503).json({ message: "Dịch vụ AI không khả dụng" });
      }
      res.status(500).json({ message: "Lỗi khi phân tích ca bệnh" });
    }
  });

  app.post("/api/ai/search-evidence", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== "admin" && user.role !== "pharmacist" && user.role !== "doctor") {
        return res.status(403).json({ message: "Chỉ dược sĩ, bác sĩ và admin mới có quyền tìm kiếm bằng chứng" });
      }

      const { query, caseId } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Thiếu query" });
      }

      if (caseId) {
        const caseData = await storage.getCase(caseId);
        if (!caseData) {
          return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
        }
        
        if (user.role !== "admin" && caseData.userId !== user.id) {
          return res.status(403).json({ message: "Không có quyền thêm bằng chứng cho ca bệnh này" });
        }
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ message: "Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên." });
      }

      const result = await searchMedicalEvidence(query);

      let evidenceRecord = null;
      if (caseId) {
        evidenceRecord = await storage.createEvidence({
          caseId,
          query,
          title: "Kết quả tìm kiếm bằng chứng",
          source: "Perplexity AI",
          summary: Array.isArray(result) ? result.join('\n') : String(result),
          verificationStatus: "pending",
        });
      }

      res.json({ result, evidence: evidenceRecord });
    } catch (error: any) {
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return res.status(503).json({ message: "Dịch vụ AI không khả dụng" });
      }
      res.status(500).json({ message: "Lỗi khi tìm kiếm bằng chứng" });
    }
  });

  app.post("/api/ai/generate-report", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== "admin" && user.role !== "pharmacist" && user.role !== "doctor") {
        return res.status(403).json({ message: "Chỉ dược sĩ, bác sĩ và admin mới có quyền tạo phiếu tư vấn" });
      }

      const { caseId } = req.body;
      if (!caseId) {
        return res.status(400).json({ message: "Thiếu caseId" });
      }

      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
      }

      if (user.role !== "admin" && caseData.userId !== user.id) {
        return res.status(403).json({ message: "Không có quyền tạo phiếu tư vấn cho ca bệnh này" });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ message: "Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên." });
      }

      const analyses = await storage.getAnalysesByCase(caseId);
      const reportContent = await generateConsultationForm(caseData, analyses[0]?.result);

      const report = await storage.createConsultationReport({
        caseId,
        reportContent: typeof reportContent === 'string' ? JSON.parse(reportContent) : reportContent,
        generatedBy: user.id,
        approved: false,
      });

      res.json(report);
    } catch (error: any) {
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return res.status(503).json({ message: "Dịch vụ AI không khả dụng" });
      }
      res.status(500).json({ message: "Lỗi khi tạo phiếu tư vấn" });
    }
  });

  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== "admin" && user.role !== "pharmacist" && user.role !== "doctor") {
        return res.status(403).json({ message: "Chỉ dược sĩ, bác sĩ và admin mới có quyền sử dụng AI chat" });
      }

      const { message, caseId } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Thiếu message" });
      }

      if (caseId) {
        const caseData = await storage.getCase(caseId);
        if (!caseData) {
          return res.status(404).json({ message: "Không tìm thấy ca bệnh" });
        }
        
        if (user.role !== "admin" && caseData.userId !== user.id) {
          return res.status(403).json({ message: "Không có quyền chat về ca bệnh này" });
        }
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(503).json({ message: "Dịch vụ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên." });
      }

      let context: any = {};
      if (caseId) {
        const caseData = await storage.getCase(caseId);
        const medications = await storage.getMedicationsByCase(caseId);
        context.caseData = { ...caseData, medications };
      }

      const previousMessages = await storage.getChatMessagesByUser(user.id, caseId);
      context.previousMessages = previousMessages.slice(-10).map(m => ({
        role: "user",
        content: m.message,
      }));

      const systemStats = await storage.getSystemStatistics();
      context.systemStats = systemStats;

      const aiResponse = await chatWithAI(message, context);

      await storage.createChatMessage({
        userId: user.id,
        caseId: caseId || null,
        message: message,
        response: "",
      });

      const aiMessage = await storage.createChatMessage({
        userId: user.id,
        caseId: caseId || null,
        message: "",
        response: aiResponse,
      });

      res.json({ message: aiMessage, response: aiResponse });
    } catch (error: any) {
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return res.status(503).json({ message: "Dịch vụ AI không khả dụng" });
      }
      res.status(500).json({ message: "Lỗi khi chat với AI" });
    }
  });

  // Drug Formulary Routes (read-only for all authenticated users, write for admin only)
  app.get("/api/drugs", requireAuth, async (req, res) => {
    try {
      const { search } = req.query;
      const drugs = search 
        ? await storage.searchDrugs(search as string) 
        : await storage.getAllDrugs();
      res.json(drugs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/drugs/upload", requireAuth, requireRole("admin"), uploadDrug.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Không có file được tải lên" });
      }

      // Early size validation (redundant with multer but explicit for clarity)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ 
          message: `File quá lớn (${(req.file.size / 1024 / 1024).toFixed(2)}MB). Tối đa 10MB` 
        });
      }

      const isCSV = req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');
      const isExcel = req.file.mimetype.includes('spreadsheet') || 
                      req.file.originalname.endsWith('.xlsx') || 
                      req.file.originalname.endsWith('.xls');
      
      if (!isCSV && !isExcel) {
        return res.status(400).json({ message: "Chỉ hỗ trợ file Excel (.xlsx, .xls) hoặc CSV" });
      }

      let drugs: any[] = [];
      // Use AI for files > 5MB (still under 10MB limit enforced by multer + explicit check above)
      const useAI = req.file.size > 5 * 1024 * 1024;

      // CSV files: parse directly as text (no XLSX needed)
      if (isCSV) {
        console.log(`[Drug Upload] CSV file detected - ${useAI ? 'using AI extraction' : 'using CSV parsing'}`);
        
        try {
          const csvText = req.file.buffer.toString('utf-8');
          
          if (!csvText || csvText.trim().length === 0) {
            return res.status(400).json({ message: "File CSV rỗng" });
          }

          if (useAI) {
            // Large CSV: use AI extraction
            const extractedDrugs = await extractDrugDataFromFile(csvText);
            
            if (!extractedDrugs || extractedDrugs.length === 0) {
              return res.status(400).json({ 
                message: "AI không tìm thấy dữ liệu thuốc hợp lệ trong file CSV" 
              });
            }
            
            drugs = extractedDrugs;
          } else {
            // Small CSV: use XLSX to parse it
            const workbook = XLSX.read(csvText, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet);

            if (data.length === 0) {
              return res.status(400).json({ message: "File CSV không có dữ liệu" });
            }

            const firstRow: any = data[0];
            const hasVietnameseHeaders = 
              'Tên thuốc' in firstRow || 
              'Tên thuốc, nồng độ, hàm lượng' in firstRow || 
              'Hoạt chất' in firstRow || 
              'Tên hoạt chất' in firstRow;
            const hasEnglishHeaders = 'tradeName' in firstRow || 'activeIngredient' in firstRow;
            
            if (!hasVietnameseHeaders && !hasEnglishHeaders) {
              return res.status(400).json({ 
                message: "File CSV thiếu cột bắt buộc. Cần có: 'Tên thuốc', 'Tên hoạt chất' hoặc 'tradeName', 'activeIngredient'" 
              });
            }

            drugs = data.map((row: any) => ({
              drugCode: (row[' Mã dược '] ?? row['Mã dược'] ?? row['drugCode'] ?? '').toString().trim() || null,
              tradeName: (row['Tên thuốc, nồng độ, hàm lượng'] ?? row['Tên thuốc'] ?? row['tradeName'] ?? '').toString().trim(),
              activeIngredient: (row['Tên hoạt chất'] ?? row['Hoạt chất'] ?? row['activeIngredient'] ?? '').toString().trim(),
              strength: (row['Hàm lượng'] ?? row['strength'] ?? '').toString().trim(),
              unit: (row['Đơn vị tính'] ?? row['Đơn vị'] ?? row['unit'] ?? '').toString().trim(),
              manufacturer: row['Nhà sản xuất'] ?? row['manufacturer'] ?? null,
              notes: row['Ghi chú'] ?? row['notes'] ?? null,
            })).filter((drug: any) => drug.tradeName && drug.activeIngredient);

            if (drugs.length === 0) {
              return res.status(400).json({ 
                message: `Không tìm thấy dữ liệu hợp lệ trong file CSV. Tất cả ${data.length} dòng đều thiếu tên thuốc hoặc hoạt chất.` 
              });
            }
          }
        } catch (error: any) {
          console.error("[Drug Upload CSV Path Error]", error);
          return res.status(400).json({ 
            message: `Lỗi khi xử lý file CSV: ${error.message || 'File có thể bị hỏng hoặc định dạng không đúng'}` 
          });
        }
        
      } else if (useAI) {
        // Large Excel files: use AI extraction
        console.log(`[Drug Upload] File size ${(req.file.size / 1024 / 1024).toFixed(2)}MB - using AI extraction`);
        
        try {
          // Convert Excel to text for AI processing (no JSON parsing)
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            return res.status(400).json({ message: "File Excel không có sheet nào" });
          }
          
          const sheet = workbook.Sheets[sheetName];
          const fileText = XLSX.utils.sheet_to_csv(sheet);
          
          if (!fileText || fileText.trim().length === 0) {
            return res.status(400).json({ message: "File Excel không có dữ liệu" });
          }
          
          console.log(`[Drug Upload] Converted Excel to CSV text (${fileText.length} chars)`);
          
          // Use AI to extract drug data (AI returns structured array)
          const extractedDrugs = await extractDrugDataFromFile(fileText);
          
          if (!extractedDrugs || extractedDrugs.length === 0) {
            return res.status(400).json({ 
              message: "AI không tìm thấy dữ liệu thuốc hợp lệ trong file" 
            });
          }
          
          // AI already returns structured data, just assign it
          drugs = extractedDrugs;
        } catch (error: any) {
          console.error("[Drug Upload AI Path Error]", error);
          return res.status(400).json({ 
            message: `Lỗi khi xử lý file Excel: ${error.message || 'File có thể bị hỏng hoặc định dạng không đúng'}` 
          });
        }
        
      } else {
        console.log(`[Drug Upload] File size ${(req.file.size / 1024 / 1024).toFixed(2)}MB - using XLSX parsing`);
        
        try {
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            return res.status(400).json({ message: "File Excel không có sheet nào" });
          }
          
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);

          if (data.length === 0) {
            return res.status(400).json({ message: "File không có dữ liệu" });
          }

          // Validate required columns (support multiple Vietnamese header formats)
          const firstRow: any = data[0];
          const hasVietnameseHeaders = 
            'Tên thuốc' in firstRow || 
            'Tên thuốc, nồng độ, hàm lượng' in firstRow || 
            'Hoạt chất' in firstRow || 
            'Tên hoạt chất' in firstRow;
          const hasEnglishHeaders = 'tradeName' in firstRow || 'activeIngredient' in firstRow;
          
          if (!hasVietnameseHeaders && !hasEnglishHeaders) {
            return res.status(400).json({ 
              message: "File thiếu cột bắt buộc. Cần có: 'Tên thuốc', 'Tên hoạt chất' hoặc 'tradeName', 'activeIngredient'" 
            });
          }

          drugs = data.map((row: any) => ({
            drugCode: (row[' Mã dược '] ?? row['Mã dược'] ?? row['drugCode'] ?? '').toString().trim() || null,
            tradeName: (row['Tên thuốc, nồng độ, hàm lượng'] ?? row['Tên thuốc'] ?? row['tradeName'] ?? '').toString().trim(),
            activeIngredient: (row['Tên hoạt chất'] ?? row['Hoạt chất'] ?? row['activeIngredient'] ?? '').toString().trim(),
            strength: (row['Hàm lượng'] ?? row['strength'] ?? '').toString().trim(),
            unit: (row['Đơn vị tính'] ?? row['Đơn vị'] ?? row['unit'] ?? '').toString().trim(),
            manufacturer: row['Nhà sản xuất'] ?? row['manufacturer'] ?? null,
            notes: row['Ghi chú'] ?? row['notes'] ?? null,
          })).filter((drug: any) => drug.tradeName && drug.activeIngredient);

          if (drugs.length === 0) {
            return res.status(400).json({ 
              message: `Không tìm thấy dữ liệu hợp lệ trong file. Kiểm tra ${data.length} dòng, tất cả đều thiếu tên thuốc hoặc hoạt chất.` 
            });
          }
        } catch (error: any) {
          console.error("[Drug Upload XLSX Path Error]", error);
          return res.status(400).json({ 
            message: `Lỗi khi xử lý file Excel: ${error.message || 'File có thể bị hỏng hoặc định dạng không đúng'}` 
          });
        }
      }

      // Validate each drug with schema
      const validDrugs = [];
      const errors = [];
      
      for (let i = 0; i < drugs.length; i++) {
        try {
          const validated = insertDrugFormularySchema.parse(drugs[i]);
          validDrugs.push(validated);
        } catch (error: any) {
          errors.push(`Dòng ${i + 2}: ${error.message}`);
        }
      }

      if (validDrugs.length === 0) {
        return res.status(400).json({ 
          message: "Không có dữ liệu hợp lệ để import",
          errors: errors.slice(0, 5)
        });
      }

      const inserted = await storage.createDrugsBatch(validDrugs);
      
      // Invalidate cache to show updated drugs immediately
      invalidateDrugFormularyCache();
      
      const skippedCount = validDrugs.length - inserted.length;
      const response: any = { 
        message: `Đã import thành công ${inserted.length}/${drugs.length} thuốc${useAI ? ' (sử dụng AI)' : ''}${skippedCount > 0 ? ` (${skippedCount} bị bỏ qua vì trùng lặp)` : ''}`,
        count: inserted.length,
        skipped: skippedCount
      };
      
      if (errors.length > 0) {
        response.warnings = `${errors.length} dòng bị bỏ qua do lỗi validation`;
        response.errorSample = errors.slice(0, 3);
      }
      
      res.json(response);
    } catch (error: any) {
      console.error("[Drug Upload Error]", error);
      res.status(500).json({ message: error.message || "Lỗi khi upload danh mục thuốc" });
    }
  });

  app.post("/api/drugs", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const validated = insertDrugFormularySchema.parse(req.body);
      const drug = await storage.createDrug(validated);
      invalidateDrugFormularyCache(); // Immediate cache refresh
      res.json(drug);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/drugs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const drug = await storage.updateDrug(req.params.id, req.body);
      if (!drug) {
        return res.status(404).json({ message: "Không tìm thấy thuốc" });
      }
      invalidateDrugFormularyCache(); // Immediate cache refresh
      res.json(drug);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/drugs/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteDrug(req.params.id);
      invalidateDrugFormularyCache(); // Immediate cache refresh
      res.json({ message: "Đã xóa thuốc" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/library", requireAuth, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const docs = category 
        ? await storage.getReferenceDocumentsByCategory(category)
        : await storage.getAllReferenceDocuments();
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/library/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getReferenceDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: "Không tìm thấy tài liệu tham khảo" });
      }
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const uploadLibrary = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.ms-powerpoint', // .ppt
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX'));
      }
    }
  });

  app.post("/api/library", requireAuth, uploadLibrary.single('file'), async (req, res) => {
    let filePath: string | null = null;
    
    try {
      const user = req.user!;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "Không có file nào được tải lên" });
      }

      const validated = insertReferenceDocumentSchema.parse({
        title: req.body.title,
        description: req.body.description || null,
        category: req.body.category,
        fileName: file.originalname,
        fileType: path.extname(file.originalname).substring(1),
        filePath: '',
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: user.id,
        extractedText: null
      });

      const libraryDir = path.resolve(uploadsDir, 'library');
      if (!fs.existsSync(libraryDir)) {
        fs.mkdirSync(libraryDir, { recursive: true });
      }

      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
      filePath = path.resolve(libraryDir, uniqueFilename);
      
      if (!filePath.startsWith(libraryDir)) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      
      fs.writeFileSync(filePath, file.buffer);

      const relativePath = path.join('uploads', 'library', uniqueFilename);
      
      let extractedText = '';
      let extractionFailed = false;
      try {
        if (file.mimetype === 'application/pdf') {
          const data = new Uint8Array(file.buffer);
          const loadingTask = pdfjsLib.getDocument({ data });
          const pdfDocument = await loadingTask.promise;
          
          const textParts = [];
          for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            textParts.push(pageText);
          }
          extractedText = textParts.join('\n\n');
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          extractedText = result.value;
        } else if (
          file.mimetype === 'application/msword' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.mimetype === 'application/vnd.ms-powerpoint'
        ) {
          // Parse DOC, PPTX, PPT using officeParser
          extractedText = await officeParser.parseOfficeAsync(file.buffer);
        } else if (
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
          // Parse Excel files
          const workbook = XLSX.read(file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          if (sheetName) {
            const sheet = workbook.Sheets[sheetName];
            extractedText = XLSX.utils.sheet_to_csv(sheet);
          }
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
          extractionFailed = true;
        }
      } catch (extractError) {
        console.error('[Text Extraction Error]', extractError);
        extractionFailed = true;
      }
      
      if (extractionFailed) {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(422).json({ 
          message: "Không thể trích xuất văn bản từ file. Vui lòng kiểm tra file có nội dung văn bản." 
        });
      }
      
      const doc = await storage.createReferenceDocument({
        ...validated,
        filePath: relativePath,
        extractedText
      });

      res.status(201).json(doc);
    } catch (error: any) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error('[File Cleanup Error]', cleanupError);
        }
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/library/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const doc = await storage.getReferenceDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ message: "Không tìm thấy tài liệu tham khảo" });
      }

      try {
        const fullPath = path.resolve(__dirname, '..', doc.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (fileError) {
        console.error('[File Delete Error]', fileError);
      }

      await storage.deleteReferenceDocument(req.params.id);
      res.json({ message: "Đã xóa tài liệu tham khảo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // REPORTS API
  // ============================================
  app.get("/api/reports", requireAuth, async (req, res) => {
    try {
      const { type = 'monthly', month } = req.query;
      const userId = req.user!.id;

      // Parse month parameter (YYYY-MM)
      let startDate: Date;
      let endDate: Date;

      if (month && typeof month === 'string') {
        const [year, monthNum] = month.split('-').map(Number);
        startDate = new Date(year, monthNum - 1, 1);
        endDate = new Date(year, monthNum, 0, 23, 59, 59); // Last day of month
      } else {
        // Default to current month
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      // Fetch cases in date range
      const casesData = await db.select()
        .from(cases)
        .where(
          and(
            eq(cases.userId, userId),
            gte(cases.createdAt, startDate),
            lte(cases.createdAt, endDate)
          )
        );

      // Fetch all medications for these cases
      const caseIds = casesData.map(c => c.id);
      const medicationsData = caseIds.length > 0
        ? await db.select()
            .from(medications)
            .where(inArray(medications.caseId, caseIds))
        : [];

      // Calculate statistics
      const totalCases = casesData.length;
      const totalMedications = medicationsData.length;

      // Count medication frequency
      const medicationCounts = new Map<string, number>();
      for (const med of medicationsData) {
        const key = med.drugName;
        medicationCounts.set(key, (medicationCounts.get(key) || 0) + 1);
      }

      // Top 10 medications
      const topMedications = Array.from(medicationCounts.entries())
        .map(([drugName, count]) => ({ drugName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Fetch analyses to count interactions
      const analysesData = caseIds.length > 0
        ? await db.select()
            .from(analyses)
            .where(inArray(analyses.caseId, caseIds))
        : [];

      let totalInteractions = 0;
      let totalDoseAdjustments = 0;
      const interactionCounts = new Map<string, number>();

      for (const analysis of analysesData) {
        try {
          const structured = typeof analysis.result === 'string'
            ? JSON.parse(analysis.result)
            : analysis.result;

          if (structured?.drugDrugInteractions) {
            totalInteractions += structured.drugDrugInteractions.length;
            for (const interaction of structured.drugDrugInteractions) {
              const key = interaction.substring(0, 100); // Truncate for grouping
              interactionCounts.set(key, (interactionCounts.get(key) || 0) + 1);
            }
          }

          if (structured?.doseAdjustments) {
            totalDoseAdjustments += structured.doseAdjustments.length;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }

      // Top interactions
      const topInteractions = Array.from(interactionCounts.entries())
        .map(([description, count]) => ({ description, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json({
        totalCases,
        totalMedications,
        totalInteractions,
        totalDoseAdjustments,
        topMedications,
        topInteractions,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[Reports Error]', error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
