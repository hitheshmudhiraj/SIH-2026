# RailBlock AI — Intelligent Railway Maintenance Block Planning Platform

> **SAFETY NOTICE & OPERATIONAL PRINCIPLE**  
> **PROTOTYPE — Simulated Data — Human Approval Required**  
> RailBlock AI is a decision-support platform designed for Indian Railways to coordinate maintenance block requests across operational systems (**TMS**, **SMMS**, **TDMS**, **COA**, and **BDMS**). **It is NOT an autonomous control system.** Human railway planners and Section Controllers always review, modify, and authorize final maintenance schedules.

---

## 🏛️ System Architecture

```
                  ┌─────────────────────────────────────────────────┐
                  │   5 Simulated Siloed Railway Systems            │
                  │   TMS | SMMS | TDMS | COA | BDMS                │
                  └────────────────────────┬────────────────────────┘
                                           │
                                           ▼
                  ┌─────────────────────────────────────────────────┐
                  │   Supabase PostgreSQL (Single Source of Truth)  │
                  │   (With local persistence engine fallback)      │
                  └────────────────────────┬────────────────────────┘
                                           │
                                           ▼
                  ┌─────────────────────────────────────────────────┐
                  │   Modular FastAPI Backend (Python 3.14)         │
                  │   app/main.py, app/api/health.py, app/db/       │
                  │   ├── Health Checks (/health & /health/db)      │
                  │   ├── 7-Factor Explainable Priority Model       │
                  │   ├── Conflict & Grouping Engine                │
                  │   ├── Google OR-Tools CP-SAT Optimizer          │
                  │   ├── Human Review & Approval Mod               │
                  │   ├── Immutable Audit Trail                     │
                  │   └── Dynamic Emergency Re-planning             │
                  └────────────────────────┬────────────────────────┘
                                           │ REST API
                                           ▼
                  ┌─────────────────────────────────────────────────┐
                  │   React 19 + Tailwind Control-Room UI           │
                  │   src/layout/AppShell.jsx (Persistent Badge)    │
                  │   ├── 1. Dashboard                              │
                  │   ├── 2. Intake (5 Siloed Systems)              │
                  │   ├── 3. Planning Board (Gantt Board)           │
                  │   ├── 4. Optimizer (CP-SAT Model)               │
                  │   ├── 5. Weekly/Monthly Plans (Human Review)    │
                  │   ├── 6. KPIs (Before vs After Story)           │
                  │   └── 7. Audit Trail (Immutable Governance)     │
                  └─────────────────────────────────────────────────┘
```

---

## 🚀 Key Innovation Highlights

1. **Layer 1 — Explainable Priority Intelligence**:
   - Replaces "black-box AI" with a transparent, weighted 7-factor mathematical scoring model ($0$ to $100$ score):
     - **Safety Risk** (max 25 pts)
     - **Asset Criticality** (max 20 pts)
     - **Overdue Days** (max 15 pts)
     - **Failure History** (max 15 pts)
     - **Predicted Failure Probability** (max 15 pts, calibrated with a `scikit-learn` Logistic Regression model)
     - **Traffic Density** (max 10 pts)
     - **Deferral Consequence** (max 10 pts)
   - Planners click **"Why?"** to open the interactive waterfall breakdown showing individual factor contributions and operational justifications.

2. **Layer 2 — Conflict & Compatibility Detection**:
   - Detects spatial/temporal corridor overlaps, heavy machine bottlenecks (e.g. Plasser CSM 09-32 Tamping Machine), and passenger train timetable blackouts (e.g. Vande Bharat Express).
   - Identifies synergistic joint block opportunities (e.g. Track renewal + S&T Point machine overhaul during a TRD 25kV OHE power isolation block).

3. **Layer 3 — Google OR-Tools CP-SAT Mathematical Optimization**:
   - Formulates maintenance block scheduling using constraint programming.
   - Solves multi-corridor weekly schedules with 0 clashes in **~70ms**.
   - Consolidates separate blocks into unified multi-department shadow blocks.

4. **Layer 4 — Human-in-the-Loop Governance & Audit Trail**:
   - Planners review, modify schedules, and enter mandatory operational justification reasons.
   - Complete cryptographic audit log records all modifications, solver runs, and approvals.

5. **Layer 5 — Dynamic Emergency Re-Planning Simulator**:
   - Injects real-time ultrasonic rail fractures (USFD Priority 98/100 on C1) and triggers incremental CP-SAT re-planning, producing Plan V2 with automated diff tracking (`ADDED`, `MOVED`, `GROUPED`, `UNCHANGED`).

---

## 📊 Before vs. After Optimization KPI Story

| Operational Metric | Before Optimization (Uncoordinated) | After CP-SAT Optimization | Impact / Improvement |
| :--- | :---: | :---: | :---: |
| **Separate Blocks Needed** | 18 separate blocks | **6 consolidated blocks** | **-66.7% Block Reduction** |
| **Total Track Blocked Hours** | 42.5 hours | **22.0 hours** | **-48.2% Track Downtime** |
| **Critical Work Completed** | 10 / 12 items | **12 / 12 items** | **100% Critical Guarantee** |
| **Corridor & Resource Clashes**| 5 active clashes | **0 clashes** | **100% Conflicts Resolved** |
| **Joint Shadow Megablocks** | 0 multi-department | **3 joint megablocks** | **+3 Coordinated Windows** |

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11+, FastAPI, `uvicorn`, `ortools`, `scikit-learn`, `supabase-py`, `python-dotenv`
- **Frontend**: React 19 (Vite), Tailwind CSS, React Router v7, Lucide Icons
- **Database**: Supabase PostgreSQL with RLS (`backend/schema.sql`) + local SQLite fallback engine
- **Optimization**: Google OR-Tools CP-SAT 9.15

---

## ⚙️ Environment Configuration

### Backend (`backend/.env` or `backend/.env.example`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Frontend (`frontend/.env` or `frontend/.env.example`):
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

---

## 🚀 Quick Start (Running Locally)

### Option 1: 1-Click Startup (Windows)
Double-click:
```bash
start_demo.bat
```
This automatically launches both the FastAPI backend on `http://localhost:8000` and Vite React frontend on `http://localhost:5173`.

### Option 2: Manual Terminal Commands

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Health Check: `http://localhost:8000/health`
- Database Health: `http://localhost:8000/health/db`
- Interactive Swagger API Docs: `http://localhost:8000/docs`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
- App UI: `http://localhost:5173`

---

## 🖥️ Control-Room Navigation Sections

The UI provides a persistent left sidebar with the 7 core sections, topped by the permanent safety banner:
1. **Dashboard** (`/dashboard`): Executive overview, live KPI cards, quick-action pipeline.
2. **Intake** (`/intake`): Ingestion feeds from TMS, SMMS, TDMS, COA, and BDMS, with explainable priority matrix.
3. **Planning Board** (`/planning-board`): 24-hour visual corridor Gantt board with protected passenger train blackouts (Vande Bharat / Rajdhani Express).
4. **Optimizer** (`/optimizer`): Pre-optimization clash analysis and Google OR-Tools CP-SAT solver execution.
5. **Weekly/Monthly Plans** (`/plans`): Human-in-the-loop schedule modification with mandatory operational justification, and Sr. DOM sign-off.
6. **KPIs** (`/kpis`): Measurable Before vs. After optimization analytics.
7. **Audit Trail** (`/audit-trail`): Immutable cryptographic event log of all system and planner decisions.
