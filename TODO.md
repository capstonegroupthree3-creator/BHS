# TODO - Smart Barangay Health Management System

## Step 1: Create project scaffold
- [x] Create root directories: database, backend, frontend, ai
- [x] Add root package.json with scripts to start all services

## Step 2: Database layer
- [x] Add database/schema.sql
- [x] Add database/seed.sql
- [x] Add database/start-db.js (loads schema+seed)

## Step 3: Python AI service (/ai)
- [ ] Create ai/requirements.txt
- [ ] Create ai/app.py

## Step 4: Node/Express backend (/backend)
- [ ] Create backend/package.json
- [ ] Create backend/server.js
- [ ] Create backend/db.js, auth middleware
- [ ] Create backend routes

## Step 5: React frontend (/frontend)
- [ ] Create frontend Vite app structure
- [ ] Create index.css + core components
- [ ] Create pages and API integration

## Step 6: Orchestration
- [ ] Ensure root `npm run dev` starts db + backend + ai + frontend

## Step 7: Verification
- [ ] Run DB seeding (node ./database/start-db.js)
- [ ] Run AI endpoints
- [ ] Run backend auth + RBAC
- [ ] Run frontend and verify role restrictions

