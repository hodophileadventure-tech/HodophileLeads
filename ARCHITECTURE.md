# TRIPNEXUS Architecture Documentation

## System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│  Browser (React.js + TypeScript + Tailwind CSS + Vite)      │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / REST API
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
│ Express.js Server with TypeScript                           │
│ ├─ Authentication (JWT)                                     │
│ ├─ Lead Management                                          │
│ ├─ Dashboard & Analytics                                    │
│ └─ Error Handling & Middleware                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ SQL
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│ PostgreSQL Database                                         │
│ ├─ Users & Authentication                                   │
│ ├─ Leads & Client Information                              │
│ ├─ Tasks & Follow-ups                                      │
│ ├─ Itineraries & Payments                                  │
│ └─ Audit Logs                                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────────┐
│           App (main.tsx)                    │
├─────────────────────────────────────────────┤
│ AuthProvider (Context)                      │
│  ├─ Login/Auth State                        │
│  └─ JWT Token Management                    │
├─────────────────────────────────────────────┤
│ Zustand Stores                              │
│  ├─ UI Store (sidebar, darkMode)            │
│  └─ Data Store (leads, followups)           │
├─────────────────────────────────────────────┤
│ Pages                                       │
│  ├─ LoginPage                               │
│  └─ App (Dashboard, Leads, Tasks)           │
├─────────────────────────────────────────────┤
│ Components (Reusable)                       │
│  ├─ Navbar                                  │
│  ├─ Sidebar                                 │
│  ├─ Dashboard                               │
│  ├─ LeadCard, LeadForm, LeadList            │
│  └─ Common (Button, Modal, Card, etc.)      │
├─────────────────────────────────────────────┤
│ Services                                    │
│  ├─ api-service.ts (API calls)              │
│  └─ api.ts (Axios setup with JWT)           │
├─────────────────────────────────────────────┤
│ Utils                                       │
│  ├─ helpers.ts (Formatting, colors)         │
│  └─ API client with interceptors            │
└─────────────────────────────────────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────┐
│         Express Server (index.ts)           │
├─────────────────────────────────────────────┤
│ Middleware Stack                            │
│  ├─ helmet (Security)                       │
│  ├─ cors (Cross-Origin)                     │
│  ├─ express.json (Body Parser)              │
│  └─ Error Handler                           │
├─────────────────────────────────────────────┤
│ Routes                                      │
│  ├─ /api/auth (Login, Register)             │
│  ├─ /api/leads (Lead CRUD)                  │
│  └─ /api/dashboard (Stats)                  │
├─────────────────────────────────────────────┤
│ Controllers                                 │
│  ├─ authController                          │
│  ├─ leadsController                         │
│  └─ dashboardController                     │
├─────────────────────────────────────────────┤
│ Models (DB Layer)                           │
│  ├─ leadsModel (Query builders)             │
│  └─ userModel (Auth queries)                │
├─────────────────────────────────────────────┤
│ Services (Business Logic)                   │
│  ├─ leadService (Temperature calc)          │
│  └─ pdfService (PDF generation)             │
├─────────────────────────────────────────────┤
│ Utils                                       │
│  ├─ database.ts (Connection pool)           │
│  ├─ auth.ts (JWT & Password hash)           │
│  └─ middleware.ts (Auth checks)             │
└─────────────────────────────────────────────┘
```

### Database Schema Architecture

```
USERS
├─ id (PK)
├─ email (Unique)
├─ name
├─ password
├─ role (admin/agent)
└─ created_at

LEADS
├─ id (PK)
├─ client_name
├─ email
├─ phone
├─ destination
├─ travel_dates (JSONB)
├─ persons
├─ budget
├─ source
├─ temperature (hot/warm/cold/dead)
├─ status (new/contacted/interested/negotiation/booked/completed)
├─ agent_id (FK → USERS)
└─ special_requests

FOLLOW_UPS
├─ id (PK)
├─ lead_id (FK → LEADS)
├─ type (manual/auto)
├─ title
├─ due_date
├─ status
├─ priority
├─ assigned_to (FK → USERS)
└─ completed_at

ITINERARIES
├─ id (PK)
├─ lead_id (FK → LEADS)
├─ trip_plan (JSONB)
├─ hotel_info (JSONB)
├─ transport_info (JSONB)
├─ total_cost
└─ status

PAYMENTS
├─ id (PK)
├─ lead_id (FK → LEADS)
├─ amount
├─ status (pending/approved/confirmed)
├─ method (cash/card/bank_transfer)
├─ due_date
└─ paid_date

AVAILABILITY (Triple-Lock)
├─ id (PK)
├─ lead_id (FK → LEADS)
├─ hotel_confirmed
├─ transport_confirmed
├─ guide_confirmed
└─ all_confirmed (GENERATED)

CLIENT_PROFILES
├─ id (PK)
├─ user_email (FK)
├─ loyalty_tier (bronze/silver/gold/platinum)
├─ total_trips
└─ preferred_destinations

AUDIT_LOGS
├─ id (PK)
├─ entity_type
├─ entity_id
├─ action (create/update/delete)
├─ changes (JSONB)
├─ user_id (FK → USERS)
└─ created_at
```

## Data Flow

### Lead Creation Flow

```
User Input (Frontend)
    ↓
LeadForm Component validates
    ↓
POST /api/leads (with JWT)
    ↓
authMiddleware checks JWT
    ↓
leadsController.create()
    ↓
leadService.calculateLeadTemperature()
    ↓
leadsModel.create() (SQL INSERT)
    ↓
PostgreSQL generates UUID, inserts record
    ↓
Response sent back to Frontend
    ↓
UI updates with new lead
```

### Authentication Flow

```
User enters email/password
    ↓
POST /api/auth/login
    ↓
Find user in database
    ↓
Compare password hash with bcryptjs
    ↓
Generate JWT token
    ↓
Return token + user info to frontend
    ↓
Frontend stores token in localStorage
    ↓
Subsequent requests include "Authorization: Bearer <token>"
    ↓
authMiddleware verifies JWT on each request
```

### Dashboard Stats Flow

```
User requests dashboard
    ↓
GET /api/dashboard/stats
    ↓
authMiddleware verifies JWT
    ↓
dashboardController.getStats()
    ↓
SQL aggregation query
    ↓
COUNT leads by temperature
    ↓
SUM budget for booked leads
    ↓
Calculate health score
    ↓
Return stats to frontend
    ↓
Frontend renders charts/cards
```

## Technology Integration Points

### Frontend-Backend Integration
- **Communication**: REST API via HTTP/HTTPS
- **Format**: JSON
- **Auth**: JWT tokens in Authorization header
- **Error Handling**: JSON error responses with status codes

### Backend-Database Integration
- **Driver**: pg (PostgreSQL Node.js driver)
- **Connection**: Pooling for performance
- **Queries**: Parameterized to prevent SQL injection
- **Transactions**: For complex multi-table operations

## Scalability Considerations

### Current Architecture
- Single Express server instance
- Single PostgreSQL connection pool
- In-memory state management (Zustand)

### For Scaling

**Horizontal Scaling (Multiple Servers)**
- Use load balancer (nginx, AWS ELB)
- Shared database (PostgreSQL)
- Session store (Redis) instead of in-memory
- Queue system for async jobs (Bull, RabbitMQ)

**Database Scaling**
- Read replicas for analytics queries
- Partitioning large tables (leads by date)
- Archive old leads to separate DB
- Caching layer (Redis)

**Frontend Scaling**
- CDN for static assets
- Code splitting with lazy loading
- Service worker for offline support
- Client-side caching strategies

## Security Layers

```
┌─────────────────────────────────────┐
│      API Requests from Browser      │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│         HTTPS Encryption            │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│    Helmet Security Headers          │
│    CORS Validation                  │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│      JWT Token Verification         │
│      Role-based Access Control      │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│    Parameterized SQL Queries        │
│    Input Validation                 │
└────────────┬────────────────────────┘
             ▼
┌─────────────────────────────────────┐
│   PostgreSQL Constraints            │
│   Data Encryption                   │
└─────────────────────────────────────┘
```

## API Contract

### Request/Response Format
```
Request:
- Headers: Content-Type: application/json, Authorization: Bearer <token>
- Body: JSON object
- Method: GET/POST/PUT/PATCH/DELETE

Response:
- Headers: Content-Type: application/json
- Status: 200/201/204/400/401/403/404/500
- Body: JSON object or array
- Error: { message: "Error description" }
```

### Error Handling
```
400 Bad Request - Invalid input
401 Unauthorized - Missing/invalid JWT
403 Forbidden - Insufficient permissions
404 Not Found - Resource doesn't exist
500 Server Error - Unexpected error
```

## Deployment Architecture

### Development
```
Local Machine
├─ Frontend (port 3000)
├─ Backend (port 5000)
└─ PostgreSQL (local)
```

### Production
```
CDN / Static Hosting
    ↓
Frontend (React SPA)
    ↓
Load Balancer
    ↓
API Servers (Express)
    ↓
Primary Database + Replicas (PostgreSQL)
```

---

**Architecture Version**: 1.0
**Last Updated**: May 2026
**Status**: Production-Ready Scaffold
