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
  medicalHistory: text("medical_history"),
  allergies: text("allergies"),
  labResults: jsonb("lab_results"),
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
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
  createdAt: true,
});
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medications.$inferSelect;

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

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  caseId: varchar("case_id").references(() => cases.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

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

export const insertConsultationReportSchema = createInsertSchema(consultationReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConsultationReport = z.infer<typeof insertConsultationReportSchema>;
export type ConsultationReport = typeof consultationReports.$inferSelect;
