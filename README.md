# BARK!

This is currently a minimal starter for the project with:

- a styled login / signup page
- Supabase email/password authentication
- automatic redirect to a protected `/main` page after sign-in
- a simple placeholder main page with a sign-out button
- a minimal Flask backend placeholder

The rest of the app is not built yet I and the team are still working on it.

## Current scope

Implemented:

- React + Vite frontend
- Tailwind styling
- Supabase auth integration
- login page
- protected placeholder page at `/main`
- sign-out flow

Not implemented:

- browse page
- profile page
- reviews
- analytics
- admin tools
- database schema and application-specific backend APIs

## Tech stack

- Frontend: React, Vite, Tailwind CSS
- Auth: Supabase Auth
- Backend: Flask

## Project structure

```text
Bark/
├── backend/
│   ├── app.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── contexts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .env.example
└── README.md
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- access to the shared Supabase project credentials

## 1. Install dependencies

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
```

## 2. Create `.env`

Copy the `.env` i will shared into the `.env` you will create in the project root.

Required frontend values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Required backend values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `FLASK_SECRET_KEY`

## 3. Supabase

You do **not** need to create your own Supabase project.

Use the shared values **I** provided:

1. Put the shared project URL in `VITE_SUPABASE_URL`
2. Put the shared anon/public key in `VITE_SUPABASE_ANON_KEY`
3. Keep `CORS_ORIGINS` as `http://localhost:5173` unless your frontend runs on a different port

## 4. Run the app

Open two terminals.

### Terminal 1: backend

```bash
cd backend
python app.py
```

Backend:

- `http://localhost:5000`
- health check: `http://localhost:5000/api/health`

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Frontend:

- `http://localhost:5173`

## Authentication behavior

- Users can sign up with email and password
- Users can log in with email and password
- After successful login, users are redirected to `/main`
- `/main` is only a placeholder page right now
- The placeholder page includes a sign-out button so you can return to the login screen

## Notes for contributors

- This repo is intentionally minimal right now
- Build new features from this base
- Before pushing any changes make sure everyone on the team is aware
- LETS GET BUILDING!!!!

