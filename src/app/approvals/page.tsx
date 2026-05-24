"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck, SquareX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createGaClawClient } from "@/lib/hub-client";
import type { ApprovalItem } from "@/lib/hub-types";

const DEFAULT_BASE_URL = "/api/hub";
const DEFAULT_TOKEN = process.env.NEXT_PUBLIC_GAGO_AUTH_TOKEN?.trim() || "";

export default function ApprovalsPage() {
  const client = React.useMemo(() => createGaClawClient({ baseUrl: DEFAULT_BASE_URL, token: DEFAULT_TOKEN || null }), []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [approvals, setApprovals] = React.useState<ApprovalItem[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.listApprovals();
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  async function decide(id: string, decision: "approve" | "reject") {
    try {
      await client.decideApproval(id, decision, decision === "reject" ? "rejected from UI" : undefined);
      setNotice(`${id}: ${decision}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const pending = approvals.filter(a => a.status === "pending");
  const approved = approvals.filter(a => a.status === "approved");
  const rejected = approvals.filter(a => a.status === "rejected");

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link href="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">审批中心 | Approvals</h1>
              <p className="text-sm text-muted-foreground">工具调用审批、权限决策</p>
            </div>
          </div>
          <Button onClick={() => void refresh()} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-amber-600">{pending.length}</div><div className="text-xs text-muted-foreground">待审批</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-emerald-600">{approved.length}</div><div className="text-xs text-muted-foreground">已批准</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{rejected.length}</div><div className="text-xs text-muted-foreground">已拒绝</div></CardContent></Card>
        </div>

        {(error || notice) && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>
        )}

        {approvals.length === 0 && !loading && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">暂无审批项</CardContent></Card>
        )}

        <div className="space-y-3">
          {approvals.map(item => (
            <div key={item.approval_id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.title || item.approval_id}</span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      item.status === "pending" ? "border-amber-300 bg-amber-50 text-amber-700" :
                      item.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-700" :
                      "border-red-300 bg-red-50 text-red-700"
                    }`}>{item.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.approval_id} · task {item.task_id || "-"} · room {item.room_id || "-"}
                    {item.payload?.tool_name ? ` · tool: ${item.payload.tool_name}` : ""}
                  </div>
                  {item.reason && <div className="mt-2 text-sm text-slate-600">{item.reason}</div>}
                </div>
                {item.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void decide(item.approval_id, "approve")}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />批准
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void decide(item.approval_id, "reject")}>
                      <SquareX className="mr-1 h-3 w-3" />拒绝
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
