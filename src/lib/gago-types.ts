// Auto-generated types based on GA-Go server.py/protocol.py
// Do not modify manually unless syncing with backend changes.

export enum TaskState {
  NEW = 'NEW',
  QUEUED = 'QUEUED',
  DISPATCHED = 'DISPATCHED',
  RUNNING = 'RUNNING',
  BLOCKED = 'BLOCKED',
  VERIFYING = 'VERIFYING',
  DONE = 'DONE',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELED = 'CANCELED',
}

export enum NodeState {
  OFFLINE = 'OFFLINE',
  REGISTERED = 'REGISTERED',
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  DEGRADED = 'DEGRADED',
  DRAINING = 'DRAINING',
}

export enum Verdict {
  PASS = 'PASS',
  FAIL = 'FAIL',
  UNKNOWN = 'UNKNOWN',
}

export interface Task {
  task_id: string;
  title: string;
  type: string;
  priority: number;
  requirements: Record<string, any>;
  inputs: Record<string, any>;
  constraints: Record<string, any>;
  dependencies: string[];
  outputs: Record<string, any>;
  created_at: string;
}

export interface Status {
  task_id: string;
  state: TaskState;
  run_id: string | null;
  node_id: string | null;
  lease_until: string | null;
  attempt: number;
  message: string;
  updated_at: string;
}

export interface Node {
  node_id: string;
  type: string;
  version: string;
  capabilities: string[];
  labels: string[];
  cluster_role: string;
  role_profile: Record<string, any>;
  state: NodeState;
  endpoint: string;
  last_heartbeat: string;
  health: Record<string, any>;
}

export interface Result {
  task_id: string;
  run_id: string;
  node_id: string;
  status: TaskState;
  verdict: Verdict;
  summary: string;
  artifacts: Record<string, any>;
  metrics: Record<string, any>;
  errors: Array<Record<string, any>>;
  completed_at: string;
}

export interface Heartbeat {
  node_id: string;
  state: NodeState;
  timestamp: string;
  health: Record<string, any>;
}

export interface Pairing {
  pairing_id: string;
  node_id: string;
  endpoint: string | null;
  capabilities: string[];
  labels: string[];
  state: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  created_at: string;
  updated_at?: string;
}

// API Response Types
export interface HealthResponse {
  ok: boolean;
  version: string;
  service: string;
  time: string;
}

export interface TaskSubmitPayload {
  task_id?: string;
  title?: string;
  type?: string;
  priority?: number;
  requirements?: Record<string, any>;
  inputs?: Record<string, any>;
  constraints?: Record<string, any>;
  dependencies?: string[];
  outputs?: Record<string, any>;
}

export interface TaskSubmitResponse {
  task: Task;
  status: Status;
}

export interface TaskClaimPayload {
  node_id: string;
}

export interface TaskClaimResponse {
  task: Task | null;
}

export interface TaskCompletePayload {
  status: TaskState.DONE | TaskState.FAILED | TaskState.CANCELED;
  verdict?: Verdict;
  summary?: string;
  artifacts?: Record<string, any>;
  metrics?: Record<string, any>;
  errors?: Array<Record<string, any>>;
  node_id?: string;
  run_id?: string;
}

export interface TaskCompleteResponse {
  result: Result;
  status: Status;
}

export interface NodeRegisterPayload {
  node_id?: string;
  type?: string;
  version?: string;
  capabilities?: string[];
  labels?: string[];
  cluster_role?: string;
  endpoint?: string;
}

export interface NodeHeartbeatPayload {
  state?: NodeState;
  health?: Record<string, any>;
}

export interface PairingRequestPayload {
  node_id: string;
  endpoint?: string;
  capabilities?: string[];
  labels?: string[];
}

export interface PairingApproveRejectPayload {
  reason?: string;
}

export interface PairingApproveResponse {
  pairing: Pairing;
  node: Node;
}

export interface PairingRejectResponse {
  pairing: Pairing;
}

export type TaskListResponse = Array<Task & { status: Status }>;
export type NodeListResponse = Node[];
export type PairingListResponse = Pairing[];


export interface ManagedService {
  id: string;
  name: string;
  kind: string;
  state: 'running' | 'stopped' | 'unknown' | string;
  pid?: number | null;
  match?: string | null;
  description?: string;
  last_checked: number;
  actions: string[];
  log_paths: string[];
}

export interface ServiceActionResponse {
  ok: boolean;
  service_id: string;
  action: string;
  message?: string;
  returncode?: number;
  stdout?: string;
  stderr?: string;
}

export interface ServiceLogsResponse {
  service_id: string;
  logs: Array<{ path: string; content: string }>;
}

// --- Stage B: Observability ---

export interface TaskEvent {
  ts: string;
  kind: string;
  detail: string;
  meta?: Record<string, unknown>;
}

export type TaskEventsResponse = TaskEvent[];

export interface TaskLogEntry {
  ts: string;
  level: string;
  message: string;
  source?: string;
}

export type TaskLogsResponse = TaskLogEntry[];

// --- Stage C: Tools Lab v2 ---

export interface ToolInfo {
  name: string;
  adapter: string;
  description: string;
  available: boolean;
  tags?: string[];
}

export type ToolListResponse = ToolInfo[];

export interface ToolSchemaParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  params: ToolSchemaParam[];
}

export interface ToolRunPayload {
  params: Record<string, unknown>;
}

export interface ToolRunResult {
  ok: boolean;
  tool: string;
  duration_ms: number;
  output: unknown;
  error?: string;
}


// --- Stage G: Task Templates ---

export interface TemplateParam {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default?: string | number | boolean;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: 'search' | 'chat' | 'tool' | 'workflow' | 'custom';
  taskType: string;
  params: TemplateParam[];
  buildPayload: (values: Record<string, any>) => Record<string, any>;
}
