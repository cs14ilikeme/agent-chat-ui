/**
 * SSE Stream Route Handler
 * Polls backend events/status for a task and streams incremental updates to the client.
 * GET /api/tasks/{task_id}/stream
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 1500;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 min max connection

export async function GET(
  request: Request,
  { params }: { params: Promise<{ task_id: string }> }
) {
  const { task_id } = await params;
  const apiUrl = (
    process.env.GAGO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_GAGO_API_BASE_URL ??
    "http://127.0.0.1:8765"
  ).replace(/\/+$/, "");
  const apiKey = process.env.GAGO_AUTH_TOKEN ?? process.env.NEXT_PUBLIC_GAGO_AUTH_TOKEN;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let lastEventCount = 0;
      let lastState = "";
      const startTime = Date.now();

      const poll = async () => {
        while (!closed && Date.now() - startTime < MAX_DURATION_MS) {
          try {
            // Fetch status
            const statusRes = await fetch(`${apiUrl}/tasks/${task_id}/status`, { headers });
            if (statusRes.ok) {
              const status = await statusRes.json();
              if (status.state !== lastState) {
                lastState = status.state;
                send("status", status);
              }
            }

            // Fetch events
            const eventsRes = await fetch(`${apiUrl}/tasks/${task_id}/events`, { headers });
            if (eventsRes.ok) {
              const events = await eventsRes.json();
              const arr = Array.isArray(events) ? events : events.events || [];
              if (arr.length > lastEventCount) {
                const newEvents = arr.slice(lastEventCount);
                for (const ev of newEvents) {
                  send("event", ev);
                }
                lastEventCount = arr.length;
              }
            }

            // If terminal state, send result and close
            if (["DONE", "FAILED", "CANCELED"].includes(lastState)) {
              try {
                const resultRes = await fetch(`${apiUrl}/tasks/${task_id}/result`, { headers });
                if (resultRes.ok) {
                  const result = await resultRes.json();
                  send("result", result);
                }
              } catch { /* no result available */ }
              send("done", { state: lastState });
              break;
            }
          } catch (err) {
            send("error", { message: String(err) });
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        if (!closed) {
          controller.close();
        }
      };

      poll();

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
