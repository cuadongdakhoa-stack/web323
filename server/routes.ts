import type { Express } from "express";
import { createServer, type Server } from "http";
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
  medications,
  analyses,
  evidence
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { 
  analyzePatientCase,
  searchMedicalEvidence,
  generateConsultationForm,
  chatWithAI,
  extractDataFromDocument,
  verifyWithPipeline
} from "./openrouter";

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      await storage.deleteCase(req.params.id);
      res.json({ message: "Đã xóa ca bệnh" });
    } catch (error: any) {
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
      const validatedData = insertChatMessageSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      const message = await storage.createChatMessage(validatedData);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
      const report = await storage.updateConsultationReport(req.params.id, validatedData);
      res.json(report);
    } catch (error: any) {
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
