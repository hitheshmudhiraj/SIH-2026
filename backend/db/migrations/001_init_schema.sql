-- ====================================================================
-- Railway Block Planning Platform - Migration 001: Core Schema
-- Human-in-the-Loop Decision Support System
-- ====================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL, -- e.g. Engineering (P-Way), S&T, Traction Distribution (TD)
    code VARCHAR(32) NOT NULL UNIQUE, -- ENG, SNT, TRD, BDG, OPS
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Corridors
CREATE TABLE IF NOT EXISTS corridors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    section_from VARCHAR(64) NOT NULL,
    section_to VARCHAR(64) NOT NULL,
    route_km NUMERIC(8, 2) NOT NULL,
    max_concurrent_blocks INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Assets
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    asset_type VARCHAR(64) NOT NULL, -- TRACK_TURNOUT, POINT_MACHINE, OHE_CABLE, BRIDGE_GIRDER, AXLE_COUNTER
    name VARCHAR(128) NOT NULL,
    criticality_score NUMERIC(5, 2) NOT NULL DEFAULT 50.0,
    install_date DATE,
    last_maintenance_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Work Items (Unified Maintenance Demands from TMS, SMMS, TDMS)
CREATE TABLE IF NOT EXISTS work_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_system VARCHAR(16) NOT NULL CHECK (source_system IN ('TMS', 'SMMS', 'TDMS', 'COA', 'BDMS')),
    department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    defect_type VARCHAR(64) NOT NULL,
    days_overdue INT NOT NULL DEFAULT 0,
    failure_history_count INT NOT NULL DEFAULT 0,
    predicted_failure_probability NUMERIC(4, 3) NOT NULL DEFAULT 0.20,
    traffic_density_factor NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    estimated_duration_minutes INT NOT NULL,
    required_resources JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'deferred', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Priority Scores (Explainable Scoring History)
CREATE TABLE IF NOT EXISTS priority_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
    total_score NUMERIC(6, 2) NOT NULL,
    factor_breakdown JSONB NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Train Timetable (Passenger & Goods paths causing block restrictions)
CREATE TABLE IF NOT EXISTS train_timetable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    train_number VARCHAR(32) NOT NULL,
    train_type VARCHAR(32) NOT NULL CHECK (train_type IN ('passenger', 'express', 'goods', 'vande_bharat', 'rajdhani')),
    day_of_week VARCHAR(16) NOT NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Goods Forecast (COA Freight Traffic Projections)
CREATE TABLE IF NOT EXISTS goods_forecast (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    expected_goods_traffic_level VARCHAR(16) NOT NULL CHECK (expected_goods_traffic_level IN ('low', 'medium', 'high')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Resources
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    resource_type VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    total_units INT NOT NULL DEFAULT 1,
    unit VARCHAR(32) DEFAULT 'unit',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Plans
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_type VARCHAR(16) NOT NULL CHECK (plan_type IN ('weekly', 'monthly')),
    week_or_month_label VARCHAR(64) NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by VARCHAR(16) NOT NULL CHECK (generated_by IN ('optimizer', 'baseline', 'manual')),
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'modified', 'replanned')),
    kpi_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Plan Versions
CREATE TABLE IF NOT EXISTS plan_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    change_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Blocks (Approved / Proposed Maintenance Possessions)
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    block_type VARCHAR(32) NOT NULL CHECK (block_type IN ('single-department', 'multi-department')),
    status VARCHAR(32) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'active', 'completed', 'cancelled')),
    source VARCHAR(16) NOT NULL DEFAULT 'optimizer' CHECK (source IN ('optimizer', 'manual', 'baseline')),
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Block Work Items (Many-to-Many Join for Combined Blocks)
CREATE TABLE IF NOT EXISTS block_work_items (
    block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
    work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
    PRIMARY KEY (block_id, work_item_id)
);

-- 13. Block Requests (Legacy / Raw Submissions from BDMS & Departments)
CREATE TABLE IF NOT EXISTS block_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    corridor_id UUID REFERENCES corridors(id) ON DELETE CASCADE,
    requested_start TIMESTAMPTZ NOT NULL,
    requested_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'combined', 'scheduled', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    actor VARCHAR(128) NOT NULL DEFAULT 'SYSTEM',
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core Performance Indexes
CREATE INDEX IF NOT EXISTS idx_work_items_corridor ON work_items(corridor_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_blocks_corridor ON blocks(corridor_id);
CREATE INDEX IF NOT EXISTS idx_blocks_plan ON blocks(plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
