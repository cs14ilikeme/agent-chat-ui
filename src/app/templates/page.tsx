"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Layers, MessageSquare, Play, Plus, Search, Terminal, HeartPulse, Trash2, Upload } from "lucide-react";

import { createGAGoClient } from "@/lib/gago-client";
import { TaskTemplate, TemplateParam } from "@/lib/gago-types";
import { builtinTemplates } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Using native select element (no shadcn Select component available)
import { Switch } from "@/components/ui/switch";
// Badge not available, using span instead

const CUSTOM_TEMPLATES_KEY = "ga-go-custom-templates";

const iconMap: Record<string, React.ReactNode> = {
  Search: <Search className="h-5 w-5" />,
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  Terminal: <Terminal className="h-5 w-5" />,
  Layers: <Layers className="h-5 w-5" />,
  HeartPulse: <HeartPulse className="h-5 w-5" />,
  Plus: <Plus className="h-5 w-5" />,
};

const categoryColors: Record<string, string> = {
  search: "bg-blue-100 text-blue-800",
  chat: "bg-green-100 text-green-800",
  tool: "bg-orange-100 text-orange-800",
  workflow: "bg-purple-100 text-purple-800",
  custom: "bg-yellow-100 text-yellow-800",
};

interface SerializedTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "search" | "chat" | "tool" | "workflow" | "custom";
  taskType: string;
  params: TemplateParam[];
  payloadTemplate?: Record<string, any>;
}

function loadCustomTemplates(): TaskTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const items: SerializedTemplate[] = JSON.parse(raw);
    return items.map((item) => ({
      ...item,
      buildPayload: (values: Record<string, any>) => ({
        title: `${item.name} - ${new Date().toLocaleString()}`,
        task_type: item.taskType,
        priority: 5,
        inputs: values,
        ...(item.payloadTemplate || {}),
      }),
    }));
  } catch { return []; }
}

function saveCustomTemplates(templates: TaskTemplate[]) {
  const serialized: SerializedTemplate[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    category: t.category,
    taskType: t.taskType,
    params: t.params,
  }));
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(serialized));
}

export default function TemplatesPage() {
  const [selected, setSelected] = React.useState<TaskTemplate | null>(null);
  const [values, setValues] = React.useState<Record<string, any>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [customTemplates, setCustomTemplates] = React.useState<TaskTemplate[]>([]);
  const [importMsg, setImportMsg] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const client = React.useMemo(() => createGAGoClient({ baseUrl: "/api/gago" }), []);

  React.useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
  }, []);

  const allTemplates = React.useMemo(
    () => [...builtinTemplates, ...customTemplates],
    [customTemplates]
  );

  function selectTemplate(t: TaskTemplate) {
    setSelected(t);
    setResult(null);
    const defaults: Record<string, any> = {};
    for (const p of t.params) {
      if (p.default !== undefined) defaults[p.key] = p.default;
    }
    setValues(defaults);
  }

  function updateValue(key: string, value: any) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!selected) return;
    for (const p of selected.params) {
      if (p.required && !values[p.key]) {
        setResult({ ok: false, message: `请填写必填项: ${p.label}` });
        return;
      }
    }
    setSubmitting(true);
    setResult(null);
    try {
      const payload = selected.buildPayload(values);
      await client.submitTask(payload as any);
      setResult({ ok: true, message: `任务已提交: ${payload.title || selected.name}` });
    } catch (err: any) {
      setResult({ ok: false, message: `提交失败: ${err.message || String(err)}` });
    } finally {
      setSubmitting(false);
    }
  }

  function handleExport() {
    const data: SerializedTemplate[] = allTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      category: t.category,
      taskType: t.taskType,
      params: t.params,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ga-go-templates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportMsg("已导出模板文件");
    setTimeout(() => setImportMsg(null), 3000);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items: SerializedTemplate[] = JSON.parse(reader.result as string);
        if (!Array.isArray(items)) throw new Error("格式错误：需要数组");
        // Filter out duplicates with builtin
        const builtinIds = new Set(builtinTemplates.map((t) => t.id));
        const newCustom: SerializedTemplate[] = items.filter((item) => !builtinIds.has(item.id));
        const templates: TaskTemplate[] = newCustom.map((item) => ({
          ...item,
          buildPayload: (values: Record<string, any>) => ({
            title: `${item.name} - ${new Date().toLocaleString()}`,
            task_type: item.taskType,
            priority: 5,
            inputs: values,
            ...(item.payloadTemplate || {}),
          }),
        }));
        setCustomTemplates(templates);
        saveCustomTemplates(templates);
        setImportMsg(`已导入 ${templates.length} 个自定义模板`);
        setTimeout(() => setImportMsg(null), 3000);
      } catch (err: any) {
        setImportMsg(`导入失败: ${err.message}`);
        setTimeout(() => setImportMsg(null), 5000);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function deleteCustomTemplate(id: string) {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    if (selected?.id === id) { setSelected(null); setResult(null); }
    setImportMsg("已删除自定义模板");
    setTimeout(() => setImportMsg(null), 3000);
  }

  function renderParamInput(param: TemplateParam) {
    const val = values[param.key];
    switch (param.type) {
      case "string":
        return (
          <Input
            value={val || ""}
            onChange={(e) => updateValue(param.key, e.target.value)}
            placeholder={param.placeholder}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={val ?? ""}
            onChange={(e) => updateValue(param.key, Number(e.target.value))}
            placeholder={param.placeholder}
          />
        );
      case "boolean":
        return (
          <Switch
            checked={val ?? false}
            onCheckedChange={(checked) => updateValue(param.key, checked)}
          />
        );
      case "select":
        return (
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={val || ""}
            onChange={(e) => updateValue(param.key, e.target.value)}
          >
            <option value="" disabled>选择...</option>
            {param.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      default:
        return <Input value={val || ""} onChange={(e) => updateValue(param.key, e.target.value)} />;
    }
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">工作台</h1>
              <p className="text-sm text-muted-foreground">选择模板快速提交任务</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-3.5 w-3.5" />导出
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" />导入
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{allTemplates.length} 个模板</span>
          </div>
        </div>

        {importMsg && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{importMsg}</div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Template List */}
          <div className="space-y-3 lg:col-span-1">
            <h2 className="text-sm font-medium text-muted-foreground">可用模板</h2>
            {allTemplates.map((t) => {
              const isCustom = customTemplates.some((c) => c.id === t.id);
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-colors hover:border-primary ${selected?.id === t.id ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => selectTemplate(t)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        {iconMap[t.icon] || <Layers className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-sm">{t.name}</CardTitle>
                        <CardDescription className="text-xs">{t.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryColors[t.category] || ""}`}>
                          {t.category}
                        </span>
                        {isCustom && (
                          <button
                            className="ml-1 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => { e.stopPropagation(); deleteCustomTemplate(t.id); }}
                            title="删除自定义模板"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* Parameter Form */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      {iconMap[selected.icon] || <Layers className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle>{selected.name}</CardTitle>
                      <CardDescription>{selected.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selected.params.map((param) => (
                    <div key={param.key} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {param.label}
                        {param.required && <span className="text-xs text-red-500">*</span>}
                      </Label>
                      {renderParamInput(param)}
                    </div>
                  ))}

                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={handleSubmit} disabled={submitting}>
                      <Play className="mr-2 h-4 w-4" />
                      {submitting ? "提交中..." : "提交任务"}
                    </Button>
                    <Button variant="outline" onClick={() => { setSelected(null); setResult(null); }}>
                      取消
                    </Button>
                  </div>

                  {result && (
                    <div className={`mt-3 rounded-lg p-3 text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                      {result.message}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex h-64 items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Layers className="mx-auto mb-3 h-10 w-10 opacity-50" />
                    <p>从左侧选择一个模板开始</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
