const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

if (!OPENROUTER_API_KEY) {
  console.error("⚠️  WARNING: OPENROUTER_API_KEY is not set. AI features will not work.");
}

const MODELS = {
  DEEPSEEK: "deepseek/deepseek-chat",
  PERPLEXITY: "perplexity/llama-3.1-sonar-large-128k-online",
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
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://cuadong-care-pharma.replit.app",
        "X-Title": "Cửa Đông Care+ Pharma",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
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

Hãy cung cấp phân tích chi tiết bao gồm:
1. Đánh giá chức năng thận và tác động đến các thuốc
2. Kiểm tra tương tác thuốc-thuốc
3. Kiểm tra tương tác thuốc-bệnh
4. Khuyến nghị điều chỉnh liều (nếu cần)
5. Các lưu ý theo dõi và cảnh báo

Trả về kết quả dưới dạng JSON với cấu trúc:
{
  "renalAssessment": "...",
  "drugDrugInteractions": [...],
  "drugDiseaseInteractions": [...],
  "doseAdjustments": [...],
  "monitoring": [...],
  "warnings": [...]
}`;

  const initialAnalysis = await callDeepSeek(systemPrompt, userPrompt);

  const verificationQuery = `Kiểm tra khuyến nghị điều chỉnh liều thuốc cho bệnh nhân ${caseData.patientAge} tuổi với chẩn đoán ${caseData.diagnosis} và eGFR ${caseData.egfr || "không rõ"} ml/min/1.73m². Thuốc đang dùng: ${caseData.medications?.map((m: any) => m.drugName).join(", ")}`;

  const verified = await verifyWithPipeline(initialAnalysis, verificationQuery);

  return {
    initialAnalysis,
    verified: verified.verified,
    evidenceFindings: verified.perplexityFindings,
    finalAnalysis: verified.finalAnalysis,
  };
}

export async function searchMedicalEvidence(query: string): Promise<string> {
  const systemPrompt = `Bạn là trợ lý nghiên cứu y khoa. Hãy tìm kiếm guidelines, nghiên cứu lâm sàng, và bằng chứng y khoa liên quan đến câu hỏi.`;

  const userPrompt = `Tìm kiếm bằng chứng y khoa cho: ${query}

Hãy cung cấp:
1. Các guidelines quốc tế liên quan (AHA, ESC, KDIGO, IDSA, v.v.)
2. Nghiên cứu lâm sàng quan trọng
3. Meta-analysis và systematic reviews
4. Khuyến nghị cụ thể
5. Nguồn tham khảo`;

  return callPerplexity(systemPrompt, userPrompt);
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

Tạo phiếu tư vấn với cấu trúc JSON:
{
  "consultationDate": "...",
  "pharmacistName": "...",
  "patientInfo": {...},
  "clinicalAssessment": "...",
  "recommendations": [...],
  "monitoring": [...],
  "patientEducation": [...],
  "followUp": "..."
}`;

  const result = await callDeepSeek(systemPrompt, userPrompt);
  return result;
}

export async function chatWithAI(
  userMessage: string,
  context?: {
    caseData?: any;
    previousMessages?: Array<{ role: string; content: string }>;
  }
): Promise<string> {
  const systemPrompt = `Bạn là trợ lý AI chuyên về dược lâm sàng tại bệnh viện Việt Nam. Hãy trả lời các câu hỏi một cách chuyên nghiệp, dựa trên bằng chứng khoa học, và hỗ trợ dược sĩ/bác sĩ trong công việc lâm sàng.`;

  let userPrompt = userMessage;

  if (context?.caseData) {
    userPrompt = `Dựa trên ca bệnh sau:
${JSON.stringify(context.caseData, null, 2)}

Câu hỏi: ${userMessage}`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context?.previousMessages) {
    messages.push(...(context.previousMessages as ChatMessage[]));
  }

  messages.push({ role: "user", content: userPrompt });

  return callOpenRouter(MODELS.DEEPSEEK, messages);
}

export async function extractDataFromDocument(
  fileContent: string,
  fileType: "pdf" | "docx"
): Promise<any> {
  const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu y tế. Hãy phân tích nội dung tài liệu và trích xuất thông tin bệnh nhân, chẩn đoán, xét nghiệm, và danh sách thuốc.`;

  const userPrompt = `Hãy trích xuất thông tin từ tài liệu ${fileType.toUpperCase()} sau:

${fileContent}

Trả về JSON với cấu trúc:
{
  "patientName": "...",
  "patientAge": 0,
  "patientGender": "...",
  "patientWeight": 0,
  "diagnosis": "...",
  "medicalHistory": "...",
  "allergies": "...",
  "labResults": {...},
  "medications": [
    {
      "drugName": "...",
      "dose": "...",
      "frequency": "...",
      "route": "..."
    }
  ]
}

Nếu thông tin nào không có trong tài liệu, hãy để null.`;

  const result = await callDeepSeek(systemPrompt, userPrompt, 0.3);
  return result;
}
