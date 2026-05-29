# TRIPNEXUS Quick Start Guide

## 5-Minute Setup

### Step 1: Install Dependencies (Windows)
```bash
cd "c:\Users\HP\Hodophile Leads"
setup.bat
```

### Step 2: Configure Database
Edit `backend\.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/tripnexus
JWT_SECRET=your-secret-key-change-later
PORT=5000
```

### Step 3: Setup Database
```bash
# Create database in PostgreSQL first
# Then run migrations
npm run db:migrate
npm run db:seed
```

### Step 4: Start Development

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

### Step 5: Access the App

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Docs**: http://localhost:5000/api/docs

### Step 6: Login

Use demo credentials:
- **Email**: `admin@hodophile.com`
- **Password**: `admin@123`

---

## Troubleshooting

### PostgreSQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: 
1. Install PostgreSQL if not installed
2. Ensure PostgreSQL service is running
3. Verify connection string in `.env`
4. Create database: `CREATE DATABASE tripnexus;`

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution**:
1. Check what's using port 5000: `netstat -ano | findstr :5000`
2. Kill process: `taskkill /PID <PID> /F`
3. Or change PORT in `.env`

### Node Modules Issues
```bash
# Clear and reinstall
rm -rf node_modules frontend/node_modules backend/node_modules
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### TypeScript Errors in Backend
```bash
cd backend
npm run build  # Check for errors
```

---

## Project Structure Overview

```
tripnexus/
├── frontend/           React.js (http://localhost:3000)
├── backend/            Express.js (http://localhost:5000)
├── database/           PostgreSQL schema & seed data
├── README.md           Main documentation
├── DEVELOPMENT.md      Development guide
├── PROJECT_STATUS.md   Detailed status
└── setup.bat           One-click Windows setup
```

---

## Key Features

✅ **Lead Management** - Create, update, view leads with temperature scoring
✅ **Dashboard** - Real-time statistics and pipeline health
✅ **Authentication** - JWT-based auth with role-based access
✅ **Responsive UI** - Dark mode + mobile-friendly design
✅ **Database** - PostgreSQL with 8 tables for complete workflow

---

## What's Included

### Frontend Features
- Login & authentication
- Lead management dashboard
- Lead cards with details
- Lead form for creation
- Dashboard with statistics
- Dark mode toggle
- Responsive layout

### Backend Features
- Lead CRUD API
- User authentication
- Dashboard statistics
- Role-based access control
- Error handling
- JWT token management

### Database Features
- User management
- Lead information
- Follow-up tasks
- Itineraries
- Payments
- Client profiles
- Audit logs

---

## Common Tasks

### Add a New Lead
1. Click "New Lead" button
2. Fill in client details
3. Set travel dates & budget
4. Submit form
5. Lead appears in dashboard

### Change Lead Status
1. Click on a lead
2. Update status dropdown
3. Changes reflect immediately

### View Dashboard Stats
1. Go to Dashboard page
2. See total leads, hot leads, bookings
3. View pipeline health score

### Export Sample Data
Database comes pre-populated with 5 sample leads for testing.

---

## Next Steps

1. **Explore the UI** - Log in and navigate around
2. **Create Test Leads** - Use the form to add new leads
3. **Check API** - Visit http://localhost:5000/api/docs
4. **Review Code** - Check `frontend/src/` and `backend/src/`
5. **Read DEVELOPMENT.md** - For detailed dev guide

---

## Development Tips

### Auto-reload
Both frontend and backend support hot reload during development.

### API Testing
Use `http://localhost:5000/api/docs` for API documentation and testing.

### Database Queries
Connect with PostgreSQL client:
```
Host: localhost
Port: 5432
Database: tripnexus
User: postgres
Password: (your password)
```

### Debugging Frontend
- Open browser DevTools (F12)
- Check Console for errors
- Use React DevTools extension

### Debugging Backend
- Check terminal output for errors
- Add `console.log()` statements
- Use VS Code debugger

---

## Production Deployment

When ready to deploy:

1. **Build frontend**
   ```bash
   cd frontend
   npm run build  # Creates dist/ folder
   ```

2. **Build backend**
   ```bash
   cd backend
   npm run build  # Creates dist/ folder
   ```

3. **Deploy to hosting**
   - Frontend → Vercel, Netlify, AWS S3 + CloudFront
   - Backend → Heroku, AWS EC2, DigitalOcean

---

## Support

- **API Docs**: http://localhost:5000/api/docs
- **Frontend Docs**: [README.md](frontend/README.md)
- **Backend Docs**: [README.md](backend/README.md)
- **Dev Guide**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **Project Status**: [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

**Happy Development! 🚀**

Questions? Check the [DEVELOPMENT.md](DEVELOPMENT.md) for detailed information.
