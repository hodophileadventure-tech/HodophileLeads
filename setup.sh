#!/bin/bash

# TRIPNEXUS Setup Script
echo "🚀 TRIPNEXUS Setup Starting..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✓ Node.js version: $(node -v)"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Create .env files
echo "⚙️  Creating environment files..."
[ ! -f backend/.env ] && cp backend/.env.example backend/.env && echo "✓ Created backend/.env"
[ ! -f frontend/.env.local ] && cp frontend/.env.example frontend/.env.local && echo "✓ Created frontend/.env.local"

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Configure PostgreSQL connection in backend/.env"
echo "2. Set up database: npm run db:setup && npm run db:migrate"
echo "3. Start development: npm run dev"
echo ""
echo "🎉 TRIPNEXUS is ready to go!"
