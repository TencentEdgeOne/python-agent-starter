# Python Starter Agent

EdgeOne Pages Functions 上的极简 Python LLM Agent 模板，演示如何使用 OpenAI Agents SDK 构建一个支持流式输出、会话记忆和中断的 Agent。

## 功能简介

- **简单 LLM 调用** — 使用 OpenAI Agents SDK 调用 LLM，支持 OpenAI 兼容接口
- **流式输出** — SSE (Server-Sent Events) 逐字推送模型回复
- **会话记忆** — 基于 EdgeOne `context.store` 自动维护多轮对话上下文
- **中断生成** — 通过 `/chat/stop` 真正中断 LLM 调用，释放上游连接
- **工具扩展** — 预留 `_tools.py`，后续只需添加 `@function_tool` 即可扩展能力
- **心跳保活** — 每 15 秒发送 ping 事件，防止网关/CDN 空闲断开

## 目录结构

```text
python-starter/
├── agents/                        # Python 后端（EdgeOne Pages Functions）
│   └── chat/
│       ├── index.py               # POST /chat — 主聊天入口
│       ├── stop.py                # POST /chat/stop — 中断入口
│       ├── _model.py              # LLM 模型配置（私有模块）
│       ├── _logger.py             # 日志工具（私有模块）
│       ├── _tools.py              # 工具列表（私有模块，当前为空）
│       └── _store_session.py     # 会话记忆适配器（私有模块）
├── src/                           # React 前端（Vite + TypeScript）
│   ├── App.tsx                    # 主应用组件
│   ├── api.ts                     # 后端 API 封装（SSE 流式调用）
│   ├── types.ts                   # 类型定义
│   ├── index.css                  # 全局样式
│   └── components/                # UI 组件
│       ├── ChatWindow.tsx         # 聊天窗口
│       ├── ChatBubble.tsx         # 消息气泡（支持 Markdown）
│       ├── ChatInput.tsx          # 输入框 + 预设 + 停止按钮
│       ├── CodeViewer.tsx         # 代码展示面板（CRT 风格）
│       ├── ToolIndicators.tsx     # 工具指示灯容器
│       └── ToolLamp.tsx           # 单个工具指示灯
├── index.html                     # 入口 HTML
├── package.json                   # 前端依赖
├── vite.config.ts                 # Vite 配置（含 proxy → 后端）
├── tsconfig.json                  # TypeScript 配置
├── requirements.txt               # Python 依赖
├── .env.example                   # 环境变量示例
└── README.md
```

> 以 `_` 开头的文件是私有模块，不会被 EdgeOne Pages Functions 映射为公开路由。

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `AI_GATEWAY_API_KEY` | LLM API 密钥 | — |
| `AI_GATEWAY_BASE_URL` | LLM API 地址 | — |
| `AI_GATEWAY_MODEL` | 模型名称 | `@Pages/hy3-preview` |

复制 `.env.example` 为 `.env` 并填入实际值：

```bash
cp .env.example .env
```

## 接口说明

### POST /chat

发送消息并获取流式回复。

**请求：**

```json
{
  "message": "你好"
}
```

请求头由前端/平台自动携带：

```text
pages-agent-conversation-id: <conversation_id>
```

**响应：** SSE 文本流

| 事件 | 说明 | 数据示例 |
|---|---|---|
| `text_delta` | 模型增量文本 | `{"delta": "你好"}` |
| `tool_called` | 工具被调用 | `{"tool": "get_weather"}` |
| `ping` | 心跳保活 | `{"ts": 1710000000000}` |
| `error` | 错误 | `{"message": "..."}` |
| `done` | 完成/已停止 | `{"stopped": false}` |

### POST /chat/stop

中断正在生成的回答。

**请求：**

```json
{
  "conversation_id": "<conversation_id>"
}
```

**响应：**

```json
{
  "status": "aborting",
  "conversationId": "<conversation_id>",
  "runId": "<run_id>",
  "aborted": true
}
```

> 注意：`/chat/stop` 请求不要携带 `pages-agent-conversation-id` header，目标会话 ID 只通过 body 传递。

## 会话记忆

- 使用 EdgeOne 平台的 `context.store` 进行持久化
- 通过 `EdgeOneStoreSession` 适配 OpenAI Agents SDK 的 Session Protocol
- `Runner.run_streamed(..., session=session)` 自动读取历史、写入本轮输入和输出
- 同一个 `conversation_id` 下的多轮对话自动具备上下文
- **不要手动拼接历史**，避免重复写入

## 中断生成

中断不是简单断开前端连接，而是通过平台 runtime 真正中断 LLM 调用：

1. 前端调用 `POST /chat/stop`，传入目标 `conversation_id`
2. `stop.py` 调用 `context.utils.abort_active_run(conversation_id)`
3. 平台 runtime 设置目标会话的 cancel signal
4. `index.py` 流式循环检测到 signal 后停止读取
5. 关闭 async generator，释放上游 LLM 连接
6. 最终返回 `done` 事件，`stopped=true`

## 工具扩展

当前 `_tools.py` 中 `TOOLS = []`（空列表），不影响正常运行。

后续添加工具只需修改 `agents/chat/_tools.py`：

```python
from typing import Annotated
from agents import function_tool


@function_tool
def get_weather(city: Annotated[str, "The city name"]) -> str:
    """Get the current weather for a specified city."""
    return f"{city}: Sunny, 18-25C"


@function_tool
def translate_text(
    text: Annotated[str, "The text to translate"],
    target_language: Annotated[str, "Target language code, e.g. en, ja, fr"],
) -> str:
    """Translate text to the specified language."""
    return f"[Translated to {target_language}]: {text}"


TOOLS = [get_weather, translate_text]
```

主入口 `index.py` 无需任何改动。

## 本地调试

```bash
# 1. 安装前端依赖
npm install

# 2. 安装 Python 依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 AI_GATEWAY_API_KEY 和 AI_GATEWAY_BASE_URL

# 4. 启动后端（EdgeOne CLI）
npx edgeone-cli dev

# 5. 启动前端开发服务器（另一个终端）
npm run dev
# 浏览器打开 http://localhost:5173
```

> Vite 开发服务器会将 `/chat` 请求代理到 `http://localhost:8088`（后端默认端口）。
>
> 部署到 EdgeOne Pages 平台时，runtime 已内置部分依赖，以平台环境为准。
