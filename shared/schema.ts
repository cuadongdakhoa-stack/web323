import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  department: text("department"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export interface AuthMeResponse {
  user: User;
}

export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  patientName: text("patient_name").notNull(),
  patientAge: integer("patient_age").notNull(),
  patientGender: text("patient_gender").notNull(),
  patientWeight: real("patient_weight"),
  patientHeight: real("patient_height"),
  admissionDate: timestamp("admission_date").notNull(),
  diagnosis: text("diagnosis").notNull(),
  diagnosisMain: text("diagnosis_main"),
  diagnosisSecondary: text("diagnosis_secondary").array(),
  icdCodes: jsonb("icd_codes"),
  medicalHistory: text("medical_history"),
  allergies: text("allergies"),
  labResults: jsonb("lab_results"),
  creatinine: real("creatinine"),
  creatinineUnit: text("creatinine_unit").default("mg/dL"),
  egfr: real("egfr"),
  egfrCategory: text("egfr_category"),
  renalFunction: text("renal_function"),
  uploadedFileName: text("uploaded_file_name"),
  uploadedFileData: text("uploaded_file_data"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

export const medications = pgTable("medications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  drugName: text("drug_name").notNull(),
  indication: text("indication"),
  prescribedDose: text("prescribed_dose").notNull(),
  prescribedFrequency: text("prescribed_frequency").notNull(),
  prescribedRoute: text("prescribed_route").notNull(),
  adjustedDose: text("adjusted_dose"),
  adjustedFrequency: text("adjusted_frequency"),
  adjustedRoute: text("adjusted_route"),
  adjustmentReason: text("adjustment_reason"),
  usageStartDate: timestamp("usage_start_date"),
  usageEndDate: timestamp("usage_end_date"),
  variableDosing: boolean("variable_dosing").default(false),
  selfSupplied: boolean("self_supplied").default(false),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
  createdAt: true,
}).extend({
  // ✅ Accept both string (from HTML date input) and Date objects
  usageStartDate: z.union([z.string(), z.date()]).nullable().optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  usageEndDate: z.union([z.string(), z.date()]).nullable().optional().transform((val) => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medications.$inferSelect;
export type MedicationWithStatus = Medication & {
  status: "active" | "stopped" | "unknown";
  activeIngredient?: string;
  strength?: string;
  unit?: string;
};

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  analysisType: text("analysis_type").notNull(),
  result: jsonb("result").notNull(),
  model: text("model").notNull(),
  prompt: text("prompt"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export const evidence = pgTable("evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id, { onDelete: "cascade" }),
  analysisId: varchar("analysis_id").references(() => analyses.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url"),
  summary: text("summary").notNull(),
  relevanceScore: real("relevance_score"),
  citationCount: integer("citation_count"),
  publicationYear: integer("publication_year"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  verifiedContent: text("verified_content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true,
  createdAt: true,
});
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type Evidence = typeof evidence.$inferSelect;

export const consultationReports = pgTable("consultation_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  reportContent: jsonb("report_content").notNull(),
  generatedBy: varchar("generated_by").notNull().references(() => users.id),
  approved: boolean("approved").notNull().default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const analysisResultSchema = z.object({
  initialAnalysis: z.object({
    renalAssessment: z.string().optional(),
    drugDrugInteractions: z.array(z.string()).optional(),
    drugDiseaseInteractions: z.array(z.string()).optional(),
    doseAdjustments: z.array(z.string()).optional(),
    monitoring: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  }).optional(),
  verified: z.boolean().optional(),
  evidenceFindings: z.union([z.string(), z.array(z.any())]).optional(),
  finalAnalysis: z.union([z.string(), z.object({}).passthrough()]).optional(),
}).passthrough();

export const reportContentSchema = z.object({
  consultationDate: z.string().optional(),
  pharmacistName: z.string().min(1, "Tên dược sĩ không được để trống"),
  patientInfo: z.object({
    name: z.string(),
    age: z.number().nullable().optional(),
    gender: z.string().nullable().optional(),
    // Legacy support (backward compatible)
    diagnosis: z.string().nullish(),
    // New structured diagnosis with ICD codes (separate fields)
    diagnosisMain: z.string().nullish(),
    diagnosisMainIcd: z.string().nullish(),  // ✅ Accepts null/undefined
    diagnosisSecondary: z.array(z.string()).nullish(),
    diagnosisSecondaryIcd: z.array(z.string()).nullish(),  // ✅ Accepts null/undefined
  }).optional(),
  clinicalAssessment: z.string().min(1, "Đánh giá lâm sàng không được để trống"),
  recommendations: z.array(z.string()).min(1, "Phải có ít nhất một khuyến nghị"),
  monitoring: z.array(z.string()).min(1, "Phải có ít nhất một mục theo dõi"),
  patientEducation: z.array(z.string()).min(1, "Phải có ít nhất một hướng dẫn"),
  followUp: z.string().min(1, "Kế hoạch tái khám không được để trống"),
});

export const insertConsultationReportSchema = createInsertSchema(consultationReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConsultationReport = z.infer<typeof insertConsultationReportSchema>;
export type ConsultationReport = typeof consultationReports.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  response: text("response").notNull(),
  caseId: varchar("case_id").references(() => cases.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileGroup: text("file_group").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  extractedData: jsonb("extracted_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  createdAt: true,
});
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;

export const drugFormulary = pgTable("drug_formulary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  drugCode: text("drug_code"), // Mã dược từ bệnh viện (VD: 270314.TBH075.TYT)
  tradeName: text("trade_name").notNull(),
  activeIngredient: text("active_ingredient").notNull(),
  strength: text("strength").notNull(),
  unit: text("unit").notNull(),
  manufacturer: text("manufacturer"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDrugFormularySchema = createInsertSchema(drugFormulary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDrugFormulary = z.infer<typeof insertDrugFormularySchema>;
export type DrugFormulary = typeof drugFormulary.$inferSelect;

export const referenceDocuments = pgTable("reference_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  extractedText: text("extracted_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferenceDocumentSchema = createInsertSchema(referenceDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReferenceDocument = z.infer<typeof insertReferenceDocumentSchema>;
export type ReferenceDocument = typeof referenceDocuments.$inferSelect;
