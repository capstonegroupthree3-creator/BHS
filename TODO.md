# TODO - Smart Barangay Health Management System

## Step 1: Create project scaffold
- [x] Create root directories: database, backend, frontend, ai
- [x] Add root package.json with scripts to start all services

## Step 2: Database layer
- [x] Add database/schema.sql
- [x] Add database/seed.sql
- [x] Add database/start-db.js (loads schema + seed + migration_v2)
- [x] Add database/migration_v2.sql (consent, family access, WHO columns)

## Step 3: Python AI service (/ai)
- [x] Create ai/requirements.txt
- [x] Create ai/app.py (9 endpoints: nutrition, pregnancy, trends, priority, chatbot, etc.)

## Step 4: Node/Express backend (/backend)
- [x] Create backend/package.json
- [x] Create backend/server.js
- [x] Create backend/config/db.js (MySQL connection pool)
- [x] Create backend/middleware/auth.js (JWT + RBAC + audit logging)
- [x] Create backend routes (auth, children, pregnant, seniors, nutrition, ai, reports, programs, users, barangays, consent, family, audit, notifications)
- [x] Install backend node_modules (npm install)

## Step 5: React frontend (/frontend)
- [x] Create frontend Vite + React + TypeScript app structure
- [x] Create index.css + Tailwind CSS
- [x] Create core components (Layout, StatCard, RiskBadge, NotificationBell, AiChatbotDrawer, etc.)
- [x] Create all pages (Dashboard, Children, PregnantWomen, Seniors, Vaccinations, Analytics, Reports, etc.)
- [x] Create API integration (src/lib/api.ts)
- [x] Create AuthContext + ThemeLanguageContext
- [x] i18n (English + Cebuano)
- [x] Install frontend node_modules

## Step 6: Orchestration
- [x] Root npm run dev starts backend + ai + frontend

## Step 7: Verification
- [ ] Run DB seeding: node ./database/start-db.js
- [ ] Run AI service: cd ai && python app.py
- [ ] Run backend: cd backend && node server.js
- [ ] Run frontend: cd frontend && npm run dev
- [ ] Verify login (admin / password123) at http://localhost:5174
- [ ] Verify role restrictions (admin, health_personnel, parent views)
