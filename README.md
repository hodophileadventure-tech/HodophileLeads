# TRIPNEXUS - Travel Agency Lead Management System

A comprehensive full-stack application for managing travel agency leads from inquiry to booking with automation, real-time notifications, and comprehensive analytics.

## 🎯 Features

### Core Modules
- **Smart Lead Capture**: Auto-categorization based on travel profile
- **Temperature Scoring**: Hot/Warm/Cold/Dead lead classification
- **Follow-Up Scheduler**: Manual reminders + auto-generation
- **Triple-Lock Availability**: Hotel, transport, guide confirmation
- **Itinerary Builder**: PDF generation with sharing capabilities
- **Payment Safe-Gate**: Controlled payment recording
- **Task Automation**: Pre-trip, mid-trip, post-trip workflows
- **Admin Dashboard**: Kanban pipeline + red flag center
- **Client 360°**: Complete travel history and preferences
- **Booking Health Score**: Real-time pipeline health monitoring

### Technical Highlights
- **Frontend**: React.js + TypeScript + Tailwind CSS + Dark Mode
- **Backend**: Node.js + Express.js + PostgreSQL
- **Auth**: JWT + Role-Based Access Control
- **Notifications**: WebSocket + Node Cron
- **PDF**: pdf-lib / jsPDF
- **Real-time**: WebSocket support
- **Mobile**: Fully responsive design

## 📋 Project Structure

```
tripnexus/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── .env.example
├── database/
│   ├── schema.sql
│   ├── seed-data.sql
│   └── scripts/
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 12
- npm or yarn

### Installation

**Windows:**
```bash
setup.bat
```

**macOS/Linux:**
```bash
bash setup.sh
```

**Manual Setup:**

1. **Install dependencies**
```bash
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

2. **Setup environment variables**
```bash
# Frontend
cd frontend
cp .env.example .env.local

# Backend
cd ../backend
cp .env.example .env
# Edit .env with your PostgreSQL details
```

3. **Initialize database**
```bash
# Ensure PostgreSQL is running and database created
npm run db:migrate
npm run db:seed
```

### Development

**Prerequisites:**
- Node.js >= 18
- PostgreSQL >= 12 (running locally or remote)
- npm or yarn

**Start development servers:**

*Terminal 1 - Frontend:*
```bash
cd frontend
npm run dev
```

*Terminal 2 - Backend:*
```bash
cd backend
npm run dev
```

**Access Points:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **API Documentation**: http://localhost:5001/api/docs
- **Health Check**: http://localhost:5001/health

**Demo Login Credentials:**
- Admin: `admin@hodophile.com` / `admin@123`

### Build for Production

```bash
npm run build
```

## 🔑 Key API Endpoints

### Leads
- `GET /api/leads` - List all leads
- `POST /api/leads` - Create new lead
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead
- `PATCH /api/leads/:id/status` - Update lead status

### Follow-ups
- `GET /api/follow-ups` - List follow-ups
- `POST /api/follow-ups` - Create follow-up
- `PATCH /api/follow-ups/:id/complete` - Mark complete

### Itineraries
- `GET /api/itineraries/:leadId` - Get itinerary
- `POST /api/itineraries` - Create itinerary
- `POST /api/itineraries/:id/generate-pdf` - Generate PDF

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment
- `PATCH /api/payments/:id/confirm` - Confirm payment

### Dashboard
- `GET /api/dashboard/pipeline` - Pipeline stats
- `GET /api/dashboard/analytics` - Team analytics
- `GET /api/dashboard/health` - Booking health

## 🔐 Authentication

JWT-based authentication with role-based access:
- **Admin**: Full system access, configuration
- **Agent**: Lead management, booking workflow

Live agent screenshots are available only with agent consent: the agent must enable screen capture in the Agent Panel, then an admin can request a one-time screenshot from the Admin Analytics modal.

Default credentials (for testing):
- Admin: `admin@hodophile.com` / `admin@123`

## 📊 Database Schema

Key entities:
- **users**: Admin/Agent accounts
- **leads**: Lead information with temperature
- **follow_ups**: Scheduled follow-ups and tasks
- **itineraries**: Generated trip plans
- **payments**: Payment records
- **availability**: Triple-lock confirmations
- **clients**: Client 360° profiles
- **bookings**: Final booking records

## 🧪 Testing

```bash
npm run test
```

Includes unit tests for:
- Lead temperature calculation
- Payment validation
- Task automation
- Dashboard analytics

## 📱 Mobile Optimization

- Large touch targets (min 44x44px)
- Swipe actions for common tasks
- One-tap WhatsApp sharing
- Dark mode support
- Responsive grid layouts

## 🔄 Real-time Features

- WebSocket notifications for task updates
- Live dashboard updates
- Real-time lead status changes
- Agent presence tracking

## 📝 Audit & Compliance

- Full audit logs for all changes
- Change tracking by user and timestamp
- Data export (CSV/Excel)
- GDPR-compliant data handling

## 🚢 Deployment

### Frontend (Vercel/Netlify)
```bash
cd frontend
npm run build
```

### Backend (Heroku/AWS)
```bash
cd backend
npm run build
npm start
```

### Docker / Compose
```bash
docker compose up --build
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for environment variables and release checklist.

## 📚 Documentation

- [Frontend Documentation](./frontend/README.md)
- [Backend Documentation](./backend/README.md)
- [Database Documentation](./database/README.md)
- [API Reference](./backend/API.md)

## 🤝 Contributing

1. Create a feature branch
2. Implement changes with tests
3. Submit pull request with description

## 📄 License

MIT License - see LICENSE file

## 📞 Support

For issues and questions:
- GitHub Issues
- Email: support@tripnexus.local

---

**Last Updated**: May 2026
**Version**: 1.0.0
