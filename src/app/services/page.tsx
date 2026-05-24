"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowLeft, FileText, Play, Power, RefreshCw, RotateCcw, Server, Square } from "lucide-react";

import { createGAGoClient } from "@/lib/gago-client";
import { ManagedService } from "@/lib/gago-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ServicesPage() {
  const [services, setServices] = React.useState<ManagedService[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<{ id: string; action: string } | null>(null);

  const client = React.useMemo(() => createGAGoClient({ baseUrl: "/api" }), []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await client.listServices();
      setServices(list);
    } catch (e) {
      console.error("Failed to load services", e);
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const loadLogs = React.useCallback(async (serviceId: string) => {
    setLogsLoading(true);
    try {
      const res = await client.getServiceLogs(serviceId, 200);
      const allLines = res.logs.flatMap(entry => [`# ${entry.path}`, ...entry.content.split('\n')]);
      setLogs(allLines);
    } catch {
      setLogs(["(无法加载日志)"]);
    } finally {
      setLogsLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    if (selectedId) void loadLogs(selectedId);
  }, [selectedId, loadLogs]);

  async function doAction(serviceId: string, action: "start" | "stop" | "restart") {
    // Dangerous actions need confirmation
    if ((action === "stop" || action === "restart") && !confirmAction) {
      setConfirmAction({ id: serviceId, action });
      return;
    }
    setConfirmAction(null);
    setActionLoading(`${serviceId}-${action}`);
    try {
      await client.serviceAction(serviceId, action);
      await refresh();
      if (selectedId === serviceId) void loadLogs(serviceId);
    } catch (e) {
      console.error(`Action ${action} failed`, e);
    } finally {
      setActionLoading(null);
    }
  }

  const selected = services.find(s => s.id === selectedId);

  const stateColor = (state: string) => {
    if (state === "running") return "text-green-600 bg-green-50";
    if (state === "stopped") return "text-red-600 bg-red-50";
    return "text-yellow-600 bg-yellow-50";
  };

  const stateIcon = (state: string) => {
    if (state === "running") return <Activity className="h-4 w-4 text-green-500" />;
    if (state === "stopped") return <Square className="h-4 w-4 text-red-500" />;
    return <Power className="h-4 w-4 text-yellow-500" />;
  };

  const runningCount = services.filter(s => s.state === "running").length;
  const stoppedCount = services.filter(s => s.state === "stopped").length;
  const unknownCount = services.filter(s => s.state !== "running" && s.state !== "stopped").length;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link href="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <Server className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">GA-Claw Service Ops</h1>
              <p className="text-sm text-muted-foreground">运行服务 / 重启 / 日志 / 健康视图</p>
            </div>
          </div>
          <Button onClick={() => void refresh()} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-green-600">{runningCount}</div><div className="text-xs text-muted-foreground">运行中</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{stoppedCount}</div><div className="text-xs text-muted-foreground">已停止</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-yellow-600">{unknownCount}</div><div className="text-xs text-muted-foreground">未知</div></CardContent></Card>
        </div>

        {/* Confirmation dialog */}
        {confirmAction && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="flex items-center justify-between pt-4">
              <span className="text-sm font-medium text-orange-800">
                确认对 <strong>{confirmAction.id}</strong> 执行 <strong>{confirmAction.action}</strong>？此操作可能影响服务可用性。
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => void doAction(confirmAction.id, confirmAction.action as "stop" | "restart")}>确认执行</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Service list */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">服务列表</CardTitle>
              <CardDescription>{services.length} 个已注册服务</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[500px] space-y-2 overflow-y-auto">
              {loading && services.length === 0 && <div className="text-sm text-muted-foreground">加载中...</div>}
              {!loading && services.length === 0 && <div className="text-sm text-muted-foreground">暂无注册服务</div>}
              {services.map(svc => (
                <div
                  key={svc.id}
                  onClick={() => setSelectedId(svc.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent ${selectedId === svc.id ? "border-primary bg-accent" : ""}`}
                >
                  {stateIcon(svc.state)}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{svc.name}</div>
                    <div className="text-xs text-muted-foreground">{svc.kind}{svc.pid ? ` · PID ${svc.pid}` : ""}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateColor(svc.state)}`}>{svc.state}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Detail + Logs */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selected ? selected.name : "服务详情"}</CardTitle>
              {selected && <CardDescription>{selected.description || selected.kind}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  {/* Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">ID：</span>{selected.id}</div>
                    <div><span className="text-muted-foreground">类型：</span>{selected.kind}</div>
                    <div><span className="text-muted-foreground">状态：</span><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${stateColor(selected.state)}`}>{selected.state}</span></div>
                    <div><span className="text-muted-foreground">PID：</span>{selected.pid ?? "-"}</div>
                    <div><span className="text-muted-foreground">匹配：</span>{selected.match || "-"}</div>
                    <div><span className="text-muted-foreground">最后检查：</span>{selected.last_checked ? new Date(selected.last_checked * 1000).toLocaleString() : "-"}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {selected.actions.includes("start") && (
                      <Button size="sm" variant="default" disabled={actionLoading !== null} onClick={() => void doAction(selected.id, "start")}>
                        <Play className="mr-1 h-3 w-3" />启动
                      </Button>
                    )}
                    {selected.actions.includes("restart") && (
                      <Button size="sm" variant="secondary" disabled={actionLoading !== null} onClick={() => void doAction(selected.id, "restart")}>
                        <RotateCcw className="mr-1 h-3 w-3" />重启
                      </Button>
                    )}
                    {selected.actions.includes("stop") && (
                      <Button size="sm" variant="destructive" disabled={actionLoading !== null} onClick={() => void doAction(selected.id, "stop")}>
                        <Square className="mr-1 h-3 w-3" />停止
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => void loadLogs(selected.id)} disabled={logsLoading}>
                      <FileText className="mr-1 h-3 w-3" />刷新日志
                    </Button>
                  </div>

                  {/* Logs */}
                  <div>
                    <h4 className="mb-2 text-sm font-medium">最近日志</h4>
                    <div className="max-h-[300px] overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-200">
                      {logsLoading && <div className="text-slate-400">加载中...</div>}
                      {!logsLoading && logs.length === 0 && <div className="text-slate-400">(空)</div>}
                      {!logsLoading && logs.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">选择一个服务查看详情、执行操作或查看日志。</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
