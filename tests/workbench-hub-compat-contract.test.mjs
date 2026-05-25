import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../src/app/api/hub/[...path]/route.ts', import.meta.url), 'utf8');
const healthRoute = readFileSync(new URL('../src/app/api/health/route.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/gago-client.ts', import.meta.url), 'utf8');
const taskDetail = readFileSync(new URL('../src/components/task-detail-enhancements.tsx', import.meta.url), 'utf8');

test('workbench defaults to relative GA-Claw Hub proxy, not MSYS-mangled env path', () => {
  assert.match(page, /normalizeWorkbenchBaseUrl/);
  assert.match(page, /const DEFAULT_BASE_URL = normalizeWorkbenchBaseUrl\(process\.env\.NEXT_PUBLIC_GAGO_API_BASE_URL\)/);
  assert.match(page, /\^\[A-Za-z\]:\.\*\\\/api\\\/\(hub\|gago\)\$/);
  assert.doesNotMatch(page, /http:\/\/127\.0\.0\.1:8765/);
});

test('hub proxy normalizes GA-Go workbench paths to GA-Claw Hub v1 paths', () => {
  assert.match(proxy, /function normalizeHubPath/);
  assert.match(proxy, /pathname === ['"]\/tasks\/submit['"].*return ['"]\/api\/v1\/tasks['"]/s);
  assert.match(proxy, /pathname === ['"]\/pairings['"].*pairings.*count/s);
  assert.match(proxy, /pathname === ['"]\/collab\/rooms['"].*rooms/s);
});

test('client normalizes GA-Claw Hub task list and submit responses for Workbench UI', () => {
  assert.match(client, /normalizeHubTask/);
  assert.match(client, /const taskId = task\.task_id \?\? task\.id/);
  assert.match(client, /task_id:\s*taskId/);
  assert.match(client, /this\.toWorkbenchTaskState\(task\.status/);
  assert.match(client, /input:\s*payload\.inputs\?\.query/);
  assert.match(client, /return \{ task, status: task\.status \}/);
});

test('proxy soft-falls back task detail subresources absent from GA-Claw Hub', () => {
  assert.match(proxy, /\\\/tasks\\\/\[\^\/\]\+\\\/evidence/);
  assert.match(proxy, /\\\/tasks\\\/\[\^\/\]\+\\\/events/);
  assert.match(proxy, /\\\/tasks\\\/\[\^\/\]\+\\\/logs/);
  assert.match(proxy, /files:\s*\[\]/);
  assert.match(proxy, /events:\s*\[\]/);
  assert.match(proxy, /logs:\s*\[\]/);
});

test('workbench health route probes GA-Claw Hub v1 health instead of legacy GA-Go tasks path', () => {
  assert.match(healthRoute, /GA_CLAW_HUB_URL/);
  assert.match(healthRoute, /\/api\/v1\/health/);
  assert.doesNotMatch(healthRoute, /\$\{GA_CLAW_HUB_URL\}\/tasks\?limit=1/);
});

test('workbench tool leases use real GA-Claw Hub route and accept wrapped lease lists', () => {
  assert.doesNotMatch(proxy, /pathname === ['"]\/tool-leases['"].*NextResponse\.json\(\[\]\)/s);
  assert.match(client, /async listToolLeases\(\): Promise<ToolLeaseItem\[\]>/);
  assert.match(client, /data\?\.leases \?\? data\?\.tool_leases \?\? \[\]/);
  assert.match(client, /\/tool-leases/);
});

test('workbench M33 policy governance types expose lifecycle and redacted summaries', () => {
  const types = readFileSync(new URL('../src/lib/gago-types.ts', import.meta.url), 'utf8');
  assert.match(types, /policy_reason\?: string \| null/);
  assert.match(types, /input_summary\?: string \| null/);
  assert.match(types, /output_summary\?: string \| null/);
  assert.match(types, /renewed_at\?: string \| null/);
  assert.match(types, /revoked_at\?: string \| null/);
  assert.match(types, /export interface ToolInvocationItem/);
  assert.match(types, /tool_invocations: ToolInvocationItem\[\]/);
});

test('workbench avoids placeholder undefined and NO_STATUS demo labels', () => {
  assert.doesNotMatch(page, /\$\{health\.service\} \$\{health\.version\}/);
  assert.match(page, /formatHealthDescription/);
  assert.doesNotMatch(taskDetail, /NO_STATUS|NO_VERDICT/);
  assert.match(taskDetail, /等待状态/);
  assert.match(taskDetail, /等待结果/);
});


test('room workbench v2 uses Hub overview and command endpoints', () => {
  assert.match(client, /async getRoomOverview\(roomId: string\): Promise<RoomOverview>/);
  assert.match(client, /`\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/overview`/);
  assert.match(client, /async sendRoomCommand\(roomId: string, payload:/);
  assert.match(client, /`\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/commands`/);
  assert.match(page, /Room Workbench v2/);
  assert.match(page, /getRoomOverview\(selectedRoomId\)/);
  assert.match(page, /sendRoomCommand\(selectedRoomId/);
  assert.match(page, /task.cancel|worker.nudge|comment.add/);
});


test('workbench M31 remote node/worker contract uses real Hub worker and node fields', () => {
  const types = readFileSync(new URL('../src/lib/gago-types.ts', import.meta.url), 'utf8');
  assert.match(types, /disk_free_mb\?: number/);
  assert.match(types, /running_workers\?: number/);
  assert.match(types, /export interface WorkerItem/);
  assert.match(types, /node_selector\?: Record<string, string>/);
  assert.match(client, /async listWorkers\(\): Promise<WorkerItem\[\]>/);
  assert.match(client, /\/workers/);
  assert.match(client, /\/workers\/\$\{encodeURIComponent\(workerId\)\}\/logs\/tail/);
});

test('workbench M34 pipeline DAG contract exposes dependencies and failure policies', () => {
  const types = readFileSync(new URL('../src/lib/gago-types.ts', import.meta.url), 'utf8');
  assert.match(types, /export interface PipelineStepItem/);
  assert.match(types, /depends_on\?: number\[\]/);
  assert.match(types, /on_failure\?:/);
  assert.match(types, /fallback_step\?: number/);
  assert.match(client, /async listPipelines\(\): Promise<PipelineItem\[\]>/);
  assert.match(client, /`\/pipelines\/\$\{encodeURIComponent\(pipelineId\)\}`/);
});

test('workbench M35 trace and ops contract uses real trace metrics repair endpoints', () => {
  const types = readFileSync(new URL('../src/lib/gago-types.ts', import.meta.url), 'utf8');
  assert.match(types, /export interface TraceResponse/);
  assert.match(types, /export interface RepairStuckTasksResponse/);
  assert.match(client, /async getTaskTrace\(taskId: string\): Promise<TraceResponse>/);
  assert.match(client, /\/tasks\/\$\{encodeURIComponent\(taskId\)\}\/trace/);
  assert.match(client, /\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/trace/);
  assert.match(client, /\/metrics\/prometheus/);
  assert.match(client, /\/ops\/repair-stuck-tasks/);
});


test('workbench HiClaw parity visual surfaces are wired to real trace DAG node and repair actions', () => {
  const opsPage = readFileSync(new URL('../src/app/ops/page.tsx', import.meta.url), 'utf8');
  const roomsPage = readFileSync(new URL('../src/app/rooms/page.tsx', import.meta.url), 'utf8');
  const workersPage = readFileSync(new URL('../src/app/workers/page.tsx', import.meta.url), 'utf8');
  assert.match(client, /getTaskWaterfall/);
  assert.match(client, /repairStuckTasks/);
  assert.match(client, /tailWorkerLogs/);
  assert.match(client, /getPipeline/);
  assert.match(opsPage + roomsPage + workersPage + page, /trace|waterfall|Repair|repair|pipeline|DAG|worker|node|logs/i);
});
