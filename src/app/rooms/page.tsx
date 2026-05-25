"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Plus, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGaClawClient } from "@/lib/hub-client";
import type { CollabRoom, CollabMessage, TaskListResponse, Node, HealthResponse } from "@/lib/hub-types";

const DEFAULT_BASE_URL = "/api/hub";
const DEFAULT_TOKEN = process.env.NEXT_PUBLIC_GAGO_AUTH_TOKEN?.trim() || "";

export default function RoomsPage() {
  const client = React.useMemo(() => createGaClawClient({ baseUrl: DEFAULT_BASE_URL, token: DEFAULT_TOKEN || null }), []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rooms, setRooms] = React.useState<CollabRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<CollabMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [tasks, setTasks] = React.useState<TaskListResponse>([]);
  const [nav, setNav] = React.useState("rooms"); // rooms | tasks

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, t] = await Promise.all([
        client.listCollabRooms().catch(() => ({ rooms: [] as CollabRoom[] })),
        client.listTasks().catch(() => [] as TaskListResponse),
      ]);
      setRooms(Array.isArray(r?.rooms) ? r.rooms : []);
      setTasks(Array.isArray(t) ? t : []);
      if (!selectedRoomId && r?.rooms?.length > 0) setSelectedRoomId(r.rooms[0].room_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, selectedRoomId]);

  const loadMessages = React.useCallback(async (roomId: string | null) => {
    if (!roomId) { setMessages([]); return; }
    try {
      const data = await client.listCollabMessages(roomId);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch { setMessages([]); }
  }, [client]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => { void loadMessages(selectedRoomId); }, [loadMessages, selectedRoomId]);

  async function sendMessage() {
    if (!selectedRoomId || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    try {
      await client.sendCollabMessage(selectedRoomId, { author: "human", content, metadata: { source: "ui" } });
      await loadMessages(selectedRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const selectedRoom = rooms.find(r => r.room_id === selectedRoomId) ?? null;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link href="/"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">协作空间 | Rooms</h1>
              <p className="text-sm text-muted-foreground">Room 协作空间、多维对话视图</p>
            </div>
          </div>
          <Button onClick={() => void refresh()} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />刷新
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant={nav === "rooms" ? "default" : "outline"} size="sm" onClick={() => setNav("rooms")}>Rooms ({rooms.length})</Button>
          <Button variant={nav === "tasks" ? "default" : "outline"} size="sm" onClick={() => setNav("tasks")}>Tasks ({tasks.length})</Button>
        </div>

        {nav === "rooms" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-3">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {rooms.length === 0 && !loading && (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">暂未发现协作空间</CardContent></Card>
              )}
              {rooms.map(room => (
                <div key={room.room_id}
                  onClick={() => setSelectedRoomId(room.room_id)}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent ${selectedRoomId === room.room_id ? "border-primary bg-accent" : ""}`}>
                  <div className="font-medium text-sm">{room.title || room.room_id}</div>
                  <div className="text-xs text-muted-foreground">{room.room_id} · {room.task_id || "无关联任务"}</div>
                  {room.participants?.length > 0 && <div className="text-xs text-muted-foreground mt-1">{room.participants.length} 参与者</div>}
                </div>
              ))}
            </div>
            <div className="lg:col-span-2 space-y-4">
              {selectedRoom ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{selectedRoom.title || selectedRoom.room_id}</CardTitle>
                      <CardDescription>
                        Room ID: {selectedRoom.room_id}
                        {selectedRoom.task_id ? ` · Task: ${selectedRoom.task_id}` : ""}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">对话</CardTitle></CardHeader>
                    <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
                      {messages.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">暂无消息</div>}
                      {messages.map((msg, i) => (
                        <div key={msg.message_id || i}
                          className={`rounded-lg border p-3 ${msg.author === "human" ? "bg-blue-50 border-blue-200" : msg.author === "assistant" ? "bg-emerald-50 border-emerald-200" : "bg-slate-50"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{msg.author}</span>
                            <span className="text-xs text-muted-foreground">{msg.created_at || ""}</span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                          {msg.metadata && <div className="text-xs text-muted-foreground mt-1">{JSON.stringify(msg.metadata)}</div>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <div className="flex gap-2">
                    <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="输入指令…" onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void sendMessage())} />
                    <Button onClick={() => void sendMessage()} disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </>
              ) : (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">选择一个 Room 查看对话</CardContent></Card>
              )}
            </div>
          </div>
        )}

        {nav === "tasks" && (
          <div className="space-y-3">
            {tasks.length === 0 && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">暂无任务</CardContent></Card>}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map(task => (
                <Link key={task.task_id} href={`/tasks/${task.task_id}`} className="block">
                  <Card className="cursor-pointer hover:border-primary transition-colors h-full">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium truncate">{task.title || task.task_id || "未命名"}</div>
                      <div className="text-xs text-muted-foreground mt-1">{task.task_id}</div>
                      <div className="text-xs text-muted-foreground">{task.status?.state || "unknown"}</div>
                      <div className="text-xs text-muted-foreground">{task.status?.node_id ? `→ ${task.status.node_id}` : "未分配"}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
