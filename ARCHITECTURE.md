# Architecture Documentation

## System Overview

This is a monorepo containing a modern full-stack application with:
- **Frontend**: React 19 + TypeScript + Tailwind CSS (Vite)
- **Backend**: Python FastAPI with SQLAlchemy ORM
- **Database**: PostgreSQL (or SQLite for development)
- **Deployment**: Docker, Cloudflare Pages (Frontend), Railway/Render (Backend)

## Directory Structure

### Frontend (`/frontend`)

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Shared components (Button, Card, Modal, etc.)
│   ├── auth/            # Authentication flows
│   ├── expense/         # Expense submission & tracking
│   ├── dashboard/       # Dashboard widgets
│   ├── approval/        # Approval workflows
│   ├── admin/           # Admin panel
│   └── profile/         # User profile
├── pages/               # Full-page components (routes)
├── hooks/               # Custom React hooks for logic
├── context/             # React Context for global state
├── services/            # API integration layer
├── utils/               # Helper functions
├── types/               # TypeScript definitions
├── styles/              # Global CSS & Tailwind config
└── assets/              # Images, icons, fonts
```

### Backend (`/backend`)

```
app/
├── api/
│   └── routes/          # API endpoints organized by feature
│       ├── auth.py      # /api/auth/*
│       ├── expense.py   # /api/expense/*
│       ├── dashboard.py # /api/dashboard/*
│       ├── approval.py  # /api/approval/*
│       ├── admin.py     # /api/admin/*
│       ├── upload.py    # /api/upload/*
│       ├── reports.py   # /api/reports/*
│       └── users.py     # /api/users/*
├── models/              # SQLAlchemy ORM models
├── schemas/             # Pydantic request/response validation
├── services/            # Business logic layer
├── utils/               # Helper functions
├── config/              # Configuration & database setup
├── middleware/          # Custom middleware
└── core/                # Core exceptions & security
```

## Component Communication Flow

### Frontend Architecture

```
User Input
    ↓
React Component
    ↓
Custom Hook (useAuth, useFetch, useForm, etc.)
    ↓
Service Layer (authService, expenseService, etc.)
    ↓
API Layer (axios instance with interceptors)
    ↓
Backend API
```

### Backend Architecture

```
HTTP Request
    ↓
Middleware (CORS, Auth, Error Handling)
    ↓
Router (API Routes)
    ↓
Service Layer (Business Logic)
    ↓
Models (Database Layer)
    ↓
Database (PostgreSQL/SQLite)
```

## Database Schema

### Users Table
```sql
users
├── id (PK)
├── email (UNIQUE)
├── username (UNIQUE)
├── full_name
├── hashed_password
├── role (employee, manager, admin, approver)
├── zone (Bikaner, Ajmer, Jodhpur, Udaipur)
├── is_active
└── timestamps
```

### Expenses Table
```sql
expenses
├── id (PK)
├── user_id (FK → users)
├── month
├── year
├── amount
├── status (draft, submitted, approved, rejected)
├── travel_mode (bike, car, public)
├── itinerary (JSON)
├── attachments (JSON array)
└── timestamps
```

### Approvals Table
```sql
approvals
├── id (PK)
├── expense_id (FK → expenses)
├── approver_id (FK → users)
├── status (pending, approved, rejected)
├── comments
└── timestamps
```

### Assets Table
```sql
assets
├── id (PK)
├── name
├── asset_type
├── zone
├── status
└── timestamps
```

## Authentication Flow

1. **Login Request**
   - User submits email & password
   - Backend validates credentials
   - JWT token generated
   - Token stored in localStorage

2. **Protected Requests**
   - Token included in Authorization header
   - Axios interceptor adds token automatically
   - Backend verifies token validity

3. **Token Refresh**
   - Access token expires after 30 minutes
   - Refresh token used to get new access token
   - Automatic refresh on 401 response

4. **Logout**
   - Token removed from localStorage
   - User redirected to login page

## State Management

### Frontend
- **React Context**: Global auth & notification state
- **Zustand** (optional): Complex state management
- **Local Storage**: Persistence for tokens & user data
- **Component State**: useState for local component state

### Backend
- **SQLAlchemy ORM**: Object-relational mapping
- **Pydantic**: Data validation & serialization
- **Sessions**: Database connection management

## API Response Format

### Success Response
```json
{
  "data": { /* response data */ },
  "status_code": 200,
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "status_code": 400,
  "message": "Validation error",
  "detail": "Invalid email format"
}
```

## Error Handling

### Frontend
- Try-catch blocks in services
- Toast notifications for errors
- Axios interceptor handles 401s
- Form validation before submission

### Backend
- Custom exception classes
- Global error handler middleware
- Pydantic validation errors
- HTTP status codes (400, 401, 403, 404, 500)

## Security

1. **Password Security**
   - Bcrypt hashing (passlib)
   - Salt rounds: 12

2. **JWT Tokens**
   - HS256 algorithm
   - 30-minute expiration (access token)
   - 7-day expiration (refresh token)

3. **CORS**
   - Whitelist localhost & production domains
   - Allow credentials

4. **Database**
   - Parameterized queries (SQLAlchemy prevents SQL injection)
   - HTTPS in production
   - Environment variables for secrets

## Deployment

### Frontend
**Cloudflare Pages**
- Automatic deploys on push to main
- Environment variables in Cloudflare dashboard
- CDN for static files

### Backend
**Railway / Render / Heroku**
- Docker container deployment
- PostgreSQL managed database
- Environment variables via CI/CD secrets
- Auto-scaling (optional)

## Development Workflow

1. **Local Development**
   ```bash
   # Terminal 1: Frontend
   cd frontend && npm run dev
   
   # Terminal 2: Backend
   cd backend && python main.py
   ```

2. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Database Migrations** (Alembic)
   ```bash
   cd backend
   alembic revision --autogenerate -m "Description"
   alembic upgrade head
   ```

4. **Testing**
   ```bash
   # Frontend
   npm test
   
   # Backend
   pytest
   ```

## Performance Optimization

1. **Frontend**
   - Code splitting & lazy loading
   - Image optimization
   - Gzip compression
   - Caching strategy

2. **Backend**
   - Database indexing on frequently queried columns
   - Query optimization
   - Response caching
   - Pagination for large datasets

3. **Network**
   - API request debouncing
   - Request batching
   - Efficient query parameters

## Monitoring & Logging

1. **Frontend**
   - Console error tracking
   - User session tracking
   - Performance metrics

2. **Backend**
   - Application logging
   - Database query logging
   - Request/response logging
   - Error tracking (Sentry integration ready)

## Future Enhancements

- [ ] WebSocket for real-time updates
- [ ] File upload to S3/R2
- [ ] Email notifications
- [ ] Advanced reporting & analytics
- [ ] Mobile app (React Native)
- [ ] GraphQL API
- [ ] Microservices architecture
- [ ] Kubernetes deployment

## Team & Roles

- **Employee**: Submit expenses, view own data
- **Manager**: Approve expenses, view team data
- **Admin**: All access, user management, reports
- **Approver**: Approve expenses (specialized role)

## Contact & Support

For issues or questions, refer to the README.md or contact the development team.
