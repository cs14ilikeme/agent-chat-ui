import { TaskState } from './gago-types';
import type {
  HealthResponse,
  NodeListResponse,
  TaskListResponse,
  TaskEventsResponse,
  TaskLogsResponse,
  ToolListResponse,
  ToolSchema,
  ToolRunResult,
  Status,
  Result,
  TaskSubmitPayload,
  TaskSubmitResponse,
  TaskClaimPayload,
  TaskClaimResponse,
  TaskCompletePayload,
  TaskCompleteResponse,
  CollabRoom,
  CollabMessage,
  CollabRoomsResponse,
  CollabMessagesResponse,
  NodeRegisterPayload,
  NodeHeartbeatPayload,
  PairingRequestPayload,
  PairingApproveRejectPayload,
  PairingApproveResponse,
  PairingRejectResponse,
  ManagedService,
  ServiceActionResponse,
  ServiceLogsResponse,
  PairingListResponse,
  Pairing,
  Node,
  Task,
  ApprovalItem,
  WorkspaceItem,
  ArtifactItem,
  ToolLeaseItem,
  TimelineEvent,
  RoomOverview,
  RoomCommandResponse,
  WorkerItem,
  PipelineItem,
  TraceResponse,
  RepairStuckTasksResponse,
} from './gago-types';

export class GAGoClient {
  private baseUrl: string;
  private token: string | null;

  constructor(config: { baseUrl: string; token?: string | null }) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token ?? null;
  }

  private toWorkbenchTaskState(status?: string): TaskState {
    switch ((status || '').toLowerCase()) {
      case 'queued': return TaskState.QUEUED;
      case 'assigned': return TaskState.DISPATCHED;
      case 'running': return TaskState.RUNNING;
      case 'completed': return TaskState.DONE;
      case 'failed': return TaskState.FAILED;
      case 'retrying': return TaskState.RETRYING;
      case 'cancelled':
      case 'canceled': return TaskState.CANCELED;
      default: return TaskState.NEW;
    }
  }

  private normalizeHubTask(task: any): Task & { status: Status } {
    const taskId = task.task_id ?? task.id;
    const state = this.toWorkbenchTaskState(task.status);
    const title = task.title ?? task.input ?? taskId;
    return {
      ...task,
      task_id: taskId,
      title,
      type: task.type ?? 'hub_task',
      priority: task.priority ?? 0,
      requirements: task.requirements ?? { capabilities: task.required_capabilities ?? [] },
      inputs: task.inputs ?? { input: task.input },
      constraints: task.constraints ?? {},
      dependencies: task.dependencies ?? [],
      outputs: task.outputs ?? (task.result ? { result: task.result } : {}),
      created_at: task.created_at ?? '',
      status: {
        task_id: taskId,
        state,
        run_id: task.assignment_id ?? null,
        node_id: task.assigned_to ?? null,
        lease_until: null,
        attempt: task.retry_count ?? 0,
        message: task.fail_reason || task.result || task.status || '',
        updated_at: task.updated_at ?? task.created_at ?? '',
      },
    };
  }

  private normalizeHubResult(task: any): Result {
    const normalized = this.normalizeHubTask(task);
    return {
      task_id: normalized.task_id,
      run_id: task.assignment_id ?? '',
      node_id: task.assigned_to ?? '',
      status: normalized.status.state,
      verdict: normalized.status.state === TaskState.FAILED ? 'FAIL' as any : 'PASS' as any,
      summary: task.result || task.fail_reason || '',
      artifacts: task.outputs ?? {},
      metrics: {},
      errors: task.fail_reason ? [{ message: task.fail_reason }] : [],
      completed_at: task.updated_at ?? '',
    };
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    payload?: Record<string, any>,
    options?: { expectText?: boolean }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // CSRF token: read from ga_csrf_token cookie (set by middleware) and
    // attach to mutating requests so the auth middleware accepts them.
    if (typeof document !== 'undefined' && method !== 'GET') {
      const m = document.cookie.match(/(?:^|;\s*)ga_csrf_token=([^;]+)/);
      if (m) headers['x-csrf-token'] = decodeURIComponent(m[1]);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      let errorData: any;
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { message: await response.text() };
      }
      const errorMessage = errorData?.error || errorData?.message || response.statusText;
      throw new Error(`GA-Claw Hub API error (${response.status}): ${errorMessage}`);
    }

    if (options?.expectText) {
      return (await response.text()) as any;
    }

    return response.json();
  }

  // Health endpoint
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  // Nodes endpoints
  async listNodes(): Promise<NodeListResponse> {
    const data = await this.request<any>('GET', '/nodes');
    return Array.isArray(data) ? data : data?.nodes ?? [];
  }

  async registerNode(payload: NodeRegisterPayload): Promise<Node> {
    return this.request<Node>('POST', '/nodes/register', payload);
  }

  async heartbeatNode(nodeId: string, payload: NodeHeartbeatPayload): Promise<Node> {
    return this.request<Node>('POST', `/nodes/${nodeId}/heartbeat`, payload);
  }

  async drainNode(nodeId: string, reason?: string): Promise<Node> {
    return this.request<Node>('POST', `/nodes/${nodeId}/drain`, { reason });
  }

  async removeNode(nodeId: string): Promise<Node> {
    return this.request<Node>('POST', `/nodes/${nodeId}/remove`);
  }

  // Tasks endpoints
  async listTasks(state?: string): Promise<TaskListResponse> {
    const path = state ? `/tasks?state=${encodeURIComponent(state)}` : '/tasks';
    const data = await this.request<any>('GET', path);
    const tasks = Array.isArray(data) ? data : data?.tasks ?? [];
    return tasks.map((task: any) => this.normalizeHubTask(task));
  }

  async getTask(taskId: string): Promise<Task> {
    const task = await this.request<any>('GET', `/tasks/${taskId}`);
    return this.normalizeHubTask(task);
  }

  async submitTask(payload: TaskSubmitPayload): Promise<TaskSubmitResponse> {
    const data = await this.request<any>('POST', '/tasks/submit', {
      input: payload.inputs?.query ?? payload.inputs?.input ?? payload.title ?? '',
      required_capabilities: payload.requirements?.capabilities ?? ['echo'],
      priority: payload.priority,
    });
    const taskId = data.task_id ?? data.id;
    const task = this.normalizeHubTask({
      ...data,
      id: taskId,
      title: payload.title,
      type: payload.type,
      priority: payload.priority,
      input: payload.inputs?.query ?? payload.inputs?.input ?? payload.title ?? '',
    });
    return { task, status: task.status };
  }

  async claimTask(payload: TaskClaimPayload): Promise<TaskClaimResponse> {
    return this.request<TaskClaimResponse>('POST', '/tasks/claim', payload);
  }

  async assignTask(taskId: string, nodeId: string): Promise<any> {
    return this.request('POST', `/tasks/${taskId}/assign`, { node_id: nodeId });
  }

  async completeTask(taskId: string, payload: TaskCompletePayload): Promise<TaskCompleteResponse> {
    return this.request<TaskCompleteResponse>('POST', `/tasks/${taskId}/complete`, payload);
  }

  async getTaskStatus(taskId: string): Promise<Status> {
    const task = await this.request<any>('GET', `/tasks/${taskId}`);
    return this.normalizeHubTask(task).status;
  }

  async getTaskResult(taskId: string): Promise<Result> {
    const task = await this.request<any>('GET', `/tasks/${taskId}`);
    return this.normalizeHubResult(task);
  }

  async cancelTask(taskId: string, reason?: string): Promise<Status> {
    return this.request<Status>('POST', `/tasks/${taskId}/cancel`, { reason });
  }

  async retryTask(taskId: string, reason?: string): Promise<Status> {
    return this.request<Status>('POST', `/tasks/${taskId}/retry`, { reason });
  }

  async rerunTask(taskId: string): Promise<TaskSubmitResponse> {
    return this.request<TaskSubmitResponse>('POST', `/tasks/${taskId}/rerun`);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>('DELETE', `/tasks/${taskId}`);
  }

  // --- Stage M7B: Collaboration ---

  async listCollabRooms(taskId?: string): Promise<CollabRoomsResponse> {
    const path = taskId ? `/collab/rooms?task_id=${encodeURIComponent(taskId)}` : '/collab/rooms';
    const data = await this.request<any>('GET', path);
    return Array.isArray(data) ? { rooms: data } : { rooms: data?.rooms ?? [] };
  }

  async createCollabRoom(payload: { title: string; task_id?: string | null; participants?: string[]; metadata?: Record<string, unknown> }): Promise<CollabRoom> {
    return this.request<CollabRoom>('POST', '/collab/rooms', payload);
  }

  async deleteCollabRoom(roomId: string): Promise<void> {
    await this.request<void>('DELETE', `/collab/rooms/${encodeURIComponent(roomId)}`);
  }

  async listCollabMessages(roomId: string): Promise<CollabMessagesResponse> {
    return this.request<CollabMessagesResponse>('GET', `/collab/rooms/${encodeURIComponent(roomId)}/messages`);
  }

  async sendCollabMessage(roomId: string, payload: { author: string; content: string; task_id?: string | null; reply_to?: string | null; metadata?: Record<string, unknown> }): Promise<CollabMessage> {
    return this.request<CollabMessage>('POST', `/collab/rooms/${encodeURIComponent(roomId)}/messages`, payload);
  }

  async getRoomOverview(roomId: string): Promise<RoomOverview> {
    return this.request<RoomOverview>('GET', `/rooms/${encodeURIComponent(roomId)}/overview`);
  }

  async sendRoomCommand(roomId: string, payload: { type: string; input?: string; text?: string; actor?: string; task_id?: string; reason?: string; worker_id?: string; assign_to?: string; required_capabilities?: string[] }): Promise<RoomCommandResponse> {
    return this.request<RoomCommandResponse>('POST', `/rooms/${encodeURIComponent(roomId)}/commands`, payload);
  }


  async listWorkers(): Promise<WorkerItem[]> {
    const data = await this.request<any>('GET', '/workers');
    return Array.isArray(data) ? data : data?.workers ?? [];
  }

  async startWorker(workerId: string): Promise<any> {
    return this.request('POST', `/workers/${encodeURIComponent(workerId)}/start`);
  }

  async stopWorker(workerId: string): Promise<any> {
    return this.request('POST', `/workers/${encodeURIComponent(workerId)}/stop`);
  }

  async restartWorker(workerId: string): Promise<any> {
    return this.request('POST', `/workers/${encodeURIComponent(workerId)}/restart`);
  }

  async tailWorkerLogs(workerId: string, lines = 200): Promise<any> {
    return this.request('POST', `/workers/${encodeURIComponent(workerId)}/logs/tail`, { lines });
  }

  async listPipelines(): Promise<PipelineItem[]> {
    const data = await this.request<any>('GET', '/pipelines');
    return Array.isArray(data) ? data : data?.pipelines ?? [];
  }

  async getPipeline(pipelineId: string): Promise<PipelineItem> {
    return this.request<PipelineItem>('GET', `/pipelines/${encodeURIComponent(pipelineId)}`);
  }

  async getTaskTrace(taskId: string): Promise<TraceResponse> {
    return this.request<TraceResponse>('GET', `/tasks/${encodeURIComponent(taskId)}/trace`);
  }

  async getRoomTrace(roomId: string): Promise<TraceResponse> {
    return this.request<TraceResponse>('GET', `/rooms/${encodeURIComponent(roomId)}/trace`);
  }

  async getTaskWaterfall(taskId: string): Promise<any> {
    return this.request<any>('GET', `/tasks/${encodeURIComponent(taskId)}/waterfall`);
  }

  async getPrometheusMetrics(): Promise<string> {
    return this.request<string>('GET', '/metrics/prometheus', undefined, { expectText: true });
  }

  async repairStuckTasks(payload: { max_age_seconds?: number; action?: 'fail' | 'abort' | 'requeue' } = {}): Promise<RepairStuckTasksResponse> {
    return this.request<RepairStuckTasksResponse>('POST', '/ops/repair-stuck-tasks', payload);
  }

  // Pairings endpoints
  async listPairings(state?: string): Promise<PairingListResponse> {
    const path = state ? `/pairings?state=${encodeURIComponent(state)}` : '/pairings';
    const data = await this.request<any>('GET', path);
    return Array.isArray(data) ? data : data?.pairings ?? [];
  }

  async requestPairing(payload: PairingRequestPayload): Promise<Pairing> {
    return this.request<Pairing>('POST', '/pairings/request', payload);
  }

  async approvePairing(pairingId: string, payload?: PairingApproveRejectPayload): Promise<PairingApproveResponse> {
    return this.request<PairingApproveResponse>('POST', `/pairings/${pairingId}/approve`, payload || {});
  }

  async rejectPairing(pairingId: string, payload?: PairingApproveRejectPayload): Promise<PairingRejectResponse> {
    return this.request<PairingRejectResponse>('POST', `/pairings/${pairingId}/reject`, payload || {});
  }

  async listServices(): Promise<ManagedService[]> {
    return this.request<ManagedService[]>('GET', '/services');
  }

  async serviceAction(serviceId: string, action: 'start' | 'stop' | 'restart'): Promise<ServiceActionResponse> {
    return this.request<ServiceActionResponse>('POST', `/services/${serviceId}/${action}`);
  }

  async getServiceLogs(serviceId: string, limit = 200): Promise<ServiceLogsResponse> {
    return this.request<ServiceLogsResponse>('GET', `/services/${serviceId}/logs?limit=${limit}`);
  }

  // --- Stage B: Observability ---

  async getTaskEvents(taskId: string): Promise<TaskEventsResponse> {
    return this.request<TaskEventsResponse>('GET', `/tasks/${taskId}/events`);
  }

  async getTaskLogs(taskId: string, limit = 100): Promise<TaskLogsResponse> {
    return this.request<TaskLogsResponse>('GET', `/tasks/${taskId}/logs?limit=${limit}`);
  }

  // --- Stage C: Tools Lab v2 ---

  async listTools(): Promise<ToolListResponse> {
    return this.request<ToolListResponse>('GET', '/tools');
  }

  async getToolSchema(toolName: string): Promise<ToolSchema> {
    return this.request<ToolSchema>('GET', `/tools/${encodeURIComponent(toolName)}/schema`);
  }

  async runTool(toolName: string, params: Record<string, unknown>): Promise<ToolRunResult> {
    return this.request<ToolRunResult>('POST', `/tools/${encodeURIComponent(toolName)}/run`, { params });
  }

  // Metrics endpoint (returns text)
  async getMetrics(): Promise<string> {
    return this.request<string>('GET', '/metrics', undefined, { expectText: true });
  }

  // --- Workbench bridge (GA-Claw compatible) ---
  async listApprovals(): Promise<ApprovalItem[]> {
    const data = await this.request<any>('GET', '/approvals');
    return Array.isArray(data) ? data : data?.approvals ?? [];
  }

  async decideApproval(approvalId: string, decision: 'approve' | 'reject', reason?: string): Promise<ApprovalItem> {
    return this.request<ApprovalItem>('POST', `/approvals/${encodeURIComponent(approvalId)}/${decision}`, { reason });
  }

  async listWorkspaces(): Promise<WorkspaceItem[]> {
    const data = await this.request<any>('GET', '/workspaces');
    return Array.isArray(data) ? data : data?.workspaces ?? [];
  }

  async listArtifacts(workspaceId?: string): Promise<ArtifactItem[]> {
    const path = workspaceId ? `/artifacts?workspace_id=${encodeURIComponent(workspaceId)}` : '/artifacts';
    const data = await this.request<any>('GET', path);
    return Array.isArray(data) ? data : data?.artifacts ?? [];
  }

  async listToolLeases(): Promise<ToolLeaseItem[]> {
    const data = await this.request<any>('GET', '/tool-leases');
    return Array.isArray(data) ? data : data?.leases ?? data?.tool_leases ?? [];
  }

  async listTimeline(roomId?: string, taskId?: string): Promise<TimelineEvent[]> {
    const q = new URLSearchParams();
    if (roomId) q.set('room_id', roomId);
    if (taskId) q.set('task_id', taskId);
    const path = q.toString() ? `/timeline?${q.toString()}` : '/timeline';
    const data = await this.request<any>('GET', path);
    return Array.isArray(data) ? data : data?.events ?? data?.timeline ?? [];
  }
}

// Factory function for convenience
export function createGAGoClient(config: { baseUrl: string; token?: string | null }): GAGoClient {
  return new GAGoClient(config);
}

export function createWorkbenchClient(config: { baseUrl: string; token?: string | null }): GAGoClient {
  return new GAGoClient(config);
}
