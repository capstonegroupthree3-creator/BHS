# SBHMS Deployment Guide

**Smart Barangay Health Management System (SBHMS)**  
Barangay Camagong Health Center, Nasipit, Agusan Del Norte

---

## System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10/11, Ubuntu 20.04+ |
| Node.js | v18+ |
| Python | 3.9+ |
| MySQL | 8.0+ (via XAMPP or standalone) |
| RAM | 4 GB minimum, 8 GB recommended |
| Storage | 10 GB free space |

---

## 1. Database Setup (MySQL)

### Using XAMPP (Windows)
```bash
# Start XAMPP → Start Apache + MySQL
# Open phpMyAdmin → Create database: barangay_health_db

# Run initial schema
C:\xampp\mysql\bin\mysql.exe -u root barangay_health_db < database\schema.sql

# Run v2 migration (new tables: consent, family access, nutrition tracking)
C:\xampp\mysql\bin\mysql.exe -u root barangay_health_db < database\migration_v2.sql
```

### Using standalone MySQL
```bash
mysql -u root -p barangay_health_db < database/schema.sql
mysql -u root -p barangay_health_db < database/migration_v2.sql
```

---

## 2. Backend Setup (Node.js / Express)

```bash
cd backend
npm install

# Configure environment variables
copy .env.example .env
# Edit .env:
#   DB_HOST=localhost
#   DB_PORT=3306
#   DB_USER=root
#   DB_PASSWORD=
#   DB_NAME=barangay_health_db
#   JWT_SECRET=your-secret-key-here
#   PORT=5000
#   AI_SERVICE_URL=http://localhost:5001

# Start development server
node server.js

# Production (with PM2)
npm install -g pm2
pm2 start server.js --name sbhms-backend
pm2 save
pm2 startup
```

---

## 3. AI Microservice Setup (Python Flask)

```bash
cd ai

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install flask flask-cors scikit-learn numpy pandas

# Start AI service
python app.py

# Production (with gunicorn on Linux)
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:5001 app:app
```

> The AI service runs on **port 5001** and provides:
> - `POST /predict/nutrition` — ML nutrition classification
> - `POST /predict/pregnancy-risk` — maternal risk assessment
> - `POST /growth-assessment` — WHO LMS Z-score calculation
> - `GET /priority-list` — AI-ranked priority list
> - `GET /health` — health check

---

## 4. Frontend Setup (React / Vite)

```bash
cd frontend
npm install --legacy-peer-deps

# Development server (port 5174)
npm run dev

# Production build
npm run build
# Output: frontend/dist/

# Serve production build (using serve)
npm install -g serve
serve -s dist -l 3000
```

### Environment Variables (frontend)
Create `frontend/.env.production`:
```
VITE_API_BASE_URL=http://your-server-ip:5000/api
```

---

## 5. Full Stack Startup (Windows)

Open **three terminal windows**:

**Terminal 1 — Backend:**
```powershell
cd c:\Users\Admin\Downloads\BHS\backend
node server.js
```

**Terminal 2 — AI Service:**
```powershell
cd c:\Users\Admin\Downloads\BHS\ai
python app.py
```

**Terminal 3 — Frontend (dev):**
```powershell
cd c:\Users\Admin\Downloads\BHS\frontend
npm run dev
```

Access: **http://localhost:5174**

---

## 6. Default Admin Account

After running the schema, the default admin credentials are set in the initial seed data.  
**Change the password immediately after first login via Settings → Change Password.**

---

## 7. User Roles

| Role | Access |
|------|--------|
| `admin` | Full system access, user management, audit trail |
| `health_personnel` | Resident records, health assessments, reports |
| `parent` | Own profile, children's records, family health access |

---

## 8. Backup & Restore

### Daily Database Backup (Windows Task Scheduler)
```batch
:: Create backup.bat
@echo off
set TIMESTAMP=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%
C:\xampp\mysql\bin\mysqldump.exe -u root barangay_health_db > C:\backups\sbhms_%TIMESTAMP%.sql
```

### Restore from Backup
```bash
C:\xampp\mysql\bin\mysql.exe -u root barangay_health_db < C:\backups\sbhms_20261101.sql
```

---

## 9. Production Checklist

- [ ] Change default admin password
- [ ] Set strong `JWT_SECRET` in backend `.env`
- [ ] Configure HTTPS (use nginx or Caddy as reverse proxy)
- [ ] Enable MySQL user with restricted privileges (not root)
- [ ] Set up daily automated backups
- [ ] Configure firewall: expose only ports 80/443
- [ ] Test all three services start on server reboot
- [ ] Verify AI service is reachable from backend

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend 500 errors | Check `DB_HOST`, `DB_USER`, `DB_PASSWORD` in `.env` |
| AI service not responding | Check Python venv is activated; run `python app.py` |
| Frontend blank page | Run `npm run build` and check for TypeScript errors |
| MySQL connection refused | Start XAMPP MySQL or check MySQL service is running |
| JWT errors | Ensure `JWT_SECRET` matches between sessions; clear browser storage |
| CORS errors | Ensure backend `CORS` origins include frontend URL |

---

## 11. API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| GET | `/api/reports/summary-stats` | Dashboard KPIs |
| GET | `/api/children` | Children records |
| GET | `/api/seniors` | Senior citizens |
| GET | `/api/nutrition` | Nutrition assessments |
| POST | `/api/nutrition` | Create assessment |
| GET | `/api/consent` | Consent records |
| GET | `/api/family/my` | Family relationships |
| POST | `/api/family/request` | Request family access |
| GET | `/api/ai/priority-list` | AI-ranked priority list |
| GET | `/api/audit` | Audit trail |

---

*SBHMS v2.0 — Enhanced with WHO Nutrition Analysis, Consent Management, and Family Health Access*
