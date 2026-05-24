"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, RefreshCw, Wrench, AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createGaClawClient } from "@/lib/hub-client";
import type { ToolInfo, ToolSchema, ToolSchemaParam, ToolRunResult } from "@/lib/hub-types";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_GAGO_API_BASE_URL || "http://127.0.0.1:8765";
const DEFAULT_TOKEN = process.env.NEXT_PUBLIC_GAGO_AUTH_TOKEN || "";

export default function ToolsLabPage() {
  const client = React.useMemo(() => createGaClawClient({ baseUrl: DEFAULT_BASE_URL, token: DEFAULT_TOKEN || null }), []);

  // Tool list state
  const [tools, setTools] = React.useState<ToolInfo[]>([]);
  const [toolsLoading, setToolsLoading] = React.useState(false);
  const [toolsError, setToolsError] = React.useState<string | null>(null);

  // Selected tool & schema
  const [selectedTool, setSelectedTool] = React.useState<string | null>(null);
  const [schema, setSchema] = React.useState<ToolSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = React.useState(false);

  // Form state
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

  // Execution state
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<ToolRunResult | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);

  // History
  const [history, setHistory] = React.useState<Array<{ tool: string; params: Record<string, unknown>; result: ToolRunResult; ts: number }>>([]);

  // Load tool list
  const loadTools = React.useCallback(async () => {
    if (!client) return;
    setToolsLoading(true);
    setToolsError(null);
    try {
      const list = await client.listTools();
      setTools(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404 means the Hub tool gateway has not exposed /tools yet — show friendly message
      if (msg.includes("404") || msg.includes("Not Found")) {
        setToolsError("工具服务尚未启用 — Hub 工具网关暂未注册 /tools 端点。请启用 GA-Claw tool lease gateway 或手动注册工具。");
      } else {
        setToolsError(msg);
      }
    } finally {
      setToolsLoading(false);
    }
  }, [client]);

  React.useEffect(() => { void loadTools(); }, [loadTools]);

  // Load schema when tool selected
  const selectTool = React.useCallback(async (toolName: string) => {
    if (!client) return;
    setSelectedTool(toolName);
    setSchema(null);
    setFormValues({});
    setFormErrors({});
    setResult(null);
    setRunError(null);
    setSchemaLoading(true);
    try {
      const s = await client.getToolSchema(toolName);
      setSchema(s);
      // Pre-fill defaults
      const defaults: Record<string, string> = {};
      for (const p of s.params) {
        if (p.default !== undefined && p.default !== null) {
          defaults[p.name] = typeof p.default === 'string' ? p.default : JSON.stringify(p.default);
        } else {
          defaults[p.name] = '';
        }
      }
      setFormValues(defaults);
    } catch (err) {
      setSchema(null);
    } finally {
      setSchemaLoading(false);
    }
  }, [client]);

  // Validate form
  function validateForm(): boolean {
    if (!schema) return false;
    const errors: Record<string, string> = {};
    for (const p of schema.params) {
      const val = formValues[p.name] ?? '';
      if (p.required && val.trim() === '') {
        errors[p.name] = '必填参数';
      }
      if (val.trim() && p.type === 'number' && isNaN(Number(val))) {
        errors[p.name] = '需要数字';
      }
      if (val.trim() && (p.type === 'object' || p.type === 'array')) {
        try { JSON.parse(val); } catch { errors[p.name] = '无效 JSON'; }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Build params from form
  function buildParams(): Record<string, unknown> {
    if (!schema) return {};
    const params: Record<string, unknown> = {};
    for (const p of schema.params) {
      const val = formValues[p.name] ?? '';
      if (val.trim() === '') continue;
      switch (p.type) {
        case 'number': params[p.name] = Number(val); break;
        case 'boolean': params[p.name] = val === 'true'; break;
        case 'object': case 'array': params[p.name] = JSON.parse(val); break;
        default: params[p.name] = val;
      }
    }
    return params;
  }

  // Run tool
  async function handleRun() {
    if (!client || !selectedTool || !schema) return;
    if (!validateForm()) return;
    setRunning(true);
    setResult(null);
    setRunError(null);
    const params = buildParams();
    try {
      const res = await client.runTool(selectedTool, params);
      setResult(res);
      setHistory(prev => [{ tool: selectedTool, params, result: res, ts: Date.now() }, ...prev.slice(0, 19)]);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  // Render param input
  function renderParamInput(p: ToolSchemaParam) {
    const value = formValues[p.name] ?? '';
    const error = formErrors[p.name];

    if (p.enum && p.enum.length > 0) {
      return (
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={value}
          onChange={e => setFormValues(prev => ({ ...prev, [p.name]: e.target.value }))}
        >
          <option value="">-- 选择 --</option>
          {p.enum.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }

    if (p.type === 'boolean') {
      return (
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={value}
          onChange={e => setFormValues(prev => ({ ...prev, [p.name]: e.target.value }))}
        >
          <option value="">-- 选择 --</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (p.type === 'object' || p.type === 'array') {
      return (
        <Textarea
          className="font-mono text-xs"
          rows={3}
          placeholder={p.type === 'object' ? '{"key": "value"}' : '[1, 2, 3]'}
          value={value}
          onChange={e => setFormValues(prev => ({ ...prev, [p.name]: e.target.value }))}
        />
      );
    }

    return (
      <Input
        type={p.type === 'number' ? 'number' : 'text'}
        placeholder={p.description || p.name}
        value={value}
        onChange={e => setFormValues(prev => ({ ...prev, [p.name]: e.target.value }))}
      />
    );
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <Wrench className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">GA-Claw Tool Leases</h1>
          <p className="text-sm text-muted-foreground">工具租约 / Hub 工具网关 / 调用 / 结果历史</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={loadTools} disabled={toolsLoading}>
          <RefreshCw className={`mr-1 size-3 ${toolsLoading ? 'animate-spin' : ''}`} /> 刷新
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left: Tool List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">可用工具</CardTitle>
            <CardDescription>{tools.length} 个工具已注册</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-auto">
            {toolsError && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>加载失败: {toolsError}</span>
              </div>
            )}
            {toolsLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />加载中...</div>}
            {!toolsLoading && tools.length === 0 && !toolsError && (
              <div className="text-center text-sm text-muted-foreground py-8">暂无工具<br /><span className="text-xs">确保 GA-Claw Hub 工具网关已启动</span></div>
            )}
            {tools.map(t => (
              <button
                key={t.name}
                onClick={() => selectTool(t.name)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${selectedTool === t.name ? 'bg-accent border border-primary/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.available ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {t.available ? '可用' : '离线'}
                  </span>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                {t.adapter && <span className="text-[10px] text-muted-foreground">adapter: {t.adapter}</span>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Right: Schema Form + Result */}
        <div className="space-y-4">
          {/* Schema Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {selectedTool ? `${selectedTool} 参数` : '选择工具'}
                {schemaLoading && <Loader2 className="size-4 animate-spin" />}
              </CardTitle>
              {schema && <CardDescription>{schema.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              {!selectedTool && (
                <div className="text-center text-sm text-muted-foreground py-8">← 从左侧选择一个工具开始</div>
              )}
              {selectedTool && schema && (
                <div className="space-y-4">
                  {schema.params.length === 0 && (
                    <p className="text-sm text-muted-foreground">此工具无需参数</p>
                  )}
                  {schema.params.map(p => (
                    <div key={p.name} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        {p.name}
                        {p.required && <span className="text-destructive">*</span>}
                        <span className="text-[10px] text-muted-foreground ml-1">({p.type})</span>
                      </Label>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      {renderParamInput(p)}
                      {formErrors[p.name] && <p className="text-xs text-destructive">{formErrors[p.name]}</p>}
                    </div>
                  ))}
                  <Button onClick={handleRun} disabled={running || !selectedTool} className="w-full">
                    {running ? <><Loader2 className="mr-2 size-4 animate-spin" />执行中...</> : <><Play className="mr-2 size-4" />执行工具</>}
                  </Button>
                </div>
              )}
              {selectedTool && !schema && !schemaLoading && (
                <div className="text-center text-sm text-muted-foreground py-4">无法加载 schema</div>
              )}
            </CardContent>
          </Card>

          {/* Result */}
          {(result || runError) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {result?.ok ? <CheckCircle2 className="size-4 text-green-500" /> : <AlertCircle className="size-4 text-destructive" />}
                  执行结果
                  {result && <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1"><Clock className="size-3" />{result.duration_ms}ms</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {runError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{runError}</div>
                )}
                {result?.error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-3">{result.error}</div>
                )}
                {result?.output !== undefined && (
                  <pre className="max-h-[400px] overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200 whitespace-pre-wrap">
                    {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">执行历史</CardTitle>
                <CardDescription>最近 {history.length} 次调用</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[300px] overflow-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                    {h.result.ok ? <CheckCircle2 className="size-3 text-green-500" /> : <AlertCircle className="size-3 text-destructive" />}
                    <span className="font-medium">{h.tool}</span>
                    <span className="text-muted-foreground">{h.result.duration_ms}ms</span>
                    <span className="ml-auto text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setSelectedTool(h.tool);
                        // Restore params
                        const restored: Record<string, string> = {};
                        for (const [k, v] of Object.entries(h.params)) {
                          restored[k] = typeof v === 'string' ? v : JSON.stringify(v);
                        }
                        setFormValues(restored);
                      }}
                    >
                      复用
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
