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
  drugFormulary, type DrugFormulary, type InsertDrugFormulary
} from "@shared/schema";
import { eq, desc, and, or, sql, like } from "drizzle-orm";
import bcrypt from "bcrypt";

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
}

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const result = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getCase(id: string): Promise<Case | undefined> {
    const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
    return result[0];
  }

  async getCasesByUser(userId: string): Promise<Case[]> {
    return db.select().from(cases).where(eq(cases.userId, userId)).orderBy(desc(cases.createdAt));
  }

  async getAllCases(): Promise<Case[]> {
    return db.select().from(cases).orderBy(desc(cases.createdAt));
  }

  async createCase(caseData: InsertCase): Promise<Case> {
    const result = await db.insert(cases).values(caseData).returning();
    return result[0];
  }

  async updateCase(id: string, caseData: Partial<InsertCase>): Promise<Case | undefined> {
    const result = await db.update(cases)
      .set({ ...caseData, updatedAt: new Date() })
      .where(eq(cases.id, id))
      .returning();
    return result[0];
  }

  async deleteCase(id: string): Promise<void> {
    await db.delete(cases).where(eq(cases.id, id));
  }

  async getMedicationsByCase(caseId: string): Promise<Medication[]> {
    return db.select().from(medications)
      .where(eq(medications.caseId, caseId))
      .orderBy(medications.orderIndex);
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    const result = await db.insert(medications).values(medication).returning();
    return result[0];
  }

  async updateMedication(id: string, medication: Partial<InsertMedication>): Promise<Medication | undefined> {
    const result = await db.update(medications)
      .set(medication)
      .where(eq(medications.id, id))
      .returning();
    return result[0];
  }

  async deleteMedication(id: string): Promise<void> {
    await db.delete(medications).where(eq(medications.id, id));
  }

  async getAnalysesByCase(caseId: string): Promise<Analysis[]> {
    return db.select().from(analyses)
      .where(eq(analyses.caseId, caseId))
      .orderBy(desc(analyses.createdAt));
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    const result = await db.insert(analyses).values(analysis).returning();
    return result[0];
  }

  async updateAnalysis(id: string, analysis: Partial<InsertAnalysis>): Promise<Analysis | undefined> {
    const result = await db.update(analyses)
      .set(analysis)
      .where(eq(analyses.id, id))
      .returning();
    return result[0];
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
    const searchPattern = `%${query}%`;
    return db.select().from(drugFormulary)
      .where(or(
        like(drugFormulary.tradeName, searchPattern),
        like(drugFormulary.activeIngredient, searchPattern),
        like(drugFormulary.manufacturer, searchPattern)
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
}

export const storage = new PostgresStorage();
