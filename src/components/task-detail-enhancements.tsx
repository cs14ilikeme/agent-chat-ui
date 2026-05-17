"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, ChevronDown, ChevronRight, CircleAlert, CircleDot, Clock3, Coins, FileJson, Layers, ListChecks, Timer, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskState, Verdict, type Result, type Status, type Task } from "@/lib/gago-types";

// --- Utilities ---

function badgeTone(value?: string | null): string {
  if (!value) return "border-slate-200 bg-slate-50 text-slate-600";
  if ([TaskState.DONE, Verdict.PASS].includes(value as TaskState & Verdict)) return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if ([TaskState.FAILED, TaskState.CANCELED, Verdict.FAIL].includes(value as TaskState & Verdict)) return "border-red-300 bg-red-50 text-red-700";
  if ([TaskState.RUNNING, TaskState.DISPATCHED, TaskState.VERIFYING].includes(value as TaskState)) return "border-blue-300 bg-blue-50 text-blue-700";
  if ([TaskState.BLOCKED, TaskState.RETRYING].includes(value as TaskState)) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-white text-slate-600";
}

function MiniBadge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone || "border-slate-200 bg-white text-slate-600"}`}>{children}</span>;
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function JsonPreview({ value }: { value: unknown }) {
  return <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-200">{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

// --- Markdown Renderer ---

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-slate max-w-none dark:prose-invert [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_table]:text-sm [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// --- Collapsible Section ---

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children, count }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Icon className="size-3.5" />
        <span>{title}</span>
        {count !== undefined && <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span>}
      </button>
      {open && <div className="border-t border-slate-100 px-3 py-2">{children}</div>}
    </div>
  );
}

// --- Cost / Token Statistics ---

interface MetricsStats {
  tokens_input?: number;
  tokens_output?: number;
  tokens_total?: number;
  cost_usd?: number;
  duration_ms?: number;
  tool_calls?: number;
  llm_calls?: number;
  [key: string]: unknown;
}

function extractMetrics(metrics: Record<string, any> | undefined | null): MetricsStats {
  if (!metrics) return {};
  // Try common field names
  return {
    tokens_input: metrics.tokens_input ?? metrics.input_tokens ?? metrics.prompt_tokens ?? undefined,
    tokens_output: metrics.tokens_output ?? metrics.output_tokens ?? metrics.completion_tokens ?? undefined,
    tokens_total: metrics.tokens_total ?? metrics.total_tokens ?? undefined,
    cost_usd: metrics.cost_usd ?? metrics.cost ?? metrics.total_cost ?? undefined,
    duration_ms: metrics.duration_ms ?? metrics.duration ?? metrics.elapsed_ms ?? undefined,
    tool_calls: metrics.tool_calls ?? metrics.tools_used ?? undefined,
    llm_calls: metrics.llm_calls ?? metrics.api_calls ?? undefined,
  };
}

function CostStatsPanel({ metrics }: { metrics: Record<string, any> | undefined | null }) {
  const stats = extractMetrics(metrics);
  const hasAny = Object.values(stats).some((v) => v !== undefined);

  if (!hasAny) return null;

  const items: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[] = [];

  if (stats.tokens_total !== undefined || (stats.tokens_input !== undefined && stats.tokens_output !== undefined)) {
    const total = stats.tokens_total ?? ((stats.tokens_input || 0) + (stats.tokens_output || 0));
    items.push({ icon: Zap, label: "Tokens", value: `${total.toLocaleString()} (${(stats.tokens_input || 0).toLocaleString()} in / ${(stats.tokens_output || 0).toLocaleString()} out)` });
  }

  if (stats.cost_usd !== undefined) {
    items.push({ icon: Coins, label: "Cost", value: `$${Number(stats.cost_usd).toFixed(4)}` });
  }

  if (stats.duration_ms !== undefined) {
    const sec = (Number(stats.duration_ms) / 1000).toFixed(2);
    items.push({ icon: Timer, label: "Duration", value: `${sec}s` });
  }

  if (stats.tool_calls !== undefined) {
    items.push({ icon: Layers, label: "Tool Calls", value: String(stats.tool_calls) });
  }

  if (stats.llm_calls !== undefined) {
    items.push({ icon: Zap, label: "LLM Calls", value: String(stats.llm_calls) });
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
            <Icon className="size-3.5 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className="truncate text-[10px] text-slate-500">{item.label}</div>
              <div className="truncate text-xs font-medium text-slate-700">{item.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Tool Evidence (Artifacts) Folding ---

function ArtifactEvidence({ artifacts }: { artifacts: Record<string, any> | undefined | null }) {
  if (!artifacts || Object.keys(artifacts).length === 0) return <div className="text-xs text-slate-400">无工具证据</div>;

  // If artifacts has tool_calls array, render each as collapsible
  const toolCalls = artifacts.tool_calls || artifacts.steps || artifacts.evidence;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return (
      <div className="space-y-1.5">
        {toolCalls.map((call: Record<string, any>, idx: number) => (
          <CollapsibleSection
            key={idx}
            title={call.tool || call.name || call.action || `Step ${idx + 1}`}
            icon={Layers}
            count={call.result ? 1 : undefined}
          >
            <div className="space-y-1">
              {call.input && (
                <div>
                  <div className="text-[10px] font-medium text-slate-500">Input</div>
                  <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">{typeof call.input === "string" ? call.input : JSON.stringify(call.input, null, 2)}</pre>
                </div>
              )}
              {(call.result || call.output) && (
                <div>
                  <div className="text-[10px] font-medium text-slate-500">Output</div>
                  <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">{typeof (call.result || call.output) === "string" ? (call.result || call.output) : JSON.stringify(call.result || call.output, null, 2)}</pre>
                </div>
              )}
            </div>
          </CollapsibleSection>
        ))}
      </div>
    );
  }

  // Fallback: render each top-level key as a collapsible section
  return (
    <div className="space-y-1.5">
      {Object.entries(artifacts).map(([key, value]) => (
        <CollapsibleSection key={key} title={key} icon={FileJson}>
          {typeof value === "string" ? (
            <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">{value}</pre>
          ) : (
            <JsonPreview value={value} />
          )}
        </CollapsibleSection>
      ))}
    </div>
  );
}

// --- Error List ---

function ErrorList({ errors }: { errors: Array<Record<string, any>> | undefined | null }) {
  if (!errors || errors.length === 0) return null;
  return (
    <CollapsibleSection title={`Errors (${errors.length})`} icon={CircleAlert} defaultOpen={errors.length <= 3}>
      <div className="space-y-1.5">
        {errors.map((err, idx) => (
          <div key={idx} className="rounded border border-red-100 bg-red-50 p-2 text-xs text-red-800">
            <div className="font-medium">{err.type || err.code || `Error ${idx + 1}`}</div>
            <div className="mt-0.5 whitespace-pre-wrap">{err.message || err.detail || JSON.stringify(err)}</div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// --- Main Enhanced Result Card ---

export function ResultPreviewCard({ task, status, result }: { task: Task | null; status: Status | null; result: Result | null }) {
  const hasResult = Boolean(result);
  const summaryContent = result?.summary || status?.message || task?.title || "";
  const isMarkdown = summaryContent.includes("**") || summaryContent.includes("##") || summaryContent.includes("```") || summaryContent.includes("- ") || summaryContent.includes("| ");

  return (
    <Card className="border-slate-200 bg-white/95 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><FileJson className="size-4" /> 结果中心</CardTitle>
        <CardDescription>Markdown 渲染 · 工具证据折叠 · 成本统计</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <MiniBadge tone={badgeTone(status?.state)}>{status?.state || "NO_STATUS"}</MiniBadge>
          <MiniBadge tone={badgeTone(result?.verdict)}>{result?.verdict || "NO_VERDICT"}</MiniBadge>
          {status?.node_id && <MiniBadge>{status.node_id}</MiniBadge>}
          {status?.run_id && <MiniBadge>run {status.run_id}</MiniBadge>}
        </div>

        {/* Cost / Token Statistics */}
        {hasResult && <CostStatsPanel metrics={result?.metrics} />}

        {/* Summary with Markdown rendering */}
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="mb-2 text-xs font-medium text-slate-500">Summary</div>
          {summaryContent ? (
            isMarkdown ? (
              <MarkdownContent content={summaryContent} />
            ) : (
              <div className="whitespace-pre-wrap text-sm text-slate-800">{summaryContent}</div>
            )
          ) : (
            <div className="text-sm text-slate-400">暂无结果摘要，任务完成后会在这里显示。</div>
          )}
        </div>

        {/* Tool Evidence / Artifacts */}
        {hasResult && (
          <CollapsibleSection
            title="工具证据 / Artifacts"
            icon={Layers}
            defaultOpen={true}
            count={result?.artifacts ? Object.keys(result.artifacts).length : 0}
          >
            <ArtifactEvidence artifacts={result?.artifacts} />
          </CollapsibleSection>
        )}

        {/* Errors */}
        {hasResult && <ErrorList errors={result?.errors} />}

        {/* Raw Metrics (collapsed) */}
        {hasResult && result?.metrics && Object.keys(result.metrics).length > 0 && (
          <CollapsibleSection title="Raw Metrics" icon={FileJson}>
            <JsonPreview value={result.metrics} />
          </CollapsibleSection>
        )}

        {/* Inputs (when no result yet) */}
        {!hasResult && (
          <CollapsibleSection title="Inputs" icon={FileJson} defaultOpen={true}>
            <JsonPreview value={task?.inputs} />
          </CollapsibleSection>
        )}
      </CardContent>
    </Card>
  );
}

// --- Task Timeline (unchanged) ---

export function TaskTimeline({ task, status, result }: { task: Task | null; status: Status | null; result: Result | null }) {
  const events = [
    { label: "Created", value: formatTime(task?.created_at), active: Boolean(task), icon: CircleDot },
    { label: "Current status", value: `${status?.state || "unknown"}${status?.updated_at ? ` · ${formatTime(status.updated_at)}` : ""}`, active: Boolean(status), icon: Clock3 },
    { label: "Lease / worker", value: `${status?.node_id || "no node"} · lease ${formatTime(status?.lease_until)}`, active: Boolean(status?.node_id || status?.lease_until), icon: ListChecks },
    { label: "Completed", value: result ? `${result.status} · ${formatTime(result.completed_at)}` : "waiting for result", active: Boolean(result), icon: result?.verdict === Verdict.FAIL ? CircleAlert : CheckCircle2 },
  ];
  return (
    <Card className="border-slate-200 bg-white/95 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="size-4" /> 任务时间线</CardTitle>
        <CardDescription>基于 created/status/result 字段推导的生命周期视图。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event, index) => {
            const Icon = event.icon;
            return (
              <div key={event.label} className="flex gap-3">
                <div className="flex flex-col items-center"><div className={`rounded-full border p-1.5 ${event.active ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}><Icon className="size-3.5" /></div>{index < events.length - 1 && <div className="h-8 w-px bg-slate-200" />}</div>
                <div className="min-w-0 pb-2"><div className="text-sm font-medium text-slate-800">{event.label}</div><div className="break-all text-xs text-muted-foreground">{event.value}</div></div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
