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
} from './gago-types';

export class GAGoClient {
  private baseUrl: string;
  private token: string | null;

  constructor(config: { baseUrl: string; token?: string | null }) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token ?? null;
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
      throw new Error(`GA-Go API error (${response.status}): ${errorMessage}`);
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
    return this.request<NodeListResponse>('GET', '/nodes');
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
    return this.request<TaskListResponse>('GET', path);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>('GET', `/tasks/${taskId}`);
  }

  async submitTask(payload: TaskSubmitPayload): Promise<TaskSubmitResponse> {
    return this.request<TaskSubmitResponse>('POST', '/tasks/submit', payload);
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
    return this.request<Status>('GET', `/tasks/${taskId}/status`);
  }

  async getTaskResult(taskId: string): Promise<Result> {
    return this.request<Result>('GET', `/tasks/${taskId}/result`);
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

  // Pairings endpoints
  async listPairings(state?: string): Promise<PairingListResponse> {
    const path = state ? `/pairings?state=${encodeURIComponent(state)}` : '/pairings';
    return this.request<PairingListResponse>('GET', path);
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
}

// Factory function for convenience
export function createGAGoClient(config: { baseUrl: string; token?: string | null }): GAGoClient {
  return new GAGoClient(config);
}
