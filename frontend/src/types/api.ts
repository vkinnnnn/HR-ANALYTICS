// ── Workforce ──
export interface WorkforceSummary {
  total_headcount: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_years: number;
  new_hires_this_quarter: number;
  departures_this_quarter: number;
  unique_departments: number;
  unique_locations: number;
}

export interface DimensionCount {
  department?: string;
  business_unit?: string;
  function?: string;
  grade?: string;
  country?: string;
  headcount: number;
  departments?: number;
}

export interface GradePyramid {
  grade: string;
  count: number;
  percentage: number;
}

export interface HeadcountPoint {
  month: string;
  headcount: number;
}

// ── Turnover ──
export interface TurnoverSummary {
  total_employees: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_at_departure_years: number;
  median_tenure_at_departure_years: number;
}

export interface DepartmentTurnover {
  department: string;
  total: number;
  active: number;
  departed: number;
  turnover_rate: number;
  avg_tenure_at_departure: number;
}

export interface TurnoverTrend {
  month: string;
  departures: number;
}

export interface TenureAtDeparture {
  bin: string;
  count: number;
}

export interface DangerZone {
  department: string;
  turnover_rate: number;
  departed: number;
  total: number;
  excess_rate: number;
}

// ── Tenure ──
export interface TenureSummary {
  overall_avg_tenure_years: number;
  overall_median_tenure_years: number;
  active_avg_tenure_years: number;
  active_median_tenure_years: number;
  departed_avg_tenure_years: number;
  departed_median_tenure_years: number;
  total_employees: number;
  active_count: number;
  departed_count: number;
}

export interface TenureCohort {
  cohort: string;
  total: number;
  active: number;
  departed: number;
}

export interface RetentionPoint {
  year: number;
  pct_retained: number;
}

export interface LongTenuredEmployee {
  PK_PERSON: number;
  job_title: string;
  department_name: string;
  grade_title: string;
  tenure_years: number;
  is_active: boolean;
}

// ── Careers ──
export interface CareerSummary {
  total_title_changes: number;
  avg_promotion_velocity_days: number;
  pct_with_title_changes: number;
  stuck_count: number;
}

export interface StuckEmployee {
  PK_PERSON: number;
  job_title: string;
  department: string;
  grade: string;
  time_in_current_role_days: number;
  tenure_years: number;
}

export interface CareerPath {
  path: string;
  count: number;
}

// ── Managers ──
export interface ManagerSummary {
  total_managers: number;
  avg_span_of_control: number;
  max_span_of_control: number;
  median_span_of_control: number;
  min_span_of_control: number;
  total_direct_report_relationships: number;
}

export interface SpanBucket {
  range: string;
  count: number;
}

export interface ManagerLeaderboard {
  manager_id: number;
  direct_reports: number;
  job_title: string;
  department: string;
  grade: string;
  business_unit: string;
}

export interface ManagerRetention {
  manager_id: number;
  job_title: string;
  department: string;
  total_reports: number;
  departed: number;
  retained: number;
  retention_rate: number;
  revolving_door: boolean;
}

// ── Org ──
export interface OrgSummary {
  total_departments: number;
  total_business_units: number;
  total_functions: number;
  avg_dept_size: number;
  max_dept_size: number;
}

export interface DepartmentSize {
  department: string;
  headcount: number;
}

export interface RestructuringEvent {
  month: string;
  changes: number;
  z_score: number;
}

// ── Predictions ──
export interface FlightRiskEmployee {
  pk_person: string;
  job_title: string;
  department: string;
  business_unit: string;
  country: string;
  grade: string;
  tenure_years: number;
  time_in_current_role_days: number;
  num_role_changes: number;
  num_manager_changes: number;
  num_actual_title_changes: number;
  risk_score: number;
}

export interface FeatureImportance {
  feature: string;
  coefficient: number;
}

export interface DepartmentRisk {
  department: string;
  avg_risk_score: number;
  max_risk_score: number;
  employee_count: number;
  high_risk_count: number;
}

// ── Chat ──
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>;
}

// ── Upload ──
export interface UploadStatus {
  loaded: boolean;
  total_employees?: number;
  active?: number;
  departed?: number;
  history_records?: number;
  loaded_at?: string;
}
