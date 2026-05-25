@echo off
REM TRIPNEXUS Setup Script for Windows

echo 🚀 TRIPNEXUS Setup Starting...

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    exit /b 1
)

echo ✓ Node.js version:
node -v

REM Install root dependencies
echo.
echo 📦 Installing root dependencies...
call npm install
if %errorlevel% neq 0 goto error

REM Install frontend dependencies
echo.
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 goto error
cd ..

REM Install backend dependencies
echo.
echo 📦 Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 goto error
cd ..

REM Create .env files
echo.
echo ⚙️  Creating environment files...
if not exist "backend\.env" (
    copy backend\.env.example backend\.env
    echo ✓ Created backend\.env
)
if not exist "frontend\.env.local" (
    copy frontend\.env.example frontend\.env.local
    echo ✓ Created frontend\.env.local
)

echo.
echo ✅ Setup Complete!
echo.
echo 📝 Next Steps:
echo 1. Configure PostgreSQL connection in backend\.env
echo 2. Set up database: npm run db:setup ^&^& npm run db:migrate
echo 3. Start development: npm run dev
echo.
echo 🎉 TRIPNEXUS is ready to go!
goto end

:error
echo ❌ Setup failed with error code %errorlevel%
exit /b %errorlevel%

:end
