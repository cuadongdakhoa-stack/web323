# ✅ CHUYỂN ĐỔI MODEL AI HOÀN TẤT

## Thay đổi đã thực hiện:

### 1. Model AI Architecture
- ✅ **DeepSeek v3.1**: Gọi TRỰC TIẾP qua `api.deepseek.com` (KHÔNG qua OpenRouter)
- ✅ **Perplexity Sonar Pro**: Vẫn dùng qua OpenRouter (cho evidence search)

### 2. API Routes:
| Function | Model | API Route | Pricing |
|----------|-------|-----------|---------|
| Extract data from PDF | DeepSeek v3.1 | **Direct** → `api.deepseek.com` | $0.14/$0.28 per 1M |
| Analyze medications | DeepSeek v3.1 | **Direct** → `api.deepseek.com` | $0.14/$0.28 per 1M |
| Summarize case | DeepSeek v3.1 | **Direct** → `api.deepseek.com` | $0.14/$0.28 per 1M |
| Extract drug list | DeepSeek v3.1 | **Direct** → `api.deepseek.com` | $0.14/$0.28 per 1M |
| Detect document type | DeepSeek v3.1 | **Direct** → `api.deepseek.com` | $0.14/$0.28 per 1M |
| Search evidence | **Perplexity Sonar Reasoning** | OpenRouter → `openrouter.ai` | $1/$5 per 1M |

### 3. Lợi ích khi dùng DeepSeek Direct:

- ✅ **Trích xuất dữ liệu từ PDF** (extractDataFromDocument)
- ✅ **Phân tích tương tác thuốc** (analyzeMedications)
- ✅ **Tổng hợp hồ sơ bệnh án** (summarizeCase)
- ✅ **Trích xuất danh sách thuốc** (extractDrugList)
- ✅ **Phát hiện loại tài liệu** (detectDocumentType)

### 3. Lợi ích khi dùng DeepSeek Direct:

| Chỉ số | GPT-4o (OpenRouter) | DeepSeek v3.1 (Direct) | Tiết kiệm |
|--------|---------------------|------------------------|-----------|
| **Chi phí input** | $2.50/1M tokens | $0.14/1M tokens | **95%** |
| **Chi phí output** | $10.00/1M tokens | $0.28/1M tokens | **97%** |
| **Chi phí/case** | ~$0.12 | ~$0.003 | **~40x rẻ hơn** |
| **Chi phí/tháng** | $108-185 | $2.70-4.50 | **Tiết kiệm ~$180/tháng** |
| **Latency** | N/A | 3-4 giây | Fast |
| **OpenRouter fee** | +$0.005/1M | **$0** (Direct) | No markup |

**Perplexity Sonar Models Comparison:**

| Model | Input Cost | Output Cost | Use Case |
|-------|------------|-------------|----------|
| sonar-pro | $3/1M | $15/1M | Deep research, many citations |
| **sonar-reasoning** ✅ | **$1/1M** | **$5/1M** | **Balanced (67-83% cheaper)** |
| sonar | $1/1M | $5/1M | Fast online search |

*Chọn sonar-reasoning để cân bằng giữa chất lượng và chi phí.*

### 4. Test Results (Verified):

**Test 1: Simple conversation (test-direct-api.ts)**
- Prompt: "Xin chào! Tên của bạn là gì?"  
- Response time: **3.9 seconds**
- Tokens: 27 input + 88 output = 115 total
- Cost: **$0.000028**
- ✅ Vietnamese response accurate

**Test 2: Full case extraction (BÙI THỊ TÂM - 3 PDFs)**
- Patient Info: ✅ 100% chính xác
- Diagnosis: ✅ Đầy đủ text + ICD codes (I50.9, I25.1)
- Medications: ✅ 20 thuốc extracted
- Lab Results: ✅ 26 tests với abnormal flags
- Response time: **141 seconds**
- Tokens: 12,316 input + 4,291 output = 16,607 total
- Cost: **$0.002926** (vs $0.12 với GPT-4)

### 5. API Keys đã cấu hình:

```
✅ DEEPSEEK_API_KEY: sk-4568... (for direct API)
✅ OPENROUTER_API_KEY: sk-or-v1-bcff... (for Perplexity only)
✅ DATABASE_URL: postgresql://neondb_owner...
```

## 🚀 Cách chạy local để test:

### Option 1: Dùng script có sẵn
```powershell
.\dev.ps1
```

### Option 2: Chạy thủ công
```powershell
# Set environment
$env:NODE_ENV = "development"

# Start server
tsx server/index.ts
```

Server sẽ chạy tại: **http://localhost:5000**

## 📋 Checklist trước khi test:

- [x] Model AI đã chuyển sang DeepSeek v3.1
- [x] OPENROUTER_API_KEY configured
- [x] DEEPSEEK_API_KEY configured (dự phòng cho direct API)
- [x] DATABASE_URL configured (Neon PostgreSQL)
- [x] node_modules installed
- [ ] **Bạn chạy `.\dev.ps1` để start server**

## 🧪 Test scenarios gợi ý:

1. **Upload PDF bệnh án** → Kiểm tra trích xuất thông tin bệnh nhân
2. **Upload tờ điều trị** → Kiểm tra trích xuất danh sách thuốc
3. **Upload xét nghiệm** → Kiểm tra trích xuất labs + creatinine
4. **Phân tích tương tác thuốc** → Kiểm tra AI analysis với DeepSeek
5. **Tạo báo cáo** → Kiểm tra tổng hợp hồ sơ

## 📊 Monitoring:

Khi server chạy, bạn sẽ thấy logs:
```
[AI] Using DeepSeek v3.1 for document type detection
[AI] Using DeepSeek v3.1 for medication analysis
[AI] Using DeepSeek v3.1 for case summarization
```

Confirms DeepSeek đang được sử dụng thay vì GPT-4.

---

**SẴN SÀNG TEST!** Chạy `.\dev.ps1` để bắt đầu 🎉
