# Quick Start Guide 🚀

Get the application running in 5 minutes!

## Option 1: Local Development (Recommended)

### Prerequisites
- Node.js 18+ installed
- Python 3.9+ installed
- Git installed

### Step 1: Clone & Setup
```bash
cd new-app
```

### Step 2: Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Frontend will run at: `http://localhost:5173`

### Step 3: Setup Backend (New Terminal)
```bash
cd backend
python -m venv venv

# On Windows
venv\Scripts\activate
# On Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python main.py
```
Backend will run at: `http://localhost:8000`
API Docs: `http://localhost:8000/docs`

## Option 2: Docker Compose (All-in-One)

### Prerequisites
- Docker & Docker Compose installed

### Step 1: Start Services
```bash
docker-compose up -d
```

This will start:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

### Step 2: Stop Services
```bash
docker-compose down
```

## Common Commands

### Frontend
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend
```bash
python main.py                    # Run dev server
python -m pytest                  # Run tests
alembic upgrade head              # Run migrations
alembic revision --autogenerate   # Create migration
```

## Project Structure Quick Reference

```
new-app/
├── frontend/          # React + TypeScript
│   └── src/
│       ├── components/    # UI components by feature
│       ├── pages/         # Full-page components
│       ├── services/      # API calls
│       ├── hooks/         # Custom hooks
│       └── types/         # TypeScript types
│
└── backend/           # Python + FastAPI
    └── app/
        ├── api/           # API routes
        ├── models/        # Database models
        ├── schemas/       # Request validation
        └── services/      # Business logic
```

## Environment Setup

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=Field Operations
```

### Backend (.env)
```env
DATABASE_URL=sqlite:///./test.db
SECRET_KEY=dev-secret-key
DEBUG=True
```

## First Steps

### 1. Create a User (Backend)
```bash
# Use curl or Postman to POST to /api/auth/register
POST http://localhost:8000/api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### 2. Test Frontend
- Open `http://localhost:5173`
- Try to login with your credentials
- Navigate through the app

### 3. Check Backend Docs
- Visit `http://localhost:8000/docs`
- Test API endpoints using Swagger UI

## Troubleshooting

### Frontend Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend Issues
```bash
# Clear Python cache
find . -type d -name __pycache__ -exec rm -r {} +
pip install --upgrade pip
pip install -r requirements.txt
python main.py
```

### Port Already in Use
```bash
# Frontend (5173)
npm run dev -- --port 3000

# Backend (8000)
python -m uvicorn app.main:app --port 8001
```

### Database Issues
```bash
# Delete SQLite database and restart
rm backend/test.db
python main.py
```

## Next Steps

1. **Read the full README.md** for complete documentation
2. **Check ARCHITECTURE.md** for system design
3. **Start building!** Create features following the project structure
4. **Join team discussions** and share progress

## Useful Tools

### API Testing
- **Postman**: GUI for API testing
- **Insomnia**: Alternative to Postman
- **curl**: Command line tool

### Frontend Development
- **React Developer Tools**: Browser extension
- **VS Code Extensions**: ES7+ React/Redux/React-Native snippets

### Database
- **DBeaver**: Database management tool
- **pgAdmin**: PostgreSQL GUI (if using Docker)

## Getting Help

1. Check the comments in the code
2. Read error messages carefully
3. Check `http://localhost:8000/docs` for API details
4. Review ARCHITECTURE.md for system design
5. Ask in team chat/Discord

---

**Ready to build?** Start coding in `frontend/src/components` and `backend/app/api/routes` 🎉
