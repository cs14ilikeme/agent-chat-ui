"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Server, Key, RefreshCw, LogOut, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { createGAGoClient } from "@/lib/gago-client";

interface SystemInfo {
  version: string;
  uptime: string;
  tasksTotal: number;
  nodesTotal: number;
  servicesTotal: number;
}

export default function SettingsPage() {
  const { username, role, authenticated, logout } = useAuth();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInfo = async () => {
    setLoading(true);
    setError("");
    try {
      const client = createGAGoClient({
        baseUrl: "/api/gago",
      });
      const health = await client.health();
      const tasks = await client.listTasks();
      const nodes = await client.listNodes();

      let servicesCount = 0;
      try {
        const services = await client.listServices();
        servicesCount = services.length;
      } catch { /* services may not be available */ }

      setInfo({
        version: health.version || "unknown",
        uptime: health.time || "N/A",
        tasksTotal: tasks.length ?? 0,
        nodesTotal: nodes.length ?? 0,
        servicesTotal: servicesCount,
      });
    } catch (err: any) {
      setError(err.message || "无法连接到 GA-Go 服务");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfo(); }, []);



  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">设置 & 配置中心</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Auth Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              认证状态
            </CardTitle>
            <CardDescription>当前登录信息与权限</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">状态</span>
              <span className={`text-sm font-medium ${authenticated ? "text-green-600" : "text-yellow-600"}`}>
                {authenticated ? "已认证" : "未认证"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">用户</span>
              <span className="text-sm font-medium">{username || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">角色</span>
              <span className="text-sm font-medium capitalize">{role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">会话</span>
              <span className="text-sm font-mono">
                {authenticated ? "httpOnly Cookie (安全)" : "无"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">权限</span>
              <span className="text-sm">
                {role === "admin" ? "完全控制" : role === "worker" ? "读取+执行" : "只读"}
              </span>
            </div>
            {authenticated ? (
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="default" size="sm" className="w-full mt-2">
                  <LogIn className="mr-2 h-4 w-4" />
                  前往登录
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              系统信息
            </CardTitle>
            <CardDescription>GA-Go 服务端状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : info ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">版本</span>
                  <span className="text-sm font-mono">{info.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">运行时间</span>
                  <span className="text-sm">{info.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">任务总数</span>
                  <span className="text-sm">{info.tasksTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">节点数</span>
                  <span className="text-sm">{info.nodesTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">托管服务</span>
                  <span className="text-sm">{info.servicesTotal}</span>
                </div>
              </>
            ) : null}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={fetchInfo}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          </CardContent>
        </Card>

        {/* API Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              连接配置
            </CardTitle>
            <CardDescription>API 端点与密钥状态（脱敏）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">API 地址</span>
              <span className="text-sm font-mono">
                {process.env.NEXT_PUBLIC_GAGO_API_BASE_URL || "http://127.0.0.1:8765"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">认证方式</span>
              <span className="text-sm">Bearer Token</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">CORS</span>
              <span className="text-sm text-green-600">本地同源</span>
            </div>
          </CardContent>
        </Card>

        {/* Security Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              安全建议
            </CardTitle>
            <CardDescription>生产环境部署注意事项</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 启用 HTTPS 反向代理（Nginx/Caddy）</li>
              <li>• 为不同用户分配不同角色的 Token</li>
              <li>• 定期轮换 Token</li>
              <li>• 限制 API 端口仅本机或内网访问</li>
              <li>• 危险操作（服务重启/任务取消）需 admin 权限</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
