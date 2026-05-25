"use client";

import React from "react";
import { FileText, AlertTriangle, Info, Bug } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskLogEntry } from "@/lib/gago-types";

const levelStyles: Record<string, { icon: React.ReactNode; textClass: string }> = {
  error: { icon: <AlertTriangle className="size-3.5 text-red-500" />, textClass: "text-red-700 bg-red-50" },
  warn: { icon: <AlertTriangle className="size-3.5 text-amber-500" />, textClass: "text-amber-700 bg-amber-50" },
  warning: { icon: <AlertTriangle className="size-3.5 text-amber-500" />, textClass: "text-amber-700 bg-amber-50" },
  info: { icon: <Info className="size-3.5 text-blue-500" />, textClass: "text-slate-700 bg-slate-50" },
  debug: { icon: <Bug className="size-3.5 text-slate-400" />, textClass: "text-slate-500 bg-slate-50" },
};

function formatTs(ts: string): string {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts || "-";
    return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts || "-";
  }
}

interface TaskLogPanelProps {
  logs: TaskLogEntry[];
  loading?: boolean;
}

export function TaskLogPanel({ logs, loading }: TaskLogPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> 任务日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-3 animate-pulse rounded-full bg-slate-300" /> 加载中…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> 任务日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无日志</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" /> 任务日志
          <span className="ml-auto text-xs font-normal text-muted-foreground">{logs.length} 条</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border bg-slate-950 p-3 font-mono text-xs">
          {logs.map((log, idx) => {
            const style = levelStyles[log.level?.toLowerCase()] || levelStyles.info;
            return (
              <div key={`${log.ts}-${idx}`} className="flex items-start gap-2">
                <span className="shrink-0 text-slate-500">{formatTs(log.ts)}</span>
                <span className="shrink-0">{style.icon}</span>
                <span className={`inline-block rounded px-1 ${style.textClass}`}>
                  {log.message}
                </span>
                {log.source && <span className="ml-auto shrink-0 text-slate-600">[{log.source}]</span>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
