# 🚀 Hướng dẫn chạy local trên Windows

## Bước 1: Cài đặt Dependencies

```powershell
npm install
```

## Bước 2: Setup Database

### Option A: PostgreSQL Local (khuyến nghị cho dev)

1. **Cài PostgreSQL:**
   - Download: https://www.postgresql.org/download/windows/
   - Chọn version 14+ 
   - Port: 5432 (mặc định)
   - Nhớ password của user `postgres`

2. **Chạy script tự động:**
   ```powershell
   .\setup-db.ps1
   ```
   - Chọn option 1
   - Nhập username/password PostgreSQL
   - Script sẽ tự tạo database `carepharma`

### Option B: Neon Cloud (không cần cài gì)

1. Truy cập: https://neon.tech
2. Đăng ký tài khoản miễn phí
3. Tạo project mới
4. Copy connection string
5. Paste vào file `.env`:
   ```env
   DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

## Bước 3: Cấu hình API Keys

Mở file `.env` và điền:

```env
# Database (đã setup ở bước 2)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carepharma

# OpenRouter API (bắt buộc cho AI features)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Session Secret (đã có mặc định, có thể giữ nguyên)
SESSION_SECRET=cuadong-care-pharma-secret-key
```

**Lấy OpenRouter API Key:**
1. Truy cập: https://openrouter.ai/keys
2. Đăng ký/đăng nhập
3. Tạo API key mới
4. Copy và paste vào `.env`
5. Nạp credit (khuyến nghị $5 để test)

## Bước 4: Chạy Migrations

```powershell
npm run db:push
```

Lệnh này sẽ tạo tất cả tables trong database.

## Bước 5: Seed Users (Tạo tài khoản demo)

Sau khi tạo xong database, chạy script seed để tạo 5 tài khoản demo:

```powershell
npm run db:seed
```

**Tài khoản được tạo:**

| Username | Password | Vai trò | Họ tên | Khoa |
|----------|----------|---------|---------|-------|
| `admin_cd` | `admin123` | Admin | Quản trị viên Cửa Đông | Quản lý hệ thống |
| `duoc1` | `duoc123` | Pharmacist | Dược sĩ Nguyễn Văn A | Khoa Dược |
| `duoc2` | `duoc123` | Pharmacist | Dược sĩ Trần Thị B | Khoa Dược |
| `bsnoi` | `bsnoi123` | Doctor | Bác sĩ Lê Văn C | Khoa Nội |
| `bsicu` | `bsicu123` | Doctor | Bác sĩ Phạm Thị D | Khoa Hồi sức cấp cứu |

💡 **Lưu ý:** Script sẽ tự động bỏ qua nếu user đã tồn tại, an toàn chạy nhiều lần.

## Bước 6: Khởi động Server

### Cách 1: Dùng npm script
```powershell
npm run dev
```

### Cách 2: Dùng PowerShell script
```powershell
.\dev.ps1
```

Server sẽ chạy tại: **http://localhost:5000**

## 📝 Scripts có sẵn

```powershell
# Development
npm run dev          # Chạy dev server (cross-platform)
npm run dev:win      # Chạy dev server (Windows native)
.\dev.ps1            # Chạy dev với PowerShell (có check .env)

# Database
npm run db:push      # Push schema changes
npm run db:studio    # Mở Drizzle Studio (GUI)
npm run db:seed      # Seed demo users (5 tài khoản)

# Production build
npm run build        # Build frontend + backend
npm run start        # Start production server
npm run start:win    # Start production (Windows native)

# Type checking
npm run check        # Check TypeScript errors
```

## 🔧 Troubleshooting

### ❌ Error: "DATABASE_URL must be set"
- Kiểm tra file `.env` có tồn tại và có dòng `DATABASE_URL=...`
- Đảm bảo connection string đúng format

### ❌ Error: "OPENROUTER_API_KEY is not configured"
- Mở `.env` và thêm API key từ OpenRouter
- Restart server sau khi thay đổi `.env`

### ❌ Error: "connect ECONNREFUSED ::1:5432"
- PostgreSQL service chưa chạy
- Windows: Mở Services → PostgreSQL → Start
- Hoặc dùng Neon Cloud thay thế

### ❌ Port 5000 đã bị chiếm
- Tìm process đang dùng port:
  ```powershell
  netstat -ano | findstr :5000
  ```
- Kill process:
  ```powershell
  taskkill /PID <PID> /F
  ```

### ❌ Lỗi "Cannot find module"
- Xóa `node_modules` và cài lại:
  ```powershell
  Remove-Item -Recurse -Force node_modules
  npm install
  ```

## 📂 Cấu trúc Dự án

```
CarePharmaWeb/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── hooks/       # Custom hooks
├── server/              # Express backend
│   ├── index.ts         # Entry point
│   ├── routes.ts        # API routes
│   ├── db.ts            # Database config
│   ├── auth.ts          # Authentication
│   └── openrouter.ts    # AI integration
├── shared/              # Shared types/schemas
│   └── schema.ts        # Drizzle schema + Zod
├── uploads/             # File uploads (auto-created)
├── .env                 # Environment variables (GIT IGNORED)
├── package.json         # Dependencies
└── vite.config.ts       # Vite config
```

## 🎯 Next Steps

1. ✅ Login với tài khoản admin: `admin_cd` / `admin123`
2. ✅ Tạo case mới để test
3. ✅ Upload file PDF/DOCX để test AI extraction
4. ✅ Thử chatbot với câu hỏi y khoa
5. ✅ Import danh mục thuốc (Drug Formulary) từ Excel

## 📚 Tài liệu thêm

- Design Guidelines: `design_guidelines.md`
- Project Overview: `replit.md`
- Drizzle ORM: https://orm.drizzle.team
- OpenRouter API: https://openrouter.ai/docs
