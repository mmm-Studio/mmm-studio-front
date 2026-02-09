/**
 * API client for the MMM Backend.
 *
 * All requests include the Supabase JWT in the Authorization header.
 * The backend verifies this token and extracts the user context.
 */

import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(401, "Not authenticated");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const { method = "GET", body, headers = {} } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...authHeaders, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, error.detail || res.statusText);
  }

  return res.json();
}

async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(401, "Not authenticated");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, error.detail || res.statusText);
  }

  return res.json();
}

// ============================================================================
// AUTH
// ============================================================================

export const auth = {
  me: () => request<AuthMe>("/auth/me"),
};

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const orgs = {
  list: () => request<Org[]>("/orgs"),
  get: (orgId: string) => request<Org>(`/orgs/${orgId}`),
  create: (data: { name: string; slug?: string }) =>
    request<Org>("/orgs", { method: "POST", body: data }),
  update: (orgId: string, data: { name?: string }) =>
    request<Org>(`/orgs/${orgId}`, { method: "PATCH", body: data }),
};

// ============================================================================
// MEMBERS
// ============================================================================

export const members = {
  list: (orgId: string) => request<Member[]>(`/orgs/${orgId}/members`),
  invite: (orgId: string, data: { email: string; role?: string }) =>
    request<Member>(`/orgs/${orgId}/members`, { method: "POST", body: data }),
  remove: (orgId: string, userId: string) =>
    request<{ status: string }>(`/orgs/${orgId}/members/${userId}`, { method: "DELETE" }),
};

// ============================================================================
// PROJECTS
// ============================================================================

export const projects = {
  list: (orgId: string) => request<Project[]>(`/orgs/${orgId}/projects`),
  get: (orgId: string, projectId: string) =>
    request<Project>(`/orgs/${orgId}/projects/${projectId}`),
  create: (orgId: string, data: { name: string; description?: string }) =>
    request<Project>(`/orgs/${orgId}/projects`, { method: "POST", body: data }),
  delete: (orgId: string, projectId: string) =>
    request<{ status: string }>(`/orgs/${orgId}/projects/${projectId}`, { method: "DELETE" }),
};

// ============================================================================
// DATASETS
// ============================================================================

export const datasets = {
  list: (orgId: string, projectId: string) =>
    request<Dataset[]>(`/orgs/${orgId}/projects/${projectId}/datasets`),
  get: (orgId: string, projectId: string, datasetId: string, previewRows = 10) =>
    request<DatasetDetail>(
      `/orgs/${orgId}/projects/${projectId}/datasets/${datasetId}?preview_rows=${previewRows}`
    ),
  upload: (orgId: string, projectId: string, formData: FormData) =>
    uploadFile<Dataset>(`/orgs/${orgId}/projects/${projectId}/datasets/upload`, formData),
  delete: (orgId: string, projectId: string, datasetId: string) =>
    request<{ status: string }>(
      `/orgs/${orgId}/projects/${projectId}/datasets/${datasetId}`,
      { method: "DELETE" }
    ),
};

// ============================================================================
// TRAINING JOBS
// ============================================================================

export const jobs = {
  list: (orgId: string, status?: string) =>
    request<Job[]>(`/orgs/${orgId}/jobs${status ? `?status=${status}` : ""}`),
  get: (orgId: string, jobId: string) =>
    request<Job>(`/orgs/${orgId}/jobs/${jobId}`),
  train: (orgId: string, projectId: string, data: TrainJobInput) =>
    request<TrainJobResponse>(`/orgs/${orgId}/projects/${projectId}/jobs/train`, {
      method: "POST",
      body: data,
    }),
  cancel: (orgId: string, jobId: string) =>
    request<{ status: string }>(`/orgs/${orgId}/jobs/${jobId}/cancel`, { method: "POST" }),
};

// ============================================================================
// MODELS
// ============================================================================

export const models = {
  list: (orgId: string, projectId: string) =>
    request<Model[]>(`/orgs/${orgId}/projects/${projectId}/models`),
  get: (orgId: string, modelId: string) =>
    request<ModelDetail>(`/orgs/${orgId}/models/${modelId}`),
  delete: (orgId: string, modelId: string) =>
    request<{ status: string }>(`/orgs/${orgId}/models/${modelId}`, { method: "DELETE" }),
};

// ============================================================================
// ANALYSIS
// ============================================================================

export const analysis = {
  roas: (orgId: string, modelId: string) =>
    request<RoasResult>(`/orgs/${orgId}/models/${modelId}/roas`),
  contributions: (orgId: string, modelId: string) =>
    request<ContributionsResult>(`/orgs/${orgId}/models/${modelId}/contributions`),
  posterior: (orgId: string, modelId: string) =>
    request<PosteriorResult>(`/orgs/${orgId}/models/${modelId}/posterior`),
};

// ============================================================================
// OPTIMIZATION
// ============================================================================

export const optimization = {
  historical: (orgId: string, modelId: string, data: HistoricalOptInput) =>
    request<HistoricalOptResult>(`/orgs/${orgId}/models/${modelId}/optimize/historical`, {
      method: "POST",
      body: data,
    }),
  budget: (orgId: string, modelId: string, data: BudgetOptInput) =>
    request<BudgetOptResult>(`/orgs/${orgId}/models/${modelId}/optimize/budget`, {
      method: "POST",
      body: data,
    }),
  compare: (orgId: string, modelId: string, data: PeriodCompareInput) =>
    request<PeriodCompareResult>(`/orgs/${orgId}/models/${modelId}/optimize/compare`, {
      method: "POST",
      body: data,
    }),
};

// ============================================================================
// SCENARIOS
// ============================================================================

export const scenarios = {
  list: (orgId: string, modelId: string) =>
    request<Scenario[]>(`/orgs/${orgId}/models/${modelId}/scenarios`),
  save: (orgId: string, modelId: string, data: SaveScenarioInput) =>
    request<Scenario>(`/orgs/${orgId}/models/${modelId}/scenarios`, {
      method: "POST",
      body: data,
    }),
  delete: (orgId: string, scenarioId: string) =>
    request<{ status: string }>(`/orgs/${orgId}/scenarios/${scenarioId}`, { method: "DELETE" }),
};

// ============================================================================
// TYPES
// ============================================================================

export interface AuthMe {
  user_id: string;
  email: string;
  organizations: { id: string; name: string; slug: string; role: string }[];
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: string;
  project_id: string;
  org_id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_size_bytes: number | null;
  row_count: number | null;
  column_names: string[] | null;
  date_column: string | null;
  target_column: string | null;
  spend_columns: string[] | null;
  control_columns: string[] | null;
  countries: string[] | null;
  date_range: { min: string; max: string } | null;
  status: string;
  validation_errors: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetDetail extends Dataset {
  preview: Record<string, unknown>[] | null;
}

export interface TrainJobInput {
  dataset_id: string;
  name: string;
  countries?: string[];
  date_column?: string;
  target_column?: string;
  spend_columns: string[];
  control_columns?: string[];
  start_date?: string;
  end_date?: string;
  test_weeks?: number;
  draws?: number;
  tune?: number;
  chains?: number;
  target_accept?: number;
  base_contribution_pct?: number;
  cv_base?: number;
}

export interface TrainJobResponse {
  job_id: string;
  model_id: string;
  status: string;
  message: string;
}

export interface Job {
  id: string;
  model_id: string;
  org_id: string;
  status: string;
  progress: number;
  message: string | null;
  error: string | null;
  config: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  models?: { name: string; status: string };
}

export interface Model {
  id: string;
  project_id: string;
  org_id: string;
  dataset_id: string | null;
  name: string;
  model_file_path: string | null;
  file_size_mb: number | null;
  countries: string[] | null;
  start_date: string | null;
  end_date: string | null;
  spend_columns: string[] | null;
  control_columns: string[] | null;
  config: Record<string, unknown> | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ModelDetail extends Model {
  datasets?: { name: string; file_path: string } | null;
}

export interface RoasResult {
  model_id: string;
  roas_by_channel: Record<string, number>;
  roas_summary: Record<string, Record<string, number>>;
}

export interface ContributionsResult {
  model_id: string;
  contribution_by_channel: Record<string, number>;
  contribution_percentage: Record<string, number>;
  total_contribution: number;
}

export interface PosteriorResult {
  model_id: string;
  summary: Record<string, Record<string, number>>;
}

export interface HistoricalOptInput {
  start_date: string;
  end_date: string;
  budget_bounds_pct?: number;
}

export interface HistoricalOptResult {
  model_id: string;
  period: Record<string, unknown>;
  original_spend: Record<string, number>;
  optimized_spend: Record<string, number>;
  multipliers: Record<string, number>;
  original_response: number;
  optimized_response: number;
  uplift_pct: number;
}

export interface BudgetOptInput {
  total_budget: number;
  num_weeks: number;
  channel_limits?: Record<string, number>;
  default_limit?: number;
}

export interface BudgetOptResult {
  model_id: string;
  input: Record<string, unknown>;
  baseline_per_week: Record<string, number>;
  optimal_per_week: Record<string, number>;
  optimal_total: Record<string, number>;
  change_pct: Record<string, number>;
  expected_response: number;
  expected_roas: number;
}

export interface PeriodCompareInput {
  period1_start: string;
  period1_end: string;
  period2_start: string;
  period2_end: string;
  period1_name?: string;
  period2_name?: string;
}

export interface PeriodCompareResult {
  model_id: string;
  period1: Record<string, unknown>;
  period2: Record<string, unknown>;
  comparison: Record<string, unknown>;
}

export interface Scenario {
  id: string;
  model_id: string;
  org_id: string;
  name: string;
  type: string;
  input_params: Record<string, unknown>;
  results: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface SaveScenarioInput {
  name: string;
  type: "historical" | "budget" | "comparison";
  input_params: Record<string, unknown>;
  results: Record<string, unknown>;
}

export { ApiError };
