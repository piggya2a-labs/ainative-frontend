"""
感知 Agent — 内循环分析决策层

职责：
1. 读取 PostHog 过去 7 天的用户行为数据
2. 用 Claude 分析数据，生成结构化的改进指令
3. 将指令输出为 JSON 到 stdout，交给 v0 Worker 执行

这个脚本只做分析和决策，不写任何代码，不改任何文件。
代码生成和部署由 v0_worker.js 负责。

环境变量：
  POSTHOG_PERSONAL_API_KEY — PostHog Personal API Key
  POSTHOG_PROJECT_ID       — PostHog Project ID（默认 428900）
  ANTHROPIC_API_KEY        — Claude API Key

用法：
  python3 agents/perception_agent.py | node agents/v0_worker.js
"""
import os
import json
import sys
import requests
from datetime import datetime, timedelta, timezone

# ── 配置 ─────────────────────────────────────────────────────────────────
POSTHOG_PERSONAL_API_KEY = os.environ["POSTHOG_PERSONAL_API_KEY"]
POSTHOG_PROJECT_ID = os.environ.get("POSTHOG_PROJECT_ID", "428900")
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

POSTHOG_HOST = "https://us.posthog.com"

# ── Step 1: 读 PostHog 行为数据 ──────────────────────────────────────────
def fetch_posthog_insights() -> dict:
    print("📊 读取 PostHog 行为数据...", file=sys.stderr)
    headers = {"Authorization": f"Personal {POSTHOG_PERSONAL_API_KEY}"}
    base_url = f"{POSTHOG_HOST}/api/projects/{POSTHOG_PROJECT_ID}"

    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    insights = {
        "pageviews": 0,
        "custom_events": {},
        "cold_start": False,
        "top_pages": [],
        "period": f"{seven_days_ago} to {today}",
    }

    # 页面浏览量
    try:
        resp = requests.get(
            f"{base_url}/insights/trend/",
            headers=headers,
            params={
                "events": json.dumps([{"id": "$pageview", "type": "events"}]),
                "date_from": seven_days_ago,
                "date_to": today,
                "interval": "day"
            },
            timeout=15
        )
        if resp.status_code == 200:
            results = resp.json().get("result", [])
            if results:
                insights["pageviews"] = int(sum(results[0].get("data", [])))
                insights["daily_pageviews"] = results[0].get("data", [])
        print(f"  ✓ 页面浏览量: {insights['pageviews']}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  页面浏览量查询失败: {e}", file=sys.stderr)

    # 自定义事件
    try:
        resp = requests.get(
            f"{base_url}/events/?limit=500",
            headers=headers,
            timeout=15
        )
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            custom = [e for e in results if not e.get("event", "").startswith("$")]
            for e in custom:
                name = e.get("event", "unknown")
                insights["custom_events"][name] = insights["custom_events"].get(name, 0) + 1
        print(f"  ✓ 自定义事件: {insights['custom_events']}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  事件查询失败: {e}", file=sys.stderr)

    if insights["pageviews"] < 10:
        insights["cold_start"] = True
        print("  ℹ️  数据量不足，启用冷启动策略", file=sys.stderr)

    return insights

# ── Step 2: Claude 分析数据，生成改进指令 ────────────────────────────────
def analyze_and_decide(insights: dict) -> dict:
    print("🧠 Claude 分析数据，生成改进指令...", file=sys.stderr)

    cold_start_context = ""
    if insights["cold_start"]:
        cold_start_context = "\n网站刚上线，数据量不足（冷启动状态）。请基于 AI Native 产品最佳实践给出改进方向，重点提升首屏文案清晰度和 CTA 行动导向性。\n"

    event_summary = (
        json.dumps(insights["custom_events"], ensure_ascii=False, indent=2)
        if insights["custom_events"] else "暂无用户交互数据"
    )

    prompt = f"""你是一个 AI Native 产品的增长分析师，负责分析用户行为数据并指导前端 v0 Agent 优化页面。

## 过去 7 天的用户行为数据（{insights['period']}）
- 总页面浏览量：{insights['pageviews']}
- 用户交互事件：
{event_summary}
{cold_start_context}

## 可优化的目标文件（轮流选择，避免重复优化同一文件）
- components/hero.tsx — 首屏 Hero 区域（标题、副标题、CTA）
- components/features.tsx — Features 功能列表（标题、描述文案）
- components/cta-footer.tsx — CTA 区块（号召性用语、按钮文字）
- components/tools-grid.tsx — Tools 展示区（标题、分类文案）

## 任务
根据用户行为数据，选择最需要优化的一个文件，生成具体改进指令，交给 v0 Agent 执行。
选择策略：如果 pageviews < 100，优先优化 hero.tsx；否则轮流优化其他文件以提升整体质量。

输出一个 JSON 对象，字段如下：
- directive: 给 v0 的具体改进指令（英文，清晰描述改什么、怎么改，v0 会直接用这个指令修改代码）
- target_file: 从上面 4 个文件中选一个（完整路径，如 "components/hero.tsx"）
- analysis_summary: 中文分析摘要（一句话说明为什么选这个文件、做什么改动）
- cold_start: 是否冷启动（布尔值）
- priority: 优先级（"high" / "medium" / "low"）

directive 示例（hero.tsx）：
"Update the hero headline to emphasize that AI agents work autonomously 24/7. Change CTA button from 'Get Started' to 'Deploy Your First Agent'. Add a specific use case in the subheadline showing concrete value."

只返回 JSON，不要任何解释。"""

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        json={
            "model": "claude-haiku-4-5",
            "max_tokens": 512,
            "messages": [{"role": "user", "content": prompt}]
        }
    )

    if resp.status_code != 200:
        print(f"  ⚠️  Claude API 失败: {resp.status_code}，使用默认指令", file=sys.stderr)
        return _default_instruction(insights)

    content = resp.json()["content"][0]["text"].strip()

    # 提取 JSON
    if "```json" in content:
        start = content.find("```json") + 7
        end = content.rfind("```")
        content = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.rfind("```")
        content = content[start:end].strip()

    try:
        instruction = json.loads(content)
        print(f"  ✓ 改进指令: {instruction.get('analysis_summary', '')}", file=sys.stderr)
        return instruction
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON 解析失败: {e}，使用默认指令", file=sys.stderr)
        return _default_instruction(insights)

# 多文件轮流默认指令
_DEFAULT_INSTRUCTIONS = [
    {
        "directive": "Update the hero headline to be more specific about autonomous AI agent capabilities. Change the main headline to 'Your AI Agent Team, Working 24/7'. Update the subheadline to: 'Deploy specialized AI agents that research, plan, and execute tasks autonomously \u2014 no human supervision required.' Change CTA button text to 'Deploy Your First Agent'.",
        "target_file": "components/hero.tsx",
        "analysis_summary": "冷启动优化：提升 Hero 文案的具体性，强调 Agent 自主性这一核心价値主张",
        "priority": "medium"
    },
    {
        "directive": "Update the Features section to highlight three core AI-native capabilities: (1) Autonomous Execution \u2014 agents run 24/7 without human supervision, (2) Self-Healing \u2014 agents detect and fix issues automatically, (3) Composable \u2014 mix and match agents for any workflow. Make descriptions concrete and benefit-focused.",
        "target_file": "components/features.tsx",
        "analysis_summary": "优化 Features 文案，强调 AI Native 三大核心能力的具体性",
        "priority": "medium"
    },
    {
        "directive": "Update the CTA section headline to 'Start Deploying Agents Today'. Change the description to: 'Join teams using AI agents to automate research, content, and operations. No setup required.' Update the button text to 'Deploy Free Agent'.",
        "target_file": "components/cta-footer.tsx",
        "analysis_summary": "优化 CTA 区块号召力，降低转化阔値",
        "priority": "medium"
    },
]

import time

def _default_instruction(insights: dict) -> dict:
    # 根据当前小时轮流选择不同文件
    idx = (int(time.time()) // 86400) % len(_DEFAULT_INSTRUCTIONS)
    base = _DEFAULT_INSTRUCTIONS[idx]
    return {
        **base,
        "cold_start": insights["cold_start"],
    }

# ── 主流程 ────────────────────────────────────────────────────────────────
def main():
    print("=" * 60, file=sys.stderr)
    print("🔍 感知 Agent 启动", file=sys.stderr)
    print(f"   时间: {datetime.now(timezone.utc).isoformat()}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    insights = fetch_posthog_insights()
    instruction = analyze_and_decide(insights)

    # 输出 JSON 到 stdout，供 v0 Worker 通过 pipe 读取
    print(json.dumps(instruction, ensure_ascii=False, indent=2))

    print("\n✅ 感知 Agent 完成，指令已传递给 v0 Worker", file=sys.stderr)

if __name__ == "__main__":
    main()
