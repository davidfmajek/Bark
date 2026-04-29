# BARK

BARK is a campus food review platform with a React frontend, Supabase authentication/database, and a Flask API.

## Overview

The app is designed for students to discover campus food spots, browse restaurant pages, and share reviews.  

## Tech Stack

- Frontend: React 19, Vite 7, Tailwind CSS 4
- Backend: Flask
- Auth + Database: Supabase (Auth + Postgres)
- UI/Charts/Maps: Base UI, Recharts, React Leaflet(Openstreetmap)

## Repository Structure

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
│   ├── auth_sync_trigger.sql
│   └── *.sql
└── README.md
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- npm
- Access to the shared Supabase project

## Local Setup

### 1) Install dependencies

```bash
# frontend
cd frontend
npm install

# backend
cd ../backend
python -m pip install -r requirements.txt
```

### 2) Configure environment variables

Create a `.env` file at the repo root:

```bash
# Flask / backend
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
FLASK_SECRET_KEY=
CORS_ORIGINS=http://localhost:5173

# Vite / frontend
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:5000/api
```


```bash
# terminal 1: backend
cd backend
python app.py
```

```bash
# terminal 2: frontend
cd frontend
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- API base: `http://localhost:5000`
- Health endpoint: `http://localhost:5000/api/health`

## Available Frontend Scripts

From `frontend/`:

- `npm run dev` - start Vite dev server
- `npm run build` - create production build
- `npm run preview` - preview production build locally
- `npm run lint` - run ESLint

## Current Project Status

In place:

- Core React app shell and routing
- Supabase email/password authentication
- Protected route flow via auth context
- Main user pages (restaurants, map, profile, reviews flow)
- Admin dashboard groundwork (analytics/reports/flagged content/users/establishments tabs)
- Flask service with health endpoint and Supabase integration scaffolding

In progress:

- Full backend API surface and validation
- End-to-end data wiring for all frontend pages
- Admin/moderation actions connected to live data
- Test coverage, deployment setup, and production hardening

## Notes

- Keep secrets in local env files only; never commit credentials. PLSSSS DONTTT IM BEGGING
- Ignore generated files in `frontend/node_modules/.vite/` when committing.

