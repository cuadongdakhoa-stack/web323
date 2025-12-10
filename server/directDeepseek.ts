/**
 * Direct DeepSeek API Integration 
 * Model: deepseek-chat (DeepSeek-V3.2-Exp)
 * API: https://api.deepseek.com
 * Pricing: $0.27/1M input tokens, $1.10/1M output tokens (cache miss)
 */

interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: {
    type: "json_object";
  };
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call DeepSeek API directly (DeepSeek-V3.2-Exp)
 */
export async function callDirectDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.1,
  maxTokens: number = 4000,
  jsonMode: boolean = false
): Promise<{ content: string; usage: any }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not found in environment");
  }

  const url = "https://api.deepseek.com/v1/chat/completions";
  
  const requestBody: DeepSeekRequest = {
    model: "deepseek-chat", // DeepSeek-V3.2-Exp (non-thinking mode)
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature,
    max_tokens: maxTokens,
    stream: true  // Enable streaming to avoid 30s timeout
  };

  // Enable JSON mode if requested (forces valid JSON output)
  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  console.log(`[DeepSeek V3.2-Exp] Calling API${jsonMode ? ' (JSON mode)' : ''}... STREAMING`);
  console.log(`[DeepSeek V3.2-Exp] Prompt length: ${userPrompt.length} chars`);

  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 phút timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let totalTokens = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

      for (const line of lines) {
        const jsonStr = line.replace(/^data:\s*/, '');
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.choices?.[0]?.delta?.content) {
            fullContent += parsed.choices[0].delta.content;
          }
          if (parsed.usage) {
            totalTokens = parsed.usage;
          }
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[DeepSeek V3.2-Exp] Streaming complete in ${duration}ms`);
    console.log(`[DeepSeek V3.2-Exp] Tokens: ${totalTokens.prompt_tokens} in + ${totalTokens.completion_tokens} out = ${totalTokens.total_tokens} total`);

    // Calculate cost (DeepSeek V3.2-Exp pricing: $0.27 per 1M input, $1.10 per 1M output - cache miss)
    const inputCost = (totalTokens.prompt_tokens / 1_000_000) * 0.27;
    const outputCost = (totalTokens.completion_tokens / 1_000_000) * 1.10;
    const totalCost = inputCost + outputCost;
    
    console.log(`[DeepSeek V3.2-Exp] Cost ≈ $${totalCost.toFixed(6)} ($${inputCost.toFixed(6)} in + $${outputCost.toFixed(6)} out)`);

    return {
      content: fullContent,
      usage: {
        ...totalTokens,
        costUsd: totalCost
      }
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('DeepSeek API timeout sau 3 phút - tài liệu quá phức tạp');
    }
    throw error;
  }
}

/**
 * Extract full case data from multiple PDFs
 */
export async function extractFullCaseDirectDeepSeek(
  pdfTexts: { type: string; text: string }[]
): Promise<any> {
  
  // Combine all PDF texts
  const combinedText = pdfTexts.map(pdf => `
=== ${pdf.type.toUpperCase()} ===
${pdf.text}
`).join("\n\n");

  const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu y tế. NGẮN GỌN, CHÍNH XÁC, CHỈ JSON. KHÔNG giải thích. KHÔNG markdown.

Trích xuất TOÀN BỘ thông tin từ hồ sơ bệnh án (Bệnh án, Tờ điều trị, Xét nghiệm).`;

  const userPrompt = `${combinedText}

Trích xuất theo JSON schema:

{
  "patientName": "Họ tên bệnh nhân (CHỮ IN HOA)",
  "patientAge": number,
  "patientGender": "Nam" | "Nữ",
  "patientWeight": number,
  "patientHeight": number,
  "admissionDate": "DD/MM/YYYY",
  "department": "Khoa điều trị",
  
  "diagnosis": "Chẩn đoán chính (MÔ TẢ ĐẦY ĐỦ, không chỉ mã)",
  "diagnosisMain": "Chẩn đoán xác định",
  "diagnosisSecondary": ["Bệnh kèm theo 1", "Bệnh kèm theo 2"],
  "icdCodes": {
    "main": "Mã ICD chính",
    "secondary": ["ICD phụ 1", "ICD phụ 2"]
  },
  
  "medicalHistory": "Tiền sử bệnh",
  "allergies": "Dị ứng thuốc/thực phẩm",
  
  "medications": [
    {
      "drugName": "Tên thuốc đầy đủ",
      "prescribedDose": "Liều dùng (VD: 1 viên, 500mg)",
      "prescribedFrequency": "Tần suất (VD: 3 lần/ngày, Sáng - Trưa - Tối)",
      "prescribedRoute": "Đường dùng (Uống, Tiêm, Truyền)",
      "form": "Dạng thuốc (Viên, Ống, Lọ)",
      "dosePerAdmin": "Liều mỗi lần",
      "frequencyPerDay": number,
      "adminTimes": ["Sáng", "Trưa", "Tối"],
      "usageStartDate": "DD/MM/YYYY hoặc null",
      "usageEndDate": "DD/MM/YYYY hoặc null"
    }
  ],
  
  "labs": [
    {
      "testGroup": "Hematology" | "Biochemistry" | "Urinalysis" | "Microbiology" | "Other",
      "testName": "Tên xét nghiệm",
      "resultValue": "Giá trị",
      "unit": "Đơn vị",
      "referenceRange": "Khoảng tham chiếu",
      "abnormalFlag": "HIGH" | "LOW" | "NORMAL" | null,
      "collectedAt": "YYYY-MM-DD hoặc null"
    }
  ],
  
  "creatinine": number (từ labs),
  "creatinineUnit": "mg/dL" | "µmol/L" | "umol/L"
}

⚠️ QUAN TRỌNG:
1. TRÍCH XUẤT TOÀN BỘ THUỐC - không giới hạn số lượng
2. TRÍCH XUẤT TOÀN BỘ XÉT NGHIỆM - tất cả các test
3. Chẩn đoán phải là MÔ TẢ ĐẦY ĐỦ, không chỉ mã số
4. Mã ICD phải là mã thực (VD: I10, E11.9), không phải số thứ tự
5. Creatinine: tìm trong xét nghiệm hóa sinh
6. Tên bệnh nhân: CHỮ IN HOA như trong bệnh án
7. abnormalFlag: so sánh kết quả với khoảng tham chiếu

CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC.`;

  // Use JSON mode to ensure valid JSON output
  const result = await callDirectDeepSeek(systemPrompt, userPrompt, 0.1, 8000, true);
  
  // Parse JSON from response
  const raw = result.content.trim();
  
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      _meta: {
        usage: result.usage,
        extractedAt: new Date().toISOString()
      }
    };
  } catch (error: any) {
    console.error("[DeepSeek V3.2-Exp] JSON parse error:", error.message);
    console.error("[DeepSeek V3.2-Exp] Raw content:", raw.substring(0, 500));
    throw new Error(`Failed to parse DeepSeek response as JSON: ${error.message}`);
  }
}
