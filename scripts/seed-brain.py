#!/usr/bin/env python3
"""
把 ONIT 品牌知识写入 Gentic Brain，作为 AI 内循环的品牌记忆基础。
每次品牌定位有重大变化时重新运行即可。
"""

import os, json, requests, sys

GENTIC_API_KEY = os.environ.get("GENTIC_API_KEY", "gentic_e3cdc7f25d535fd78337cc2e5f9f3532")
BRAIN_URL = "https://mcp.gentic.co/brain"
HEADERS_BASE = {
    "Authorization": f"Bearer {GENTIC_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

BRAND_KNOWLEDGE = """# ONIT — 品牌核心知识库

## 产品定位

ONIT 是一个 AI Native 的 Agent 团队管理平台。核心价值主张：你的 AI 员工团队，7x24 小时工作。

不是聊天机器人，不是自动化工具，而是一支真正的 AI 员工团队——每个 Agent 有名字、有职责、有能力边界，通过 Telegram 等渠道直接和你对话、帮你干活。

## 目标用户

中小企业主、独立创业者、小团队负责人。没有技术背景，但想用 AI 提升效率。不想学复杂工具，希望像管理真实员工一样管理 AI。

## 核心差异化

1. Agent 有身份感：不是调用 AI，是和 AI 同事协作
2. Telegram 原生：用户最熟悉的沟通方式，零学习成本
3. MCP 生态：通过 Model Context Protocol 接入外部工具，Agent 能力可扩展
4. 闭环自优化：网站本身由 AI Agent 维护和优化，产品即演示

## 视觉风格

极简、克制、专业。黑白为主，ONIT Green (#22c55e) 作为唯一强调色。等宽字体用于技术细节，无衬线字体用于正文。不用渐变、不用卡通图标、不用过度装饰。数字说话：用具体指标而非形容词。

## 文案语气

直接、简洁，不废话。第二人称（你的团队而不是用户的团队）。用动词开头（部署、连接、扩展）。避免 AI 行业的过度营销词汇（革命性、颠覆性）。

## 技术栈（前端）

Next.js 15 App Router + Tailwind CSS v4 + Shadcn UI。Supabase（数据库+认证）。Sanity CMS（内容管理）。PostHog（用户行为分析）。Vercel（部署）。GitHub Actions（AI 内循环自动优化）。

## 竞品参照

Gentic.co：电商垂直 Agent 平台，视觉极简黑白，数字结果驱动，是设计语言的参照。
Lindy.ai：AI 员工概念，产品定位最接近。
Relevance AI：Agent 团队管理，UI 成熟度参照。

## 绝对禁止

不硬编码用户可见文案（从 Sanity 读取）。不用裸色值（用 CSS token）。不引入新 UI 库（只用 Shadcn）。不删除 /api/health 端点。不破坏 /api/agent/update-content 端点。
"""


def init_session(url):
    resp = requests.post(
        url,
        headers=HEADERS_BASE,
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "onit-seed", "version": "1.0"},
        }},
        timeout=15,
    )
    session_id = resp.headers.get("mcp-session-id")
    if not session_id:
        raise RuntimeError(f"No session ID: {resp.text[:200]}")
    return session_id


def mcp_call(url, session_id, method, params):
    resp = requests.post(
        url,
        headers={**HEADERS_BASE, "Mcp-Session-Id": session_id},
        json={"jsonrpc": "2.0", "id": 2, "method": method, "params": params},
        timeout=30,
    )
    for line in resp.text.splitlines():
        if line.startswith("data:"):
            payload = json.loads(line[5:])
            if "result" in payload:
                return payload["result"]
            if "error" in payload:
                raise RuntimeError(f"MCP error: {payload['error']}")
    raise RuntimeError(f"No result: {resp.text[:300]}")


def main():
    print("🧠 初始化 Brain MCP session...")
    session_id = init_session(BRAIN_URL)
    print(f"   Session: {session_id}")

    print("📝 写入 ONIT 品牌知识...")
    result = mcp_call(BRAIN_URL, session_id, "tools/call", {
        "name": "brain_capture_text",
        "arguments": {
            "content_text": BRAND_KNOWLEDGE,
            "slug": "onit-brand-core",
            "source_metadata": {
                "custom_label": "brand-knowledge",
                "sender": "onit-seed-script",
            }
        }
    })
    content = result.get("content", [{}])
    text = content[0].get("text", str(result)) if content else str(result)
    print(f"   结果: {text[:300]}")
    print("✅ 品牌知识写入完成")


if __name__ == "__main__":
    main()
