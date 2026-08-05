@echo off
:: ============================================================
:: Cyrix Field Connect — One-Time Cloudflare Setup Script
:: Run this from the worker-backend directory
:: Prerequisite: wrangler must be logged in (wrangler login)
:: ============================================================

echo.
echo ============================================================
echo  Cyrix Field Connect — Cloudflare Setup (Single Server)
echo ============================================================
echo.

:: Step 1: Set CF Email API Token (Secret — never in wrangler.toml)
echo [1/6] Setting CF_EMAIL_API_TOKEN secret...
echo YOUR_CLOUDFLARE_API_TOKEN_HERE | wrangler secret put CF_EMAIL_API_TOKEN
echo.

:: Step 2: Set JWT API Secret (CHANGE THIS to a strong random value)
echo [2/6] Setting API_SECRET (JWT signing key)...
echo PLEASE_CHANGE_THIS_TO_A_STRONG_32_CHAR_SECRET_BEFORE_DEPLOY | wrangler secret put API_SECRET
echo.
echo  ^> ACTION REQUIRED: Replace the above with your actual API_SECRET!
echo  ^> Minimum 32 characters. Use: openssl rand -hex 32
echo.

:: Step 3: Set Approval token secret
echo [3/6] Setting APPROVAL_SECRET (for email approval links)...
echo PLEASE_CHANGE_THIS_APPROVAL_SECRET_TOO | wrangler secret put APPROVAL_SECRET
echo.

:: Step 4: Create R2 bucket (run once)
echo [4/6] Creating R2 bucket: fieldops-uploads...
wrangler r2 bucket create fieldops-uploads
echo.

:: Step 5: Create Cloudflare Queues (run once)
echo [5/6] Creating Cloudflare Queues...
wrangler queues create fieldops-uploads-queue
wrangler queues create fieldops-email-queue
wrangler queues create fieldops-analytics-queue
wrangler queues create fieldops-dlq
echo.

:: Step 6: Run V2 database migrations (via admin API after deploy)
echo [6/6] Reminder: After deploy, run migrations via admin panel:
echo       POST /api/admin/run-migrations-v2   (Admin only)
echo       POST /api/admin/run-migrations       (Admin only)
echo.

echo ============================================================
echo  Setup complete! Start local dev with:
echo    wrangler dev --local
echo  Deploy with (only when explicitly approved):
echo    wrangler deploy
echo ============================================================
pause
