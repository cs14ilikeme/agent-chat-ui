"use client";

import React from "react";
import { Activity, AlertTriangle, CheckCircle2, CircleDot, Clock3, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskEvent } from "@/lib/gago-types";

const kindIconMap: Record<string, React.ReactNode> = {
  created: <CircleDot className="size-4 text-blue-500" />,
  queued: <Clock3 className="size-4 text-slate-500" />,
  dispatched: <Zap className="size-4 text-amber-500" />,
  running: <Activity className="size-4 text-cyan-500" />,
  completed: <CheckCircle2 className="size-4 text-green-500" />,
  failed: <AlertTriangle className="size-4 text-red-500" />,
  error: <AlertTriangle className="size-4 text-red-500" />,
};

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

interface TaskEventTimelineProps {
  events: TaskEvent[];
  loading?: boolean;
}

export function TaskEventTimeline({ events, loading }: TaskEventTimelineProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" /> 事件时间线
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

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" /> 事件时间线
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无事件</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4" /> 事件时间线
          <span className="ml-auto text-xs font-normal text-muted-foreground">{events.length} 条</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {events.map((event, idx) => (
            <div key={`${event.ts}-${idx}`} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="mt-0.5">{kindIconMap[event.kind] || <CircleDot className="size-4 text-slate-400" />}</div>
                {idx < events.length - 1 && <div className="h-8 w-px bg-slate-200" />}
              </div>
              <div className="min-w-0 pb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-slate-800">{event.kind}</span>
                  <span className="text-xs text-muted-foreground">{formatTs(event.ts)}</span>
                </div>
                <div className="break-all text-xs text-muted-foreground">{event.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
