"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, Send, ArrowLeft, CircleAlert, Clock3, FileText, MessageSquare, Play, RefreshCw, Server, SquareX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createGaClawClient } from "@/lib/hub-client";
import { TaskEventTimeline } from "@/components/task-event-timeline";
import { TaskLogPanel } from "@/components/task-log-panel";
import { TaskDagPanel } from "@/components/task-dag";
import { MonitorAlertPanel } from "@/components/monitor-alert-panel";
import { TaskTimeline, ResultPreviewCard } from "@/components/task-detail-enhancements";
import { useTaskStream } from "@/hooks/use-task-stream";
import type { Status, Result, Task, TaskEvent, TaskLogEntry, CollabRoom, CollabMessage } from "@/lib/hub-types";
import { NodeState, TaskState } from "@/lib/hub-types";

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
};

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone || "border-slate-200 bg-white text-slate-600"}`}>{children}</span>;
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const client = React.useMemo(() => createGaClawClient({ baseUrl: "/api/hub", token: process.env.NEXT_PUBLIC_GAGO_AUTH_TOKEN?.trim() || null }), []);

  const [task, setTask] = React.useState<Task | null>(null);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const [events, setEvents] = React.useState<TaskEvent[]>([]);
  const [logs, setLogs] = React.useState<TaskLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("events");
  const [rooms, setRooms] = React.useState<CollabRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<CollabMessage[]>([]);
  const [draft, setDraft] = React.useState("");

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, s, r, e, l] = await Promise.all([
        client.getTask(taskId),
        client.getTaskStatus(taskId),
        client.getTaskResult(taskId).catch(() => null),
        client.getTaskEvents(taskId).catch(() => []),
        client.getTaskLogs(taskId).catch(() => []),
      ]);
      setTask(t);
      setStatus(s);
      setResult(r);
      setEvents(Array.isArray(e) ? e : (e as any)?.events ?? []);
      setLogs(Array.isArray(l) ? l : (l as any)?.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, taskId]);

  const isActive = status ? ![TaskState.DONE, TaskState.FAILED, TaskState.CANCELED].includes(status.state) : false;
  const stream = useTaskStream(taskId, {
    enabled: isActive,
    onEvent: (evt) => setEvents(prev => [...prev, { ts: (evt.timestamp as string) ?? new Date().toISOString(), kind: evt.type, detail: String(evt.data ?? "") }].slice(-500)),
    onStatus: (s) => setStatus(s as Status),
    onResult: (r) => setResult(r as Result),
    onDone: () => void loadDetail(),
  });

  React.useEffect(() => { void loadDetail(); }, [loadDetail]);

  const loadRooms = React.useCallback(async () => {
    try {
      const data = await client.listCollabRooms(taskId);
      const arr = Array.isArray(data?.rooms) ? data.rooms : [];
      setRooms(arr);
      if (!selectedRoomId && arr.length > 0) setSelectedRoomId(arr[0].room_id);
    } catch { setRooms([]); }
  }, [client, taskId, selectedRoomId]);

  const loadMessages = React.useCallback(async (roomId: string | null) => {
    if (!roomId) { setMessages([]); return; }
    try {
      const data = await client.listCollabMessages(roomId);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch { setMessages([]); }
  }, [client]);

  React.useEffect(() => { void loadRooms(); }, [loadRooms]);
  React.useEffect(() => { void loadMessages(selectedRoomId); }, [loadMessages, selectedRoomId]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link href="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <Activity className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Task {taskId?.slice(0, 16)}...</h1>
              {status && <Badge tone={stateTone[status.state]}>{status.state}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void loadDetail()} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新
            </Button>
            {status && isActive && (
              <Button variant="destructive" size="sm" onClick={() => client.cancelTask(taskId).then(() => void loadDetail())}>
                <SquareX className="mr-1 h-3 w-3" />取消
              </Button>
            )}
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-2">
          {["events", "logs", "room", "dag", "output"].map(t => (
            <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
              {t === "events" ? <><Activity className="mr-1 h-3 w-3" />事件</> : t === "logs" ? <><FileText className="mr-1 h-3 w-3" />日志</> : t === "room" ? <><MessageSquare className="mr-1 h-3 w-3" />Room</> : t === "dag" ? <><Server className="mr-1 h-3 w-3" />DAG</> : <><Play className="mr-1 h-3 w-3" />输出</>}
            </Button>
          ))}
        </div>

        {tab === "events" && <TaskEventTimeline events={events} />}
        {tab === "logs" && <TaskLogPanel logs={logs} />}
        {tab === "dag" && (
          <Card>
            <CardHeader><CardTitle className="text-base">DAG</CardTitle></CardHeader>
            <CardContent>
              {task && <TaskDagPanel events={events} />}
            </CardContent>
          </Card>
        )}
        {tab === "output" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Result / 输出</CardTitle></CardHeader>
            <CardContent>
              {result ? <ResultPreviewCard task={null} status={null} result={result} /> : <div className="text-sm text-muted-foreground">暂无输出</div>}
            </CardContent>
          </Card>
        )}

        {tab === "room" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-2">
              {rooms.length === 0 && <div className="text-sm text-muted-foreground">暂无房间</div>}
              {rooms.map(room => (
                <div key={room.room_id}
                  onClick={() => setSelectedRoomId(room.room_id)}
                  className={`cursor-pointer rounded-lg border p-2 text-sm ${selectedRoomId === room.room_id ? "border-primary bg-accent" : ""}`}>
                  {room.title || room.room_id}
                </div>
              ))}
            </div>
            <div className="lg:col-span-2 space-y-3">
              <div className="max-h-80 overflow-y-auto space-y-2">
                {messages.map((msg, i) => (
                  <div key={msg.message_id || i}
                    className={`rounded-lg border p-2 text-sm ${msg.author === "human" ? "bg-blue-50" : "bg-emerald-50"}`}>
                    <div className="text-xs font-medium text-muted-foreground">{msg.author} · {msg.created_at || ""}</div>
                    <div className="mt-1">{msg.content}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="发送指令…"
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(),
                    selectedRoomId && draft.trim() && client.sendCollabMessage(selectedRoomId, { author: "human", content: draft.trim(), metadata: { source: "ui" } }).then(() => { setDraft(""); void loadMessages(selectedRoomId); })
                  )} />
                <Button size="sm" onClick={async () => { if (!selectedRoomId || !draft.trim()) return; await client.sendCollabMessage(selectedRoomId, { author: "human", content: draft.trim(), metadata: { source: "ui" } }); setDraft(""); await loadMessages(selectedRoomId); }}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
