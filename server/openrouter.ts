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

  const deepseekVerificationSystemPrompt = `Bạn là dược sĩ lâm sàng chuyên nghiệp. Dựa trên kết quả tìm kiếm bằng chứng y khoa, hãy viết lại phân tích của bạn để đảm bảo tính chính xác và dựa trên bằng chứng.`;

  const deepseekVerificationUserPrompt = `Phân tích ban đầu của bạn:
${initialAnalysis}

Kết quả tìm kiếm bằng chứng y khoa:
${perplexityFindings}

Hãy viết lại phân tích của bạn, đảm bảo:
1. Chính xác dựa trên bằng chứng khoa học
2. Bổ sung thông tin quan trọng từ kết quả tìm kiếm
3. Sửa đổi những thông tin không chính xác (nếu có)
4. Giữ nguyên cấu trúc và độ chi tiết
5. Viết bằng tiếng Việt chuyên nghiệp`;

  const finalAnalysis = await callDeepSeek(
    deepseekVerificationSystemPrompt,
    deepseekVerificationUserPrompt,
    0.5
  );

  return {
    verified: true,
    perplexityFindings,
    finalAnalysis,
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
  fileContent: string,
  fileType: "pdf" | "docx"
): Promise<any> {
  const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu y tế. QUAN TRỌNG: CHỈ trả về JSON hợp lệ, KHÔNG thêm văn bản giải thích hay markdown. Response phải bắt đầu bằng { và kết thúc bằng }.`;

  const userPrompt = `Trích xuất thông tin từ tài liệu ${fileType.toUpperCase()} sau và TRẢ VỀ CHỈ JSON (không có markdown, không có text khác):

${fileContent}

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
