import { NextResponse } from "next/server";

/**
 * GET /api/health — 系统健康检查 + 告警
 * 检查: GA-Go API 连通性、内存使用、运行时间
 */

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "critical";
  message: string;
  value?: number;
  threshold?: number;
}

const GA_GO_API = process.env.GAGO_API_URL || "http://127.0.0.1:8765";

async function checkGaGoApi(): Promise<HealthCheck> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${GA_GO_API}/tasks?limit=1`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) return { name: "GA-Go API", status: "ok", message: "Connected" };
    return { name: "GA-Go API", status: "warn", message: `HTTP ${res.status}` };
  } catch (e) {
    return { name: "GA-Go API", status: "critical", message: `Unreachable: ${(e as Error).message}` };
  }
}

function checkMemory(): HealthCheck {
  const used = process.memoryUsage();
  const heapMB = Math.round(used.heapUsed / 1024 / 1024);
  const threshold = 512;
  return {
    name: "UI Memory",
    status: heapMB > threshold ? "warn" : "ok",
    message: `Heap: ${heapMB}MB`,
    value: heapMB,
    threshold,
  };
}

function checkUptime(): HealthCheck {
  const uptimeSec = process.uptime();
  const hours = Math.round(uptimeSec / 3600 * 10) / 10;
  return {
    name: "Uptime",
    status: "ok",
    message: `${hours}h`,
    value: uptimeSec,
  };
}

export async function GET() {
  const checks = await Promise.all([
    checkGaGoApi(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkUptime()),
  ]);

  const overallStatus = checks.some((c) => c.status === "critical")
    ? "critical"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}
