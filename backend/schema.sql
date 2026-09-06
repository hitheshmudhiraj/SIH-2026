-- ====================================================================
-- RailBlock AI: Intelligent Railway Maintenance Block Planning Platform
-- Single Source of Truth PostgreSQL / Supabase Schema
-- ====================================================================

-- 1. Departments & Siloed Systems Registry
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    silo_system VARCHAR(32) NOT NULL, -- TMS, SMMS, TDMS, COA, BDMS
    color_code VARCHAR(16) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Corridors (Railway Routes / Sections)
CREATE TABLE IF NOT EXISTS corridors (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    division VARCHAR(64) NOT NULL,
    zone VARCHAR(32) NOT NULL,
    length_km NUMERIC(8, 2) NOT NULL,
    track_type VARCHAR(32) DEFAULT 'DOUBLE_LINE', -- SINGLE_LINE, DOUBLE_LINE, QUADRUPLE
    gmt_annual NUMERIC(8, 2) NOT NULL, -- Gross Million Tonnes per annum
    speed_limit_kmph INT NOT NULL DEFAULT 130,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Assets Registry
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(64) PRIMARY KEY,
    corridor_id VARCHAR(32) REFERENCES corridors(id),
    name VARCHAR(128) NOT NULL,
    asset_type VARCHAR(64) NOT NULL, -- TRACK_TURNOUT, OHE_CATENARY, POINT_MACHINE, BRIDGE_GIRDER, TRACK_CIRCUIT, RAIL_JOINT
    km_post VARCHAR(32) NOT NULL,
    installed_year INT NOT NULL,
    last_inspected_date DATE,
    condition_rating VARCHAR(16) DEFAULT 'GOOD', -- CRITICAL, POOR, FAIR, GOOD
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Work Items (Unified Maintenance Requests from Siloed Systems)
CREATE TABLE IF NOT EXISTS work_items (
    id VARCHAR(64) PRIMARY KEY,
    source_system VARCHAR(32) NOT NULL, -- TMS, SMMS, TDMS, COA, BDMS
    department_id VARCHAR(32) REFERENCES departments(id),
    corridor_id VARCHAR(32) REFERENCES corridors(id),
    asset_id VARCHAR(64) REFERENCES assets(id),
    title VARCHAR(256) NOT NULL,
    description TEXT,
    work_type VARCHAR(64) NOT NULL, -- TAMPING, USFD_TESTING, OHE_MAINTENANCE, POINT_OVERHAUL, GIRDER_PAINTING, DEEP_SCREENING
    duration_minutes INT NOT NULL,
    required_resource VARCHAR(64), -- CSM_TAMPING_09, BCM_CLEANER, TOWER_WAGON, CRANE_140T, GANG_CREW
    requested_date DATE NOT NULL,
    requested_start_hour INT NOT NULL,
    requested_end_hour INT NOT NULL,
    
    -- Priority Attributes (Explainable Model Inputs)
    safety_risk_rating INT NOT NULL DEFAULT 15, -- 0 to 25
    asset_criticality_rating INT NOT NULL DEFAULT 12, -- 0 to 20
    overdue_days INT NOT NULL DEFAULT 0,
    failure_history_count INT NOT NULL DEFAULT 0,
    failure_probability NUMERIC(4, 3) NOT NULL DEFAULT 0.25, -- 0.0 to 1.0 (from ML or calibrated model)
    traffic_density_factor NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    deferral_consequence_rating INT NOT NULL DEFAULT 5, -- 0 to 10
    
    -- Calculated Priority Score (Layer 1)
    priority_score INT NOT NULL DEFAULT 50, -- 0 to 100
    priority_tier VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- CRITICAL, HIGH, MEDIUM, LOW
    priority_factors JSONB, -- Breakdown: {"safety_risk": 23, "asset_criticality": 20, ...}
    
    -- Status
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, SCHEDULED, REJECTED, COMPLETED, CANCELLED
    is_emergency BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Timetable Windows (Train movements causing maintenance blackout windows)
CREATE TABLE IF NOT EXISTS timetable_windows (
    id VARCHAR(64) PRIMARY KEY,
    corridor_id VARCHAR(32) REFERENCES corridors(id),
    day_of_week VARCHAR(16) NOT NULL, -- Monday to Sunday
    train_number VARCHAR(32) NOT NULL,
    train_name VARCHAR(128) NOT NULL,
    train_type VARCHAR(32) NOT NULL, -- VANDE_BHARAT, RAJDHANI, EXPRESS, COMMUTER
    blackout_start_minute INT NOT NULL, -- minutes from 00:00 (e.g. 600 = 10:00)
    blackout_end_minute INT NOT NULL,
    is_critical_punctuality BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Goods Train Forecasts (Freight movement windows from COA)
CREATE TABLE IF NOT EXISTS goods_forecasts (
    id VARCHAR(64) PRIMARY KEY,
    corridor_id VARCHAR(32) REFERENCES corridors(id),
    day_of_week VARCHAR(16) NOT NULL,
    rake_type VARCHAR(64) NOT NULL, -- COAL_RAKE, CONTAINER, PETROLEUM, CEMENT
    earliest_slot_minute INT NOT NULL,
    latest_slot_minute INT NOT NULL,
    can_be_diverted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Department Resources (Machinery & Specialized Gangs)
CREATE TABLE IF NOT EXISTS department_resources (
    id VARCHAR(64) PRIMARY KEY,
    department_id VARCHAR(32) REFERENCES departments(id),
    resource_type VARCHAR(64) NOT NULL,
    resource_name VARCHAR(128) NOT NULL,
    total_available_units INT NOT NULL DEFAULT 1,
    hourly_cost_inr NUMERIC(10, 2) DEFAULT 15000.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Plans (Versioned Generated Maintenance Schedules)
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(64) PRIMARY KEY,
    version INT NOT NULL DEFAULT 1,
    title VARCHAR(128) NOT NULL,
    horizon_start_date DATE NOT NULL,
    horizon_end_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, OPTIMIZED, UNDER_REVIEW, MODIFIED, APPROVED, REPLANNED
    created_by VARCHAR(64) DEFAULT 'CP-SAT Optimizer',
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Plan Items (Scheduled Work Items inside Maintenance Blocks)
CREATE TABLE IF NOT EXISTS plan_items (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) REFERENCES plans(id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) REFERENCES work_items(id),
    corridor_id VARCHAR(32) REFERENCES corridors(id),
    day_of_week VARCHAR(16) NOT NULL,
    scheduled_start_minute INT NOT NULL,
    scheduled_end_minute INT NOT NULL,
    block_id VARCHAR(64) NOT NULL, -- Identifies the unified block grouping
    is_shadow_block BOOLEAN DEFAULT FALSE, -- Multi-department joint block indicator
    is_modified_by_planner BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Planner Modifications (Human-in-the-Loop Audit Trail)
CREATE TABLE IF NOT EXISTS plan_modifications (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) REFERENCES plans(id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) REFERENCES work_items(id),
    modified_by VARCHAR(64) NOT NULL,
    previous_schedule JSONB NOT NULL,
    new_schedule JSONB NOT NULL,
    reason TEXT NOT NULL,
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Immutable Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL, -- INGESTION, PRIORITY_COMPUTE, OPTIMIZE_RUN, PLANNER_MODIFY, PLAN_APPROVE, EMERGENCY_TRIGGER, REPLAN_COMPLETE
    entity_type VARCHAR(64) NOT NULL, -- WORK_ITEM, PLAN, CORRIDOR, OPTIMIZER
    entity_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    action VARCHAR(128) NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Optimization Runs (CP-SAT Performance & Result Metrics)
CREATE TABLE IF NOT EXISTS optimization_runs (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) REFERENCES plans(id),
    solver_name VARCHAR(64) DEFAULT 'Google OR-Tools CP-SAT',
    status VARCHAR(32) NOT NULL, -- OPTIMAL, FEASIBLE, INFEASIBLE
    solve_duration_ms INT NOT NULL,
    num_constraints INT NOT NULL,
    num_variables INT NOT NULL,
    objective_value NUMERIC(12, 2) NOT NULL,
    before_metrics JSONB NOT NULL,
    after_metrics JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. KPI Snapshots (Before vs After Optimization Performance)
CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) REFERENCES plans(id),
    phase VARCHAR(32) NOT NULL, -- BEFORE_OPTIMIZATION, AFTER_OPTIMIZATION, AFTER_REPLAN
    separate_blocks_count INT NOT NULL,
    total_blocked_hours NUMERIC(8, 2) NOT NULL,
    critical_work_completed INT NOT NULL,
    total_work_completed INT NOT NULL,
    conflicts_count INT NOT NULL,
    compatible_groupings_used INT NOT NULL,
    punctuality_impact_score NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- Row Level Security (RLS) Policies
-- ====================================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE corridors ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated and anonymous users
CREATE POLICY "Allow read access to public" ON departments FOR SELECT USING (true);
CREATE POLICY "Allow read access to corridors" ON corridors FOR SELECT USING (true);
CREATE POLICY "Allow read access to assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Allow read access to work_items" ON work_items FOR SELECT USING (true);
CREATE POLICY "Allow read access to timetable" ON timetable_windows FOR SELECT USING (true);
CREATE POLICY "Allow read access to goods" ON goods_forecasts FOR SELECT USING (true);
CREATE POLICY "Allow read access to resources" ON department_resources FOR SELECT USING (true);
CREATE POLICY "Allow read access to plans" ON plans FOR SELECT USING (true);
CREATE POLICY "Allow read access to plan_items" ON plan_items FOR SELECT USING (true);
CREATE POLICY "Allow read access to modifications" ON plan_modifications FOR SELECT USING (true);
CREATE POLICY "Allow read access to audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow read access to optimization_runs" ON optimization_runs FOR SELECT USING (true);
CREATE POLICY "Allow read access to kpis" ON kpi_snapshots FOR SELECT USING (true);

-- Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_work_items_corridor ON work_items(corridor_id);
CREATE INDEX IF NOT EXISTS idx_work_items_priority ON work_items(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
