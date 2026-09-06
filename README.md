# RailBlock AI — Intelligent Railway Maintenance Block Planning Platform

A decision-support platform designed for Indian Railways to coordinate maintenance block demands fragmented across siloed operational systems (**TMS**, **SMMS**, **TDMS**, **COA**, and **BDMS**).

Built for the **Smart India Hackathon (SIH)**.

---

## 🚂 Core Innovation: 2-Layer Architectural Paradigm

1. **Layer 1 — Explainable Priority Intelligence**:
   - Replaces "black-box AI" with a transparent, weighted 7-factor mathematical scoring model (0–100 score).
   - Scoring includes **Safety Risk** (max 25), **Asset Criticality** (max 20), **Overdue Days** (max 15), **Failure History** (max 15), **Predicted Failure Probability** (max 15, calibrated with Logistic Regression ML), **Traffic Density** (max 10), and **Deferral Consequence** (max 10).
   - Planners click **"Why?"** to open the interactive waterfall breakdown showing the exact points contribution.

2. **Layer 2 — Conflict & Compatibility Detection**:
   - Scans uncoordinated requests for spatial/temporal corridor overlaps, heavy machine bottlenecks (e.g., Plasser CSM 09-32 Tamping Machine), and passenger train timetable blackouts (e.g. Vande Bharat Express).
   - Detects synergistic joint block opportunities (e.g., Track renewal + S&T Point machine motor overhaul under TRD 25kV OHE power isolation).

3. **Layer 3 — Google OR-Tools CP-SAT Mathematical Optimization**:
   - Formulates maintenance block scheduling as a constraint satisfaction & optimization problem (CP-SAT).
   - Solves multi-corridor, multi-department, multi-machine constraints in <100ms.
   - Eliminates 100% of clashes while consolidating separate blocks into unified shadow megablocks.

4. **Layer 4 — Human-in-the-Loop Governance & Audit Trail**:
   - Planners review, modify schedules, and input mandatory operational justification reasons.
   - Complete cryptographic audit log records all modifications, solver runs, and approvals.

5. **Layer 5 — Dynamic Emergency Re-Planning Simulator**:
   - Injects real-time ultrasonic rail fractures (USFD Priority 98/100) and triggers incremental CP-SAT re-planning, producing Plan V2 with automated diff tracking (Added, Moved, Grouped, Unchanged).

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

- **Backend**: Python 3.14 + FastAPI + Pydantic v2 + Google OR-Tools CP-SAT 9.15 + scikit-learn
- **Frontend**: React 19 + Vite + Tailwind CSS + Lucide Icons
- **Database**: Dual-Mode (Supabase PostgreSQL with full RLS in `backend/schema.sql` + Out-of-the-box local persistence fallback in `backend/railblock_local.db`)
- **Optimization Engine**: Google OR-Tools CP-SAT Constraint Programming Solver

---

## 🚀 Quick Start (Running the Prototype)

### Option 1: 1-Click Startup (Windows)
Double-click:
```bash
start_demo.bat
```
This automatically starts both the FastAPI backend on `http://localhost:8000` and Vite React frontend on `http://localhost:5173`.

### Option 2: Manual Terminal Startup

**Terminal 1 — Backend:**
```bash
cd backend
python main.py
```
Backend runs at: `http://localhost:8000`  
Swagger API Docs: `http://localhost:8000/docs`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Frontend UI runs at: `http://localhost:5173`

---

## 🎯 Demonstration Script for Judges (Step-by-Step)

1. **Step 1 — Show 5 Siloed Systems**:
   - Navigate to the **"5 Siloed Systems"** tab.
   - Show how requests from **TMS** (Timetable), **SMMS** (Signals/OHE), **TDMS** (Track), **COA** (Freight), and **BDMS** (Bridges) arrive fragmented and uncoordinated.

2. **Step 2 — Priority Intelligence & "Why?" Explainability**:
   - Click the **"Priority Intelligence"** tab.
   - Point to a critical work item (e.g., `W001` or `W004` with Priority 100/100).
   - Click the blue **"Why?"** button.
   - Show the slide-over drawer displaying the exact 7-factor waterfall score breakdown (+24 Safety Risk, +19 Asset Criticality, +13 Overdue Days, etc.) and human-readable justification. Explain: *"The planner never sees only 'AI says this is critical' — they see the transparent factors."*

3. **Step 3 — Inspect Clashes & Groupings**:
   - Click the **"Conflicts & Grouping"** tab.
   - Show the 5 detected clashes (e.g., simultaneous track possession requests on Corridor C1, and heavy machine contention for CSM Tamping #09-32).
   - Switch to the **"Compatible Grouping Opportunities"** sub-tab to show how S&T Point Overhauls and Track Tamping can share an OHE power block.

4. **Step 4 — Execute Google OR-Tools CP-SAT Optimization**:
   - Click **"Run CP-SAT Optimizer"** in the top header.
   - Show the solver completing in <100 milliseconds.
   - Navigate to the **"Executive Overview"** tab to review the dynamic **Before vs. After KPI cards** (-66.7% separate blocks, 0 clashes, 100% critical completion).

5. **Step 5 — Inspect the Interactive Gantt Block Board**:
   - Click **"Gantt Planning Board"**.
   - Show the 24-hour timeline across corridors (NDLS-GZB, NDLS-PWL, BRC-ST, etc.).
   - Highlight the red hatched **Passenger Train Blackouts** (Vande Bharat Express, Rajdhani Express) and show how the CP-SAT optimizer scheduled maintenance blocks into non-conflicting windows.
   - Point out the **"JOINT"** badge indicating multi-department shadow blocks.

6. **Step 6 — Human-in-the-Loop Modification & Sign-Off**:
   - Click **"Planner Review & Approval"**.
   - Click **"Modify"** on any scheduled work item. Change its day or start hour, and type an operational justification reason (e.g., *"Adjusted due to freight rake positioning"*).
   - Click **"Save & Log in Audit Trail"**.
   - Scroll down and click **"Sign & Authorize Plan"** as the Senior Divisional Operations Manager (Sr. DOM).

7. **Step 7 — Dynamic Emergency Re-planning**:
   - Click the top red button **"Simulate Emergency Rail Fracture"**.
   - Show the platform detecting the critical defect (Priority 98/100 on Corridor C1), immediately triggering incremental CP-SAT re-planning, and generating **Plan V2**.
   - Inspect the **Schedule Modification Diff table** showing which tasks were **ADDED**, **MOVED**, **GROUPED**, or **UNCHANGED**.

8. **Step 8 — Audit Trail & Governance**:
   - Click **"Audit Trail"**.
   - Show the complete immutable log of all actions (`INGESTION`, `OPTIMIZE_RUN`, `PLANNER_MODIFY`, `PLAN_APPROVE`, `EMERGENCY_TRIGGER`, `REPLAN_COMPLETE`) with user designations and timestamps.
