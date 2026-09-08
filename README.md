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
4. **Block Planning** (`/optimizer` or `/plans`): End-to-end multi-department CP-SAT scheduling (Weekly Gantt, Monthly 4-Week Calendar, Baseline vs Optimized Comparison, and JSON/CSV Export).
5. **Optimization Plans** (`/plans`): Human-in-the-loop schedule modification with mandatory operational justification, and Sr. DOM sign-off.
6. **KPIs** (`/kpis`): Measurable Before vs. After optimization analytics.
7. **Audit Trail** (`/audit-trail`): Immutable cryptographic event log of all system and planner decisions.

---

## 🚆 End-to-End Block Planning Module (SIH26027)

### 1. Synthetic Data Generation

Generate realistic Indian Railways datasets across 32 sections, 160 trains, 420 maintenance tasks, 30 resource units, and precomputed 30-minute corridor availability:

```bash
# Run from repository root or backend directory
python generate_synthetic_data.py
```

Generated files in `data/`:
- `data/sections.csv`: 32 section topological records across 4 corridors (BZA, VSKP, GNT, GTL divisions).
- `data/timetable_trains.csv`: 160 passenger & freight train schedules with days-of-run and direction.
- `data/maintenance_tasks.csv`: 420 maintenance defects across Engineering, Traction (TRD), and S&T with severity, due dates, and crew requirements.
- `data/resources.csv`: 30 gangs and specialized machines (CSM tamping machines, tower wagons, testing vans).
- `data/existing_blocks_baseline.csv`: Uncoordinated historical departmental block requests.
- `data/corridor_availability.csv`: Derived 30-minute slot occupancy and availability headroom scores.

---

### 2. Corridor Availability Engine

Ingests COA train timetables, models 30-minute operational time slots (48 slots per 24-hour day), and computes capacity headroom:
- **Headroom Formula**:
  $$\text{AvailabilityScore} = 1.0 - \text{HeadwayOccupancyPenalty}$$
  - 0 trains scheduled in slot: `1.0` (High Availability)
  - 1 train scheduled: `0.8`
  - 2 trains scheduled: `0.5` (Medium Availability)
  - 3+ trains scheduled: `0.25` (Low Availability / Congested)
  - Protected VIP Blackout (Vande Bharat / Rajdhani with priority score $\ge 9$): penalized by 0.3.

---

### 3. Explainable Maintenance Prioritization Formula

Computes transparent priority scores ($0$ to $100$) for every maintenance task:
$$\text{PriorityScore} = W_{\text{sev}} \cdot S_{\text{sev}} + W_{\text{overdue}} \cdot S_{\text{overdue}} + W_{\text{asset}} \cdot S_{\text{asset}} + W_{\text{sec}} \cdot S_{\text{sec}}$$

- **Severity Factor (max 35 pts)**: Critical = 35, High = 25, Medium = 15, Low = 5.
- **Overdue Factor (max 25 pts)**: $\min(25, 10 + (\text{overdue\_days} \times 1.5))$.
- **Asset Criticality (max 20 pts)**: Track segment mainline = 20, Point machine = 20, OHE span = 20, Signals = 16, Cables = 12.
- **Section Operating Risk (max 20 pts)**: Trunk 130 km/h routes = 17 pts + 3 pts double track bonus.

---

### 4. Google OR-Tools CP-SAT Block Optimization Planner

Mathematical formulation for multi-department block planning:
- **Decision Variables**:
  - $x_{t, b} \in \{0, 1\}$: Task $t$ assigned to candidate block window $b$.
  - $y_b \in \{0, 1\}$: Candidate block window $b$ activated (track blocked).
  - $\text{dept\_active}_{b, d} \in \{0, 1\}$: Department $d$ has active tasks in block $b$.
  - $\text{is\_joint}_b \in \{0, 1\}$: Block $b$ bundles tasks from $\ge 2$ departments.
- **Hard Constraints**:
  - Task scheduled at most once: $\sum_b x_{t, b} \le 1$.
  - Block activation linking: $x_{t, b} \le y_b$.
  - Maximum 1 block per section per day (prevents repeated closures): $\sum_w y_{s, d, w} \le 1$.
  - Task duration fits block window duration.
  - Multi-department co-location linking: $\text{is\_joint}_b = 1 \iff \sum_d \text{dept\_active}_{b, d} \ge 2$.
- **Multi-Criteria Objective**:
  $$\max \sum_{t, b} \text{priority}(t) \cdot x_{t, b} + 250 \sum_b \text{is\_joint}_b + \sum_b y_b (\text{avail}_b - 40) - 80 \sum_b y_b$$

---

### 5. REST API Endpoints & Example Requests

#### a. Get Sections
```bash
curl -X GET "http://localhost:8000/api/sections"
```

#### b. Get Prioritized Maintenance Tasks
```bash
curl -X GET "http://localhost:8000/api/maintenance-tasks?department=Engineering&status=open"
```

#### c. Get Corridor Availability Profile (30-min slots)
```bash
curl -X GET "http://localhost:8000/api/corridor-availability?section_id=SEC_C01_01&date=2026-09-08"
```

#### d. Generate Coordinated Weekly Block Plan
```bash
curl -X POST "http://localhost:8000/api/block-plan/generate-weekly" \
     -H "Content-Type: application/json" \
     -d '{"start_date": "2026-09-08", "end_date": "2026-09-14"}'
```

#### e. Generate 4-Week Monthly Calendar
```bash
curl -X POST "http://localhost:8000/api/block-plan/generate-monthly" \
     -H "Content-Type: application/json" \
     -d '{"start_date": "2026-09-08"}'
```

#### f. Compare Baseline vs. Optimized Plan
```bash
curl -X GET "http://localhost:8000/api/block-plan/compare?start_date=2026-09-08&end_date=2026-09-14"
```

---

### 6. Automated Verification Tests

Run the complete block planning automated test suite:
```bash
cd backend
python test_block_planning.py
```
Outputs:
- `test_01_corridor_availability`: 48 30-min slots verified.
- `test_02_task_prioritizer`: 4-factor scoring verified.
- `test_03_weekly_block_plan`: CP-SAT multi-department scheduling verified.
- `test_04_monthly_block_plan`: 4-week calendar rotation verified.
- `test_05_comparator`: Quantitative before vs after verified.
- `test_06_rest_endpoints`: All 6 REST APIs verified (200 OK).

