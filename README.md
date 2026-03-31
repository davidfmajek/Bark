# BARK

BARK is a campus food review app with a React frontend, Supabase authentication, and a lightweight Flask API.

## Current status

Implemented:

- React + Vite frontend with routing and shared layout
- Supabase email/password auth (sign in and sign up)
- protected routes using auth context
- pages for home, restaurants, map, profile, and reviews flow
- Flask backend placeholder with health endpoint
- SQL scripts for core Supabase SQL schema and auth user sync trigger

Still in progress:

- full backend APIs
- complete data fetching/writes across all pages
- admin and moderation workflows
- production hardening, tests, and deployment setup

## Tech stack

- Frontend: React 19, Vite 7, React Router 7, Tailwind CSS 4
- Backend: Flask
- Auth + DB: Supabase (Auth + Postgres)

## Project structure

```text
Bark/
├── backend/
│   ├── app.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── supabase/
│   ├── schema.sql
│   └── auth_sync_trigger.sql
├── .env (shared in #backend-database channel on discord)
└── README.md
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- access to the Supabase project 

## Setup

### 1) Install dependencies

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
```

### 2) Configure environment variables

Create a `.env` file at the repository root with:

```bash
# Backend (Flask)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
FLASK_SECRET_KEY=
CORS_ORIGINS=http://localhost:5173

# Frontend (Vite)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:5000/api
```

This creates the app tables and a trigger that syncs new `auth.users` records into `public.users`.

## Run the app

Use two terminals.

Backend:

```bash
cd backend
python app.py
```

- API base: `http://localhost:5000`
- health: `http://localhost:5000/api/health`

Frontend:

```bash
cd frontend
npm run dev
```

- app: `http://localhost:5173`

## Frontend routes

- public: `/`, `/signin`, `/restaurants`, `/restaurants/:slug`, `/map`
- auth required: `/main`, `/profile`, `/my-reviews`, `/writeareview`, `/restaurants/:slug/writeareview`

