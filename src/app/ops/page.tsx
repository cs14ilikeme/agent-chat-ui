"use client";

import * as React from "react";
import { Activity, AlertCircle, BarChart3, CheckCircle2, Clock, Cpu, Heart, Loader2, Server, XCircle } from "lucide-react";

import { createWorkbenchClient } from "@/lib/gago-client";
import { HealthResponse, Node, ApprovalItem, ToolLeaseItem } from "@/lib/gago-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TaskCount {
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
}

export default function OpsPage() {
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([]);
  const [leases, setLeases] = React.useState<ToolLeaseItem[]>([]);
  // Local task counts are computed from a lightweight list
  const [taskCounts, setTaskCounts] = React.useState<TaskCount>({ total: 0, queued: 0, running: 0, done: 0, failed: 0 });
  const [loading, setLoading] = React.useState(true);
  const [metricsText, setMetricsText] = React.useState("");

  const client = React.useMemo(() => createWorkbenchClient({ baseUrl: "/api" }), []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [h, n, a, l, tasks, metrics] = await Promise.all([
        client.health().catch(() => null),
        client.listNodes().catch(() => [] as Node[]),
        client.listApprovals().catch(() => [] as ApprovalItem[]),
        client.listToolLeases().catch(() => [] as ToolLeaseItem[]),
        client.listTasks().catch(() => []),
        client.getMetrics().catch(() => ""),
      ]);
      setHealth(h);
      setNodes(n);
      setApprovals(a);
      setLeases(l);
      setMetricsText(metrics);

      // Compute task counts
      const counts: TaskCount = { total: 0, queued: 0, running: 0, done: 0, failed: 0 };
      for (const t of tasks) {
        counts.total++;
        const s = ((t as any).status?.state || (t as any).status || "").toLowerCase();
        if (s === "queued" || s === "new" || s === "queued") counts.queued++;
        else if (s === "running" || s === "dispatched" || s === "dispatched") counts.running++;
        else if (s === "done" || s === "completed" || s === "done") counts.done++;
        else if (s === "failed" || s === "failed") counts.failed++;
      }
      setTaskCounts(counts);
    } catch (e) {
      console.error("Failed to load ops data", e);
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => { refresh(); const iv = setInterval(refresh, 15000); return () => clearInterval(iv); }, [refresh]);

  const onlineNodes = nodes.filter(n => n.state !== "OFFLINE");
  const healthy = health?.ok ?? false;
  const pendingApprovals = approvals.filter(a => a.status === "pending").length;
  const activeLeases = leases.filter(l => l.state === "active").length;
  const expiredLeases = leases.filter(l => l.state === "expired" || l.state === "revoked").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ops / Monitoring</h1>
          <p className="text-muted-foreground">System health, metrics, and operational status</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={healthy ? "default" : "destructive"} className="text-sm px-3 py-1">
            {healthy ? (
              <><Heart className="h-3.5 w-3.5 mr-1" /> Healthy</>
            ) : (
              <><XCircle className="h-3.5 w-3.5 mr-1" /> Unhealthy</>
            )}
          </Badge>
        </div>
      </div>

      {/* Health & Version */}
      {health && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Service Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Service</span>
                <p className="font-mono font-medium">{health.service}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Version</span>
                <p className="font-mono font-medium">{health.version}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className={healthy ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                  {healthy ? "OK" : "DOWN"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Check</span>
                <p className="font-mono text-xs">{new Date(health.time).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={onlineNodes.length > 0 ? "border-l-4 border-l-green-500" : "border-l-4 border-l-gray-300"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nodes</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineNodes.length}/{nodes.length}</div>
            <p className="text-xs text-muted-foreground">online / total</p>
          </CardContent>
        </Card>

        <Card className={taskCounts.running > 0 ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-gray-300"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskCounts.total}</div>
            <p className="text-xs text-muted-foreground">
              {taskCounts.queued} queued / {taskCounts.running} running / {taskCounts.done} done / {taskCounts.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card className={pendingApprovals > 0 ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-gray-300"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">pending / {approvals.length} total</p>
          </CardContent>
        </Card>

        <Card className={activeLeases > 0 ? "border-l-4 border-l-violet-500" : "border-l-4 border-l-gray-300"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tool Leases</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeases}</div>
            <p className="text-xs text-muted-foreground">active / {expiredLeases} expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Nodes Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5" />
            Nodes
          </CardTitle>
          <CardDescription>{nodes.length} registered nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">State</th>
                  <th className="pb-2 pr-4 font-medium">Capabilities</th>
                  <th className="pb-2 pr-4 font-medium">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.node_id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 pr-4 font-mono text-xs">{n.node_id}</td>
                    <td className="py-2 pr-4">{n.type}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={n.state === "OFFLINE" ? "secondary" : "default"}>
                        {n.state}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {(n.capabilities || []).slice(0, 3).map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                        {(n.capabilities?.length || 0) > 3 && (
                          <span className="text-xs text-muted-foreground">+{(n.capabilities?.length || 0) - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{new Date(n.last_heartbeat).toLocaleString()}</td>
                  </tr>
                ))}
                {nodes.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No nodes registered</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Approvals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Recent Approvals
          </CardTitle>
          <CardDescription>{approvals.length} total decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Requestor</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {approvals.slice(0, 10).map((a) => (
                  <tr key={a.approval_id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 pr-4 font-medium">{a.title}</td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant={
                          a.status === "approved" ? "default" :
                          a.status === "rejected" ? "destructive" :
                          a.status === "pending" ? "secondary" : "outline"
                        }
                      >
                        {a.status === "pending" ? <><Clock className="h-3 w-3 mr-1 inline" /> Pending</> : a.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{a.requestor || "-"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {approvals.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No approvals yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Active Tool Leases */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Tool Leases
          </CardTitle>
          <CardDescription>{leases.length} total leases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Tool</th>
                  <th className="pb-2 pr-4 font-medium">Task</th>
                  <th className="pb-2 pr-4 font-medium">State</th>
                  <th className="pb-2 pr-4 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {leases.slice(0, 10).map((l) => {
                  const expired = l.expires_at && new Date(l.expires_at) < new Date();
                  return (
                    <tr key={l.lease_id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2 pr-4 font-mono">{l.tool_name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{l.task_id || "-"}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={
                            expired || l.state === "expired" ? "secondary" :
                            l.state === "revoked" ? "destructive" :
                            l.state === "active" ? "default" : "outline"
                          }
                        >
                          {expired && l.state === "active" ? "expiring" : l.state}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {l.expires_at ? new Date(l.expires_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  );
                })}
                {leases.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No leases</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Raw Metrics (collapsible) */}
      {metricsText && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Metrics
            </CardTitle>
            <CardDescription>Raw /metrics endpoint output</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
              {metricsText}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
