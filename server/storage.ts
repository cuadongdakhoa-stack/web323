import { db } from "./db";
import { 
  users, type User, type InsertUser,
  cases, type Case, type InsertCase,
  medications, type Medication, type InsertMedication,
  analyses, type Analysis, type InsertAnalysis,
  evidence, type Evidence, type InsertEvidence,
  chatMessages, type ChatMessage, type InsertChatMessage,
  consultationReports, type ConsultationReport, type InsertConsultationReport,
  uploadedFiles, type UploadedFile, type InsertUploadedFile,
  drugFormulary, type DrugFormulary, type InsertDrugFormulary,
  referenceDocuments, type ReferenceDocument, type InsertReferenceDocument
} from "@shared/schema";
import { eq, desc, and, or, sql, ilike } from "drizzle-orm";
import bcrypt from "bcrypt";

// Helper function to handle database errors
function handleDbError(error: any, operation: string): never {
  console.error(`[Storage] Error in ${operation}:`, error);
  
  // More specific error messages based on error type
  if (error.code === '23505') {
    throw new Error(`Duplicate entry: ${error.detail || 'Record already exists'}`);
  } else if (error.code === '23503') {
    throw new Error(`Foreign key constraint violation: ${error.detail || 'Referenced record not found'}`);
  } else if (error.code === '23502') {
    throw new Error(`Missing required field: ${error.column || 'A required field is missing'}`);
  } else if (error.code === '42703') {
    throw new Error(`Database schema error: Column does not exist. Please run migrations.`);
  } else if (error.message?.includes('connection') || error.message?.includes('timeout')) {
    throw new Error(`Database connection error: ${error.message}`);
  }
  
  throw new Error(`Database error in ${operation}: ${error.message || 'Unknown error'}`);
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  getCase(id: string): Promise<Case | undefined>;
  getCasesByUser(userId: string): Promise<Case[]>;
  getAllCases(): Promise<Case[]>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: string, caseData: Partial<InsertCase>): Promise<Case | undefined>;
  deleteCase(id: string): Promise<void>;
  
  getMedicationsByCase(caseId: string): Promise<Medication[]>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  createMedicationsBatch(medications: InsertMedication[]): Promise<Medication[]>;
  updateMedication(id: string, medication: Partial<InsertMedication>): Promise<Medication | undefined>;
  deleteMedication(id: string): Promise<void>;
  
  getAnalysesByCase(caseId: string): Promise<Analysis[]>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  updateAnalysis(id: string, analysis: Partial<InsertAnalysis>): Promise<Analysis | undefined>;
  
  getEvidenceByCase(caseId: string): Promise<Evidence[]>;
  getEvidenceByAnalysis(analysisId: string): Promise<Evidence[]>;
  createEvidence(evidence: InsertEvidence): Promise<Evidence>;
  updateEvidence(id: string, evidence: Partial<InsertEvidence>): Promise<Evidence | undefined>;
  
  getChatMessagesByUser(userId: string, caseId?: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  getConsultationReportByCase(caseId: string): Promise<ConsultationReport | undefined>;
  createConsultationReport(report: InsertConsultationReport): Promise<ConsultationReport>;
  updateConsultationReport(id: string, report: Partial<InsertConsultationReport>): Promise<ConsultationReport | undefined>;
  
  getUploadedFilesByCase(caseId: string, fileGroup?: string): Promise<UploadedFile[]>;
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  deleteUploadedFile(id: string): Promise<void>;
  
  getAllDrugs(): Promise<DrugFormulary[]>;
  searchDrugs(query: string): Promise<DrugFormulary[]>;
  createDrug(drug: InsertDrugFormulary): Promise<DrugFormulary>;
  createDrugsBatch(drugs: InsertDrugFormulary[]): Promise<DrugFormulary[]>;
  updateDrug(id: string, drug: Partial<InsertDrugFormulary>): Promise<DrugFormulary | undefined>;
  deleteDrug(id: string): Promise<void>;
  
  getAllReferenceDocuments(): Promise<ReferenceDocument[]>;
  getReferenceDocumentsByCategory(category: string): Promise<ReferenceDocument[]>;
  getReferenceDocument(id: string): Promise<ReferenceDocument | undefined>;
  createReferenceDocument(doc: InsertReferenceDocument): Promise<ReferenceDocument>;
  updateReferenceDocument(id: string, doc: Partial<InsertReferenceDocument>): Promise<ReferenceDocument | undefined>;
  deleteReferenceDocument(id: string): Promise<void>;
  
  getSystemStatistics(): Promise<{
    totalCases: number;
    totalPatients: number;
    topDiagnoses: { diagnosis: string; count: number }[];
    topMedications: { drugName: string; count: number }[];
  }>;
}

export class PostgresStorage implements IStorage {
    async createMedicationsBatch(meds: InsertMedication[]): Promise<Medication[]> {
      if (!Array.isArray(meds) || meds.length === 0) return [];
      const result = await db.insert(medications).values(meds).returning();
      return result;
    }
  private systemStatsCache: {
    data: {
      totalCases: number;
      totalPatients: number;
      topDiagnoses: { diagnosis: string; count: number }[];
      topMedications: { drugName: string; count: number }[];
    } | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };
  private readonly STATS_CACHE_TTL = 5 * 60 * 1000;

  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      handleDbError(error, 'getUser');
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      handleDbError(error, 'getUserByUsername');
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      const result = await db.insert(users).values({
        ...insertUser,
        password: hashedPassword,
      }).returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'createUser');
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return db.select().from(users);
    } catch (error) {
      handleDbError(error, 'getAllUsers');
    }
  }

  async getCase(id: string): Promise<Case | undefined> {
    try {
      const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
      return result[0];
    } catch (error) {
      handleDbError(error, 'getCase');
    }
  }

  async getCasesByUser(userId: string): Promise<Case[]> {
    try {
      return db.select().from(cases).where(eq(cases.userId, userId)).orderBy(desc(cases.createdAt));
    } catch (error) {
      handleDbError(error, 'getCasesByUser');
    }
  }

  async getAllCases(): Promise<Case[]> {
    try {
      return db.select().from(cases).orderBy(desc(cases.createdAt));
    } catch (error) {
      handleDbError(error, 'getAllCases');
    }
  }

  async createCase(caseData: InsertCase): Promise<Case> {
    try {
      const result = await db.insert(cases).values(caseData).returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'createCase');
    }
  }

  async updateCase(id: string, caseData: Partial<InsertCase>): Promise<Case | undefined> {
    try {
      const result = await db.update(cases)
        .set({ ...caseData, updatedAt: new Date() })
        .where(eq(cases.id, id))
        .returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'updateCase');
    }
  }

  async deleteCase(id: string): Promise<void> {
    try {
      await db.delete(cases).where(eq(cases.id, id));
    } catch (error) {
      handleDbError(error, 'deleteCase');
    }
  }

  async getMedicationsByCase(caseId: string): Promise<Medication[]> {
    try {
      return db.select().from(medications)
        .where(eq(medications.caseId, caseId))
        .orderBy(medications.orderIndex);
    } catch (error) {
      handleDbError(error, 'getMedicationsByCase');
    }
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    try {
      const result = await db.insert(medications).values(medication).returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'createMedication');
    }
  }

  async updateMedication(id: string, medication: Partial<InsertMedication>): Promise<Medication | undefined> {
    try {
      const result = await db.update(medications)
        .set(medication)
        .where(eq(medications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'updateMedication');
    }
  }

  async deleteMedication(id: string): Promise<void> {
    try {
      await db.delete(medications).where(eq(medications.id, id));
    } catch (error) {
      handleDbError(error, 'deleteMedication');
    }
  }

  async getAnalysesByCase(caseId: string): Promise<Analysis[]> {
    try {
      return db.select().from(analyses)
        .where(eq(analyses.caseId, caseId))
        .orderBy(desc(analyses.createdAt));
    } catch (error) {
      handleDbError(error, 'getAnalysesByCase');
    }
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    try {
      const result = await db.insert(analyses).values(analysis).returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'createAnalysis');
    }
  }

  async updateAnalysis(id: string, analysis: Partial<InsertAnalysis>): Promise<Analysis | undefined> {
    try {
      const result = await db.update(analyses)
        .set(analysis)
        .where(eq(analyses.id, id))
        .returning();
      return result[0];
    } catch (error) {
      handleDbError(error, 'updateAnalysis');
    }
  }

  async getEvidenceByCase(caseId: string): Promise<Evidence[]> {
    return db.select().from(evidence)
      .where(eq(evidence.caseId, caseId))
      .orderBy(desc(evidence.createdAt));
  }

  async getEvidenceByAnalysis(analysisId: string): Promise<Evidence[]> {
    return db.select().from(evidence)
      .where(eq(evidence.analysisId, analysisId))
      .orderBy(desc(evidence.createdAt));
  }

  async createEvidence(evidenceData: InsertEvidence): Promise<Evidence> {
    const result = await db.insert(evidence).values(evidenceData).returning();
    return result[0];
  }

  async updateEvidence(id: string, evidenceData: Partial<InsertEvidence>): Promise<Evidence | undefined> {
    const result = await db.update(evidence)
      .set(evidenceData)
      .where(eq(evidence.id, id))
      .returning();
    return result[0];
  }

  async getChatMessagesByUser(userId: string, caseId?: string): Promise<ChatMessage[]> {
    if (caseId) {
      return db.select().from(chatMessages)
        .where(and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.caseId, caseId)
        ))
        .orderBy(chatMessages.createdAt);
    }
    return db.select().from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  }

  async getConsultationReportByCase(caseId: string): Promise<ConsultationReport | undefined> {
    const result = await db.select().from(consultationReports)
      .where(eq(consultationReports.caseId, caseId))
      .orderBy(desc(consultationReports.createdAt))
      .limit(1);
    return result[0];
  }

  async createConsultationReport(report: InsertConsultationReport): Promise<ConsultationReport> {
    const result = await db.insert(consultationReports).values(report).returning();
    return result[0];
  }

  async updateConsultationReport(id: string, report: Partial<InsertConsultationReport>): Promise<ConsultationReport | undefined> {
    const result = await db.update(consultationReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(consultationReports.id, id))
      .returning();
    return result[0];
  }

  async getUploadedFilesByCase(caseId: string, fileGroup?: string): Promise<UploadedFile[]> {
    if (fileGroup) {
      return db.select().from(uploadedFiles)
        .where(and(
          eq(uploadedFiles.caseId, caseId),
          eq(uploadedFiles.fileGroup, fileGroup)
        ))
        .orderBy(desc(uploadedFiles.createdAt));
    }
    return db.select().from(uploadedFiles)
      .where(eq(uploadedFiles.caseId, caseId))
      .orderBy(desc(uploadedFiles.createdAt));
  }

  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const result = await db.insert(uploadedFiles).values(file).returning();
    return result[0];
  }

  async deleteUploadedFile(id: string): Promise<void> {
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
  }

  async getAllDrugs(): Promise<DrugFormulary[]> {
    return db.select().from(drugFormulary).orderBy(drugFormulary.tradeName);
  }

  async searchDrugs(query: string): Promise<DrugFormulary[]> {
    const trimmedQuery = query.trim();
    const searchPattern = `%${trimmedQuery}%`;
    return db.select().from(drugFormulary)
      .where(or(
        ilike(drugFormulary.tradeName, searchPattern),
        ilike(drugFormulary.activeIngredient, searchPattern),
        ilike(drugFormulary.manufacturer, searchPattern)
      ))
      .orderBy(drugFormulary.tradeName);
  }

  async createDrug(drug: InsertDrugFormulary): Promise<DrugFormulary> {
    const result = await db.insert(drugFormulary).values(drug).returning();
    return result[0];
  }

  async createDrugsBatch(drugs: InsertDrugFormulary[]): Promise<DrugFormulary[]> {
    if (drugs.length === 0) return [];
    const result = await db.insert(drugFormulary).values(drugs).returning();
    return result;
  }

  async updateDrug(id: string, drug: Partial<InsertDrugFormulary>): Promise<DrugFormulary | undefined> {
    const result = await db.update(drugFormulary)
      .set({ ...drug, updatedAt: new Date() })
      .where(eq(drugFormulary.id, id))
      .returning();
    return result[0];
  }

  async deleteDrug(id: string): Promise<void> {
    await db.delete(drugFormulary).where(eq(drugFormulary.id, id));
  }

  async getAllReferenceDocuments(): Promise<ReferenceDocument[]> {
    return db.select().from(referenceDocuments).orderBy(desc(referenceDocuments.createdAt));
  }

  async getReferenceDocumentsByCategory(category: string): Promise<ReferenceDocument[]> {
    return db.select().from(referenceDocuments)
      .where(eq(referenceDocuments.category, category))
      .orderBy(desc(referenceDocuments.createdAt));
  }

  async getReferenceDocument(id: string): Promise<ReferenceDocument | undefined> {
    const result = await db.select().from(referenceDocuments).where(eq(referenceDocuments.id, id)).limit(1);
    return result[0];
  }

  async createReferenceDocument(doc: InsertReferenceDocument): Promise<ReferenceDocument> {
    const result = await db.insert(referenceDocuments).values(doc).returning();
    return result[0];
  }

  async updateReferenceDocument(id: string, doc: Partial<InsertReferenceDocument>): Promise<ReferenceDocument | undefined> {
    const result = await db.update(referenceDocuments)
      .set({ ...doc, updatedAt: new Date() })
      .where(eq(referenceDocuments.id, id))
      .returning();
    return result[0];
  }

  async deleteReferenceDocument(id: string): Promise<void> {
    await db.delete(referenceDocuments).where(eq(referenceDocuments.id, id));
  }

  async getSystemStatistics() {
    try {
      const now = Date.now();
      if (this.systemStatsCache.data && (now - this.systemStatsCache.timestamp < this.STATS_CACHE_TTL)) {
        return this.systemStatsCache.data;
      }

      const totalCasesResult = await db.select({
        count: sql<number>`count(*)::int`
      }).from(cases);
      const totalCases = totalCasesResult[0]?.count || 0;

    const totalPatientsResult = await db.select({
      count: sql<number>`count(distinct lower(${cases.patientName}))::int`
    }).from(cases).where(sql`${cases.patientName} IS NOT NULL`);
    const totalPatients = totalPatientsResult[0]?.count || 0;

    const topDiagnosesResult = await db.select({
      diagnosis: sql<string>`coalesce(${cases.diagnosisMain}, ${cases.diagnosis})`.as('diagnosis'),
      count: sql<number>`count(*)::int`.as('count')
    })
    .from(cases)
    .where(sql`coalesce(${cases.diagnosisMain}, ${cases.diagnosis}) IS NOT NULL AND trim(coalesce(${cases.diagnosisMain}, ${cases.diagnosis})) != ''`)
    .groupBy(sql`coalesce(${cases.diagnosisMain}, ${cases.diagnosis})`)
    .orderBy(sql`count(*) desc`)
    .limit(5);

    const topMedicationsResult = await db.select({
      drugName: sql<string>`lower(trim(${medications.drugName}))`.as('drugName'),
      count: sql<number>`count(*)::int`.as('count')
    })
    .from(medications)
    .where(sql`${medications.drugName} IS NOT NULL AND trim(${medications.drugName}) != ''`)
    .groupBy(sql`lower(trim(${medications.drugName}))`)
    .orderBy(sql`count(*) desc`)
    .limit(10);

    const stats = {
      totalCases,
      totalPatients,
      topDiagnoses: topDiagnosesResult.map(r => ({ 
        diagnosis: r.diagnosis || '', 
        count: r.count 
      })),
      topMedications: topMedicationsResult.map(r => ({ 
        drugName: r.drugName || '', 
        count: r.count 
      })),
    };

    this.systemStatsCache.data = stats;
    this.systemStatsCache.timestamp = now;

    return stats;
    } catch (error) {
      handleDbError(error, 'getSystemStatistics');
    }
  }
}

export const storage = new PostgresStorage();
