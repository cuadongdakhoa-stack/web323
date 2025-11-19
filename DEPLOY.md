# 🚀 Hướng dẫn Deploy

## Railway (Khuyến nghị - $5/tháng)

### Bước 1: Push code lên GitHub
```powershell
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/carepharma.git
git push -u origin main
```

### Bước 2: Deploy trên Railway
1. Truy cập: https://railway.app
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Chọn repository `carepharma`
4. Railway tự động detect và build

### Bước 3: Thêm Environment Variables
Trong Railway dashboard, vào **Variables** tab và thêm:

```env
DATABASE_URL=postgresql://neondb_owner:npg_SqoAV12hdLKw@ep-gentle-base-a1p8vfup-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
OPENROUTER_API_KEY=sk-or-v1-xxxxx
SESSION_SECRET=cuadong-care-pharma-secret-key
NODE_ENV=production
PORT=5000
```

### Bước 4: Deploy!
Railway tự động:
- Chạy `npm install`
- Chạy `npm run build`
- Chạy `npm run start`
- Expose public URL

### Bước 5: Seed Users
Sau khi deploy xong, truy cập:
```
https://your-app.railway.app/api/admin/seed-users
```

---

## Render.com (Free tier)

### Deploy
1. Truy cập: https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repo
4. Cấu hình:
   - **Name:** carepharma
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** Free

5. Thêm Environment Variables (giống Railway)

6. Click **"Create Web Service"**

### Lưu ý Free Tier:
- Service sleep sau 15 phút không dùng
- Cold start ~30 giây
- 750 giờ/tháng miễn phí

---

## Docker (VPS/DigitalOcean/AWS)

### Build và chạy local:
```powershell
docker build -t carepharma .
docker run -p 5000:5000 --env-file .env carepharma
```

### Deploy lên VPS:
```bash
# SSH vào VPS
ssh user@your-server

# Clone repo
git clone https://github.com/YOUR_USERNAME/carepharma.git
cd carepharma

# Tạo .env file
nano .env
# (paste environment variables)

# Build và run
docker build -t carepharma .
docker run -d -p 5000:5000 --env-file .env --name carepharma-app carepharma

# Setup nginx reverse proxy
sudo nano /etc/nginx/sites-available/carepharma
```

Nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Files đã chuẩn bị:

✅ **railway.json** - Railway config  
✅ **Procfile** - Heroku/Railway process  
✅ **nixpacks.toml** - Railway build config  
✅ **Dockerfile** - Docker container  
✅ **.dockerignore** - Files bỏ qua khi build Docker  

---

## Checklist trước khi deploy:

- [x] Đã xóa Replit dependencies
- [x] Fixed scripts cho cross-platform
- [x] Đã có .env với DATABASE_URL và OPENROUTER_API_KEY
- [x] Đã test chạy local: `npm run dev`
- [ ] Test production build: `npm run build && npm run start`
- [ ] Push code lên GitHub
- [ ] Deploy lên Railway/Render
- [ ] Seed users: `/api/admin/seed-users`
- [ ] Test đăng nhập và các features

---

## Troubleshooting Deployment:

### Railway: "Build failed"
- Kiểm tra logs trong Railway dashboard
- Đảm bảo `package.json` có đầy đủ scripts
- Verify Node version (20.x)

### Render: "Service Unavailable"
- Kiểm tra Start Command: `npm run start`
- Verify PORT environment variable
- Check logs

### Database connection error:
- Verify DATABASE_URL format
- Check Neon database status
- Ensure SSL mode in connection string

### File uploads không hoạt động:
- Railway/Render không lưu files persistent
- Cần dùng Cloudinary hoặc AWS S3
- Hoặc mount volume trên Docker/VPS
