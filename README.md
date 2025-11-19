# Care Pharma - Clinical Pharmacy Consultation System

Hệ thống hỗ trợ dược sĩ lâm sàng trong việc phân tích case bệnh nhân, kiểm tra tương tác thuốc, và tạo phiếu tư vấn sử dụng thuốc.

## 🚀 Quick Start

### Local Development
```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```
Chi tiết: [README-LOCAL.md](./README-LOCAL.md)

### Deployment
```bash
git push origin main
# Deploy trên Railway.app
```
Chi tiết: [RAILWAY-CHECKLIST.md](./RAILWAY-CHECKLIST.md)

## 📚 Documentation

- **[README-LOCAL.md](./README-LOCAL.md)** - Hướng dẫn chạy local
- **[RAILWAY-CHECKLIST.md](./RAILWAY-CHECKLIST.md)** - Deploy lên Railway
- **[DEPLOY.md](./DEPLOY.md)** - Tổng quan deployment
- **[DEPLOYMENT-READY.md](./DEPLOYMENT-READY.md)** - Technical summary

## ✨ Features

- 🔐 Authentication với role-based access
- 📋 Case management với AI extraction
- 🧪 eGFR auto-calculation (Cockcroft-Gault)
- 💊 Timeline-based drug interaction checking
- 🤖 AI-powered clinical analysis (DeepSeek + Perplexity)
- 📄 PDF/DOCX export với Vietnamese fonts
- 🗂️ Drug formulary management
- 💬 Context-aware chatbot

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Shadcn/UI
- **Backend**: Node.js + Express + Drizzle ORM
- **Database**: PostgreSQL (Neon)
- **AI**: OpenRouter (DeepSeek Chat + Perplexity Sonar Pro)

## 📦 Environment Variables

```env
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=sk-or-v1-...
SESSION_SECRET=your-secret-key
NODE_ENV=production
```

## 🎯 Default Users

After seeding (`/api/admin/seed-users`):
- Admin: `admin_cd` / `admin123`
- Dược sĩ: `duoc1` / `duoc123`

## 📝 License

MIT
