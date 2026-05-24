# GA-Claw Workbench UI

GA-Claw Workbench UI 是 GA-Claw Hub 的前端工作台，覆盖 Room / Timeline / Approval / Workspace / Artifact / Tools 等场景。
它保留了 `/api/gago` 与 `GAGO_API_URL` 的兼容入口，同时推荐使用 `GA_CLAW_HUB_URL` 指向 Hub。

## 启动

```bash
pnpm install
pnpm dev
```

## 环境变量

- `GA_CLAW_HUB_URL`: Hub 基础地址，例如 `http://127.0.0.1:8765`
- `GAGO_API_URL`: 旧版兼容别名
- `NEXT_PUBLIC_GAGO_API_BASE_URL`: 客户端默认 API 基础地址
- `NEXT_PUBLIC_GAGO_AUTH_TOKEN`: 客户端默认 token
- `GAGO_API_URL`: 服务端代理默认地址

## 兼容路由

- `/api/gago/*` 代理到 GA-Claw Hub
- `/api/health` 检查 Hub 连通性、UI 内存和 uptime

## 说明

这是 GA-Claw Workbench 的 UI 入口，不再按 GA-Go backend/service branding 描述产品线。
