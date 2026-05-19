#!/usr/bin/env python3
"""
从 Sanity brandKnowledge 文档读取品牌知识，同步到 Gentic Brain。
在 Sanity Studio → 品牌知识库 里编辑内容，这个脚本会把最新内容推送到 Gentic Brain。
由 inner-loop.yml 每日自动调用，也可手动运行：
  GENTIC_API_KEY=xxx SANITY_API_WRITE_TOKEN=xxx python3 scripts/seed-brain.py
"""
import os, json, requests, sys

GENTIC_API_KEY = os.environ.get("GENTIC_API_KEY", "")
SANITY_PROJECT_ID = os.environ.get("SANITY_PROJECT_ID", "zae9ml5g")
SANITY_DATASET = os.environ.get("SANITY_DATASET", "production")
SANITY_API_WRITE_TOKEN = os.environ.get("SANITY_API_WRITE_TOKEN", "")
BRAIN_URL = "https://mcp.gentic.co/brain"

HEADERS_BASE = {
    "Authorization": f"Bearer {GENTIC_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}


def fetch_brand_knowledge():
    """从 Sanity 读取 brandKnowledge 文档"""
    query = '*[_type == "brandKnowledge" && _id == "brandKnowledge"][0]'
    url = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/{SANITY_DATASET}"
    resp = requests.get(
        url,
        params={"query": query},
        headers={"Authorization": f"Bearer {SANITY_API_WRITE_TOKEN}"},
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sanity 查询失败: {resp.status_code} {resp.text[:200]}")
    result = resp.json().get("result")
    if not result:
        raise RuntimeError("Sanity 中没有找到 brandKnowledge 文档，请先在 Sanity Studio → 品牌知识库 填写内容")
    return result


def format_as_markdown(doc: dict) -> str:
    """把 Sanity 文档格式化为 Markdown，供 Gentic Brain 向量化"""
    lines = ["# ONIT — 品牌核心知识库\n"]

    if doc.get("positioning"):
        lines.append("## 产品定位")
        lines.append(doc["positioning"])
        lines.append("")

    if doc.get("targetUser"):
        lines.append("## 目标用户")
        lines.append(doc["targetUser"])
        lines.append("")

    if doc.get("differentiation"):
        lines.append("## 核心差异化")
        for item in doc["differentiation"]:
            lines.append(f"- {item}")
        lines.append("")

    if doc.get("visualStyle"):
        lines.append("## 视觉风格")
        lines.append(doc["visualStyle"])
        lines.append("")

    if doc.get("voiceTone"):
        lines.append("## 文案语气")
        lines.append(doc["voiceTone"])
        lines.append("")

    if doc.get("competitors"):
        lines.append("## 竞品参照")
        for c in doc["competitors"]:
            name = c.get("name", "")
            url = c.get("url", "")
            learn = c.get("learnFrom", "")
            lines.append(f"- **{name}** ({url})：{learn}")
        lines.append("")

    if doc.get("hardRules"):
        lines.append("## 绝对禁止")
        for rule in doc["hardRules"]:
            lines.append(f"- {rule}")
        lines.append("")

    if doc.get("updatedAt"):
        lines.append(f"_最后更新：{doc['updatedAt']}_")

    return "\n".join(lines)


def init_brain_session():
    resp = requests.post(
        BRAIN_URL,
        headers=HEADERS_BASE,
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "onit-seed", "version": "2.0"},
        }},
        timeout=15,
    )
    session_id = resp.headers.get("mcp-session-id")
    if not session_id:
        raise RuntimeError(f"Brain MCP 初始化失败: {resp.text[:200]}")
    return session_id


def mcp_call(session_id, method, params):
    resp = requests.post(
        BRAIN_URL,
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
    raise RuntimeError(f"无响应: {resp.text[:300]}")


def main():
    if not GENTIC_API_KEY:
        print("⚠️  GENTIC_API_KEY 未设置，跳过 Brain 同步")
        sys.exit(0)

    print("📖 从 Sanity 读取品牌知识...")
    doc = fetch_brand_knowledge()
    print(f"   读取成功，定位：{doc.get('positioning', '')[:60]}...")

    content = format_as_markdown(doc)
    print(f"   格式化完成，共 {len(content)} 字符")

    print("🧠 初始化 Gentic Brain MCP session...")
    session_id = init_brain_session()

    print("📝 同步到 Gentic Brain...")
    result = mcp_call(session_id, "tools/call", {
        "name": "brain_capture_text",
        "arguments": {
            "content_text": content,
            "slug": "onit-brand-core",
            "source_metadata": {
                "custom_label": "brand-knowledge",
                "sender": "sanity-sync",
                "sanity_updated_at": doc.get("updatedAt", ""),
            }
        }
    })
    text = result.get("content", [{}])[0].get("text", str(result))
    print(f"   结果: {text[:200]}")
    print("✅ 品牌知识已从 Sanity 同步到 Gentic Brain")


if __name__ == "__main__":
    main()
