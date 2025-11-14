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
  reportContentSchema,
  analysisResultSchema,
  medications,
  analyses,
  evidence,
  uploadedFiles
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { 
  analyzePatientCase,
  searchMedicalEvidence,
  generateConsultationForm,
  chatWithAI,
  extractDataFromDocument,
  verifyWithPipeline,
  suggestDocuments
} from "./openrouter";
import multer from "multer";
import mammoth from "mammoth";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function registerRoutes(app: Express): Promise<Server> {
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

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file PDF hoặc DOCX'));
      }
    }
  });

  app.post("/api/cases/extract", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Không có file được tải lên" });
      }

      let textContent = "";
      let fileType: "pdf" | "docx" = "pdf";

      if (req.file.mimetype === 'application/pdf') {
        fileType = "pdf";
        
        // Parse PDF using pdfjs-dist
        try {
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(req.file.buffer),
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
        } catch (pdfError) {
          console.error('[PDF Parse Error]', pdfError);
          return res.status(500).json({ message: "Không thể đọc file PDF. Vui lòng thử lại." });
        }
        
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        fileType = "docx";
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        textContent = result.value;
      } else {
        return res.status(400).json({ message: "Định dạng file không được hỗ trợ" });
      }

      if (!textContent || textContent.trim().length === 0) {
        return res.status(400).json({ message: "File rỗng hoặc không thể trích xuất nội dung" });
      }

      if (textContent.trim().length < 50) {
        return res.status(400).json({ message: "Nội dung file quá ngắn, không đủ thông tin để trích xuất" });
      }

      // Send extracted text to DeepSeek AI
      const extractedData = await extractDataFromDocument(textContent, fileType);
      
      if (!extractedData || typeof extractedData !== 'object') {
        return res.status(500).json({ message: "AI không trả về dữ liệu hợp lệ" });
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
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Chỉ chấp nhận file PDF, DOCX, JPG, hoặc PNG'));
      }
    }
  });

  function validateFileGroup(fileGroup: string, mimetype: string): boolean {
    const groupRules: Record<string, string[]> = {
      admin: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      lab: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'],
      prescription: ['application/pdf', 'image/jpeg', 'image/png']
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
        return res.status(404).json({ message: "Không tìm thấy case lâm sàng" });
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
        return res.status(404).json({ message: "Không tìm thấy case lâm sàng" });
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
        return res.status(404).json({ message: "Không tìm thấy case lâm sàng" });
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
        return res.status(404).json({ message: "Không tìm thấy case lâm sàng" });
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
      res.json(medications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/medications", requireAuth, async (req, res) => {
    try {
      const validatedData = insertMedicationSchema.parse(req.body);
      const medication = await storage.createMedication(validatedData);
      res.status(201).json(medication);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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

      const analysisResult = await analyzePatientCase({
        ...caseData,
        medications,
      });

      const analysis = await storage.createAnalysis({
        caseId: req.params.id,
        analysisType: "patient_case",
        result: analysisResult,
        model: "deepseek-chat",
        status: "completed",
      });

      res.json(analysis);
    } catch (error: any) {
      console.error("Analysis error:", error);
      
      try {
        await storage.createAnalysis({
          caseId: req.params.id,
          analysisType: "patient_case",
          result: {},
          model: "deepseek-chat",
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

      const aiResponse = await chatWithAI(userMessage, {
        caseData,
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
        model: "deepseek-chat",
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
          summary: result,
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
        role: m.role,
        content: m.content,
      }));

      const aiResponse = await chatWithAI(message, context);

      await storage.createChatMessage({
        userId: user.id,
        caseId: caseId || null,
        role: "user",
        content: message,
      });

      const aiMessage = await storage.createChatMessage({
        userId: user.id,
        caseId: caseId || null,
        role: "assistant",
        content: aiResponse,
        model: "deepseek-chat",
      });

      res.json({ message: aiMessage, response: aiResponse });
    } catch (error: any) {
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return res.status(503).json({ message: "Dịch vụ AI không khả dụng" });
      }
      res.status(500).json({ message: "Lỗi khi chat với AI" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
