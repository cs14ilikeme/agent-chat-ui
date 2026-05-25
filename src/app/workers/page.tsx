"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Clock3, Pause, Server, Trash2, Wifi, WifiOff } from "lucide-react";

import { createGaClawClient } from "@/lib/hub-client";
import { Node, NodeState } from "@/lib/hub-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stateTone: Record<string, string> = {
  [NodeState.IDLE]: "border-emerald-300 bg-emerald-50 text-emerald-700",
  [NodeState.BUSY]: "border-blue-300 bg-blue-50 text-blue-700",
  [NodeState.DEGRADED]: "border-amber-300 bg-amber-50 text-amber-700",
  [NodeState.DRAINING]: "border-orange-300 bg-orange-50 text-orange-700",
  [NodeState.OFFLINE]: "border-zinc-300 bg-zinc-50 text-zinc-700",
  [NodeState.REGISTERED]: "border-purple-300 bg-purple-50 text-purple-700",
};

const stateIcon: Record<string, React.ReactNode> = {
  [NodeState.IDLE]: <Wifi className="h-4 w-4 text-emerald-600" />,
  [NodeState.BUSY]: <Activity className="h-4 w-4 text-blue-600" />,
  [NodeState.DEGRADED]: <WifiOff className="h-4 w-4 text-amber-600" />,
  [NodeState.DRAINING]: <Pause className="h-4 w-4 text-orange-600" />,
  [NodeState.OFFLINE]: <WifiOff className="h-4 w-4 text-zinc-500" />,
  [NodeState.REGISTERED]: <Server className="h-4 w-4 text-purple-600" />,
};

export default function WorkersPage() {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);
  const [filterState, setFilterState] = React.useState<string>("");

  const client = React.useMemo(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return createGaClawClient({ baseUrl: params.get("api") || "/api/hub", token: params.get("token") });
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.listNodes();
      setNodes(data);
    } catch (e: any) {
      setError(e.message || "Failed to load nodes");
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 8000); return () => clearInterval(t); }, [refresh]);

  const runAction = async (label: string, fn: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(`${label} 成功`);
      await refresh();
    } catch (e: any) {
      setError(e.message || `${label} 失败`);
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = React.useMemo(() => {
    if (!filterState) return nodes;
    return nodes.filter((n) => n.state === filterState);
  }, [nodes, filterState]);

  const timeSince = (iso: string) => {
    if (!iso) return "N/A";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    return `${Math.round(diff / 3600000)}h ago`;
  };

  const summary = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) { counts[n.state] = (counts[n.state] || 0) + 1; }
    return counts;
  }, [nodes]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-zinc-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <div>
              <h1 className="text-2xl font-bold">GA-Claw Worker Nodes</h1>
              <p className="text-sm text-muted-foreground">节点 / adapter / heartbeat / drain 视图</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>刷新</Button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Card className="text-center">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{nodes.length}</div>
              <div className="text-xs text-muted-foreground">总节点</div>
            </CardContent>
          </Card>
          {Object.entries(summary).map(([state, count]) => (
            <Card key={state} className="text-center">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{state}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">筛选状态:</span>
          <select className="rounded-md border px-2 py-1 text-sm" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">全部</option>
            {Object.values(NodeState).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{filteredNodes.length} 个节点</span>
        </div>

        {/* Node list + detail */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* List */}
          <div className="space-y-3 lg:col-span-2">
            {filteredNodes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">暂无节点</div>
            ) : filteredNodes.map((node) => (
              <Card
                key={node.node_id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedNode?.node_id === node.node_id ? "ring-2 ring-blue-400" : ""} ${node.state === NodeState.OFFLINE ? "opacity-60" : ""}`}
                onClick={() => setSelectedNode(node)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-shrink-0">{stateIcon[node.state] || <Server className="h-4 w-4" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{node.node_id}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${stateTone[node.state] || "border-gray-300 bg-gray-50 text-gray-700"}`}>{node.state}</span>
                      <span className="text-xs text-muted-foreground">{node.type} v{node.version}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {node.capabilities.slice(0, 6).map((cap) => (
                        <span key={cap} className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs">{cap}</span>
                      ))}
                      {node.capabilities.length > 6 && <span className="text-xs text-muted-foreground">+{node.capabilities.length - 6}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{timeSince(node.last_heartbeat)}</div>
                    {node.endpoint && <div className="truncate max-w-[140px]">{node.endpoint}</div>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>节点详情</CardTitle>
                <CardDescription>{selectedNode ? selectedNode.node_id : "点击左侧节点查看详情"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedNode ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">状态</span><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${stateTone[selectedNode.state] || ""}`}>{selectedNode.state}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">类型</span><span>{selectedNode.type}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">版本</span><span>{selectedNode.version}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">角色</span><span>{selectedNode.cluster_role || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">端点</span><span className="truncate max-w-[180px]">{selectedNode.endpoint || "N/A"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">最后心跳</span><span>{timeSince(selectedNode.last_heartbeat)}</span></div>
                    </div>

                    {/* Capabilities */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">能力标签</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.capabilities.map((cap) => (
                          <span key={cap} className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs">{cap}</span>
                        ))}
                      </div>
                    </div>

                    {/* Labels */}
                    {selectedNode.labels.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">标签</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedNode.labels.map((l) => (
                            <span key={l} className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">{l}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Health */}
                    {Object.keys(selectedNode.health).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">健康信息</div>
                        <pre className="rounded bg-slate-100 p-2 text-xs overflow-auto max-h-40">{JSON.stringify(selectedNode.health, null, 2)}</pre>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => void runAction("heartbeat", () => client.heartbeatNode(selectedNode.node_id, { state: NodeState.IDLE }))} disabled={loading}>
                        <Clock3 className="mr-1 h-3 w-3" />心跳
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runAction("drain", () => client.drainNode(selectedNode.node_id, "UI drain"))} disabled={loading}>
                        <Pause className="mr-1 h-3 w-3" />排空
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { if (confirm(`确认移除节点 ${selectedNode.node_id}？`)) void runAction("remove", () => client.removeNode(selectedNode.node_id)); }} disabled={loading}>
                        <Trash2 className="mr-1 h-3 w-3" />移除
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">选择一个节点查看详细信息、能力标签和健康状态。</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
