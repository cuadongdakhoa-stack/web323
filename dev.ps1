# PowerShell script để chạy dev server
Write-Host "🚀 Starting Care Pharma Development Server..." -ForegroundColor Cyan

# Kiểm tra .env file
if (-Not (Test-Path ".env")) {
    Write-Host "❌ Không tìm thấy file .env" -ForegroundColor Red
    Write-Host "📝 Đang tạo file .env từ .env.example..." -ForegroundColor Yellow
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Đã tạo file .env" -ForegroundColor Green
        Write-Host "⚠️  Vui lòng cập nhật DATABASE_URL và OPENROUTER_API_KEY trong file .env" -ForegroundColor Yellow
        Write-Host ""
        pause
    } else {
        Write-Host "❌ Không tìm thấy .env.example" -ForegroundColor Red
        exit 1
    }
}

# Kiểm tra node_modules
if (-Not (Test-Path "node_modules")) {
    Write-Host "📦 Đang cài đặt dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Cài đặt thất bại" -ForegroundColor Red
        exit 1
    }
}

# Set environment và chạy
$env:NODE_ENV = "development"
Write-Host "✅ Environment: development" -ForegroundColor Green
Write-Host "🌐 Server sẽ chạy tại: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""

npx tsx server/index.ts
