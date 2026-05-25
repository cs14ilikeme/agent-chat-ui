"use client";

import React from "react";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "critical";
  message: string;
  value?: number;
  threshold?: number;
}

interface HealthResponse {
  status: "ok" | "warn" | "critical";
  timestamp: string;
  checks: HealthCheck[];
}

const statusIcon = {
  ok: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  critical: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  ok: { text: "正常", cls: "bg-green-50 text-green-700 border-green-200" },
  warn: { text: "警告", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  critical: { text: "异常", cls: "bg-red-50 text-red-700 border-red-200" },
};

export function MonitorAlertPanel() {
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchHealth = React.useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  React.useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          监控告警
          {health && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusLabel[health.status].cls}`}>
              {statusLabel[health.status].text}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-red-500 mb-2">健康检查失败: {error}</div>
        )}
        {health ? (
          <div className="space-y-2">
            {health.checks.map((check) => (
              <div key={check.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {statusIcon[check.status]}
                  <span>{check.name}</span>
                </div>
                <span className="text-muted-foreground">{check.message}</span>
              </div>
            ))}
            <div className="text-xs text-muted-foreground pt-1 border-t">
              上次检查: {new Date(health.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : !error ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
