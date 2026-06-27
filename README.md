# Field Operations Management System

A full-stack web application for managing field operations, built with **React + TypeScript + Tailwind CSS** (Frontend) and **Python + FastAPI** (Backend).

## 📁 Project Structure

```
new-app/
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       ├── components/   # Reusable UI components (organized by feature)
│       ├── pages/        # Page-level components
│       ├── hooks/        # Custom React hooks
│       ├── context/      # React Context for state
│       ├── services/     # API integration
│       ├── utils/        # Utility functions
│       ├── types/        # TypeScript types
│       ├── styles/       # Global styles & Tailwind
│       └── assets/       # Static files
│
└── backend/           # Python FastAPI
    └── app/
        ├── api/          # API routes (organized by feature)
        ├── models/       # SQLAlchemy database models
        ├── schemas/      # Pydantic validation schemas
        ├── services/     # Business logic
        ├── utils/        # Utility functions
        ├── config/       # Configuration & database
        ├── middleware/   # Custom middleware
        └── core/         # Core application logic
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Frontend)
- Python 3.9+ (Backend)
- npm or yarn (Frontend)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend runs on `http://localhost:8000`

## 📚 Frontend Architecture

### Components Organization
- **common/** - Shared UI components (Button, Card, Modal, etc.)
- **auth/** - Authentication-related components
- **expense/** - Expense module components
- **dashboard/** - Dashboard components
- **approval/** - Approval workflow components
- **admin/** - Admin panel components
- **profile/** - User profile components

### Services
- **api.ts** - Axios instance with interceptors
- **authService.ts** - Authentication API calls
- **expenseService.ts** - Expense management
- **dashboardService.ts** - Dashboard data

### Hooks
- **useAuth** - Authentication logic
- **useFetch** - Data fetching
- **useForm** - Form handling
- **useNotification** - Toast notifications

## 🐍 Backend Architecture

### API Routes
- `/api/auth/` - Authentication (login, logout, password reset)
- `/api/expense/` - Expense CRUD operations
- `/api/dashboard/` - Dashboard statistics
- `/api/approval/` - Approval workflow
- `/api/admin/` - Admin operations
- `/api/upload/` - File uploads
- `/api/reports/` - Report generation
- `/api/users/` - User management

### Database Models
- **User** - User accounts and roles
- **Expense** - Expense records
- **Approval** - Approval workflow
- **Asset** - Asset master data

### Services Layer
Each API feature has a corresponding service with business logic:
- `auth_service.py`
- `expense_service.py`
- `approval_service.py`
- `admin_service.py`
- `upload_service.py`

## 🎨 Styling

Using **Tailwind CSS** with custom configuration:
- Primary color: Navy (#002b5e) - matching Cyrix theme
- Responsive design utilities
- Custom spacing and typography
- Animations and transitions

## 🔐 Authentication

- JWT token-based authentication
- Access token stored in localStorage
- Refresh token rotation
- Protected routes with middleware
- Role-based access control (RBAC)

## 📦 Dependencies

### Frontend
- React 19
- React Router v6
- Axios for API calls
- Tailwind CSS
- Lucide React (icons)
- Recharts (charts)
- React Hot Toast (notifications)

### Backend
- FastAPI
- SQLAlchemy ORM
- Pydantic for validation
- JWT for authentication
- Passlib for password hashing
- Alembic for migrations

## 🧪 Testing

### Frontend
```bash
npm run test
```

### Backend
```bash
pytest
```

## 🚢 Deployment

### Frontend (Cloudflare Pages/Vercel)
```bash
npm run build
```

### Backend (Railway/Render/Heroku)
```bash
python main.py
```

## 📝 Environment Variables

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=Field Operations
```

### Backend (.env)
```
DATABASE_URL=sqlite:///./test.db
SECRET_KEY=your-secret-key
DEBUG=True
```

## 📖 API Documentation

FastAPI automatically generates OpenAPI docs at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🤝 Contributing

1. Create feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open Pull Request

## 📄 License

MIT License

## 👨‍💼 Author

Sunil | Cyrix Health Care Pvt. Ltd.
