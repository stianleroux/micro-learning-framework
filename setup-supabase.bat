@echo off
REM =====================================================
REM Supabase Local Setup Script for Windows
REM =====================================================

echo ========================================
echo   Micro Learning Framework Setup
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    echo Download from: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [INFO] Prerequisites check passed!
echo.

REM Install Supabase CLI
echo [STEP 1] Installing Supabase CLI...
npm install -g supabase
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Supabase CLI
    pause
    exit /b 1
)

echo [SUCCESS] Supabase CLI installed!
echo.

REM Initialize Supabase project (if not already done)
echo [STEP 2] Initializing Supabase project...
if not exist "supabase" (
    supabase init
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to initialize Supabase project
        pause
        exit /b 1
    )
    echo [SUCCESS] Supabase project initialized!
) else (
    echo [INFO] Supabase project already initialized.
)
echo.

REM Start Supabase local development
echo [STEP 3] Starting Supabase local development...
echo [INFO] This will start PostgreSQL, GoTrue, Realtime, and other services...
echo [INFO] Press Ctrl+C to stop services when done.
echo.

start /b supabase start
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Supabase services
    pause
    exit /b 1
)

REM Wait for services to start
echo [INFO] Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo [STEP 4] Running database migrations...
if exist "migrations\*.sql" (
    for %%f in (migrations\*.sql) do (
        echo [INFO] Running migration: %%f
        supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres
    )
    echo [SUCCESS] Migrations completed!
) else (
    echo [INFO] No migrations found. Creating initial schema...
    if exist "supabase-schema.sql" (
        supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres
        echo [SUCCESS] Initial schema created!
    )
)
echo.

REM Display connection info
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Local Supabase is now running:
echo   - API URL: http://localhost:54321
echo   - Database URL: postgresql://postgres:postgres@localhost:54322/postgres
echo   - Studio URL: http://localhost:54323
echo   - Inbucket URL: http://localhost:54324
echo.
echo Environment Configuration:
echo   1. Update your .env.local file in micro-learning-app/
echo   2. Set SUPABASE_URL=http://localhost:54321
echo   3. Set SUPABASE_ANON_KEY=(check supabase status for key)
echo.
echo Next Steps:
echo   1. Navigate to micro-learning-app/ directory
echo   2. Run: npm install
echo   3. Run: npm start
echo.
echo To stop Supabase: supabase stop
echo To view status: supabase status
echo.
pause