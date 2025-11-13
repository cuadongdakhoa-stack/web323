import { z } from "zod";

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
  diagnosis: z.string().nullable().optional(),
  medicalHistory: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  labResults: z.record(z.any()).nullable().optional(),
  medications: z.array(z.object({
    drugName: z.string(),
    dose: z.string().optional(),
    frequency: z.string().optional(),
    route: z.string().optional(),
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

const MODELS = {
  DEEPSEEK: "deepseek/deepseek-chat",
  PERPLEXITY: "perplexity/sonar-pro",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
    // Remove ALL asterisks (both ** and * in any position)
    .replace(/\*+/g, '')                // Remove all * characters
    .replace(/#{1,6}\s+/g, '')          // # headings → remove
    .replace(/^\s*[-+]\s+/gm, '')       // - or + list bullets → remove (but keep numbered lists)
    .replace(/`([^`]+)`/g, '$1')        // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link text](url) → link text
    .trim();
}

function formatAnalysisToText(analysis: any): string {
  const sections: string[] = [];
  
  // Section 1: Đánh giá chức năng thận
  if (analysis.renalAssessment) {
    sections.push(`Đánh giá chức năng thận:\n${removeMarkdown(analysis.renalAssessment)}`);
  }
  
  // Section 2: Tương tác thuốc-thuốc
  if (analysis.drugDrugInteractions && analysis.drugDrugInteractions.length > 0) {
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
  finalAnalysis: string 
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

  const deepseekVerificationSystemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp. Dựa trên kết quả tìm kiếm bằng chứng y khoa, hãy viết lại phân tích dưới dạng văn bản thuần Tiếng Việt.

QUAN TRỌNG: 
- CHỈ trả về văn bản thuần (plain text)
- KHÔNG dùng markdown (**, *, #, -)
- KHÔNG dùng JSON
- Viết bằng Tiếng Việt tự nhiên, dễ đọc
- Sử dụng số thứ tự (1., 2., 3.) cho danh sách`;

  const deepseekVerificationUserPrompt = `Phân tích ban đầu:
${initialAnalysis}

Kết quả tìm kiếm bằng chứng y khoa:
${perplexityFindings}

Hãy viết lại phân tích thành văn bản thuần Tiếng Việt, theo cấu trúc sau:

Đánh giá chức năng thận:
[Nội dung đánh giá chi tiết]

Tương tác thuốc-thuốc:
1. [Tương tác thứ nhất với giải thích]
2. [Tương tác thứ hai với giải thích]

Tương tác thuốc-bệnh:
1. [Tương tác với giải thích]

Điều chỉnh liều:
1. [Khuyến nghị điều chỉnh với lý do]
2. [Khuyến nghị khác]

Theo dõi:
1. [Hướng dẫn theo dõi cụ thể]
2. [Hướng dẫn khác]

Cảnh báo:
1. [Cảnh báo quan trọng]

Thông tin bổ sung:
[Thông tin từ bằng chứng y khoa]

NHẮC LẠI: CHỈ văn bản thuần, KHÔNG markdown, KHÔNG JSON.`;

  const finalAnalysisText = await callDeepSeek(
    deepseekVerificationSystemPrompt,
    deepseekVerificationUserPrompt,
    0.5
  );

  return {
    verified: true,
    perplexityFindings: cleanTextResponse(perplexityFindings),
    finalAnalysis: cleanTextResponse(finalAnalysisText)
  };
}

export async function analyzePatientCase(caseData: any): Promise<any> {
  const systemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp tại bệnh viện Việt Nam. Nhiệm vụ của bạn là phân tích ca bệnh và đưa ra khuyến nghị về điều chỉnh liều thuốc, tương tác thuốc, và các vấn đề liên quan.`;

  const userPrompt = `Hãy phân tích ca bệnh sau và cung cấp đánh giá lâm sàng:

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

eGFR: ${caseData.egfr || "Chưa tính"} ml/min/1.73m²

DANH SÁCH THUỐC:
${caseData.medications?.map((med: any, idx: number) => `
${idx + 1}. ${med.drugName}
   - Chỉ định: ${med.indication || "Không rõ"}
   - Liều hiện tại: ${med.prescribedDose} ${med.prescribedRoute} ${med.prescribedFrequency}
`).join("\n") || "Chưa có thuốc"}

QUAN TRỌNG: Hãy cung cấp phân tích chi tiết bao gồm:
1. Đánh giá chức năng thận và tác động đến các thuốc
2. Kiểm tra tương tác thuốc-thuốc
3. Kiểm tra tương tác thuốc-bệnh
4. Khuyến nghị điều chỉnh liều (nếu cần)
5. Các lưu ý theo dõi và cảnh báo

TRẢ VỀ CHỈ JSON HỢP LỆ (không có markdown, không có text khác):
{
  "renalAssessment": "đánh giá chức năng thận",
  "drugDrugInteractions": ["tương tác 1", "tương tác 2"],
  "drugDiseaseInteractions": ["tương tác bệnh 1"],
  "doseAdjustments": ["điều chỉnh 1", "điều chỉnh 2"],
  "monitoring": ["theo dõi 1", "theo dõi 2"],
  "warnings": ["cảnh báo 1"]
}`;

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

  const verificationQuery = `Kiểm tra khuyến nghị điều chỉnh liều thuốc cho bệnh nhân ${caseData.patientAge} tuổi với chẩn đoán ${caseData.diagnosis} và eGFR ${caseData.egfr || "không rõ"} ml/min/1.73m². Thuốc đang dùng: ${caseData.medications?.map((m: any) => m.drugName).join(", ")}`;

  const verified = await verifyWithPipeline(
    typeof initialAnalysis === 'string' ? initialAnalysis : JSON.stringify(initialAnalysis), 
    verificationQuery
  );

  return {
    initialAnalysis,
    verified: verified.verified,
    evidenceFindings: verified.perplexityFindings,
    finalAnalysis: verified.finalAnalysis,
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
  const systemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp. Hãy tạo phiếu tư vấn sử dụng thuốc chuẩn y khoa cho bệnh viện.`;

  const userPrompt = `Dựa trên thông tin ca bệnh và kết quả phân tích, hãy tạo phiếu tư vấn sử dụng thuốc:

THÔNG TIN BỆNH NHÂN:
- Họ tên: ${caseData.patientName}
- Tuổi: ${caseData.patientAge}
- Giới tính: ${caseData.patientGender}
- Chẩn đoán: ${caseData.diagnosis}

KẾT QUẢ PHÂN TÍCH:
${JSON.stringify(analysisResult, null, 2)}

QUAN TRỌNG - TRẢ VỀ CHỈ JSON HỢP LỆ (không có markdown, không có text khác):
{
  "consultationDate": "YYYY-MM-DD",
  "pharmacistName": "Tên dược sĩ",
  "patientInfo": {
    "name": "...",
    "age": 0,
    "gender": "...",
    "diagnosis": "..."
  },
  "clinicalAssessment": "Đánh giá lâm sàng chi tiết",
  "recommendations": ["Khuyến nghị 1", "Khuyến nghị 2"],
  "monitoring": ["Theo dõi 1", "Theo dõi 2"],
  "patientEducation": ["Hướng dẫn 1", "Hướng dẫn 2"],
  "followUp": "Kế hoạch tái khám"
}`;

  const rawResult = await callDeepSeek(systemPrompt, userPrompt);
  
  try {
    const cleanedResult = rawResult.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    const parsed = JSON.parse(cleanedResult);
    return parsed;
  } catch (error: any) {
    console.error("Failed to parse consultation form JSON:", error, "\nRaw:", rawResult);
    return {
      error: "Lỗi phân tích JSON",
      rawResponse: rawResult,
      consultationDate: new Date().toISOString().split('T')[0],
      pharmacistName: "Unknown",
      patientInfo: caseData,
      clinicalAssessment: rawResult.substring(0, 500),
      recommendations: [],
      monitoring: [],
      patientEducation: [],
      followUp: ""
    };
  }
}

export async function chatWithAI(
  userMessage: string,
  context?: {
    caseData?: any;
    previousMessages?: Array<{ role: string; content: string }>;
  }
): Promise<string> {
  const systemPrompt = `Em là "Trợ lý ảo Cửa Đông Care" - trợ lý dược lâm sàng của Bệnh viện Đa khoa Cửa Đông, TP Vinh, Nghệ An.

PHONG CÁCH:
- Xưng "em", gọi người dùng là "anh/chị/bác sĩ/dược sĩ" (tùy ngữ cảnh)
- Trả lời ngắn gọn, súc tích, tập trung vào chuyên môn
- Giọng văn chuyên nghiệp nhưng thân thiện

NHIỆM VỤ:
- Giải thích về thuốc, chỉnh liều, tương tác, cách theo dõi
- Khi có thông tin ca bệnh, phải sử dụng dữ liệu ca đó làm bối cảnh chính
- Gợi ý từ khóa để tìm guideline khi cần
- Dựa trên bằng chứng khoa học và guidelines quốc tế

LƯU Ý QUAN TRỌNG:
- LUÔN kết thúc câu trả lời bằng disclaimer: "Đây là gợi ý mang tính hỗ trợ, quyết định cuối cùng thuộc về bác sĩ điều trị."
- Không tự ý đưa ra quyết định điều trị chắc chắn
- Khuyến khích kiểm tra với guidelines/nguồn đáng tin cậy`;

  let userPrompt = userMessage;

  if (context?.caseData) {
    userPrompt = `[THÔNG TIN CA BỆNH - SỬ DỤNG LÀM BỐI CẢNH CHÍNH]
Bệnh nhân: ${context.caseData.patientName}, ${context.caseData.patientAge} tuổi, ${context.caseData.patientGender}
Chẩn đoán: ${context.caseData.diagnosis}
${context.caseData.egfr ? `eGFR: ${context.caseData.egfr} ml/min/1.73m²` : ''}
${context.caseData.medicalHistory ? `Tiền sử: ${context.caseData.medicalHistory}` : ''}
${context.caseData.allergies ? `Dị ứng: ${context.caseData.allergies}` : ''}

Câu hỏi: ${userMessage}`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context?.previousMessages) {
    messages.push(...(context.previousMessages as ChatMessage[]));
  }

  messages.push({ role: "user", content: userPrompt });

  return callOpenRouter(MODELS.DEEPSEEK, messages, 0.7);
}

export async function extractDataFromDocument(
  textContent: string,
  fileType: "pdf" | "docx"
): Promise<any> {
  const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu y tế từ tài liệu bệnh án. QUAN TRỌNG: CHỈ trả về JSON hợp lệ, KHÔNG thêm văn bản giải thích hay markdown. Response phải bắt đầu bằng { và kết thúc bằng }.`;

  const userPrompt = `Trích xuất thông tin từ tài liệu ${fileType.toUpperCase()} sau và TRẢ VỀ CHỈ JSON (không có markdown, không có text khác):

${textContent}

JSON format (nếu thiếu thông tin thì để null):
{
  "patientName": "string hoặc null",
  "patientAge": number hoặc null,
  "patientGender": "string hoặc null",
  "patientWeight": number hoặc null,
  "patientHeight": number hoặc null,
  "diagnosis": "string hoặc null",
  "medicalHistory": "string hoặc null",
  "allergies": "string hoặc null",
  "labResults": {} hoặc null,
  "medications": [
    {
      "drugName": "tên thuốc",
      "dose": "liều lượng",
      "frequency": "tần suất",
      "route": "đường dùng"
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
