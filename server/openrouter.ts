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
    variableDosing: z.boolean().nullable().optional(), // ✅ Liều thay đổi theo ngày
    selfSupplied: z.boolean().nullable().optional(),   // ✅ Thuốc tự túc
    notes: z.string().nullable().optional(),           // ✅ Ghi chú thêm
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

// ============================================
// SPECIALIZED PROMPTS FOR EACH DOCUMENT TYPE
// ============================================

const BENH_AN_PROMPT = `Bạn là chuyên gia trích xuất dữ liệu y tế. NGẮN GỌN, CHÍNH XÁC, CHỈ JSON. KHÔNG giải thích. KHÔNG markdown.

Trích xuất từ BỆNH ÁN / HỒ SƠ VÀO VIỆN. CHỈ TRÍCH XUẤT CÁC TRƯỜNG SAU:

TRƯỜNG CHÍNH (quan trọng):
- patientName: Họ tên bệnh nhân
- patientAge: Tuổi (số)
- patientGender: Giới tính ("Nam" hoặc "Nữ")
- patientWeight: Cân nặng (kg)
- patientHeight: Chiều cao (cm)
- admissionDate: Ngày nhập viện (YYYY-MM-DD)
- diagnosisMain: Chẩn đoán CHÍNH
- diagnosisSecondary: Mảng các bệnh kèm theo
- icdCodes: { main: "mã ICD chính", secondary: ["mã ICD bệnh kèm"] }
- medicalHistory: Tiền sử bệnh (tăng huyết áp, đái tháo đường, suy tim, suy thận, bệnh gan, ung thư, phẫu thuật...)
- allergies: Dị ứng thuốc

⚠️ CÁC TRƯỜNG SAU ĐỂ null (KHÔNG TRÍCH XUẤT TỪ BỆNH ÁN):
- labResults: null (creatinine sẽ được trích xuất từ Cận lâm sàng)
- medications: null (thuốc sẽ được trích xuất từ Tờ điều trị)

QUY TẮC TRÍCH XUẤT CHẨN ĐOÁN (CỰC KỲ QUAN TRỌNG):

1. NGUỒN DỮ LIỆU (TUYỆT ĐỐI KHÔNG HALLUCINATE):
   - CHỈ trích xuất bệnh được GHI RÕ trong tài liệu
   - Tìm mục (15) hoặc "Chẩn đoán xác định" → diagnosisMain
   - Tìm mục (17) hoặc "Bệnh kèm theo" hoặc "Chẩn đoán ra viện" → diagnosisSecondary
   - KHÔNG ĐƯỢC tự suy luận hay thêm bệnh dựa vào triệu chứng

2. DE-DUPLICATE DIAGNOSES (Loại bỏ trùng lặp):
   - Chuẩn hóa: lowercase + bỏ dấu câu
   - So sánh: nếu 2 bệnh giống nhau → chỉ giữ 1
   
   VÍ DỤ:
   - Input: ["Thoái hóa khớp gối", "THOÁI HÓA KHỚP GỐI", "Thoái hóa khớp gối."]
   - Output: ["Thoái hóa khớp gối"] (chỉ giữ 1 lần)

3. MÃ ICD MAPPING (CONTROLLED TABLE):
   - Tìm mục (16) hoặc "Mã bệnh" → icdCodes.main
   - Tìm mục (18) hoặc "Mã bệnh kèm theo" → icdCodes.secondary
   
   BẢNG ICD-10 THAM KHẢO (Chỉ dùng nếu tài liệu KHÔNG CÓ mã ICD):
   - Tăng huyết áp nguyên phát → I10
   - Đái tháo đường type 2 → E11
   - Thoái hóa khớp gối → M17 (KHÔNG PHẢI M10!)
   - Suy tim mạn → I50
   - Suy thận mạn → N18
   - Rối loạn lipid máu → E78
   - Bệnh phổi tắc nghẽn mạn tính (COPD) → J44
   - Loét dạ dày/tá tràng → K25/K26
   - Xơ gan → K74
   
   ⚠️ QUY TẮC VÀNG:
   - Nếu tài liệu ĐÃ CÓ mã ICD → dùng mã đó (ưu tiên tuyệt đối)
   - Nếu tài liệu KHÔNG CÓ mã ICD + bệnh KHÔNG CÓ trong bảng trên → để "" (chuỗi rỗng)
   - TUYỆT ĐỐI KHÔNG đoán mã ICD nếu không chắc chắn

4. TÁCH BỆNH KÈM THEO:
   - TÁCH TỪNG BỆNH theo dấu ; hoặc ,
   - Loại bỏ trùng lặp (sau khi chuẩn hóa)
   - Số lượng diagnosisSecondary PHẢI BẰNG số lượng icdCodes.secondary

VÍ DỤ:
Input: "(15) Bệnh đái tháo đường không phụ thuộc insuline (16) E11 (17) Rối loạn chuyển hóa lipoprotein;Viêm giáp;Xơ vữa động mạch (18) E78;K21;M10"
Output:
{
  "diagnosisMain": "Bệnh đái tháo đường không phụ thuộc insuline",
  "icdCodes": { "main": "E11", "secondary": ["E78", "K21", "M10"] },
  "diagnosisSecondary": ["Rối loạn chuyển hóa lipoprotein", "Viêm giáp", "Xơ vữa động mạch"]
}

VÍ DỤ KHÔNG CÓ MÃ ICD:
Input: "(15) Thoái hóa khớp gối (16) (không ghi) (17) Tăng huyết áp (18) (không ghi)"
Output:
{
  "diagnosisMain": "Thoái hóa khớp gối",
  "icdCodes": { "main": "M17", "secondary": ["I10"] },
  "diagnosisSecondary": ["Tăng huyết áp"]
}

VÍ DỤ BỆNH KHÔNG CÓ TRONG BẢNG:
Input: "(15) Bệnh lạ không rõ (16) (không ghi)"
Output:
{
  "diagnosisMain": "Bệnh lạ không rõ",
  "icdCodes": { "main": "", "secondary": [] },
  "diagnosisSecondary": []
}

⚠️ SAI LẦM THƯỜNG GẶP (TRÁNH):
❌ Tự suy luận bệnh từ triệu chứng hoặc thuốc
❌ Giữ lại bệnh trùng lặp (không de-duplicate)
❌ Gán M10 (gout) cho thoái hóa khớp gối (phải là M17)
❌ Tự đoán mã ICD khi không có trong tài liệu và không có trong bảng

⚠️ QUY TẮC QUAN TRỌNG:
- CHỈ lấy dữ liệu CÓ SẴN - KHÔNG đoán
- Không có thông tin → null
- Số lượng diagnosisSecondary PHẢI BẰNG số lượng icdCodes.secondary

JSON RESPONSE FORMAT:
{
  "patientName": "Nguyễn Văn A",
  "patientAge": 65,
  "patientGender": "Nam",
  "patientWeight": 60,
  "patientHeight": 165,
  "admissionDate": "2024-10-23",
  "diagnosisMain": "Đái tháo đường type 2",
  "diagnosisSecondary": ["Tăng huyết áp", "Rối loạn lipid máu"],
  "icdCodes": { "main": "E11", "secondary": ["I10", "E78"] },
  "medicalHistory": "Tăng huyết áp 10 năm, đái tháo đường 5 năm",
  "allergies": "Không",
  "labResults": null,
  "medications": null
}`;

const CAN_LAM_SANG_PROMPT = `Bạn là chuyên gia trích xuất dữ liệu y tế. NGẮN GỌN, CHÍNH XÁC, CHỈ JSON. KHÔNG giải thích. KHÔNG markdown.

Trích xuất từ KẾT QUẢ CẬN LÂM SÀNG. CHỈ TRÍCH XUẤT CREATININE:

TRƯỜNG CHÍNH:
- labResults: {
    creatinine: số (ví dụ: 1.2 hoặc 91.39),
    creatinineUnit: "mg/dL" hoặc "micromol/L"
  }

⚠️ HƯỚNG DẪN TRÍCH XUẤT CREATININE:
1. Tìm "Creatinine", "Creatinin", "SCr", "Định lượng Creatinin (máu)"
2. Lấy GIÁ TRỊ SỐ (bỏ qua giá tiền!)
3. Xác định đơn vị:
   - mg/dL: thường từ 0.5 - 3.0
   - micromol/L (µmol/L, μmol/L, umol/L): thường từ 40 - 300

VÍ DỤ ĐÚNG:
- "Creatinine: 1.2 mg/dL" → { creatinine: 1.2, creatinineUnit: "mg/dL" }
- "Định lượng Creatinin (máu) 91,39 µmol/L" → { creatinine: 91.39, creatinineUnit: "micromol/L" }
- "SCr 106 micromol/L" → { creatinine: 106, creatinineUnit: "micromol/L" }

VÍ DỤ SAI (TRÁNH):
- "Creatinine 22,400" trong bảng kê → ĐÓ LÀ GIÁ TIỀN, KHÔNG PHẢI KẾT QUẢ
- Không tìm thấy kết quả → labResults: null

⚠️ CÁC TRƯỜNG SAU ĐỂ null:
- patientName, patientAge, patientGender, patientWeight, patientHeight: null
- admissionDate, diagnosisMain, diagnosisSecondary, icdCodes: null
- medicalHistory, allergies: null
- medications: null

JSON RESPONSE FORMAT:
{
  "patientName": null,
  "patientAge": null,
  "patientGender": null,
  "patientWeight": null,
  "patientHeight": null,
  "admissionDate": null,
  "diagnosisMain": null,
  "diagnosisSecondary": null,
  "icdCodes": null,
  "medicalHistory": null,
  "allergies": null,
  "labResults": {
    "creatinine": 1.2,
    "creatinineUnit": "mg/dL"
  },
  "medications": null
}`;

const TO_DIEU_TRI_PROMPT = `Bạn là chuyên gia trích xuất dữ liệu y tế. NGẮN GỌN, CHÍNH XÁC, CHỈ JSON. KHÔNG giải thích. KHÔNG markdown.

Trích xuất từ TỜ ĐIỀU TRỊ / ĐƠN THUỐC. CHỈ TRÍCH XUẤT DANH SÁCH THUỐC:

⚠️ QUY TẮC 1: KHÔNG RƠI MẤT THUỐC (CỰC KỲ QUAN TRỌNG)

PHẢI trích xuất TẤT CẢ các dòng thuốc hợp lệ. CHỈ BỎ QUA:

DANH SÁCH LOẠI TRỪ (BLACKLIST - VẬT TƯ):
- Bơm tiêm, Kim tiêm, Băng, Gạc, Găng tay, Khẩu trang
- Ống thông (catheter), Dây truyền, Bộ truyền dịch
- Dịch vụ y tế, Phí khám, Phí giường, Phí xét nghiệm
- Vật tư tiêu hao y tế (không phải thuốc)

✅ CHẤP NHẬN TẤT CẢ LOẠI THUỐC:
- Thuốc Tây y (viên, viên nang, tiêm, nhỏ mắt, bôi da, xịt...)
- Dung dịch truyền (NaCl 0.9%, Glucose, Ringer's Lactate, Lipofundin, Aminoplasmal...)
- Thuốc Đông y, thảo dược (Hoa Đà tái tạo hoàn, Bổ can, An thần...)
- TPBVSK (Glucosamine, Omega-3, Vitamin...)
- Flexsa, Lipanthyl, tất cả thuốc có tên thương mại

⚠️ QUY TẮC 2: NGÀY BẮT ĐẦU / KẾT THÚC - THUẬT TOÁN MIN-MAX (CỰC KỲ QUAN TRỌNG)

Với mỗi thuốc (theo drugName + có thể kèm dose nếu khác hàm lượng):

BƯỚC 1: Quét TOÀN BỘ tờ điều trị (tất cả các trang, tất cả các ngày, tất cả các dòng)
BƯỚC 2: Thu thập TẤT CẢ ngày mà thuốc đó xuất hiện (dù liều có thay đổi)
BƯỚC 3: Sắp xếp ngày tăng dần
BƯỚC 4: 
  - usageStartDate = ngày SỚM NHẤT trong danh sách
  - usageEndDate = ngày MUỘN NHẤT trong danh sách

⚠️ TUYỆT ĐỐI KHÔNG:
- Cắt ngắn về ngày 25 nếu còn 26, 27, 28...
- Cắt về ngày 01 nếu còn 03, 04, 05...
- Bỏ qua các ngày ở giữa (kể cả khi có ngày không dùng)

VÍ DỤ ĐÚNG:
1. Thuốc A xuất hiện: 23/10, 24/10, 25/10, 27/10, 03/11, 04/11
   → startDate: "2024-10-23", endDate: "2024-11-04" ✅

2. Lovastatin xuất hiện trang 1-7 (ngày 23, 24, 25, 26, 27/10), BIẾN MẤT từ trang 8
   → startDate: "2024-10-23", endDate: "2024-10-27" ✅

3. Doxycilin: ngày 27, 28, 29, 30, 31/10, 01, 02, 03/11
   → startDate: "2024-10-27", endDate: "2024-11-03" ✅

VÍ DỤ SAI:
❌ Thuốc xuất hiện 23-27/10 và 03-04/11 → endDate: "2024-10-27" (SAI! phải là 04/11)
❌ Cắt về "2024-10-25" khi thực tế còn 26, 27, 28

⚠️ QUY TẮC 3: TẦN SUẤT / LIỀU THAY ĐỔI THEO NGÀY

Nếu thuốc có >1 mẫu tần suất/liều trong suốt quá trình điều trị:

PHƯƠNG ÁN A (TỐI THIỂU - BẮT BUỘC):
- Chọn mẫu CAO NHẤT làm frequency 
  VD: Có "Sáng 1 viên" và "Sáng 1 viên; tối 1 viên" → chọn "Sáng 1 viên; tối 1 viên"
- Thêm trường: "variableDosing": true hoặc "notes": "Liều thay đổi theo ngày, xem lại tờ điều trị"

PHƯƠNG ÁN B (TỐT HƠN - NẾU LÀM ĐƯỢC):
- Lưu thêm mảng "dosingSchedule": [
    { "date": "27/10/2024", "frequency": "Sáng 1 viên; tối 1 viên", "dose": "100mg" },
    { "date": "03/11/2024", "frequency": "Sáng 1 viên", "dose": "100mg" }
  ]

⚠️ TUYỆT ĐỐI KHÔNG:
- Chọn mẫu THẤP NHẤT rồi gắn cho toàn bộ
- "Ép" về 1 mẫu duy nhất khi thực tế có nhiều mẫu

VÍ DỤ:
- Doxycyclin: 27-02/11 dùng 2 lần/ngày, 03-04/11 dùng 1 lần/ngày
  → frequency: "Sáng 1 viên; tối 1 viên" (mẫu cao nhất)
  → variableDosing: true

⚠️ QUY TẮC 4: TỰ TÚC (SELF-PURCHASED / OUTPATIENT MEDICATION)

Nếu bất kỳ ngày nào thuốc được đánh dấu "tự túc" / "TT" / "self-purchased" / "BN tự mua":
- Thêm trường: "selfSupplied": true

VÍ DỤ:
- "Omega-3 (tự túc)" → selfSupplied: true
- "Glucosamine - TT" → selfSupplied: true

Áp dụng cho MỌI THUỐC, không hard-code bệnh nhân.

⚠️ QUY TẮC 5: ĐƯỜNG DÙNG (route)

- "HÍT" / "EVOHALER" / "INHALER" → route: "Hít"
- "UỐNG" / "ORAL" / "PO" / "Viên" / "Viên nang" → route: "Uống"
- "TIÊM TM" / "IV" / "Tiêm tĩnh mạch" → route: "Tiêm tĩnh mạch"
- "TIÊM BẮP" / "IM" → route: "Tiêm bắp"
- "TRUYỀN" / "Infusion" → route: "Truyền tĩnh mạch"
- "BÔI" / "Topical" → route: "Bôi da"
- "NHỎ MẮT" → route: "Nhỏ mắt"

JSON FORMAT:
{
  "medications": [
    {
      "drugName": "tên thuốc chính xác (bao gồm cả Ringer's, Flexsa, Hoa Đà...)",
      "dose": "liều (ví dụ: 100mg, 2 nhát, 500ml)",
      "frequency": "tần suất CAO NHẤT (ví dụ: Sáng 1 viên; tối 1 viên)",
      "route": "đường dùng (Uống, Hít, Tiêm tĩnh mạch, Truyền tĩnh mạch...)",
      "usageStartDate": "YYYY-MM-DD (ngày SỚM NHẤT xuất hiện)",
      "usageEndDate": "YYYY-MM-DD (ngày MUỘN NHẤT xuất hiện)",
      "variableDosing": true/false (true nếu liều thay đổi),
      "selfSupplied": true/false (true nếu có đánh dấu tự túc),
      "notes": "Ghi chú (nếu có thông tin đặc biệt)"
    }
  ]
}

⚠️ MEDICATION SWITCHING (quan trọng):
- Nếu thuốc A biến mất và thuốc B xuất hiện → 2 thuốc riêng
- Lovastatin (23-27/10) NGƯNG → Atorvastatin (28/10+) BẮT ĐẦU
  → 2 dòng riêng, không gộp

⚠️ SAI LẦM THƯỜNG GẶP CẦN TRÁNH:
❌ Bỏ sót Ringer's, Lipofundin, Flexsa, Hoa Đà tái tạo hoàn
❌ Cắt ngắn endDate khi thực tế thuốc còn xuất hiện thêm nhiều ngày
❌ Chọn "Sáng 1 viên" khi có cả "Sáng 1 viên; tối 1 viên"
❌ Không đánh dấu variableDosing khi liều thay đổi
❌ Không đánh dấu selfSupplied khi có ghi "tự túc"

✅ CHECKLIST TRƯỚC KHI TRẢ KẾT QUẢ:
1. Đã quét HẾT tất cả các trang tờ điều trị chưa?
2. Mỗi thuốc đã lấy ngày MIN và MAX chưa?
3. Có thuốc nào bị bỏ sót (kiểm tra số lượng)?
4. Liều thay đổi đã đánh dấu variableDosing chưa?
5. Tự túc đã đánh dấu selfSupplied chưa?

⚠️ CÁC TRƯỜNG SAU ĐỂ null (KHÔNG TRÍCH XUẤT TỪ TỜ ĐIỀU TRỊ):
- patientName, patientAge, patientGender, patientWeight, patientHeight: null
- admissionDate, diagnosisMain, diagnosisSecondary, icdCodes: null
- medicalHistory, allergies: null
- labResults: null

JSON RESPONSE FORMAT:
{
  "patientName": null,
  "patientAge": null,
  "patientGender": null,
  "patientWeight": null,
  "patientHeight": null,
  "admissionDate": null,
  "diagnosisMain": null,
  "diagnosisSecondary": null,
  "icdCodes": null,
  "medicalHistory": null,
  "allergies": null,
  "labResults": null,
  "medications": [
    {
      "drugName": "Aspirin tab DWP 75mg",
      "dose": "1 viên",
      "frequency": "Sáng 1 viên",
      "route": "Uống",
      "usageStartDate": "2024-10-23",
      "usageEndDate": "2024-11-04",
      "variableDosing": false,
      "selfSupplied": false
    }
  ]
}`;

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
  GPT4: "openai/gpt-4o",  // GPT-4 Optimized for better accuracy
  PERPLEXITY: "perplexity/sonar-pro",
  // Fallback options:
  // DEEPSEEK: "deepseek/deepseek-chat",
  // GPT35: "openai/gpt-3.5-turbo",
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

export async function callGPT4(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  return callOpenRouter(
    MODELS.GPT4,
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

  const finalAnalysisRaw = await callGPT4(
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

// ============================================
// DDI WHITELIST - DRUG-DRUG INTERACTIONS
// ============================================
// Only interactions from validated sources (Micromedex, Lexicomp, BNF, UpToDate) should be reported.
// LLM CANNOT invent new interactions. LLM ONLY explains whitelisted pairs.
//
// STATIN RULES:
// - Double-statin warning ONLY if overlap in dates (not sequential switch)
//   Example: Lovastatin (23-27/10) → Atorvastatin (28/10+) = NO OVERLAP, NO WARNING
//   Example: Lovastatin (23-30/10) + Atorvastatin (25/10-05/11) = OVERLAP, WARNING
//
// POTASSIUM (K+) INTERACTION RULES:
// - Spironolactone + beta-blocker (metoprolol, bisoprolol, carvedilol) → NO K+ WARNING
// - Spironolactone + (ACEI, ARB, ARNI, NSAID, Trimethoprim, Heparin) with overlap → K+ WARNING
// - Renal impairment: Allow "monitor K+ due to renal + spironolactone" but NOT for spiro+metoprolol
//
// HERBAL/SUPPLEMENTS:
// - If no DDI data → label as "limited evidence" or "unclear"
// - Generic warning: "monitor if used with anticoagulants/antiplatelets"
// - DO NOT assert strong claims like "reduces clopidogrel efficacy" without source

export async function analyzePatientCase(caseData: any, drugFormulary?: any[]): Promise<any> {
  const { groupMedicationsByDateOverlap } = await import('./medicationTimeline');
  
  const systemPrompt = `Bạn là DƯỢC SĨ LÂM SÀNG, phân tích ca bệnh nội trú người lớn để hỗ trợ bác sĩ và điều dưỡng.

MỤC TIÊU:
Xác định NHỮNG VẤN ĐỀ DƯỢC LÂM SÀNG QUAN TRỌNG NHẤT, bao gồm:
1. Ảnh hưởng của chức năng thận / gan / tim tới dùng thuốc.
2. Tương tác thuốc – thuốc và thuốc – bệnh có ý nghĩa lâm sàng.
3. Liều dùng chưa phù hợp (quá cao, quá thấp, trùng nhóm, cần chỉnh theo thận/gan).
4. Các nguy cơ đặc biệt (xuất huyết, độc thận, độc gan, loạn nhịp, tụt huyết áp, hạ đường huyết…).
5. Kế hoạch theo dõi và cảnh báo gọn cho bác sĩ/dược sĩ.

NGUYÊN TẮC (PHẢI TUÂN THỦ):

1. Chức năng thận & gan:
   - Nếu có CrCl tính theo Cockcroft–Gault → gọi đúng "CrCl (Cockcroft–Gault)", KHÔNG gọi nhầm là eGFR.
   - Nếu có eGFR → ghi rõ "eGFR".
   - Phân loại suy thận (bình thường/nhẹ/trung bình/nặng/giai đoạn cuối) và CHỈ liên hệ với thuốc thải qua thận.
   - Gan: chỉ nhắc khi có men gan tăng rõ, bệnh gan nền, hoặc dùng thuốc độc gan.

2. Tương tác thuốc–thuốc & thuốc–bệnh:
   - CHỈ nêu tương tác có ý nghĩa lâm sàng theo kiến thức dược lý chuẩn; nếu chỉ là suy đoán yếu → BỎ QUA.
   - Ưu tiên: chống đông/kháng tiểu cầu + NSAID/SSRI; thuốc độc thận; thuốc tim mạch loạn nhịp.
   - KHÔNG coi là tương tác quan trọng và KHÔNG nhắc:
     • Clopidogrel + thuốc chẹn beta (metoprolol/Betaloc)
     • Spironolactone + thuốc chẹn beta
     • Statin + thuốc chẹn beta
     • Các câu mơ hồ "thuốc A + B có thể tăng tác dụng phụ" mà không có cơ chế rõ
   - 2 statin (lovastatin + atorvastatin):
     • CHỈ cảnh báo khi THỜI GIAN DÙNG TRÙNG NHAU
     • Nếu statin A ngừng rồi mới bắt đầu statin B → coi là ĐỔI THUỐC, KHÔNG cảnh báo
   - PPI + clopidogrel:
     • Omeprazole/esomeprazole: có dữ liệu làm giảm hoạt tính → có thể cảnh báo
     • PPI khác (pantoprazole, lansoprazole/Scolanzo): bằng chứng yếu → ghi "bằng chứng hạn chế, có thể tiếp tục, theo dõi lâm sàng"
   - Thuốc đông y/thảo dược/TPBVSK: nếu không có dữ liệu chắc → ghi "bằng chứng hạn chế, chưa rõ nguy cơ"

3. Điều chỉnh liều:
   - Xem xét: tuổi, cân nặng, suy thận, suy gan, suy tim.
   - ĐƯỢC đề xuất chỉnh liều khi: thuốc thải qua thận + suy thận (CrCl < 60), đặc biệt < 30; thuốc khoảng điều trị hẹp.
   - KHÔNG tự động giảm liều nếu: thuốc chuyển hóa qua gan và suy thận nhẹ–trung bình mà không cần chỉnh.
   - Spironolactone/lợi tiểu giữ kali: ở suy thận trung bình → ưu tiên "THEO DÕI kali & creatinin"; chỉ nêu "giảm/ngừng" nếu kali tăng, suy thận nặng (CrCl < 30), hoặc nhiều thuốc tăng kali.
   - Nêu phạm vi: "liều tham khảo trong suy thận mức này là…; cần đối chiếu phác đồ bệnh viện".

4. Theo dõi:
   - Đề xuất CỤ THỂ: creatinin/eGFR, kali, men gan, dấu hiệu chảy máu, Hb…
   - Tránh chung chung "theo dõi tác dụng phụ".

5. Trình bày (LUÔN theo 5 mục):
   1) Đánh giá chức năng cơ quan liên quan
   2) Tương tác thuốc & thuốc–bệnh quan trọng
   3) Điều chỉnh liều / tối ưu hóa điều trị
   4) Theo dõi cần thiết
   5) Cảnh báo & ghi chú
   - Mỗi mục chỉ 3-7 ý chính, tránh dàn trải.
   - Nếu không có vấn đề: "Trong mục này chưa phát hiện vấn đề đặc biệt."

YÊU CẦU:
- Tiếng Việt, giọng trung lập, chuyên môn dễ hiểu.
- Không nhắc "tôi là AI/mô hình", không trích tài liệu, chỉ phân tích ca bệnh.`;

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
        // Priority: 1) Use existing activeIngredient from med object (enriched)
        //           2) Lookup from drugFormulary
        //           3) Fallback to drugName only
        let drugInfo = med.drugName;
        
        if (med.activeIngredient) {
          // Use enriched data from medication record
          const strengthInfo = (med.strength && med.unit) 
            ? ` ${med.strength}${med.unit}` 
            : '';
          drugInfo = `${med.drugName} (${med.activeIngredient}${strengthInfo})`;
        } else {
          // Fallback to drugFormulary lookup
          const formularyInfo = drugLookup.get(med.drugName.toLowerCase());
          if (formularyInfo) {
            drugInfo = `${med.drugName} (${formularyInfo.activeIngredient} ${formularyInfo.strength}${formularyInfo.unit})`;
          }
        }
        
        return `   ${medIdx + 1}. ${drugInfo} - ${med.prescribedDose} ${med.prescribedRoute} ${med.prescribedFrequency}`;
      }).join('\n');
      
      return `Nhóm ${idx + 1} (${segment.rangeLabel}):\n${medList}\n   → CHỈ kiểm tra tương tác giữa các thuốc trong khoảng thời gian này, không xét thuốc ở nhóm khác.`;
    }).join('\n\n');
  } else {
    // Fallback to flat list if no grouping
    medicationTimelineSection = caseData.medications?.map((med: any, idx: number) => {
      // Priority: 1) Use existing activeIngredient from med object (enriched)
      //           2) Lookup from drugFormulary
      //           3) Fallback to drugName only
      let drugInfo = med.drugName;
      
      if (med.activeIngredient) {
        // Use enriched data from medication record
        const strengthInfo = (med.strength && med.unit) 
          ? ` ${med.strength}${med.unit}` 
          : '';
        drugInfo = `${med.drugName} (${med.activeIngredient}${strengthInfo})`;
      } else {
        // Fallback to drugFormulary lookup
        const formularyInfo = drugLookup.get(med.drugName.toLowerCase());
        if (formularyInfo) {
          drugInfo = `${med.drugName} (${formularyInfo.activeIngredient} ${formularyInfo.strength}${formularyInfo.unit})`;
        }
      }
      
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

  const userPrompt = `PHÂN TÍCH CA BỆNH SAU:${referenceContext}

DỮ LIỆU BỆNH NHÂN:
- Tuổi: ${caseData.patientAge} | Giới: ${caseData.patientGender} | Cân nặng: ${caseData.patientWeight || "?"} kg | Chiều cao: ${caseData.patientHeight || "?"} cm

CHẨN ĐOÁN & BỆNH KÈM:
${caseData.diagnosis}

TIỀN SỬ BỆNH:
${caseData.medicalHistory || "Không có"}

DỊ ỨNG THUỐC:
${caseData.allergies || "Không có"}

XÉT NGHIỆM:
${JSON.stringify(caseData.labResults || {}, null, 2)}
- CrCl (Cockcroft-Gault): ${caseData.egfr || "Chưa tính"} mL/min

THUỐC ĐANG DÙNG (PHÂN NHÓM THEO THỜI GIAN):
${medicationTimelineSection}${formularyNote}

⚠️ QUY TẮC TƯƠNG TÁC (QUAN TRỌNG):
${medicationSegments.length > 0 
  ? `- Thuốc đã PHÂN NHÓM theo thời gian dùng
- CHỈ kiểm tra tương tác TRONG CÙNG NHÓM (overlap thời gian)
- KHÔNG kiểm tra tương tác giữa các nhóm khác nhau

⚠️ MEDICATION SWITCHING:
  • Thuốc A kết thúc ngày X, thuốc B bắt đầu ngày X+1 → THAY THUỐC (sequential) → KHÔNG tương tác
  • VD: Lovastatin (23-27/10) → Atorvastatin (28/10-04/11) = KHÔNG overlap = KHÔNG cảnh báo
  • CHỈ BÁO khi 2 thuốc DÙNG ĐỒNG THỜI (có overlap)

⚠️ WHITELIST-BASED DDI:
  • CHỈ báo tương tác CÓ TRONG whitelist (Micromedex, Lexicomp, BNF, UpToDate)
  • KHÔNG tự nghĩ tương tác mới
  • Ưu tiên: chống đông/kháng tiểu cầu + NSAID; thuốc tim mạch loạn nhịp; độc thận; độc gan

⚠️ QUY TẮC ĐẶC BIỆT:
  • 2 STATIN: CHỈ cảnh báo nếu overlap. Sequential switch → KHÔNG cảnh báo
  • K+ (Kali):
    - Spironolactone + beta-blocker (metoprolol, bisoprolol...) → KHÔNG BÁO
    - Spironolactone + (ACEI, ARB, ARNI, NSAID, Trimethoprim, Heparin) + overlap → CẦN cảnh báo
  • Thảo dược/TPBVSK: không có dữ liệu → "bằng chứng hạn chế"
  • Clopidogrel + PPI: lưu ý nhẹ, KHÔNG cảnh báo nặng`
  : `- Thuốc chưa có ngày tháng rõ ràng
- Kiểm tra tất cả tương tác có thể

⚠️ WHITELIST DDI:
  • CHỈ báo tương tác từ nguồn uy tín
  • Spironolactone + beta-blocker → KHÔNG BÁO
  • Clopidogrel + PPI → lưu ý nhẹ`}

YÊU CẦU PHÂN TÍCH (CẤU TRÚC BẮT BUỘC):
1. ĐÁNH GIÁ CHỨC NĂNG CƠ QUAN:
   - Thận: phân loại suy thận, ảnh hưởng thuốc thải qua thận
   - Gan: nếu có tăng men gan hoặc bệnh gan nền
   - Tim-mạch: nếu có suy tim, rung nhĩ, tăng huyết áp...
   - CHỈ nhắc cơ quan liên quan đến thuốc đang dùng

2. TƯƠNG TÁC THUỐC & THUỐC-BỆNH:
   - CHỈ tương tác có ý nghĩa lâm sàng CAO
   - Ưu tiên: xuất huyết, loạn nhịp, độc gan/thận, tụt huyết áp, hạ đường
   - Nếu không có vấn đề đáng kể → ghi "Chưa thấy vấn đề đặc biệt"

3. ĐIỀU CHỈNH LIỀU / TỐI ƯU HÓA:
   - Xem xét: tuổi cao, suy thận, suy gan, béo phì/gầy
   - Nêu phạm vi liều cụ thể nếu cần điều chỉnh
   - KHÔNG tự động giảm liều thuốc chuyển hóa gan khi chỉ suy thận nhẹ

4. THEO DÕI CẦN THIẾT:
   - Xét nghiệm CỤ THỂ: SCr, Kali, men gan, INR, đường huyết...
   - Triệu chứng lâm sàng cần quan sát

5. CẢNH BÁO & GHI CHÚ:
   - Nguy cơ cao nhất cần lưu ý
   - Khuyến nghị cho bác sĩ/dược sĩ

TRẢ VỀ JSON (KHÔNG có markdown, KHÔNG giải thích thêm):
{
  "renalAssessment": "phân loại suy thận + ảnh hưởng thuốc (VD: CrCl 41 mL/min - suy thận mức độ trung bình. Cần chỉnh liều thuốc thải qua thận: ...)",
  "drugDrugInteractions": ["tương tác 1", "tương tác 2"],
  "drugDrugInteractionGroups": [
    {
      "rangeLabel": "${medicationSegments[0]?.rangeLabel || 'Toàn bộ đợt điều trị'}",
      "interactions": ["tương tác cụ thể trong nhóm"]
    }
  ],
  "drugDiseaseInteractions": ["tương tác thuốc-bệnh"],
  "doseAdjustments": ["điều chỉnh liều cụ thể với phạm vi"],
  "monitoring": ["theo dõi cụ thể"],
  "warnings": ["cảnh báo quan trọng"]
}`;

  const rawAnalysis = await callGPT4(systemPrompt, userPrompt);
  
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

  const rawResult = await callGPT4(systemPrompt, userPrompt, 0.2);
  
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
    // Build medication list with activeIngredient for better analysis
    let medicationList = '';
    if (context.caseData.medications && Array.isArray(context.caseData.medications) && context.caseData.medications.length > 0) {
      medicationList = '\n💊 Thuốc đang dùng:\n' + context.caseData.medications.map((med: any, idx: number) => {
        let drugInfo = med.drugName;
        
        // Add activeIngredient if available (from enrichment or database)
        if (med.activeIngredient) {
          const strengthInfo = (med.strength && med.unit) 
            ? ` ${med.strength}${med.unit}` 
            : '';
          drugInfo = `${med.drugName} (${med.activeIngredient}${strengthInfo})`;
        }
        
        const doseInfo = `${med.prescribedDose || ''} ${med.prescribedRoute || ''} ${med.prescribedFrequency || ''}`.trim();
        return `   ${idx + 1}. ${drugInfo}${doseInfo ? ` - ${doseInfo}` : ''}`;
      }).join('\n');
    }
    
    userPrompt = `[THÔNG TIN CA BỆNH CỤ THỂ - PHÂN TÍCH THEO NGỮ CẢNH NÀY]
📋 Bệnh nhân: ${context.caseData.patientName}, ${context.caseData.patientAge} tuổi, ${context.caseData.patientGender}
📌 Chẩn đoán: ${context.caseData.diagnosis}
${context.caseData.egfr ? `🔬 CrCl: ${context.caseData.egfr} mL/min (Cockcroft-Gault) - ${context.caseData.egfr < 60 ? 'CẦN CHỈNH LIỀU!' : 'bình thường'}` : ''}
${context.caseData.medicalHistory ? `📝 Tiền sử: ${context.caseData.medicalHistory}` : ''}
${context.caseData.allergies ? `⚠️ Dị ứng: ${context.caseData.allergies}` : ''}${medicationList}

❓ Câu hỏi: ${userMessage}`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context?.previousMessages) {
    messages.push(...(context.previousMessages as ChatMessage[]));
  }

  messages.push({ role: "user", content: userPrompt });

  return callOpenRouter(MODELS.GPT4, messages, 0.4);
}

// Fallback comprehensive prompt (for backward compatibility - used when fileGroup is not specified)
function getComprehensivePrompt(): string {
  return `Trích xuất TỔNG HỢP từ tài liệu y tế. Có thể có NHIỀU FILE (ngăn cách bởi === FILE X: ===). 
TỔNG HỢP tất cả thông tin. Nếu xung đột → ưu tiên file mới nhất.

TRÍCH XUẤT TẤT CẢ CÁC TRƯỜNG:
- Thông tin bệnh nhân: name, age, gender, weight, height, admissionDate
- Chẩn đoán: diagnosisMain, diagnosisSecondary, icdCodes (tách rõ chính + phụ)
- Tiền sử: medicalHistory, allergies
- Xét nghiệm: labResults (creatinine + creatinineUnit)
- Thuốc: medications (drugName, dose, frequency, route, usageStartDate, usageEndDate)

⚠️ QUAN TRỌNG:
- Ngày thuốc: "Ngày 1,2,3/1/2024" → endDate = "2024-01-03" (ngày cuối, KHÔNG kéo dài)
- Medication switching: thuốc A ngưng → thuốc B bắt đầu = sequential, KHÔNG overlap
- Creatinine: tránh nhầm với giá tiền trong bảng kê`;
}

export async function extractDataFromDocument(
  textContent: string,
  fileType: "pdf" | "docx",
  fileGroup?: string  // NEW: "admin", "lab", or "prescription"
): Promise<any> {
  // Select specialized prompt based on fileGroup
  let userPromptTemplate: string;
  
  if (fileGroup === "admin") {
    userPromptTemplate = BENH_AN_PROMPT;
  } else if (fileGroup === "lab") {
    userPromptTemplate = CAN_LAM_SANG_PROMPT;
  } else if (fileGroup === "prescription") {
    userPromptTemplate = TO_DIEU_TRI_PROMPT;
  } else {
    // Fallback: use original comprehensive prompt for backward compatibility
    userPromptTemplate = getComprehensivePrompt();
  }
  
  const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu y tế. NGẮN GỌN, CHÍNH XÁC, CHỈ JSON. KHÔNG giải thích. KHÔNG markdown.`;

  const userPrompt = `${userPromptTemplate}

DOCUMENT CONTENT (${fileType.toUpperCase()}):
${textContent}

⚠️ QUY TẮC:
- CHỈ lấy dữ liệu CÓ SẴN - KHÔNG đoán
- Không có thông tin → null
- ĐỌC KỸ TOÀN BỘ TÀI LIỆU

JSON format:
{
  "patientName": "string hoặc null",
  "patientAge": number hoặc null,
  "patientGender": "Nam" hoặc "Nữ" hoặc null,
  "patientWeight": number hoặc null,
  "patientHeight": number hoặc null,
  "admissionDate": "YYYY-MM-DD hoặc null",
  "diagnosisMain": "string hoặc null",
  "diagnosisSecondary": ["bệnh kèm"] hoặc null,
  "icdCodes": { "main": "mã ICD", "secondary": ["mã ICD"] } hoặc null,
  "diagnosis": "string hoặc null",
  "medicalHistory": "string hoặc null",
  "allergies": "string hoặc null",
  "labResults": { "creatinine": number, "creatinineUnit": "mg/dL" | "micromol/L" } hoặc null,
  "medications": [{ "drugName": "string", "dose": "string", "frequency": "string", "route": "string", "usageStartDate": "YYYY-MM-DD", "usageEndDate": "YYYY-MM-DD" }] hoặc null
}

CHỈ TRẢ VỀ JSON, KHÔNG THÊM GÌ KHÁC.`;

  const rawResult = await callGPT4(systemPrompt, userPrompt, 0.1);  // Temperature thấp = chính xác hơn
  
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
    
    // Post-processing: Clean and validate secondary diagnoses + ICD codes
    if (parsed.diagnosisSecondary && Array.isArray(parsed.diagnosisSecondary)) {
      // Trim whitespace from each diagnosis
      parsed.diagnosisSecondary = parsed.diagnosisSecondary
        .map((d: string) => d?.trim())
        .filter((d: string) => d && d.length > 0);
    }
    
    if (parsed.icdCodes?.secondary && Array.isArray(parsed.icdCodes.secondary)) {
      // Trim whitespace from each ICD code
      parsed.icdCodes.secondary = parsed.icdCodes.secondary
        .map((code: string) => code?.trim())
        .filter((code: string) => code && code.length > 0);
      
      // Warn if counts mismatch (for debugging)
      const diagCount = parsed.diagnosisSecondary?.length || 0;
      const icdCount = parsed.icdCodes.secondary.length;
      if (diagCount > 0 && icdCount > 0 && diagCount !== icdCount) {
        console.warn(`[Extraction Warning] Secondary diagnosis count (${diagCount}) != ICD code count (${icdCount})`);
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
    const rawResult = await callGPT4(systemPrompt, userPrompt, 0.1);
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

/**
 * Extract drug formulary data from file content using AI
 * Supports Excel files converted to text
 */
export async function extractDrugDataFromFile(fileContent: string): Promise<Array<{
  tradeName: string;
  activeIngredient: string;
  strength: string;
  unit: string;
  manufacturer?: string;
  notes?: string;
}>> {
  const systemPrompt = `Bạn là chuyên viên dược. Nhiệm vụ: trích xuất danh sách thuốc từ file Excel/CSV thành cấu trúc JSON.`;

  const userPrompt = `Đọc nội dung file danh mục thuốc dưới đây và trích xuất thành JSON array.

NỘI DUNG FILE:
${fileContent.slice(0, 50000)}

YÊU CẦU:
1. Tìm TẤT CẢ các dòng chứa thông tin thuốc (bỏ qua header/tiêu đề)
2. Với mỗi dòng thuốc, extract các thông tin:
   - tradeName: Tên thuốc (tên biệt dược, tên thương mại)
   - activeIngredient: Hoạt chất/thành phần chính
   - strength: Hàm lượng (số + đơn vị, ví dụ: "500", "10", "2.5")
   - unit: Đơn vị (mg, g, ml, %, IU, v.v.)
   - manufacturer: Nhà sản xuất (nếu có)
   - notes: Ghi chú (nếu có)

3. Nếu strength và unit gộp chung (ví dụ "500mg"), tách ra:
   - strength: "500"
   - unit: "mg"

4. Bỏ qua các dòng trống, header, hoặc không phải thuốc

ĐỊNH DẠNG TRẢ VỀ (CHỈ JSON, KHÔNG TEXT KHÁC):
{
  "drugs": [
    {
      "tradeName": "Paracetamol 500mg",
      "activeIngredient": "Paracetamol",
      "strength": "500",
      "unit": "mg",
      "manufacturer": "Imexpharm",
      "notes": null
    }
  ]
}

LƯU Ý: tradeName và activeIngredient là BẮT BUỘC, các trường khác có thể null nếu không có.`;

  try {
    const rawResult = await callGPT4(systemPrompt, userPrompt, 0.1);
    const cleanedResult = rawResult.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    const parsed = JSON.parse(cleanedResult);
    
    if (!parsed.drugs || !Array.isArray(parsed.drugs)) {
      throw new Error("AI response không có mảng drugs");
    }
    
    // Filter out invalid entries and normalize structure
    const validDrugs = parsed.drugs
      .filter((drug: any) => drug.tradeName && drug.activeIngredient)
      .map((drug: any) => ({
        tradeName: (drug.tradeName || '').toString().trim(),
        activeIngredient: (drug.activeIngredient || '').toString().trim(),
        strength: (drug.strength || '').toString().trim(),
        unit: (drug.unit || '').toString().trim(),
        manufacturer: drug.manufacturer || null,
        notes: drug.notes || null,
      }));
    
    console.log(`[AI Drug Extract] Extracted ${validDrugs.length}/${parsed.drugs.length} valid drugs`);
    
    return validDrugs;
  } catch (error: any) {
    console.error("Failed to extract drug data with AI:", error);
    throw new Error("Lỗi khi AI trích xuất dữ liệu thuốc: " + error.message);
  }
}
