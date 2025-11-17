import { z } from "zod";
import { storage } from "./storage";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

if (!OPENROUTER_API_KEY) {
  console.error("⚠️  WARNING: OPENROUTER_API_KEY is not set. AI features will not work.");
}

const extractedDataSchema = z.object({
  patientName: z.string().nullable().optional(),
  patientAge: z.number().nullable().optional(),
  patientGender: z.string().nullable().optional(),
  patientWeight: z.number().nullable().optional(),
  patientHeight: z.number().nullable().optional(),
  admissionDate: z.string().nullable().optional(), // ISO date YYYY-MM-DD
  
  // Chẩn đoán - bao gồm cả chính và phụ
  diagnosisMain: z.string().nullable().optional(),
  diagnosisSecondary: z.array(z.string()).nullable().optional(),
  icdCodes: z.object({
    main: z.string().nullable().optional(),
    secondary: z.array(z.string()).nullable().optional(),
  }).nullable().optional(),
  
  // Backward compatibility
  diagnosis: z.string().nullable().optional(),
  
  medicalHistory: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  labResults: z.object({
    creatinine: z.number().nullable().optional(),
    creatinineUnit: z.enum(["mg/dL", "micromol/L"]).nullable().optional(),
  }).nullable().optional(),
  
  // Medications với ngày tháng
  medications: z.array(z.object({
    drugName: z.string(),
    dose: z.string().nullable().optional(),
    frequency: z.string().nullable().optional(),
    route: z.string().nullable().optional(),
    usageStartDate: z.string().nullable().optional(), // ISO date YYYY-MM-DD
    usageEndDate: z.string().nullable().optional(),   // ISO date YYYY-MM-DD
  })).nullable().optional(),
});

const evidenceItemSchema = z.object({
  title: z.string(),
  source: z.string(),
  url: z.string().nullable().optional(),
  summary: z.string(),
  relevanceScore: z.number().nullable().optional(),
  publicationYear: z.number().nullable().optional(),
  citationCount: z.number().nullable().optional(),
});

const clinicalAnalysisSchema = z.object({
  renalAssessment: z.string(),
  drugDrugInteractions: z.array(z.string()),
  drugDrugInteractionGroups: z.array(z.object({
    rangeLabel: z.string(),
    interactions: z.array(z.string()),
  })).optional(),
  drugDiseaseInteractions: z.array(z.string()),
  doseAdjustments: z.array(z.string()),
  monitoring: z.array(z.string()),
  warnings: z.array(z.string()),
  additionalInfo: z.string().optional(),
});

const MODELS = {
  DEEPSEEK: "deepseek/deepseek-chat",
  PERPLEXITY: "perplexity/sonar-pro",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function buildReferenceDocumentsContext(categories?: string[]): Promise<string> {
  try {
    const allDocs = await storage.getAllReferenceDocuments();
    
    let filteredDocs = allDocs;
    if (categories && categories.length > 0) {
      filteredDocs = allDocs.filter(doc => categories.includes(doc.category));
    }
    
    if (filteredDocs.length === 0) {
      return '';
    }
    
    const docSummaries = filteredDocs.map((doc, idx) => {
      const excerpt = doc.extractedText && doc.extractedText.length > 500 
        ? doc.extractedText.substring(0, 500) + '...' 
        : (doc.extractedText || '');
      
      return `${idx + 1}. [${doc.category}] ${doc.title}${doc.description ? ` - ${doc.description}` : ''}\n   ${excerpt}`;
    }).join('\n\n');
    
    return `\n\n📚 TÀI LIỆU THAM KHẢO Y HỌC (${filteredDocs.length} tài liệu):\n\n${docSummaries}\n`;
  } catch (error) {
    console.error('[Reference Documents Context Error]', error);
    return '';
  }
}

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  temperature: number = 0.7
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured. Please set the environment variable.");
  }

  try {
    const requestBody = JSON.stringify({
      model,
      messages,
      temperature,
    });

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://cuadong-care-pharma.replit.app",
        "X-Title": "Cua Dong Care+ Pharma",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data: OpenRouterResponse = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response from OpenRouter API");
    }
    
    return data.choices[0].message.content;
  } catch (error: any) {
    if (error.message.includes("OPENROUTER_API_KEY")) {
      throw error;
    }
    throw new Error(`Failed to call OpenRouter API: ${error.message}`);
  }
}

export async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  return callOpenRouter(
    MODELS.DEEPSEEK,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature
  );
}

export async function callPerplexity(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3
): Promise<string> {
  return callOpenRouter(
    MODELS.PERPLEXITY,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature
  );
}

function cleanTextResponse(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text;
  
  // Step 1: Remove markdown code blocks
  cleaned = cleaned
    .replace(/^```[\w]*\s*/gm, '')
    .replace(/```\s*$/gm, '');
  
  // Step 2: If entire text is a JSON-escaped string, parse it once
  try {
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = JSON.parse(cleaned);
    }
  } catch {
    // Not a JSON string, continue
  }
  
  // Step 3: Remove ALL markdown formatting
  cleaned = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')      // *italic* → italic
    .replace(/#{1,6}\s+/g, '')          // # headings → remove
    .replace(/^\s*[-*+]\s+/gm, '')      // - list items → remove bullet
    .replace(/^\s*\d+\.\s+/gm, '')      // 1. numbered → remove number (keep text)
    .replace(/`([^`]+)`/g, '$1');       // `code` → code
  
  // Step 4: Unescape common sequences  
  cleaned = cleaned
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
  
  // Step 5: Remove embedded JSON objects (aggressive cleaning)
  cleaned = cleaned.replace(/\{\\?"[^"]*\\?":\s*\\?"[^"]*\\?"[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^}]*\\["'][^}]*\}/g, '');
  
  // Step 6: Clean up multiple newlines and extra spaces
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
    .replace(/  +/g, ' ')        // Multiple spaces to single
    .trim();
  
  return cleaned;
}

function removeMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/\*+/g, '')                          // Remove all * characters (**bold**, *italic*)
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')        // __underlined__ or _italic_ → text
    .replace(/#{1,6}\s+/g, '')                    // # headings → remove
    .replace(/^\s*[-+•●○]\s+/gm, '')              // Bullet points (-, +, •, ●, ○) → remove
    .replace(/^\s*\d+\.\s+/gm, '')                // Numbered lists (1., 2.) → remove number
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')        // `code` or ```code``` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')      // [link text](url) → link text
    .replace(/~~([^~]+)~~/g, '$1')                // ~~strikethrough~~ → text
    .replace(/^\s*>\s+/gm, '')                    // > blockquotes → remove
    .replace(/\|/g, '')                           // Table pipes → remove
    .replace(/^[-=]{3,}$/gm, '')                  // Horizontal rules → remove
    .trim();
}

function formatAnalysisToText(analysis: any): string {
  const sections: string[] = [];
  
  // Section 1: Đánh giá chức năng thận
  if (analysis.renalAssessment) {
    sections.push(`Đánh giá chức năng thận:\n${removeMarkdown(analysis.renalAssessment)}`);
  }
  
  // Section 2: Tương tác thuốc-thuốc (with groups if available)
  if (analysis.drugDrugInteractionGroups && analysis.drugDrugInteractionGroups.length > 0) {
    // Use grouped interactions
    const groupedSections = analysis.drugDrugInteractionGroups.map((group: any) => {
      const groupInteractions = group.interactions.map((item: string, idx: number) => 
        `  ${idx + 1}. ${removeMarkdown(item)}`
      ).join('\n');
      return `Tương tác thuốc (${group.rangeLabel}):\n${groupInteractions}`;
    }).join('\n\n');
    sections.push(groupedSections);
  } else if (analysis.drugDrugInteractions && analysis.drugDrugInteractions.length > 0) {
    // Fallback to flat interactions
    sections.push(`Tương tác thuốc-thuốc:\n${analysis.drugDrugInteractions.map((item: string, idx: number) => `${idx + 1}. ${removeMarkdown(item)}`).join('\n')}`);
  }
  
  // Section 3: Tương tác thuốc-bệnh
  if (analysis.drugDiseaseInteractions && analysis.drugDiseaseInteractions.length > 0) {
    sections.push(`Tương tác thuốc-bệnh:\n${analysis.drugDiseaseInteractions.map((item: string, idx: number) => `${idx + 1}. ${removeMarkdown(item)}`).join('\n')}`);
  }
  
  // Section 4: Điều chỉnh liều
  if (analysis.doseAdjustments && analysis.doseAdjustments.length > 0) {
    sections.push(`Điều chỉnh liều:\n${analysis.doseAdjustments.map((item: string, idx: number) => `${idx + 1}. ${removeMarkdown(item)}`).join('\n')}`);
  }
  
  // Section 5: Theo dõi
  if (analysis.monitoring && analysis.monitoring.length > 0) {
    sections.push(`Theo dõi:\n${analysis.monitoring.map((item: string, idx: number) => `${idx + 1}. ${removeMarkdown(item)}`).join('\n')}`);
  }
  
  // Section 6: Cảnh báo
  if (analysis.warnings && analysis.warnings.length > 0) {
    sections.push(`Cảnh báo:\n${analysis.warnings.map((item: string, idx: number) => `${idx + 1}. ${removeMarkdown(item)}`).join('\n')}`);
  }
  
  // Section 7: Thông tin bổ sung
  if (analysis.additionalInfo) {
    sections.push(`Thông tin bổ sung:\n${removeMarkdown(analysis.additionalInfo)}`);
  }
  
  return sections.join('\n\n');
}

export async function verifyWithPipeline(
  initialAnalysis: string,
  verificationQuery: string
): Promise<{ 
  verified: boolean; 
  perplexityFindings: string; 
  finalAnalysis: string;
  structuredAnalysis?: any;  // Optional structured data with grouped interactions
}> {
  const perplexitySystemPrompt = `Bạn là trợ lý nghiên cứu y khoa. Nhiệm vụ của bạn là tìm kiếm các bằng chứng khoa học, guidelines, và nghiên cứu mới nhất để kiểm tra tính chính xác của thông tin được cung cấp.`;
  
  const perplexityUserPrompt = `Hãy tìm kiếm và phân tích các bằng chứng y khoa cho câu hỏi sau:

${verificationQuery}

Thông tin cần kiểm chứng:
${initialAnalysis}

Hãy cung cấp:
1. Các guidelines hoặc nghiên cứu liên quan
2. Đánh giá tính chính xác của thông tin
3. Các thông tin bổ sung quan trọng
4. Nguồn tham khảo (nếu có)`;

  const perplexityFindings = await callPerplexity(
    perplexitySystemPrompt,
    perplexityUserPrompt
  );

  const deepseekVerificationSystemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp. Dựa trên kết quả tìm kiếm bằng chứng y khoa, hãy tạo phân tích có cấu trúc.

QUAN TRỌNG: CHỈ trả về JSON hợp lệ, KHÔNG thêm văn bản giải thích hay markdown. Response phải bắt đầu bằng { và kết thúc bằng }.`;

  const deepseekVerificationUserPrompt = `Phân tích ban đầu:
${initialAnalysis}

Kết quả tìm kiếm bằng chứng y khoa:
${perplexityFindings}

TRẢ VỀ CHỈ JSON HỢP LỆ (không có markdown, không có text khác):
{
  "renalAssessment": "Đánh giá chức năng thận chi tiết",
  "drugDrugInteractions": [
    "Tương tác thuốc 1 với giải thích",
    "Tương tác thuốc 2 với giải thích"
  ],
  "drugDrugInteractionGroups": [
    {
      "rangeLabel": "01/01/2024 - 05/01/2024",
      "interactions": ["Tương tác trong khoảng thời gian này"]
    }
  ],
  "drugDiseaseInteractions": [
    "Tương tác thuốc-bệnh 1 với giải thích"
  ],
  "doseAdjustments": [
    "Khuyến nghị điều chỉnh liều 1 với lý do",
    "Khuyến nghị điều chỉnh liều 2 với lý do"
  ],
  "monitoring": [
    "Hướng dẫn theo dõi 1",
    "Hướng dẫn theo dõi 2"
  ],
  "warnings": [
    "Cảnh báo quan trọng 1"
  ],
  "additionalInfo": "Thông tin bổ sung từ bằng chứng y khoa"
}

Lưu ý: 
- Mỗi field là STRING hoặc ARRAY of STRINGS hoặc ARRAY of OBJECTS (cho drugDrugInteractionGroups)
- KHÔNG dùng markdown (**, *, #) trong nội dung
- drugDrugInteractionGroups: CHỈ điền nếu phân tích ban đầu có nhóm thuốc theo thời gian`;

  const finalAnalysisRaw = await callDeepSeek(
    deepseekVerificationSystemPrompt,
    deepseekVerificationUserPrompt,
    0.5
  );

  let finalAnalysisJSON: any;
  try {
    let jsonString = finalAnalysisRaw.trim();
    
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw new Error("No valid JSON object found in response");
    }
    
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    
    const parsed = JSON.parse(jsonString);
    
    const validated = clinicalAnalysisSchema.safeParse(parsed);
    
    if (!validated.success) {
      console.error("Clinical analysis validation failed:", validated.error);
      throw new Error(`Validation failed: ${validated.error.message}`);
    }
    
    finalAnalysisJSON = validated.data;
  } catch (error: any) {
    console.error("Failed to parse final analysis JSON:", error, "\nRaw response:", finalAnalysisRaw);
    
    throw new Error(`AI trả về dữ liệu không hợp lệ. Vui lòng thử lại. Chi tiết: ${error.message}`);
  }

  const sanitizedJSON = {
    renalAssessment: removeMarkdown(finalAnalysisJSON.renalAssessment || ""),
    drugDrugInteractions: (finalAnalysisJSON.drugDrugInteractions || []).map((item: string) => removeMarkdown(item)),
    drugDrugInteractionGroups: finalAnalysisJSON.drugDrugInteractionGroups?.map((group: any) => ({
      rangeLabel: group.rangeLabel,
      interactions: group.interactions.map((item: string) => removeMarkdown(item))
    })) || [],
    drugDiseaseInteractions: (finalAnalysisJSON.drugDiseaseInteractions || []).map((item: string) => removeMarkdown(item)),
    doseAdjustments: (finalAnalysisJSON.doseAdjustments || []).map((item: string) => removeMarkdown(item)),
    monitoring: (finalAnalysisJSON.monitoring || []).map((item: string) => removeMarkdown(item)),
    warnings: (finalAnalysisJSON.warnings || []).map((item: string) => removeMarkdown(item)),
    additionalInfo: removeMarkdown(finalAnalysisJSON.additionalInfo || "")
  };

  const finalAnalysisText = formatAnalysisToText(sanitizedJSON);

  return {
    verified: true,
    perplexityFindings: cleanTextResponse(perplexityFindings),
    finalAnalysis: finalAnalysisText,
    structuredAnalysis: sanitizedJSON  // Preserve structured data for UI
  };
}

export async function analyzePatientCase(caseData: any, drugFormulary?: any[]): Promise<any> {
  const { groupMedicationsByDateOverlap } = await import('./medicationTimeline');
  
  const systemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp tại bệnh viện Việt Nam. Nhiệm vụ của bạn là phân tích ca bệnh và đưa ra khuyến nghị về điều chỉnh liều thuốc, tương tác thuốc, và các vấn đề liên quan.`;

  // Group medications by date overlap
  const medicationSegments = groupMedicationsByDateOverlap(caseData.medications || []);
  
  // Build drug formulary lookup map
  const drugLookup = new Map();
  if (drugFormulary && drugFormulary.length > 0) {
    drugFormulary.forEach((drug: any) => {
      drugLookup.set(drug.tradeName.toLowerCase(), drug);
    });
  }

  // Build medication timeline section for prompt
  let medicationTimelineSection = '';
  if (medicationSegments.length > 0) {
    medicationTimelineSection = medicationSegments.map((segment, idx) => {
      const medList = segment.medications.map((med: any, medIdx: number) => {
        const formularyInfo = drugLookup.get(med.drugName.toLowerCase());
        const drugInfo = formularyInfo 
          ? `${med.drugName} (${formularyInfo.activeIngredient} ${formularyInfo.strength}${formularyInfo.unit})`
          : med.drugName;
        return `   ${medIdx + 1}. ${drugInfo} - ${med.prescribedDose} ${med.prescribedRoute} ${med.prescribedFrequency}`;
      }).join('\n');
      
      return `Nhóm ${idx + 1} (${segment.rangeLabel}):\n${medList}\n   → CHỈ kiểm tra tương tác giữa các thuốc trong khoảng thời gian này, không xét thuốc ở nhóm khác.`;
    }).join('\n\n');
  } else {
    // Fallback to flat list if no grouping
    medicationTimelineSection = caseData.medications?.map((med: any, idx: number) => {
      const formularyInfo = drugLookup.get(med.drugName.toLowerCase());
      const drugInfo = formularyInfo 
        ? `${med.drugName} (${formularyInfo.activeIngredient} ${formularyInfo.strength}${formularyInfo.unit})`
        : med.drugName;
      return `
${idx + 1}. ${drugInfo}
   - Chỉ định: ${med.indication || "Không rõ"}
   - Liều hiện tại: ${med.prescribedDose} ${med.prescribedRoute} ${med.prescribedFrequency}
`;
    }).join("\n") || "Chưa có thuốc";
  }
  
  // Add formulary context note if available
  const formularyNote = (drugFormulary && drugFormulary.length > 0)
    ? `\n\nLƯU Ý: Hệ thống đã tra cứu ${drugFormulary.length} thuốc trong danh mục bệnh viện để bổ sung thông tin hoạt chất và hàm lượng chính xác.`
    : '';

  // Fetch reference documents for AI context
  const referenceContext = await buildReferenceDocumentsContext(['Guidelines', 'Pharmacology', 'Drug Information', 'Clinical Practice']);

  const userPrompt = `Hãy phân tích ca bệnh sau và cung cấp đánh giá lâm sàng:${referenceContext}

THÔNG TIN BỆNH NHÂN:
- Họ tên: ${caseData.patientName}
- Tuổi: ${caseData.patientAge}
- Giới tính: ${caseData.patientGender}
- Cân nặng: ${caseData.patientWeight || "Không có"} kg
- Chiều cao: ${caseData.patientHeight || "Không có"} cm

CHẨN ĐOÁN: ${caseData.diagnosis}

TIỀN SỬ BỆNH: ${caseData.medicalHistory || "Không có"}

DỊ ỨNG: ${caseData.allergies || "Không có"}

XÉT NGHIỆM: ${JSON.stringify(caseData.labResults || {}, null, 2)}

eGFR: ${caseData.egfr || "Chưa tính"} mL/min (Cockcroft-Gault)

DANH SÁCH THUỐC THEO THỜI GIAN SỬ DỤNG:
${medicationTimelineSection}${formularyNote}

QUAN TRỌNG - QUY TẮC KIỂM TRA TƯƠNG TÁC THUỐC:
${medicationSegments.length > 0 
  ? `- Danh sách thuốc đã được PHÂN NHÓM theo thời gian sử dụng
- CHỈ kiểm tra tương tác giữa các thuốc TRONG CÙNG NHÓM (cùng thời điểm)
- KHÔNG kiểm tra tương tác giữa thuốc ở nhóm này với thuốc ở nhóm khác
- Ví dụ: Thuốc ở Nhóm 1 KHÔNG tương tác với thuốc ở Nhóm 2 vì không dùng cùng lúc`
  : `- Danh sách thuốc CHƯA có thông tin ngày tháng rõ ràng
- Kiểm tra tất cả tương tác có thể xảy ra`}

Hãy cung cấp phân tích chi tiết bao gồm:
1. Đánh giá chức năng thận và tác động đến các thuốc
2. Kiểm tra tương tác thuốc-thuốc (${medicationSegments.length > 0 ? 'phân nhóm theo thời gian' : 'tổng hợp'})
3. Kiểm tra tương tác thuốc-bệnh
4. Khuyến nghị điều chỉnh liều (nếu cần)
5. Các lưu ý theo dõi và cảnh báo

TRẢ VỀ CHỈ JSON HỢP LỆ (không có markdown, không có text khác):
{
  "renalAssessment": "đánh giá chức năng thận",
  "drugDrugInteractions": ["tương tác tổng quan 1", "tương tác tổng quan 2"],
  "drugDrugInteractionGroups": [
    {
      "rangeLabel": "${medicationSegments[0]?.rangeLabel || 'Ngày không rõ'}",
      "interactions": ["tương tác cụ thể trong nhóm này"]
    }
  ],
  "drugDiseaseInteractions": ["tương tác bệnh 1"],
  "doseAdjustments": ["điều chỉnh 1", "điều chỉnh 2"],
  "monitoring": ["theo dõi 1", "theo dõi 2"],
  "warnings": ["cảnh báo 1"]
}

Lưu ý: 
- drugDrugInteractions: Tương tác chung (backward compatibility)
- drugDrugInteractionGroups: Tương tác phân nhóm theo thời gian (CHỈ điền nếu có >= 2 nhóm thuốc theo timeline)`;

  const rawAnalysis = await callDeepSeek(systemPrompt, userPrompt);
  
  let initialAnalysis: any;
  try {
    const cleanedAnalysis = rawAnalysis.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    initialAnalysis = JSON.parse(cleanedAnalysis);
  } catch (error: any) {
    console.error("Failed to parse analysis JSON:", error, "\nRaw:", rawAnalysis);
    initialAnalysis = { 
      error: "Lỗi phân tích JSON",
      rawResponse: rawAnalysis 
    };
  }

  const verificationQuery = `Kiểm tra khuyến nghị điều chỉnh liều thuốc cho bệnh nhân ${caseData.patientAge} tuổi với chẩn đoán ${caseData.diagnosis} và CrCl ${caseData.egfr || "không rõ"} mL/min (Cockcroft-Gault). Thuốc đang dùng: ${caseData.medications?.map((m: any) => m.drugName).join(", ")}`;

  const verified = await verifyWithPipeline(
    typeof initialAnalysis === 'string' ? initialAnalysis : JSON.stringify(initialAnalysis), 
    verificationQuery
  );

  return {
    initialAnalysis,
    verified: verified.verified,
    evidenceFindings: verified.perplexityFindings,
    finalAnalysis: verified.finalAnalysis,
    structuredAnalysis: verified.structuredAnalysis,  // ✅ Pass through from verifyWithPipeline
  };
}

export async function searchMedicalEvidence(query: string): Promise<any[]> {
  const systemPrompt = `Bạn là trợ lý nghiên cứu y khoa. QUAN TRỌNG: CHỈ trả về JSON hợp lệ, KHÔNG thêm văn bản giải thích.`;

  const userPrompt = `Tìm kiếm bằng chứng y khoa cho: ${query}

TRẢ VỀ CHỈ JSON array với các bằng chứng (không có markdown, không có text khác):
[
  {
    "title": "Tên guideline/nghiên cứu",
    "source": "Tên tổ chức/journal (AHA, ESC, KDIGO, PubMed, etc.)",
    "url": "URL nguồn (nếu có) hoặc null",
    "summary": "Tóm tắt findings và khuyến nghị",
    "relevanceScore": 0.9 (hoặc null),
    "publicationYear": 2024 (hoặc null),
    "citationCount": 100 (hoặc null)
  }
]

Tìm kiếm ít nhất 3-5 bằng chứng quan trọng nhất.`;

  const rawResult = await callPerplexity(systemPrompt, userPrompt);
  
  try {
    const cleanedResult = rawResult.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    const parsed = JSON.parse(cleanedResult);
    const evidenceArray = Array.isArray(parsed) ? parsed : [parsed];
    
    const validated = evidenceArray.map((item: any) => {
      const result = evidenceItemSchema.safeParse(item);
      if (result.success) {
        return result.data;
      } else {
        console.error("Evidence item validation failed:", result.error);
        return {
          title: item.title || "Unknown",
          source: item.source || "Perplexity",
          url: item.url || null,
          summary: item.summary || JSON.stringify(item),
          relevanceScore: null,
          publicationYear: null,
          citationCount: null,
        };
      }
    });
    
    return validated;
  } catch (error: any) {
    console.error("Failed to parse evidence JSON:", error, "\nRaw:", rawResult);
    return [{
      title: "Evidence Search Results",
      source: "Perplexity",
      url: null,
      summary: rawResult,
      relevanceScore: null,
      publicationYear: null,
      citationCount: null,
    }];
  }
}

export async function generateConsultationForm(
  caseData: any,
  analysisResult: any
): Promise<any> {
  const systemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp. Hãy tạo phiếu tư vấn sử dụng thuốc chuẩn y khoa cho bệnh viện. QUAN TRỌNG: CHỈ trả về JSON hợp lệ, KHÔNG thêm văn bản giải thích hay markdown.`;

  // Build structured diagnosis string
  let diagnosisText = '';
  if (caseData.diagnosisMain) {
    diagnosisText = caseData.diagnosisMain;
    if (caseData.diagnosisMainIcd) {
      diagnosisText += ` (${caseData.diagnosisMainIcd})`;
    }
  } else {
    diagnosisText = caseData.diagnosis || 'Không có chẩn đoán';
  }

  const secondaryDiagnoses = caseData.diagnosisSecondary && Array.isArray(caseData.diagnosisSecondary) 
    ? caseData.diagnosisSecondary.map((d: any, idx: number) => {
        const icd = caseData.diagnosisSecondaryIcd && caseData.diagnosisSecondaryIcd[idx] 
          ? ` (${caseData.diagnosisSecondaryIcd[idx]})` 
          : '';
        return `${d}${icd}`;
      })
    : [];

  const userPrompt = `Dựa trên thông tin ca bệnh và kết quả phân tích, hãy tạo phiếu tư vấn sử dụng thuốc:

THÔNG TIN BỆNH NHÂN:
- Họ tên: ${caseData.patientName}
- Tuổi: ${caseData.patientAge}
- Giới tính: ${caseData.patientGender}
- Chẩn đoán chính: ${diagnosisText}
${secondaryDiagnoses.length > 0 ? `- Chẩn đoán phụ: ${secondaryDiagnoses.join('; ')}` : ''}

KẾT QUẢ PHÂN TÍCH:
${JSON.stringify(analysisResult, null, 2)}

TRẢ VỀ CHỈ JSON HỢP LỆ (không có markdown, không có text khác):
{
  "consultationDate": "${new Date().toISOString().split('T')[0]}",
  "pharmacistName": "Dược sĩ lâm sàng",
  "patientInfo": {
    "name": "${caseData.patientName}",
    "age": ${caseData.patientAge},
    "gender": "${caseData.patientGender}",
    "diagnosisMain": "${diagnosisText}",
    "diagnosisSecondary": ${JSON.stringify(secondaryDiagnoses)}
  },
  "clinicalAssessment": "Đánh giá lâm sàng chi tiết dựa trên phân tích AI và thông tin bệnh nhân, bao gồm chẩn đoán và mã ICD-10",
  "recommendations": [
    "Khuyến nghị 1 dựa trên phân tích",
    "Khuyến nghị 2 dựa trên bằng chứng y khoa"
  ],
  "monitoring": [
    "Theo dõi 1 (xét nghiệm, triệu chứng)",
    "Theo dõi 2 (tác dụng phụ)"
  ],
  "patientEducation": [
    "Hướng dẫn 1 về cách dùng thuốc",
    "Hướng dẫn 2 về chế độ ăn uống"
  ],
  "followUp": "Kế hoạch tái khám sau ... ngày/tuần"
}

LƯU Ý: 
- Tất cả arrays phải có ít nhất 1 item
- Tất cả strings không được để trống
- CHỈ TRẢ VỀ JSON, không thêm gì khác
- patientInfo.diagnosisMain: Chẩn đoán chính + mã ICD (nếu có)
- patientInfo.diagnosisSecondary: Mảng các chẩn đoán phụ + mã ICD`;

  const rawResult = await callDeepSeek(systemPrompt, userPrompt, 0.5);
  
  try {
    let jsonString = rawResult.trim();
    
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw new Error("No valid JSON object found in DeepSeek response");
    }
    
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    
    const parsed = JSON.parse(jsonString);
    
    // Build default diagnosis strings with ICD codes
    const defaultDiagnosisMain = caseData.diagnosisMain 
      ? (caseData.diagnosisMainIcd ? `${caseData.diagnosisMain} (${caseData.diagnosisMainIcd})` : caseData.diagnosisMain)
      : caseData.diagnosis || "Không có chẩn đoán";

    const defaultSecondaryDiagnoses = caseData.diagnosisSecondary && Array.isArray(caseData.diagnosisSecondary)
      ? caseData.diagnosisSecondary.map((d: any, idx: number) => {
          const icd = caseData.diagnosisSecondaryIcd && caseData.diagnosisSecondaryIcd[idx]
            ? ` (${caseData.diagnosisSecondaryIcd[idx]})`
            : '';
          return `${d}${icd}`;
        })
      : [];

    const ensuredData = {
      consultationDate: parsed.consultationDate || new Date().toISOString().split('T')[0],
      pharmacistName: parsed.pharmacistName || "Dược sĩ lâm sàng",
      // ✅ ALWAYS merge structured fields even if parsed.patientInfo exists
      patientInfo: {
        name: parsed.patientInfo?.name || caseData.patientName,
        age: parsed.patientInfo?.age || caseData.patientAge,
        gender: parsed.patientInfo?.gender || caseData.patientGender,
        // ✅ Structured diagnosis + ICD codes (ALWAYS included)
        diagnosisMain: caseData.diagnosisMain || caseData.diagnosis || "Không có chẩn đoán",
        diagnosisMainIcd: caseData.diagnosisMainIcd || null,
        diagnosisSecondary: caseData.diagnosisSecondary || [],
        diagnosisSecondaryIcd: caseData.diagnosisSecondaryIcd || [],
        // Legacy fallback for old consumers
        diagnosis: defaultDiagnosisMain,  // Combined string with ICD
      },
      clinicalAssessment: parsed.clinicalAssessment || "Đánh giá lâm sàng dựa trên phân tích AI",
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations
        : ["Tuân thủ đơn thuốc theo chỉ định"],
      monitoring: Array.isArray(parsed.monitoring) && parsed.monitoring.length > 0
        ? parsed.monitoring
        : ["Theo dõi triệu chứng lâm sàng"],
      patientEducation: Array.isArray(parsed.patientEducation) && parsed.patientEducation.length > 0
        ? parsed.patientEducation
        : ["Dùng thuốc đúng liều, đúng giờ"],
      followUp: parsed.followUp || "Tái khám theo lịch hẫn của bác sĩ",
      // ✅ structuredAnalysis kept in analysis results, NOT in patient-facing report
    };
    
    return ensuredData;
  } catch (error: any) {
    console.error("Failed to parse consultation form JSON:", error, "\nRaw response:", rawResult);
    throw new Error(`AI trả về dữ liệu không hợp lệ. Vui lòng thử lại. Chi tiết: ${error.message}`);
  }
}

export async function chatWithAI(
  userMessage: string,
  context?: {
    caseData?: any;
    previousMessages?: Array<{ role: string; content: string }>;
    systemStats?: {
      totalCases: number;
      totalPatients: number;
      topDiagnoses: { diagnosis: string; count: number }[];
      topMedications: { drugName: string; count: number }[];
    };
  }
): Promise<string> {
  const referenceContext = await buildReferenceDocumentsContext();
  
  let statsContext = '';
  if (context?.systemStats) {
    const { totalCases, totalPatients, topDiagnoses, topMedications } = context.systemStats;
    statsContext = `

THÔNG TIN HỆ THỐNG BỆNH VIỆN (để tham khảo khi tư vấn):
- Tổng số ca bệnh đã tư vấn: ${totalCases} ca
- Tổng số bệnh nhân: ${totalPatients} người
${topDiagnoses.length > 0 ? `- Chẩn đoán phổ biến: ${topDiagnoses.slice(0, 3).map(d => d.diagnosis).join(', ')}` : ''}
${topMedications.length > 0 ? `- Thuốc hay dùng: ${topMedications.slice(0, 5).map(m => m.drugName).join(', ')}` : ''}`;
  }
  
  const systemPrompt = `Em là "Trợ lý ảo Cửa Đông Care" - trợ lý dược lâm sàng chuyên nghiệp của Bệnh viện Đa khoa Cửa Đông, TP Vinh, Nghệ An.

PHONG CÁCH TRẢ LỜI (quan trọng - như nhân viên thật sự):
- Xưng "em", gọi người dùng là "anh/chị/bác sĩ/dược sĩ" (tùy ngữ cảnh)
- Trả lời CHI TIẾT, DỄ HIỂU, có CẤU TRÚC RÕ RÀNG (dùng bullet points, đánh số khi cần)
- Nhiệt tình, thân thiện nhưng chuyên nghiệp
- GIẢI THÍCH LÝ DO đằng sau mỗi khuyến nghị (không chỉ nói "nên làm X" mà giải thích "tại sao")
- Nếu câu hỏi phức tạp → chia thành mục: 1. Phân tích, 2. Khuyến nghị, 3. Lưu ý

NHIỆM VỤ CHÍNH:
✓ Tư vấn về thuốc: liều dùng, chỉnh liều theo chức năng thận/gan, cách dùng
✓ Phân tích tương tác thuốc-thuốc, thuốc-bệnh (giải thích CƠ CHẾ tương tác)
✓ Gợi ý theo dõi: xét nghiệm nào, tần suất, chỉ số cần chú ý
✓ Giáo dục bệnh nhân: cách uống thuốc, tác dụng phụ cần lưu ý
✓ Khi có ca bệnh cụ thể → phân tích TOÀN DIỆN theo ngữ cảnh bệnh nhân đó

CẤU TRÚC TRẢ LỜI MẪU (tùy câu hỏi):
📌 **[Tóm tắt vấn đề]**
[Phân tích ngắn gọn]

**Khuyến nghị:**
1. [Chi tiết khuyến nghị 1 + lý do]
2. [Chi tiết khuyến nghị 2 + lý do]

**Lưu ý theo dõi:**
- [Các dấu hiệu cần chú ý]

LƯU Ý QUAN TRỌNG:
- LUÔN dựa trên bằng chứng y học (guideline quốc tế, nghiên cứu uy tín)
- Nếu không chắc chắn → nói rõ và khuyến nghị kiểm tra thêm
- LUÔN kết thúc bằng: "💡 Đây là gợi ý hỗ trợ, quyết định cuối thuộc bác sĩ điều trị."
- Không tự ý đưa quyết định điều trị chắc chắn${referenceContext}${statsContext}`;

  let userPrompt = userMessage;

  if (context?.caseData) {
    userPrompt = `[THÔNG TIN CA BỆNH CỤ THỂ - PHÂN TÍCH THEO NGỮ CẢNH NÀY]
📋 Bệnh nhân: ${context.caseData.patientName}, ${context.caseData.patientAge} tuổi, ${context.caseData.patientGender}
📌 Chẩn đoán: ${context.caseData.diagnosis}
${context.caseData.egfr ? `🔬 CrCl: ${context.caseData.egfr} mL/min (Cockcroft-Gault) - ${context.caseData.egfr < 60 ? 'CẦN CHỈNH LIỀU!' : 'bình thường'}` : ''}
${context.caseData.medicalHistory ? `📝 Tiền sử: ${context.caseData.medicalHistory}` : ''}
${context.caseData.allergies ? `⚠️ Dị ứng: ${context.caseData.allergies}` : ''}

❓ Câu hỏi: ${userMessage}`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context?.previousMessages) {
    messages.push(...(context.previousMessages as ChatMessage[]));
  }

  messages.push({ role: "user", content: userPrompt });

  return callOpenRouter(MODELS.DEEPSEEK, messages, 0.4);
}

export async function extractDataFromDocument(
  textContent: string,
  fileType: "pdf" | "docx"
): Promise<any> {
  const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu y tế từ tài liệu bệnh án. QUAN TRỌNG: CHỈ trả về JSON hợp lệ, KHÔNG thêm văn bản giải thích hay markdown. Response phải bắt đầu bằng { và kết thúc bằng }.`;

  const userPrompt = `Trích xuất thông tin từ tài liệu ${fileType.toUpperCase()} sau và TRẢ VỀ CHỈ JSON (không có markdown, không có text khác):

${textContent}

NGUYÊN TẮC QUAN TRỌNG NHẤT:
⚠️ CHỈ TRÍCH XUẤT THÔNG TIN CÓ TRONG TÀI LIỆU - TUYỆT ĐỐI KHÔNG BỊA RA THÔNG TIN
⚠️ Nếu không tìm thấy thông tin → trả về null (KHÔNG đoán, KHÔNG suy luận)

HƯỚNG DẪN TRÍCH XUẤT CHẨN ĐOÁN:
- Phân tách rõ CHẨN ĐOÁN CHÍNH (diagnosisMain) và BỆNH KÈM (diagnosisSecondary)
- Tìm MÃ ICD-10 cho CẢ chẩn đoán chính VÀ bệnh kèm (nếu có ghi rõ trong tài liệu)
- Ví dụ: "Chẩn đoán: Viêm phổi (J18.9). Bệnh kèm: Tăng huyết áp (I10), Đái tháo đường (E11.9)"
  → diagnosisMain: "Viêm phổi", icdCodes.main: "J18.9"
  → diagnosisSecondary: ["Tăng huyết áp", "Đái tháo đường"], icdCodes.secondary: ["I10", "E11.9"]
- NGÀY NHẬP VIỆN (admissionDate): Tìm "Ngày nhập viện", "Ngày vào viện", "Admission date", "Date of admission" → Format YYYY-MM-DD
  • Ví dụ: "Nhập viện ngày 15/01/2024" → admissionDate: "2024-01-15"
  • Ví dụ: "Vào viện 01-01-2024" → admissionDate: "2024-01-01"
  • Nếu không tìm thấy → admissionDate: null
- Creatinine huyết thanh: Hỗ trợ 2 đơn vị mg/dL và micromol/L (lấy đơn vị nào có trong tài liệu)
  • Nếu thấy "Creatinine: 1.2 mg/dL" → creatinine: 1.2, creatinineUnit: "mg/dL"
  • Nếu thấy "Creatinine: 106 micromol/L" → creatinine: 106, creatinineUnit: "micromol/L"
  • Nếu không thấy → creatinine: null, creatinineUnit: null
- Trích xuất NGÀY BẮT ĐẦU và NGÀY KẾT THÚC dùng thuốc (CHÚ Ý: nhiều format khác nhau)
- Format ngày đầu ra: YYYY-MM-DD

VÍ DỤ NHẬN DIỆN NGÀY THÁNG (rất quan trọng):
1. Khoảng ngày rõ ràng:
   - "Ngày 1-3/1/2024: Paracetamol" → usageStartDate: "2024-01-01", usageEndDate: "2024-01-03"
   - "01/01/2024 - 05/01/2024: Amoxicillin" → usageStartDate: "2024-01-01", usageEndDate: "2024-01-05"
   - "Từ 15/01 đến 20/01/2024" → usageStartDate: "2024-01-15", usageEndDate: "2024-01-20"

2. Nhiều ngày liên tiếp (parse ALL dates):
   - "Ngày 1,2,3/1/2024: Ceftriaxone" → usageStartDate: "2024-01-01", usageEndDate: "2024-01-03"
   - "01, 02, 03/01/2024" → usageStartDate: "2024-01-01", usageEndDate: "2024-01-03"
   - "Ngày 5, 6, 7, 8/12/2023" → usageStartDate: "2023-12-05", usageEndDate: "2023-12-08"

3. Ngày không liên tiếp (lấy ngày đầu và cuối):
   - "Ngày 1, 3, 5/1/2024" → usageStartDate: "2024-01-01", usageEndDate: "2024-01-05"
   - "Ngày 10, 15, 20/02/2024" → usageStartDate: "2024-02-10", usageEndDate: "2024-02-20"

4. Format khác:
   - "Dùng từ 01-01-2024 đến 10-01-2024" → usageStartDate: "2024-01-01", usageEndDate: "2024-01-10"
   - "Ngày nhập viện 05/01/2024, dùng 7 ngày" → usageStartDate: "2024-01-05", usageEndDate: "2024-01-12"

5. Chỉ có 1 ngày hoặc không có ngày:
   - "Ngày 15/01/2024: Aspirin" → usageStartDate: "2024-01-15", usageEndDate: null
   - "Aspirin 500mg" (không có ngày) → usageStartDate: null, usageEndDate: null

VÍ DỤ ICD-10:
- "I10: Tăng huyết áp" → diagnosisMain: "Tăng huyết áp", icdCodes.main: "I10"
- "E11.9: Đái tháo đường type 2" → diagnosisMain: "Đái tháo đường type 2", icdCodes.main: "E11.9"

VÍ DỤ CREATININE:
- "Creatinine: 1.2 mg/dL" → labResults: { creatinine: 1.2, creatinineUnit: "mg/dL" }
- "SCr 106 micromol/L" → labResults: { creatinine: 106, creatinineUnit: "micromol/L" }
- "Creatinine máu 0.9" → labResults: { creatinine: 0.9, creatinineUnit: "mg/dL" } (mặc định mg/dL nếu không ghi rõ)

JSON format (⚠️ NẾU THIẾU THÔNG TIN THÌ ĐỂ null - KHÔNG BỊA):
{
  "patientName": "string hoặc null",
  "patientAge": number hoặc null,
  "patientGender": "string hoặc null",
  "patientWeight": number hoặc null,
  "patientHeight": number hoặc null,
  "admissionDate": "YYYY-MM-DD hoặc null (ngày nhập viện)",
  
  "diagnosisMain": "Chẩn đoán CHÍNH (ví dụ: Viêm phổi)",
  "diagnosisSecondary": ["Bệnh kèm 1", "Bệnh kèm 2"] hoặc null,
  "icdCodes": {
    "main": "mã ICD chính (ví dụ: J18.9)",
    "secondary": ["mã ICD bệnh kèm 1", "mã ICD bệnh kèm 2"] hoặc null
  } hoặc null,
  
  "diagnosis": "nếu không tách được thì ghi chung ở đây (backward compatibility)",
  "medicalHistory": "Tiền sử bệnh: bao gồm bệnh mãn tính (tăng huyết áp, đái tháo đường, suy tim, suy thận, bệnh gan, ung thư...), tiền sử phẫu thuật, tiền sử gia đình. Ghi đầy đủ thông tin có trong tài liệu. Nếu không có thì null.",
  "allergies": "string hoặc null",
  "labResults": {
    "creatinine": number hoặc null,
    "creatinineUnit": "mg/dL" hoặc "micromol/L" hoặc null
  } hoặc null,
  
  "medications": [
    {
      "drugName": "tên thuốc",
      "dose": "liều lượng hoặc null",
      "frequency": "tần suất hoặc null",
      "route": "đường dùng hoặc null",
      "usageStartDate": "YYYY-MM-DD hoặc null",
      "usageEndDate": "YYYY-MM-DD hoặc null"
    }
  ] hoặc null
}

CHỈ TRẢ VỀ JSON, KHÔNG THÊM GÌ KHÁC.`;

  const rawResult = await callDeepSeek(systemPrompt, userPrompt, 0.3);
  
  try {
    const cleanedResult = rawResult.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    const parsed = JSON.parse(cleanedResult);
    
    // Normalize creatinineUnit to match schema enum
    if (parsed.labResults?.creatinineUnit) {
      const unit = parsed.labResults.creatinineUnit;
      // Handle micromol/L variants ONLY (μmol, µmol, umol, micromol)
      // DO NOT match mmol/L, nmol/L, pmol/L
      if (/^[µμu]mol\/[lL]$/i.test(unit) || /^micromol\/[lL]$/i.test(unit)) {
        parsed.labResults.creatinineUnit = 'micromol/L';
      } else if (/^mg\/d[lL]$/i.test(unit)) {
        parsed.labResults.creatinineUnit = 'mg/dL';
      }
    }
    
    const validated = extractedDataSchema.safeParse(parsed);
    
    if (!validated.success) {
      console.error("Validation failed:", validated.error);
      throw new Error("Dữ liệu trích xuất không đúng định dạng");
    }
    
    return validated.data;
  } catch (error: any) {
    console.error("Failed to parse AI response:", error, "\nRaw:", rawResult);
    throw new Error("Lỗi phân tích dữ liệu từ AI: " + error.message);
  }
}

export async function suggestDocuments(caseData: any): Promise<{
  admin: { needed: boolean; reason: string };
  lab: { needed: boolean; reason: string };
  prescription: { needed: boolean; reason: string };
}> {
  const systemPrompt = `Bạn là chuyên gia dược lâm sàng. Phân tích ca bệnh và đề xuất tài liệu cần thiết.`;

  const userPrompt = `Phân tích ca bệnh sau và đề xuất tài liệu nào cần upload:

Bệnh nhân: ${caseData.patientName}, ${caseData.patientAge} tuổi
Chẩn đoán: ${caseData.diagnosis || "Chưa có"}
${caseData.medicalHistory ? `Tiền sử: ${caseData.medicalHistory}` : ''}

Các nhóm tài liệu:
1. Hành chính: Giấy tờ hành chính, giấy xác nhận, đơn yêu cầu
2. Cận lâm sàng: Kết quả xét nghiệm, siêu âm, X-quang, CT scan
3. Đơn thuốc: Đơn kê thuốc, phiếu chỉ định dùng thuốc

Trả về JSON (QUAN TRỌNG: CHỈ JSON, không thêm text khác):
{
  "admin": {"needed": true/false, "reason": "lý do ngắn gọn"},
  "lab": {"needed": true/false, "reason": "lý do ngắn gọn"},
  "prescription": {"needed": true/false, "reason": "lý do ngắn gọn"}
}`;

  try {
    const rawResult = await callDeepSeek(systemPrompt, userPrompt, 0.3);
    const cleanedResult = rawResult.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    const parsed = JSON.parse(cleanedResult);
    return parsed;
  } catch (error: any) {
    return {
      admin: { needed: false, reason: "Không thể phân tích" },
      lab: { needed: true, reason: "Cần kết quả xét nghiệm để đánh giá" },
      prescription: { needed: true, reason: "Cần đơn thuốc để kiểm tra tương tác" },
    };
  }
}
