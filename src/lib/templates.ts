import { TaskTemplate } from './gago-types';

/**
 * Built-in task templates for GA-Claw Workbench.
 * Each template defines parameters and a buildPayload function
 * that converts user input into a TaskSubmitPayload.
 */

export const builtinTemplates: TaskTemplate[] = [
  {
    id: 'grok-search',
    name: 'Grok 搜索',
    description: '使用 GrokSearch-rs 执行网络搜索并返回结构化结果',
    icon: 'Search',
    category: 'search',
    taskType: 'grok_search',
    params: [
      { key: 'query', label: '搜索关键词', type: 'string', required: true, placeholder: '输入搜索内容...' },
      { key: 'max_results', label: '最大结果数', type: 'number', default: 10 },
      { key: 'engine', label: '搜索引擎', type: 'select', options: ['grok', 'tavily', 'firecrawl'], default: 'grok' },
    ],
    buildPayload: (values) => ({
      title: `搜索: ${values.query}`,
      type: 'grok_search',
      priority: 5,
      inputs: {
        query: values.query,
        max_results: values.max_results || 10,
        engine: values.engine || 'grok',
      },
    }),
  },
  {
    id: 'sillytavern-chat',
    name: '酒馆对话',
    description: '通过 SillyTavern CLI 发送对话请求',
    icon: 'MessageSquare',
    category: 'chat',
    taskType: 'sillytavern_cli',
    params: [
      { key: 'message', label: '消息内容', type: 'string', required: true, placeholder: '输入对话内容...' },
      { key: 'character', label: '角色名', type: 'string', placeholder: '留空使用默认角色' },
      { key: 'stream', label: '流式输出', type: 'boolean', default: true },
    ],
    buildPayload: (values) => ({
      title: `酒馆对话: ${(values.message as string).slice(0, 30)}...`,
      type: 'sillytavern_cli',
      priority: 5,
      inputs: {
        message: values.message,
        character: values.character || undefined,
        stream: values.stream ?? true,
        action: `openai generate --prompt ${JSON.stringify(values.message || '')}`,
      },
    }),
  },
  {
    id: 'anythingcli-run',
    name: 'AnythingCLI 执行',
    description: '通过 AnythingCLI 执行自定义 AI 任务',
    icon: 'Terminal',
    category: 'tool',
    taskType: 'anythingcli',
    params: [
      { key: 'prompt', label: '提示词', type: 'string', required: true, placeholder: '输入任务提示词...' },
      { key: 'model', label: '模型', type: 'select', options: ['auto', 'gpt-4', 'claude', 'deepseek'], default: 'auto' },
      { key: 'max_tokens', label: '最大 Token', type: 'number', default: 4096 },
    ],
    buildPayload: (values) => ({
      title: `AnythingCLI: ${(values.prompt as string).slice(0, 30)}...`,
      type: 'anythingcli',
      priority: 5,
      inputs: {
        prompt: values.prompt,
        model: values.model || 'auto',
        max_tokens: values.max_tokens || 4096,
      },
    }),
  },
  {
    id: 'search-and-summarize',
    name: '搜索+摘要',
    description: '先搜索再用 LLM 生成摘要的组合工作流',
    icon: 'Layers',
    category: 'workflow',
    taskType: 'workflow',
    params: [
      { key: 'topic', label: '研究主题', type: 'string', required: true, placeholder: '输入研究主题...' },
      { key: 'depth', label: '搜索深度', type: 'select', options: ['shallow', 'medium', 'deep'], default: 'medium' },
      { key: 'language', label: '输出语言', type: 'select', options: ['中文', 'English'], default: '中文' },
    ],
    buildPayload: (values) => ({
      title: `研究: ${values.topic}`,
      type: 'workflow',
      priority: 3,
      inputs: {
        steps: [
          { tool: 'grok_search', params: { query: values.topic, max_results: values.depth === 'deep' ? 20 : values.depth === 'medium' ? 10 : 5 } },
          { tool: 'summarize', params: { language: values.language || '中文' } },
        ],
        topic: values.topic,
        depth: values.depth || 'medium',
        language: values.language || '中文',
      },
    }),
  },
  {
    id: 'service-health-check',
    name: '服务健康巡检',
    description: '批量检查本机所有注册服务的健康状态',
    icon: 'HeartPulse',
    category: 'tool',
    taskType: 'service_health_check',
    params: [
      { key: 'timeout_ms', label: '超时(ms)', type: 'number', default: 5000 },
      { key: 'include_logs', label: '包含错误日志', type: 'boolean', default: false },
    ],
    buildPayload: (values) => ({
      title: '服务健康巡检',
      type: 'service_health_check',
      priority: 7,
      inputs: {
        timeout_ms: values.timeout_ms || 5000,
        include_logs: values.include_logs ?? false,
      },
    }),
  },
];
