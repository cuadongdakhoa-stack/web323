# Script setup PostgreSQL local cho Windows
Write-Host "🗄️  PostgreSQL Database Setup" -ForegroundColor Cyan
Write-Host ""

Write-Host "Bạn muốn setup như thế nào?" -ForegroundColor Yellow
Write-Host "1. Dùng PostgreSQL đã cài sẵn trên máy"
Write-Host "2. Hướng dẫn cài PostgreSQL mới"
Write-Host "3. Dùng Neon Cloud (không cần cài gì)"
Write-Host ""

$choice = Read-Host "Chọn (1/2/3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "📝 Tạo database 'carepharma'..." -ForegroundColor Cyan
        Write-Host ""
        
        $pgUser = Read-Host "PostgreSQL username (mặc định: postgres)"
        if ([string]::IsNullOrWhiteSpace($pgUser)) { $pgUser = "postgres" }
        
        $pgPass = Read-Host "PostgreSQL password" -AsSecureString
        $pgPassText = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPass)
        )
        
        # Tạo database
        $env:PGPASSWORD = $pgPassText
        Write-Host "Đang tạo database..." -ForegroundColor Yellow
        
        $createDb = "CREATE DATABASE carepharma;"
        $checkDb = "SELECT 1 FROM pg_database WHERE datname='carepharma';"
        
        $result = psql -U $pgUser -h localhost -c $checkDb postgres 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $result -match "1 row") {
            Write-Host "✅ Database 'carepharma' đã tồn tại" -ForegroundColor Green
        } else {
            psql -U $pgUser -h localhost -c $createDb postgres
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Đã tạo database 'carepharma'" -ForegroundColor Green
            } else {
                Write-Host "❌ Không thể tạo database. Kiểm tra PostgreSQL service." -ForegroundColor Red
                exit 1
            }
        }
        
        # Cập nhật .env
        $dbUrl = "postgresql://${pgUser}:${pgPassText}@localhost:5432/carepharma"
        
        if (Test-Path ".env") {
            $envContent = Get-Content ".env" -Raw
            $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$dbUrl"
            $envContent | Set-Content ".env" -NoNewline
        }
        
        Write-Host "✅ Đã cập nhật DATABASE_URL trong .env" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Chạy migrations:" -ForegroundColor Cyan
        Write-Host "   npm run db:push" -ForegroundColor White
    }
    
    "2" {
        Write-Host ""
        Write-Host "📥 Hướng dẫn cài PostgreSQL:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Download PostgreSQL từ: https://www.postgresql.org/download/windows/" -ForegroundColor White
        Write-Host "2. Chạy installer, chọn port 5432 (mặc định)" -ForegroundColor White
        Write-Host "3. Đặt password cho user 'postgres'" -ForegroundColor White
        Write-Host "4. Sau khi cài xong, chạy lại script này và chọn option 1" -ForegroundColor White
        Write-Host ""
    }
    
    "3" {
        Write-Host ""
        Write-Host "☁️  Neon Cloud Setup:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Truy cập: https://neon.tech" -ForegroundColor White
        Write-Host "2. Đăng ký tài khoản miễn phí" -ForegroundColor White
        Write-Host "3. Tạo project mới" -ForegroundColor White
        Write-Host "4. Copy 'Connection string' (dạng postgresql://...neon.tech/...)" -ForegroundColor White
        Write-Host "5. Paste vào file .env, dòng DATABASE_URL=" -ForegroundColor White
        Write-Host ""
        Write-Host "✅ Neon tự động tạo database, không cần chạy migrations thủ công" -ForegroundColor Green
    }
    
    default {
        Write-Host "❌ Lựa chọn không hợp lệ" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Setup hoàn tất!" -ForegroundColor Green
