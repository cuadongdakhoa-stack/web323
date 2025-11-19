# Railway Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Dependencies Check
- [x] All npm packages listed in `package.json`
- [x] Native modules (bcrypt) with build tools configured
- [x] Font files for PDF export included
- [x] Database driver (@neondatabase/serverless + ws)

### 2. Build Configuration
- [x] `build` script includes postbuild for fonts
- [x] `nixpacks.toml` has python3, gcc, gnumake
- [x] `.npmrc` configured for native module rebuilds
- [x] `.dockerignore` excludes unnecessary files

### 3. Environment Variables Required
```
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=sk-or-v1-...
SESSION_SECRET=cuadong-care-pharma-secret-key
NODE_ENV=production
PORT=5000
```

### 4. Runtime Requirements
- [x] Node.js 20.x
- [x] PostgreSQL (Neon external)
- [x] File system access for uploads (ephemeral on Railway)
- [x] WebSocket support for Neon connection

## 🚀 Deployment Steps

### Option 1: Railway (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Ready for Railway deployment"
   git remote add origin https://github.com/YOUR_USERNAME/carepharma.git
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js and uses `nixpacks.toml`

3. **Add Environment Variables**
   In Railway dashboard → Variables tab:
   - `DATABASE_URL` → Your Neon connection string
   - `OPENROUTER_API_KEY` → Your OpenRouter API key
   - `SESSION_SECRET` → `cuadong-care-pharma-secret-key`
   - `NODE_ENV` → `production`
   - `PORT` → `5000` (auto-set by Railway)

4. **Wait for Build**
   - Railway builds using nixpacks
   - Installs dependencies with python3/gcc for bcrypt
   - Runs `npm run build` (includes font copying)
   - Starts with `npm run start`

5. **Verify Deployment**
   - Check logs for "serving on ..."
   - Access provided URL
   - Visit `/api/admin/seed-users` to create initial users
   - Login with `admin_cd` / `admin123`

### Option 2: Docker (VPS/Cloud)

1. **Build Image**
   ```bash
   docker build -t carepharma .
   ```

2. **Run Container**
   ```bash
   docker run -d -p 5000:5000 \
     -e DATABASE_URL="postgresql://..." \
     -e OPENROUTER_API_KEY="sk-or-v1-..." \
     -e SESSION_SECRET="cuadong-care-pharma-secret-key" \
     -e NODE_ENV="production" \
     --name carepharma-app \
     carepharma
   ```

3. **Setup Reverse Proxy** (nginx/caddy)

### Option 3: Render.com (Free Tier)

1. Connect GitHub repo
2. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Environment**: Add same variables as Railway
3. Deploy

## ⚠️ Known Limitations

### File Uploads
- Railway/Render: **Ephemeral storage** - files lost on redeploy
- **Solution**: 
  - Use Cloudinary/AWS S3 for persistent storage
  - Or deploy to VPS with persistent volumes

### Database
- Must use external database (Neon recommended)
- Railway PostgreSQL addon costs extra ($5+/month)

### Cold Starts
- Free tier (Render): ~30 second cold start after 15 min idle
- Railway Hobby ($5): Always warm

## 🔧 Troubleshooting

### Build Fails: "bcrypt@... install script failed"
- **Cause**: Missing build tools
- **Fix**: Verify `nixpacks.toml` has `python3`, `gcc`, `gnumake`

### Runtime Error: "Cannot find module './fonts/NotoSans-Regular.ttf'"
- **Cause**: Fonts not copied to dist
- **Fix**: Check `postbuild` script runs: `npm run build` should show font copy step

### Database Connection Error
- **Cause**: Invalid DATABASE_URL or Neon project paused
- **Fix**: 
  1. Verify connection string format
  2. Check Neon dashboard for project status
  3. Ensure `?sslmode=require` in connection string

### AI Features Not Working
- **Cause**: Missing or invalid OPENROUTER_API_KEY
- **Fix**: 
  1. Get API key from https://openrouter.ai/keys
  2. Add to Railway environment variables
  3. Redeploy

### Port Already in Use (Local)
- **Cause**: Old process still running
- **Fix**: 
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  
  # Linux/Mac
  lsof -ti:5000 | xargs kill -9
  ```

## 📊 Resource Usage Estimates

### Railway Hobby ($5 credit/month)
- **Typical usage**: $3-4/month
- **Compute**: ~400 hours uptime
- **Memory**: 512MB-1GB average
- **CPU**: <0.5 vCPU average

### What's Included
- ✅ Automatic HTTPS/SSL
- ✅ Custom domain support
- ✅ Automatic deployments on git push
- ✅ Logs & monitoring
- ✅ Zero-downtime deploys

## ✨ Post-Deployment

1. **Seed Initial Users**
   ```
   https://your-app.railway.app/api/admin/seed-users
   ```

2. **Test Key Features**
   - Login: `admin_cd` / `admin123`
   - Create test case
   - Upload PDF/DOCX for AI extraction
   - Generate consultation report (PDF/DOCX)
   - Test chatbot

3. **Setup Monitoring**
   - Railway: Built-in logs & metrics
   - Consider: Sentry for error tracking
   - Consider: LogDNA/Papertrail for log aggregation

4. **Backup Strategy**
   - Neon: Automatic daily backups (free plan)
   - Export drug formulary monthly
   - Backup uploaded files if using S3

---

**Ready to deploy? Run through checklist and push to Railway!** 🚀
