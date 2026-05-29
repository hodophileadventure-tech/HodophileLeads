# TRIPNEXUS API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints (except `/auth/login` and `/auth/register`) require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### Login
**POST** `/auth/login`

Request:
```json
{
  "email": "admin@hodophile.com",
  "password": "admin@123"
}
```

Response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@hodophile.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

### Register
**POST** `/auth/register`

Request:
```json
{
  "email": "agent@example.com",
  "name": "New Agent",
  "password": "SecurePass123",
  "role": "agent"
}
```

---

## Lead Endpoints

### List Leads
**GET** `/leads?limit=50&offset=0&agentId=uuid`

Response:
```json
[
  {
    "id": "uuid",
    "clientName": "Ahmed Khan",
    "email": "ahmed@email.com",
    "phone": "+92-300-1234567",
    "destination": "Dubai, UAE",
    "travelDates": {"from": "2024-06-15", "to": "2024-06-22"},
    "persons": 4,
    "budget": 2500.00,
    "source": "referral",
    "temperature": "hot",
    "status": "negotiation",
    "agentId": "uuid",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Get Lead by ID
**GET** `/leads/:id`

### Create Lead
**POST** `/leads`

Request:
```json
{
  "clientName": "New Client",
  "email": "client@email.com",
  "phone": "+92-300-0000000",
  "destination": "Maldives",
  "travelDates": {"from": "2024-12-01", "to": "2024-12-10"},
  "persons": 2,
  "budget": 4000.00,
  "source": "organic",
  "specialRequests": "Romantic package"
}
```

### Update Lead
**PUT** `/leads/:id`

Request: (same as create, partial fields accepted)

### Update Lead Status
**PATCH** `/leads/:id/status`

Request:
```json
{
  "status": "booked"
}
```

Valid statuses: `new`, `contacted`, `interested`, `negotiation`, `booked`, `completed`

### Delete Lead
**DELETE** `/leads/:id`

---

## Dashboard Endpoints

### Get Dashboard Statistics
**GET** `/dashboard/stats`

Response:
```json
{
  "totalLeads": 25,
  "hotLeads": 5,
  "bookingsThisMonth": 3,
  "totalRevenue": 12500.00,
  "pipelineHealth": "green"
}
```

### Get Pipeline Overview
**GET** `/dashboard/pipeline`

Response:
```json
[
  {
    "status": "new",
    "count": "5",
    "temperature": "cold"
  },
  {
    "status": "negotiation",
    "count": "3",
    "temperature": "hot"
  }
]
```

### Get Team Analytics (Admin Only)
**GET** `/dashboard/analytics`

Response:
```json
{
  "hot_leads": "8",
  "warm_leads": "12",
  "cold_leads": "15",
  "dead_leads": "5",
  "avg_budget": "2850.50",
  "total_agents": "3"
}
```

### Get Booking Health Score
**GET** `/dashboard/health`

Response:
```json
{
  "score": "72.5",
  "health": "green",
  "completedBookings": 18,
  "inNegotiation": 5,
  "newLeads": 2
}
```

---

## Response Codes

- **200** - Success
- **201** - Created
- **204** - No Content
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **500** - Server Error

---

## Error Response

```json
{
  "message": "Error description",
  "stack": "..." (only in development)
}
```

---

## Demo Credentials

**Admin Account:**
- Email: `admin@hodophile.com`
- Password: `admin@123`

---

## Rate Limiting
Currently no rate limiting. Recommended for production deployment.

## CORS
Enabled for all origins. Configure in production.
