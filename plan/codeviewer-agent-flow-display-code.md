# 首页右侧 CodeViewer 展示代码草案

这份代码用于首页右侧 `CodeViewer` 展示，目标是**简洁表达 EdgeOne 上创建 Python Agent 的关键流程**，不要求直接运行。重点展示：

- `context.store`：保存用户/助手消息，支持历史恢复；
- `ChatSession`：基于 EdgeOne Store 读取历史并转换成 OpenAI-compatible messages；
- `context.tools`：获取 EdgeOne 沙箱工具；
- `build_tools()`：把 EdgeOne tools 转换成 OpenAI-compatible function calling schema；
- `httpx`：调用 OpenAI-compatible `/chat/completions`；
- tool calling：模型返回 `tool_calls` 后调用 EdgeOne 沙箱工具。

```python
import httpx

from agents._model import MODEL_CONFIG
from agents._session import ChatSession
from agents._tools import build_tools

SYSTEM_PROMPT = "..."

async def handler(context):
    message = context.request.body.get("message", "")
    conversation_id = context.conversation_id
    store = context.store

    # 1. EdgeOne Store：读取历史 + 保存用户消息
    session = ChatSession(store)
    history = await session.get_history(conversation_id)
    await session.save_user_message(conversation_id, message)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": message},
    ]

    # 2. EdgeOne Tools：读取平台沙箱工具并转换成 function calling tools
    tool_registry = build_tools(context)

    payload = {
        "model": MODEL_CONFIG["model"],
        "messages": messages,
        "stream": True,
    }

    if tool_registry.has_tools():
        payload["tools"] = tool_registry.tools
        payload["tool_choice"] = "auto"

    # 3. 调用 OpenAI-compatible LLM
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{MODEL_CONFIG['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {MODEL_CONFIG['api_key']}"},
            json=payload,
        )

    # 4. 处理模型返回：文本 or 工具调用
    result = response.json()
    assistant_message = result["choices"][0]["message"]

    if assistant_message.get("tool_calls"):
        for tool_call in assistant_message["tool_calls"]:
            name = tool_call["function"]["name"]
            args = tool_call["function"]["arguments"]

            # 调用 EdgeOne 沙箱工具，例如 commands / files / browser / code_interpreter
            tool_result = await tool_registry.execute(name, args)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": tool_result,
            })

        # 继续把工具结果发回模型，直到得到最终回答
        assistant_text = await continue_llm_with_tool_results(messages)
    else:
        assistant_text = assistant_message.get("content", "")

    # 5. EdgeOne Store：保存助手回复，供 /history 恢复
    await session.save_assistant_message(conversation_id, assistant_text)

    return {"answer": assistant_text}

async def continue_llm_with_tool_results(messages):
    # 伪代码：继续请求模型，省略流式 text_delta / tool_called 细节
    return "..."
```

## 建议在 CodeViewer 中突出展示的流程

1. `context.store`：读写用户/助手消息；
2. `ChatSession(store)`：把 EdgeOne Store 封装成会话历史接口；
3. `session.get_history()`：读取历史并转成 OpenAI-compatible messages；
4. `build_tools(context)`：从 `context.tools` 构建 OpenAI function calling tools；
5. `tool_registry.execute(name, args)`：调用 EdgeOne 沙箱工具；
6. `httpx.post(.../chat/completions)`：启动模型调用；
7. `session.save_assistant_message()`：保存助手回复，支持历史恢复。
