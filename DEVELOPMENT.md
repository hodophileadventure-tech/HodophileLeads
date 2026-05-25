# TRIPNEXUS Development Guide

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **State Management**: Zustand for UI & data stores
- **HTTP Client**: Axios with JWT interceptors
- **Build Tool**: Vite for fast development & production builds

### Backend (Node.js + Express)
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js
- **Database**: PostgreSQL with native connection pooling
- **Auth**: JWT tokens with role-based access control
- **Security**: Helmet, CORS, bcryptjs for password hashing

### Database (PostgreSQL)
- Relational schema with 8 core tables
- UUID primary keys for scalability
- JSON columns for flexible data (travel dates, trip plans)
- Indexes for query optimization
- Audit logging table for compliance

## Project Structure

```
tripnexus/
├── frontend/                 # React.js frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── context/         # Auth & state management
│   │   ├── hooks/           # Custom hooks
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Helpers & API client
│   │   ├── main.tsx         # App entry
│   │   └── index.css        # Global & Tailwind styles
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                 # Node.js Express API
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Request handlers
│   │   ├── models/          # Data models
│   │   ├── middleware/      # Express middleware
│   │   ├── services/        # Business logic
│   │   ├── types/           # TypeScript interfaces
│   │   ├── utils/           # Helpers & DB
│   │   └── index.ts         # App entry
│   ├── tests/               # Unit tests
│   ├── tsconfig.json
│   └── package.json
│
├── database/                # PostgreSQL schema
│   ├── schema.sql           # Table definitions
│   ├── seed-data.sql        # Sample data
│   ├── scripts/
│   │   ├── migrate.js       # Schema migration
│   │   └── seed.js          # Data seeding
│   └── README.md
│
├── .github/
│   └── copilot-instructions.md
├── README.md
├── setup.sh / setup.bat
└── package.json (workspace root)
```

## Development Workflow

### 1. Setup New Development Environment

```bash
# Clone/open project
cd "c:\Users\HP\Hodophile Leads"

# Run setup script
setup.bat          # Windows
bash setup.sh      # macOS/Linux

# Configure .env files
# backend/.env - PostgreSQL connection
# frontend/.env.local - API base URL

# Initialize database
npm run db:migrate
npm run db:seed
```

### 2. Running Development Servers

**Terminal 1 - Frontend:**
```bash
cd frontend
npm run dev
```
Runs on `http://localhost:3000` with hot reload.

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```
Runs on `http://localhost:5000` with TypeScript transpilation.

### 3. Making Changes

#### Adding a Frontend Feature

1. **Create component** in `frontend/src/components/`
2. **Add types** in `frontend/src/types/` if needed
3. **Use API service** from `frontend/src/utils/api-service.ts`
4. **Integrate state** using Zustand stores
5. **Test** in browser with hot reload

Example: Adding a new "Itinerary" component
```bash
# Create component
touch frontend/src/components/ItineraryBuilder.tsx

# Add types (if new data structure)
# Edit frontend/src/types/index.ts

# Use in a page
# Edit frontend/src/pages/App.tsx to import and render
```

#### Adding a Backend API Endpoint

1. **Create/update controller** in `backend/src/controllers/`
2. **Create/update model** in `backend/src/models/` for DB queries
3. **Create/update route** in `backend/src/routes/`
4. **Import route** in `backend/src/index.ts`
5. **Test** with API documentation or Postman

Example: Adding lead filtering
```typescript
// backend/src/controllers/leads-controller.ts
async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { temperature, status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM leads WHERE agent_id = $1';
    let params = [req.user.id];
    
    if (temperature) {
      params.push(temperature as string);
      query += ` AND temperature = $${params.length}`;
    }
    // ... more filters
    
    const result = await database.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}
```

### 4. Database Changes

#### Adding a new column
```sql
ALTER TABLE leads ADD COLUMN custom_field VARCHAR(255) DEFAULT NULL;
```

#### Creating a migration
1. Create new SQL file in `database/migrations/`
2. Add to `database/migrate.js` execution order
3. Run: `npm run db:migrate`

#### Adding seed data
1. Add SQL to `database/seed-data.sql`
2. Run: `npm run db:seed`

### 5. Testing

#### Frontend Testing
```bash
cd frontend
npm run test
```

#### Backend Testing
```bash
cd backend
npm run test
```

#### Manual Testing
- Use API documentation at `/api/docs`
- Use browser DevTools for frontend debugging
- Use VS Code debugger with launch configuration

## Key Technologies & Patterns

### Frontend Patterns

**State Management (Zustand)**
```typescript
// Create store
const useStore = create((set) => ({
  items: [],
  addItem: (item) => set(state => ({ items: [...state.items, item] }))
}));

// Use in component
const { items, addItem } = useStore();
```

**API Integration**
```typescript
// Use pre-built API service
const response = await leadsAPI.create(leadData);
```

**Context API (Auth)**
```typescript
// Global auth context
const { user, login, logout } = useAuth();
```

### Backend Patterns

**Middleware Chain**
```typescript
router.use(authMiddleware);  // Check JWT
router.use(roleMiddleware(['admin']));  // Check role
router.post('/create', controller.create);  // Handler
```

**Database Queries**
```typescript
// Use parameterized queries to prevent SQL injection
const result = await query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

**Error Handling**
```typescript
try {
  // ... operation
} catch (error) {
  next(error);  // Express error handler
}
```

## Environment Variables

### Frontend (.env.local)
```
VITE_API_BASE_URL=http://localhost:5000/api
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/tripnexus
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=7d
PORT=5000
NODE_ENV=development
```

## Debugging

### Frontend
1. Open DevTools (F12)
2. Check Console for errors
3. Check Network tab for API calls
4. Use React DevTools extension
5. Check Local Storage for tokens

### Backend
1. Check terminal output for errors
2. Add `console.log()` statements
3. Use VS Code debugger (add breakpoints, F5)
4. Check PostgreSQL logs
5. Use `npm run dev` for TypeScript errors

## Performance Tips

- Use React.memo for expensive components
- Lazy load routes with React.lazy()
- Optimize images and assets
- Use database indexes for frequent queries
- Enable gzip compression in production
- Cache API responses client-side

## Security Considerations

- ✅ JWT token expiration (7 days by default)
- ✅ Password hashing with bcryptjs
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configuration
- ✅ Helmet security headers
- ⚠️ TODO: Rate limiting in production
- ⚠️ TODO: API request validation (Joi)
- ⚠️ TODO: HTTPS in production

## Deployment Checklist

- [ ] Update environment variables for production
- [ ] Set strong JWT_SECRET
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain
- [ ] Set up database backups
- [ ] Enable API rate limiting
- [ ] Configure CDN for static assets
- [ ] Set up monitoring & logging
- [ ] Add error tracking (Sentry)
- [ ] Load test the API
- [ ] Security audit

## Useful Commands

```bash
# Root level
npm run dev             # Start both frontend & backend
npm run build          # Build both
npm run test           # Test both
npm run db:migrate     # Run migrations
npm run db:seed        # Seed database

# Frontend only
cd frontend
npm run dev            # Start dev server
npm run build          # Build for production
npm run lint           # Run ESLint

# Backend only
cd backend
npm run dev            # Start with ts-node
npm run build          # Compile TypeScript
npm run start          # Run compiled code
npm run test           # Run tests
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes & commit
git add .
git commit -m "feat: description of change"

# Push & create PR
git push origin feature/your-feature-name
```

## Support & Resources

- **API Docs**: http://localhost:5000/api/docs
- **Frontend Components**: See `frontend/src/components/`
- **Database Schema**: See `database/schema.sql`
- **Type Definitions**: See `frontend/src/types/` and `backend/src/types/`

---

**Last Updated**: May 2026
**Maintained by**: TRIPNEXUS Development Team
