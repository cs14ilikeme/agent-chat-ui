"use client";

import React from "react";
import Link from "next/link";
import { Activity, Bot, CheckCircle2, CircleAlert, CircleDashed, Clock3, GitPullRequestArrow, Play, RefreshCw, RotateCcw, Server, ShieldCheck, SquareX, Trash2 } from "lucide-react";

import { ResultPreviewCard, TaskTimeline } from "@/components/task-detail-enhancements";
import { TaskDagPanel } from "@/components/task-dag";
import { MonitorAlertPanel } from "@/components/monitor-alert-panel";
import { TaskEventTimeline } from "@/components/task-event-timeline";
import { TaskLogPanel } from "@/components/task-log-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTaskStream } from "@/hooks/use-task-stream";
import { createGAGoClient } from "@/lib/gago-client";
import { NodeState, TaskState, type HealthResponse, type Node, type Pairing, type Result, type Status, type Task, type TaskListResponse, type ManagedService, type TaskEvent, type TaskLogEntry } from "@/lib/gago-types";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_GAGO_API_BASE_URL || "http://127.0.0.1:8765";
const DEFAULT_TOKEN = process.env.NEXT_PUBLIC_GAGO_AUTH_TOKEN || "";

const stateTone: Record<string, string> = {
  [TaskState.NEW]: "border-slate-300 bg-slate-50 text-slate-700",
  [TaskState.QUEUED]: "border-blue-300 bg-blue-50 text-blue-700",
  [TaskState.DISPATCHED]: "border-cyan-300 bg-cyan-50 text-cyan-700",
  [TaskState.RUNNING]: "border-emerald-300 bg-emerald-50 text-emerald-700",
  [TaskState.BLOCKED]: "border-amber-300 bg-amber-50 text-amber-700",
  [TaskState.VERIFYING]: "border-violet-300 bg-violet-50 text-violet-700",
  [TaskState.DONE]: "border-green-300 bg-green-50 text-green-700",
  [TaskState.FAILED]: "border-red-300 bg-red-50 text-red-700",
  [TaskState.RETRYING]: "border-orange-300 bg-orange-50 text-orange-700",
  [TaskState.CANCELED]: "border-zinc-300 bg-zinc-50 text-zinc-700",
  [NodeState.IDLE]: "border-emerald-300 bg-emerald-50 text-emerald-700",
  [NodeState.BUSY]: "border-blue-300 bg-blue-50 text-blue-700",
  [NodeState.DEGRADED]: "border-amber-300 bg-amber-50 text-amber-700",
  [NodeState.DRAINING]: "border-orange-300 bg-orange-50 text-orange-700",
  [NodeState.OFFLINE]: "border-red-300 bg-red-50 text-red-700",
  [NodeState.REGISTERED]: "border-sky-300 bg-sky-50 text-sky-700",
};

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone || "border-slate-200 bg-white text-slate-600"}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint: string }) {
  return (
    <Card className="gap-3 py-5">
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="size-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function safeJson(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON must be an object");
  return parsed as Record<string, unknown>;
}

export default function GAGoDashboard(): React.ReactNode {
  const [baseUrl, setBaseUrl] = React.useState(DEFAULT_BASE_URL);
  const [token, setToken] = React.useState(DEFAULT_TOKEN);
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [tasks, setTasks] = React.useState<TaskListResponse>([]);
  const [pairings, setPairings] = React.useState<Pairing[]>([]);
  const [metrics, setMetrics] = React.useState("");
  const [services, setServices] = React.useState<ManagedService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | null>(null);
  const [serviceLogs, setServiceLogs] = React.useState<Record<string, string>>( {} );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskType, setNewTaskType] = React.useState("grok_search");
  const [newTaskInputs, setNewTaskInputs] = React.useState("");
  const [nodeId, setNodeId] = React.useState("ui-worker");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [selectedStatus, setSelectedStatus] = React.useState<Status | null>(null);
  const [selectedResult, setSelectedResult] = React.useState<Result | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [taskEvents, setTaskEvents] = React.useState<TaskEvent[]>([]);
  const [taskLogs, setTaskLogs] = React.useState<TaskLogEntry[]>([]);
  const [evidenceFiles, setEvidenceFiles] = React.useState<{ name: string; path: string; content: string; size: number }[]>([]);
  const [eventsLogsLoading, setEventsLogsLoading] = React.useState(false);
  const [taskFilterState, setTaskFilterState] = React.useState<string>("");
  const [taskFilterKeyword, setTaskFilterKeyword] = React.useState<string>("");

  const client = React.useMemo(() => createGAGoClient({ baseUrl, token: token || null }), [baseUrl, token]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextHealth, nextNodes, nextTasks, nextPairings, nextMetrics, nextServices] = await Promise.all([
        client.health(),
        client.listNodes(),
        client.listTasks(),
        client.listPairings(),
        client.getMetrics().catch(() => ""),
        client.listServices().catch(() => []),
      ]);
      setHealth(nextHealth);
      setNodes(nextNodes);
      setTasks(nextTasks);
      if (!selectedTaskId && nextTasks.length > 0) setSelectedTaskId(nextTasks[0].task_id);
      setPairings(nextPairings);
      setMetrics(nextMetrics);
      setServices(nextServices);
      if (!selectedServiceId && nextServices.length > 0) setSelectedServiceId(nextServices[0].id);
      setNotice(`Refreshed ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, selectedTaskId, selectedServiceId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadTaskDetail = React.useCallback(async (taskId: string) => {
    setDetailLoading(true);
    setEventsLogsLoading(true);
    setError(null);
    try {
      const [task, status, result] = await Promise.all([
        client.getTask(taskId),
        client.getTaskStatus(taskId),
        client.getTaskResult(taskId).catch(() => null),
      ]);
      setSelectedTask(task);
      setSelectedStatus(status);
      setSelectedResult(result);
      setSelectedTaskId(taskId);
      // Fetch evidence file contents (best-effort, non-blocking on failure)
      fetch(`/api/gago/tasks/${encodeURIComponent(taskId)}/evidence`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { files: [] }))
        .then((data: { files?: { name: string; path: string; content: string; size: number }[] }) => {
          setEvidenceFiles(Array.isArray(data?.files) ? data.files : []);
        })
        .catch(() => setEvidenceFiles([]));
      // Stage B: fetch events and logs in parallel (non-blocking)
      Promise.all([
        client.getTaskEvents(taskId).catch(() => [] as TaskEvent[]),
        client.getTaskLogs(taskId).catch(() => [] as TaskLogEntry[]),
      ]).then(([rawEvents, rawLogs]) => {
        // API may return {task_id, events: [...]} object or plain array
        const eventsArr: any[] = Array.isArray(rawEvents) ? rawEvents : (rawEvents as any)?.events ?? [];
        const logsArr: any[] = Array.isArray(rawLogs) ? rawLogs : (rawLogs as any)?.entries ?? (rawLogs as any)?.logs ?? [];
        // Normalize event fields: API uses event_type/timestamp, component expects kind/ts/detail
        const normalized: TaskEvent[] = eventsArr.map((e: any) => ({
          ts: e.ts || e.timestamp || '',
          kind: e.kind || e.event_type || 'unknown',
          detail: e.detail || e.message || '',
          meta: e.meta || undefined,
        }));
        const normalizedLogs: TaskLogEntry[] = logsArr.map((l: any) => {
          // Handle structured logs {ts, level, message}
          if (l.ts || l.timestamp || l.message) {
            return {
              ts: l.ts || l.timestamp || '',
              level: l.level || 'info',
              message: l.message || '',
              source: l.source || undefined,
            };
          }
          // Handle file-based logs {path, content} from GA-Go backend
          let ts = '';
          let message = l.content || '';
          let level = 'info';
          const source = l.path ? l.path.split(/[/\\]/).pop() : undefined;
          try {
            const parsed = JSON.parse(l.content);
            ts = parsed.updated_at || parsed.timestamp || parsed.ts || '';
            message = parsed.message || parsed.state || JSON.stringify(parsed, null, 2);
            if (parsed.state === 'FAILED' || parsed.state === 'ERROR') level = 'error';
            else if (parsed.state === 'DONE') level = 'info';
          } catch { /* content is not JSON, use raw */ }
          return { ts, level, message, source };
        });
        setTaskEvents(normalized);
        setTaskLogs(normalizedLogs);
      }).finally(() => setEventsLogsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEventsLogsLoading(false);
    } finally {
      setDetailLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    if (selectedTaskId) void loadTaskDetail(selectedTaskId);
  }, [selectedTaskId, loadTaskDetail]);

  // SSE real-time stream: connect when task is in active state, append events incrementally
  const isActiveState = React.useMemo(() => {
    if (!selectedStatus) return false;
    const terminal: string[] = [TaskState.DONE, TaskState.FAILED, TaskState.CANCELED];
    return !terminal.includes(selectedStatus.state);
  }, [selectedStatus]);

  const stream = useTaskStream(selectedTaskId, {
    enabled: isActiveState,
    onEvent: React.useCallback((evt: { type: string; timestamp?: string; [k: string]: unknown }) => {
      // Map SSE event to TaskEvent shape {ts, kind, detail, meta?}
      const normalized: TaskEvent = {
        ts: (evt.timestamp as string) ?? new Date().toISOString(),
        kind: evt.type,
        detail: (evt.detail as string) ?? (evt.message as string) ?? JSON.stringify(evt.data ?? {}),
        meta: (evt.meta as Record<string, unknown>) ?? undefined,
      };
      setTaskEvents((prev) => {
        // Deduplicate by ts+kind
        if (prev.some((e) => e.ts === normalized.ts && e.kind === normalized.kind)) return prev;
        return [...prev, normalized].slice(-500); // cap to last 500
      });
    }, [selectedTaskId]),
    onStatus: React.useCallback((s: unknown) => setSelectedStatus(s as Status), []),
    onResult: React.useCallback((r: unknown) => setSelectedResult(r as Result), []),
    onDone: React.useCallback(() => {
      // Refresh task list and detail when stream signals completion
      if (selectedTaskId) void loadTaskDetail(selectedTaskId);
      void refresh();
    }, [selectedTaskId, loadTaskDetail, refresh]),
  });

  async function runAction(label: string, action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(`${label} succeeded`);
      await refresh();
      if (selectedTaskId) await loadTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadServiceLogs(serviceId: string) {
    setError(null);
    try {
      const response = await client.getServiceLogs(serviceId, 200);
      setSelectedServiceId(serviceId);
      setServiceLogs((current) => ({
        ...current,
        [serviceId]: response.logs.length > 0 ? response.logs.map((entry) => `# ${entry.path}\n${entry.content}`).join("\n\n") : "No configured log file found yet.",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitNewTask() {
    let inputs = safeJson(newTaskInputs);
    // Auto-construct query inputs for grok_search when inputs is empty
    if (newTaskType === "grok_search" && Object.keys(inputs).length === 0 && newTaskTitle.trim()) {
      inputs = { query: newTaskTitle.trim() };
    }
    const response = await client.submitTask({ title: newTaskTitle, type: newTaskType, inputs });
    setSelectedTaskId(response.task.task_id);
  }

  const canCancel = selectedStatus ? ![TaskState.DONE, TaskState.FAILED, TaskState.CANCELED].includes(selectedStatus.state) : false;

  const runningCount = tasks.filter((item) => [TaskState.DISPATCHED, TaskState.RUNNING, TaskState.VERIFYING].includes(item.status.state)).length;
  const doneCount = tasks.filter((item) => item.status.state === TaskState.DONE).length;
  const failedCount = tasks.filter((item) => item.status.state === TaskState.FAILED).length;
  const pendingPairings = pairings.filter((item) => item.state === "PENDING").length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-950">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_32%),linear-gradient(135deg,#020617,#0f172a_55%,#111827)] px-6 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-cyan-100">
              <ShieldCheck className="size-3.5" /> GA-Go Control Plane UI
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">GA-Go 集群控制台</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">基于 agent-chat-ui 二开，已接入 GA-Go HTTP API：节点、任务、配对、指标、任务提交和取消/重试操作。</p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur md:grid-cols-[minmax(260px,1fr)_180px_auto]">
            <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="border-white/20 bg-white/10 text-white placeholder:text-slate-400" placeholder="GA-Go API Base URL" />
            <Input value={token} onChange={(event) => setToken(event.target.value)} className="border-white/20 bg-white/10 text-white placeholder:text-slate-400" placeholder="Bearer token (optional)" type="password" />
            <div className="flex gap-2"><Button asChild variant="secondary"><Link href="/tools">工具调试</Link></Button><Button asChild variant="secondary"><Link href="/workers">Worker监控</Link></Button><Button asChild variant="secondary"><Link href="/services">服务管理</Link></Button><Button asChild variant="secondary"><Link href="/templates">工作台</Link></Button><Button asChild variant="secondary"><Link href="/settings">设置</Link></Button><Button onClick={() => void refresh()} disabled={loading} variant="secondary"><RefreshCw className={loading ? "animate-spin" : ""} />刷新</Button></div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-6 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Server} label="Nodes" value={nodes.length} hint={`${nodes.filter((node) => node.state !== NodeState.OFFLINE).length} online/registered`} />
        <StatCard icon={Activity} label="Active tasks" value={runningCount} hint={`${tasks.length} total tasks`} />
        <StatCard icon={CheckCircle2} label="Done" value={doneCount} hint={`${failedCount} failed`} />
        <StatCard icon={GitPullRequestArrow} label="Pairings" value={pairings.length} hint={`${pendingPairings} pending`} />
        <StatCard icon={CircleDashed} label="Services" value={services.filter((service) => service.state === "running").length} hint={`${services.length} registered`} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          {(error || notice) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="size-5" /> 提交任务</CardTitle>
              <CardDescription>调用 POST /tasks/submit 创建 GA-Go 任务，可附带 JSON inputs。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Task title" />
                <Input value={newTaskType} onChange={(event) => setNewTaskType(event.target.value)} placeholder="type" />
              </div>
              <Textarea value={newTaskInputs} onChange={(event) => setNewTaskInputs(event.target.value)} className="min-h-28 font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runAction("submit task", submitNewTask)} disabled={loading}><Play />提交任务</Button>
                <Input value={nodeId} onChange={(event) => setNodeId(event.target.value)} className="max-w-52" placeholder="node id" />
                <Button variant="outline" onClick={() => void runAction("register node", () => client.registerNode({ node_id: nodeId, cluster_role: "ga_worker", endpoint: `local://${nodeId}` }))} disabled={loading}>注册节点</Button>
                <Button variant="outline" onClick={() => void runAction("claim task", () => client.claimTask({ node_id: nodeId }))} disabled={loading}>领取任务</Button>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Server className="size-5" /> 本机服务</CardTitle>
              <CardDescription>GET /services 状态展示；支持 start/stop/restart 和错误日志 tail。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无服务配置；后端会在 .ga-go/services.json 生成默认白名单</div> : services.map((service) => (
                <div key={service.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{service.name}</span><Badge tone={service.state === "running" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : service.state === "stopped" ? "border-red-300 bg-red-50 text-red-700" : undefined}>{service.state}</Badge>{service.pid && <Badge>pid {service.pid}</Badge>}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{service.id} · {service.match || "no match"}</div>
                      {service.description && <div className="mt-2 text-sm text-slate-600">{service.description}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void runAction(`start ${service.id}`, () => client.serviceAction(service.id, "start"))} disabled={loading || !service.actions.includes("start")}>启动</Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction(`stop ${service.id}`, () => client.serviceAction(service.id, "stop"))} disabled={loading || !service.actions.includes("stop")}>停止</Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction(`restart ${service.id}`, () => client.serviceAction(service.id, "restart"))} disabled={loading || !service.actions.includes("restart")}>重启</Button>
                      <Button size="sm" variant="outline" onClick={() => void loadServiceLogs(service.id)} disabled={loading}>日志</Button>
                    </div>
                  </div>
                  {(selectedServiceId === service.id && serviceLogs[service.id]) && <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{serviceLogs[service.id]}</pre>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>任务队列</CardTitle>
              <CardDescription>GET /tasks；支持取消、重试、重跑、分配给当前 node id。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 筛选栏 */}
              <div className="flex flex-wrap items-center gap-2">
                <select className="rounded-md border px-2 py-1 text-sm" value={taskFilterState} onChange={(e) => setTaskFilterState(e.target.value)}>
                  <option value="">全部状态</option>
                  {Object.values(TaskState).map((s) => <option key={s} value={s}>{{ NEW: "新建", QUEUED: "排队", DISPATCHED: "已派发", RUNNING: "运行中", BLOCKED: "阻塞", VERIFYING: "验证中", DONE: "完成", FAILED: "失败", RETRYING: "重试中", CANCELED: "已取消" }[s as string] || s}</option>)}
                </select>
                <input className="flex-1 rounded-md border px-2 py-1 text-sm" placeholder="搜索标题/ID..." value={taskFilterKeyword} onChange={(e) => setTaskFilterKeyword(e.target.value)} />
              </div>
              {(() => {
                const filtered = tasks.filter((t) => {
                  if (taskFilterState && t.status.state !== taskFilterState) return false;
                  if (taskFilterKeyword) {
                    const kw = taskFilterKeyword.toLowerCase();
                    if (!t.title.toLowerCase().includes(kw) && !t.task_id.toLowerCase().includes(kw) && !t.type.toLowerCase().includes(kw)) return false;
                  }
                  return true;
                });
                if (filtered.length === 0) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂无匹配任务</div>;
                return filtered.map((item) => (
                <div key={item.task_id} className={`rounded-xl border p-4 shadow-sm ${item.status.state === TaskState.FAILED ? "border-red-400 bg-red-50/50 ring-1 ring-red-200" : "bg-white"}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title}</span><Badge tone={stateTone[item.status.state]}>{item.status.state}</Badge><Badge>{item.type}</Badge></div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.task_id} · priority {item.priority} · attempt {item.status.attempt}</div>
                      {item.status.message && <div className="mt-2 text-sm text-slate-600">{item.status.message}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void loadTaskDetail(item.task_id)} disabled={loading || detailLoading}>详情</Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("assign task", () => client.assignTask(item.task_id, nodeId))} disabled={loading}><Play />分配</Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("retry task", () => client.retryTask(item.task_id, "retry from UI"))} disabled={loading}><RotateCcw />重试</Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("rerun task", () => client.rerunTask(item.task_id))} disabled={loading}><RefreshCw />重跑</Button>
                      <Button size="sm" variant="destructive" onClick={() => void runAction("cancel task", () => client.cancelTask(item.task_id, "canceled from UI"))} disabled={loading}><SquareX />取消</Button>
                      <Button size="sm" variant="destructive" onClick={() => { if (confirm("确定删除此任务？")) void runAction("delete task", async () => { await client.deleteTask(item.task_id); await refresh(); }); }} disabled={loading}><Trash2 className="size-4" />删除</Button>
                    </div>
                  </div>
                </div>
              ));
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>任务详情</CardTitle>
              <CardDescription>{selectedTaskId ? `GET /tasks/${selectedTaskId}/status/result` : "选择一个任务查看详情；结果预览与执行时间线会在这里展示"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedTaskId ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂无选中任务</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={selectedStatus ? stateTone[selectedStatus.state] : undefined}>{selectedStatus?.state || "loading"}</Badge>
                    {detailLoading && <Badge>loading</Badge>}
                    {selectedStatus?.node_id && <Badge>{selectedStatus.node_id}</Badge>}
                  </div>
                  <div className="text-sm font-semibold">{selectedTask?.title || selectedTaskId}</div>
                  <div className="text-xs text-muted-foreground">run {selectedStatus?.run_id || "-"} · attempt {selectedStatus?.attempt ?? "-"} · lease {selectedStatus?.lease_until || "-"}</div>
                  {selectedStatus?.message && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selectedStatus.message}</div>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => selectedTaskId && void loadTaskDetail(selectedTaskId)} disabled={!selectedTaskId || detailLoading}>刷新详情</Button>
                    <Button size="sm" variant="destructive" onClick={() => selectedTaskId && void runAction("cancel selected task", () => client.cancelTask(selectedTaskId, "canceled from detail panel"))} disabled={!selectedTaskId || loading || !canCancel}>取消当前任务</Button>
                  </div>
                  {/* 回复内容 - 直接展示 evidence 文件内容 + summary */}
                  {(evidenceFiles.length > 0 || selectedResult?.summary) && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                      <div className="text-sm font-semibold text-emerald-800">📋 回复内容</div>
                      {selectedResult?.summary && (
                        <div className="rounded-md bg-white/60 p-3 text-sm text-slate-800">
                          <div className="mb-1 text-xs font-medium text-slate-500">摘要</div>
                          <div className="whitespace-pre-wrap">{selectedResult.summary}</div>
                        </div>
                      )}
                      {evidenceFiles.map((f) => (
                        <details key={f.path} open className="rounded-md bg-white/80 p-3">
                          <summary className="cursor-pointer text-xs font-medium text-slate-600">
                            📄 {f.name} <span className="text-slate-400">({f.size} bytes)</span>
                          </summary>
                          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-800">{f.content || "(空文件)"}</pre>
                        </details>
                      ))}
                      {evidenceFiles.length === 0 && !selectedResult?.summary && (
                        <div className="text-xs text-slate-500">暂无回复内容</div>
                      )}
                    </div>
                  )}
                  <ResultPreviewCard task={selectedTask} status={selectedStatus} result={selectedResult} />
                  <TaskTimeline task={selectedTask} status={selectedStatus} result={selectedResult} />
                  <TaskEventTimeline events={taskEvents} loading={eventsLogsLoading} />
                  <TaskDagPanel events={taskEvents} />
                  <TaskLogPanel logs={taskLogs} loading={eventsLogsLoading} />
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Raw payload</div>
                    <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify({ task: selectedTask, status: selectedStatus, result: selectedResult }, null, 2)}</pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CircleDashed className="size-5" /> 服务状态</CardTitle>
              <CardDescription>{health ? `${health.service} ${health.version} · ${health.time}` : "Waiting for /health"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><span className="text-sm text-muted-foreground">API</span><Badge tone={health?.ok ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}>{health?.ok ? "healthy" : "unknown"}</Badge></div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{metrics || "metrics unavailable"}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>节点</CardTitle>
              <CardDescription>GET /nodes；支持 heartbeat、drain、remove。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {nodes.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂无节点</div> : nodes.map((node) => (
                <div key={node.node_id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{node.node_id}</span><Badge tone={stateTone[node.state]}>{node.state}</Badge></div>
                      <div className="mt-1 text-xs text-muted-foreground">{node.cluster_role} · {node.endpoint}</div>
                      <div className="mt-2 flex flex-wrap gap-1">{node.capabilities.slice(0, 4).map((cap) => <Badge key={cap}>{cap}</Badge>)}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void runAction("heartbeat", () => client.heartbeatNode(node.node_id, { state: NodeState.IDLE }))} disabled={loading}><Clock3 /></Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("drain", () => client.drainNode(node.node_id, "drain from UI"))} disabled={loading}><CircleAlert /></Button>
                      <Button size="sm" variant="destructive" onClick={() => void runAction("remove", () => client.removeNode(node.node_id))} disabled={loading}><Trash2 /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <MonitorAlertPanel />

          <Card>
            <CardHeader>
              <CardTitle>配对请求</CardTitle>
              <CardDescription>GET /pairings；审批外部 worker 接入。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pairings.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂无配对请求</div> : pairings.map((pairing) => (
                <div key={pairing.pairing_id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="font-semibold">{pairing.node_id}</div><div className="text-xs text-muted-foreground">{pairing.pairing_id} · {pairing.endpoint || "no endpoint"}</div></div>
                    <Badge tone={pairing.state === "APPROVED" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : pairing.state === "REJECTED" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"}>{pairing.state}</Badge>
                  </div>
                  {pairing.state === "PENDING" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void runAction("approve pairing", () => client.approvePairing(pairing.pairing_id))} disabled={loading}>批准</Button><Button size="sm" variant="outline" onClick={() => void runAction("reject pairing", () => client.rejectPairing(pairing.pairing_id, { reason: "rejected from UI" }))} disabled={loading}>拒绝</Button></div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
