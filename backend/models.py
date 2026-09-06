from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# 1. Siloed System & Department Models
class Department(BaseModel):
    id: str
    name: str
    silo_system: str  # TMS, SMMS, TDMS, COA, BDMS
    color_code: str
    description: Optional[str] = None


class Corridor(BaseModel):
    id: str
    code: str
    name: str
    division: str
    zone: str
    length_km: float
    track_type: str = "DOUBLE_LINE"
    gmt_annual: float
    speed_limit_kmph: int = 130


class Asset(BaseModel):
    id: str
    corridor_id: str
    name: str
    asset_type: str
    km_post: str
    installed_year: int
    last_inspected_date: Optional[str] = None
    condition_rating: str = "GOOD"


# 2. Priority Factors Breakdown & Explainability
class PriorityFactors(BaseModel):
    safety_risk: float = Field(..., description="Safety Risk score contribution (max 25)")
    asset_criticality: float = Field(..., description="Asset Criticality score contribution (max 20)")
    overdue_days: float = Field(..., description="Overdue Days score contribution (max 15)")
    failure_history: float = Field(..., description="Failure History score contribution (max 15)")
    failure_probability: float = Field(..., description="ML Predicted Failure Probability contribution (max 15)")
    traffic_density: float = Field(..., description="Traffic Density contribution (max 10)")
    deferral_consequence: float = Field(..., description="Deferral Consequence contribution (max 10)")
    total: float = Field(..., description="Final combined Priority Score (0-100)")


class ExplainabilityResponse(BaseModel):
    work_id: str
    title: str
    department: str
    corridor: str
    asset_name: str
    priority_score: int
    priority_tier: str  # CRITICAL, HIGH, MEDIUM, LOW
    factors: PriorityFactors
    justification: List[str]
    ml_confidence: float
    recommended_action: str


# 3. Work Item Models
class WorkItem(BaseModel):
    id: str
    source_system: str  # TMS, SMMS, TDMS, COA, BDMS
    department_id: str
    department_name: Optional[str] = None
    corridor_id: str
    corridor_name: Optional[str] = None
    asset_id: str
    asset_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    work_type: str
    duration_minutes: int
    required_resource: Optional[str] = None
    requested_date: str
    requested_day: str  # Monday, Tuesday, etc.
    requested_start_hour: int
    requested_end_hour: int
    safety_risk_rating: int = 15
    asset_criticality_rating: int = 12
    overdue_days: int = 0
    failure_history_count: int = 0
    failure_probability: float = 0.25
    traffic_density_factor: float = 1.0
    deferral_consequence_rating: int = 5
    priority_score: int = 50
    priority_tier: str = "MEDIUM"
    priority_factors: Optional[Dict[str, float]] = None
    status: str = "PENDING"  # PENDING, SCHEDULED, REJECTED, COMPLETED
    is_emergency: bool = False


# 4. Conflict & Compatibility Models
class ConflictItem(BaseModel):
    conflict_id: str
    corridor_id: str
    corridor_name: str
    day_of_week: str
    start_time: str
    end_time: str
    conflict_type: str  # CORRIDOR_OVERLAP, RESOURCE_CONTENTION, TIMETABLE_INTERFERENCE, INCOMPATIBLE_WORK
    work_item_ids: List[str]
    work_titles: List[str]
    departments: List[str]
    description: str
    severity: str  # HIGH, MEDIUM


class CompatibilityGroup(BaseModel):
    group_id: str
    corridor_id: str
    corridor_name: str
    suggested_day: str
    suggested_start_time: str
    suggested_end_time: str
    compatible_work_ids: List[str]
    work_titles: List[str]
    departments: List[str]
    shared_benefit: str
    estimated_saved_hours: float


class ConflictAnalysisResult(BaseModel):
    total_conflicts: int
    conflicts: List[ConflictItem]
    total_compatibilities: int
    compatibilities: List[CompatibilityGroup]


# 5. Timetable & Resources
class TimetableWindow(BaseModel):
    id: str
    corridor_id: str
    day_of_week: str
    train_number: str
    train_name: str
    train_type: str
    blackout_start_minute: int
    blackout_end_minute: int
    is_critical_punctuality: bool = True


class DepartmentResource(BaseModel):
    id: str
    department_id: str
    resource_type: str
    resource_name: str
    total_available_units: int = 1
    hourly_cost_inr: float = 15000.0


# 6. Plan Models
class PlanItem(BaseModel):
    id: str
    plan_id: Optional[str] = "PLAN-PENDING"
    work_item_id: str
    work_title: str
    department_id: str
    department_name: Optional[str] = ""
    corridor_id: str
    corridor_name: str
    day_of_week: str
    scheduled_start_minute: Optional[int] = None
    scheduled_end_minute: Optional[int] = None
    start_minute: Optional[int] = None
    end_minute: Optional[int] = None
    start_time_formatted: Optional[str] = ""
    end_time_formatted: Optional[str] = ""
    duration_minutes: Optional[int] = 180
    block_id: str
    is_shadow_block: bool = False
    is_modified_by_planner: bool = False
    priority_score: int
    priority_tier: str
    status: str = "PLANNED"


class Plan(BaseModel):
    id: str
    version: int = 1
    title: str
    horizon_start_date: str
    horizon_end_date: str
    status: str  # DRAFT, OPTIMIZED, UNDER_REVIEW, MODIFIED, APPROVED, REPLANNED
    created_by: str = "CP-SAT Optimizer"
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    items: List[PlanItem] = []
    created_at: str
    updated_at: str


# 7. Planner Modification & Approval
class PlanModificationRequest(BaseModel):
    plan_id: str
    work_item_id: str
    new_day_of_week: str
    new_start_minute: int
    new_end_minute: int
    modified_by: str = "Chief Controller / Section Planner"
    reason: str


class PlanApprovalRequest(BaseModel):
    plan_id: str
    approved_by: str = "Senior Divisional Operations Manager (Sr. DOM)"
    comments: Optional[str] = "Approved following multi-department corridor window review."


# 8. Optimization & KPI Models
class KPISnapshot(BaseModel):
    separate_blocks_count: int
    total_blocked_hours: float
    critical_work_completed: int
    total_work_completed: int
    conflicts_count: int
    compatible_groupings_used: int
    high_priority_completed: int


class BeforeAfterComparison(BaseModel):
    before: KPISnapshot
    after: KPISnapshot
    block_reduction_pct: float
    critical_completion_increase_pct: float
    conflicts_resolved: int
    hours_saved_or_consolidated: float


class OptimizationResponse(BaseModel):
    plan_id: str
    version: int
    status: str
    solver_status: str
    solve_duration_ms: int
    num_constraints: int
    num_variables: int
    objective_value: float
    kpi_comparison: BeforeAfterComparison
    plan_items: List[PlanItem]
    message: str


# 9. Emergency Re-planning Models
class EmergencyEventRequest(BaseModel):
    title: str = "Emergency Ultrasonic Rail Fracture Defect"
    corridor_id: str = "C1"
    work_type: str = "USFD_EMERGENCY_REPAIR"
    duration_minutes: int = 180  # 3 hours
    department_id: str = "DEP_TRACK"
    safety_risk_rating: int = 25
    asset_criticality_rating: int = 20
    overdue_days: int = 14
    failure_history_count: int = 6
    failure_probability: float = 0.95
    deferral_consequence_rating: int = 10
    requested_day: str = "Tuesday"


class PlanDiffItem(BaseModel):
    work_item_id: str
    work_title: str
    change_type: str  # ADDED, MOVED, UNCHANGED, GROUPED
    old_slot: Optional[str] = None
    new_slot: Optional[str] = None
    reason: str


class ReplanResponse(BaseModel):
    old_plan_id: str
    old_version: int
    new_plan_id: str
    new_version: int
    emergency_work_id: str
    diff: List[PlanDiffItem]
    new_kpis: KPISnapshot
    message: str


# 10. Audit Log Models
class AuditLogEntry(BaseModel):
    id: str
    event_type: str
    entity_type: str
    entity_id: str
    user_id: str
    action: str
    details: Dict[str, Any]
    timestamp: str
