"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Status } from "@/lib/gago-types";

export interface TaskStreamEvent {
  type: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface UseTaskStreamOptions {
  /** Auto-connect when taskId is set */
  enabled?: boolean;
  /** Called on each new event */
  onEvent?: (event: TaskStreamEvent) => void;
  /** Called on status change */
  onStatus?: (status: Status) => void;
  /** Called when task completes */
  onResult?: (result: unknown) => void;
  /** Called on done (terminal state) */
  onDone?: (state: string) => void;
}

export function useTaskStream(taskId: string | null, options: UseTaskStreamOptions = {}) {
  const { enabled = true, onEvent, onStatus, onResult, onDone } = options;
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<TaskStreamEvent[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!taskId || !enabled) return;
    disconnect();

    const es = new EventSource(`/api/tasks/${taskId}/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data);
        onStatus?.(data);
      } catch { /* ignore */ }
    });

    es.addEventListener("event", (e) => {
      try {
        const data = JSON.parse(e.data) as TaskStreamEvent;
        setEvents((prev) => [...prev, data]);
        onEvent?.(data);
      } catch { /* ignore */ }
    });

    es.addEventListener("result", (e) => {
      try {
        const data = JSON.parse(e.data);
        onResult?.(data);
      } catch { /* ignore */ }
    });

    es.addEventListener("done", (e) => {
      try {
        const data = JSON.parse(e.data);
        onDone?.(data.state);
      } catch { /* ignore */ }
      disconnect();
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        try {
          const data = JSON.parse(e.data);
          setError(data.message);
        } catch { /* ignore */ }
      }
    });

    es.onerror = () => {
      setError("SSE connection lost");
      disconnect();
    };
  }, [taskId, enabled, disconnect, onEvent, onStatus, onResult, onDone]);

  useEffect(() => {
    if (taskId && enabled) {
      setEvents([]);
      setStatus(null);
      setError(null);
      connect();
    }
    return () => disconnect();
  }, [taskId, enabled, connect, disconnect]);

  return { connected, events, status, error, disconnect, reconnect: connect };
}
