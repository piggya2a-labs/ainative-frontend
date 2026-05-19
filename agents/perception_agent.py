"""
感知 Agent — 内循环分析决策层
职责：
1. 读取 PostHog 过去 7 天的用户行为数据
2. 用 Gentic Research MCP 感知竞品动态和市场趋势
3. 用 Gentic Brain MCP 查询 ONIT 品牌上下文
4. 用 Claude 综合三类信息，生成有方向感的改进指令
5. 将指令输出为 JSON 到 stdout，交给 claude_worker.js 执行

环境变量：
  POSTHOG_PERSONAL_API_KEY — PostHog Personal API Key
  POSTHOG_PROJECT_ID       — PostHog Project ID（默认 428900）
  ANTHROPIC_API_KEY        — Claude API Key
  GENTIC_API_KEY           — Gentic MCP API Key（可选，无则跳过竞品感知）

用法：
  python3 agents/perception_agent.py | node agents/claude_worker.js
"""
import os, json, sys, time, requests
from datetime import datetime, timedelta, timezone

POSTHOG_PERSONAL_API_KEY = os.environ["POSTHOG_PERSONAL_API_KEY"]
POSTHOG_PROJECT_ID = os.environ.get("POSTHOG_PROJECT_ID", "428900")
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GENTIC_API_KEY = os.environ.get("GENTIC_API_KEY", "")
POSTHOG_HOST = "https://us.posthog.com"
GENTIC_RESEARCH_URL = "https://mcp.gentic.co/research"
GENTIC_BRAIN_URL = "https://mcp.gentic.co/brain"

# ── Gentic MCP 工具函数 ───────────────────────────────────────────────────

def gentic_init_session(url, api_key):
    try:
        resp = requests.post(url, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }, json={"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2024-11-05","capabilities":{},
            "clientInfo":{"name":"onit-perception","version":"1.0"},
        }}, timeout=15)
        return resp.headers.get("mcp-session-id")
    except Exception as e:
        print(f"  ⚠️  Gentic session 初始化失败: {e}", file=sys.stderr)
        return None

def gentic_call(url, api_key, session_id, tool_name, args):
    try:
        resp = requests.post(url, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": session_id,
        }, json={"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
            "name": tool_name, "arguments": args,
        }}, timeout=30)
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                payload = json.loads(line[5:])
                if "result" in payload:
                    content = payload["result"].get("content", [])
                    return content[0].get("text","") if content else ""
                if "error" in payload:
                    print(f"  ⚠️  Gentic error ({tool_name}): {payload['error']}", file=sys.stderr)
                    return None
    except Exception as e:
        print(f"  ⚠️  Gentic call 失败 ({tool_name}): {e}", file=sys.stderr)
    return None

# ── Step 1: PostHog 行为数据 ──────────────────────────────────────────────

def fetch_posthog_insights():
    print("📊 读取 PostHog 行为数据...", file=sys.stderr)
    headers = {"Authorization": f"Personal {POSTHOG_PERSONAL_API_KEY}"}
    base_url = f"{POSTHOG_HOST}/api/projects/{POSTHOG_PROJECT_ID}"
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")
    insights = {"pageviews":0,"custom_events":{},"cold_start":False,"top_pages":[],"period":f"{seven_days_ago} to {today}"}

    try:
        resp = requests.get(f"{base_url}/insights/trend/", headers=headers, params={
            "events": json.dumps([{"id":"$pageview","type":"events"}]),
            "date_from": seven_days_ago, "date_to": today, "interval": "day"
        }, timeout=15)
        if resp.status_code == 200:
            results = resp.json().get("result", [])
            if results:
                insights["pageviews"] = int(sum(results[0].get("data", [])))
                insights["daily_pageviews"] = results[0].get("data", [])
        print(f"  ✓ 页面浏览量: {insights['pageviews']}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  页面浏览量查询失败: {e}", file=sys.stderr)

    try:
        resp = requests.get(f"{base_url}/events/?limit=500", headers=headers, timeout=15)
        if resp.status_code == 200:
            for e in resp.json().get("results", []):
                name = e.get("event","")
                if not name.startswith("$"):
                    insights["custom_events"][name] = insights["custom_events"].get(name,0)+1
        print(f"  ✓ 自定义事件: {len(insights['custom_events'])} 种", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  自定义事件查询失败: {e}", file=sys.stderr)

    if insights["pageviews"] < 10:
        insights["cold_start"] = True
        print("  ℹ️  冷启动模式（pageviews < 10）", file=sys.stderr)
    return insights

# ── Step 2: Gentic Research — 竞品感知 ───────────────────────────────────

def fetch_market_intelligence():
    if not GENTIC_API_KEY:
        print("⏭️  跳过竞品感知（未配置 GENTIC_API_KEY）", file=sys.stderr)
        return {"reddit_insights":"","trends":"","competitor_news":""}

    print("🌐 Gentic Research — 感知市场动态...", file=sys.stderr)
    session_id = gentic_init_session(GENTIC_RESEARCH_URL, GENTIC_API_KEY)
    if not session_id:
        return {"reddit_insights":"","trends":"","competitor_news":""}

    intel = {}

    print("  → Reddit 搜索 AI agent platform 用户讨论...", file=sys.stderr)
    intel["reddit_insights"] = gentic_call(GENTIC_RESEARCH_URL, GENTIC_API_KEY, session_id,
        "search_reddit", {"query":"AI agent platform team automation","subreddits":["artificial","startups","SaaS"],"limit":10,"sort":"relevance"}) or ""

    print("  → Google Trends 分析...", file=sys.stderr)
    intel["trends"] = gentic_call(GENTIC_RESEARCH_URL, GENTIC_API_KEY, session_id,
        "get_google_trends", {"keywords":["AI agent","AI automation","AI team"],"timeRange":"3m"}) or ""

    print("  → 搜索竞品最新动态...", file=sys.stderr)
    intel["competitor_news"] = gentic_call(GENTIC_RESEARCH_URL, GENTIC_API_KEY, session_id,
        "search_web", {"query":"Lindy AI agent platform new features 2026","num_results":5}) or ""

    print("  ✅ 市场感知完成", file=sys.stderr)
    return intel

# ── Step 3: Gentic Brain — 品牌上下文 ────────────────────────────────────

def fetch_brand_context():
    if not GENTIC_API_KEY:
        return ""
    print("🧠 Gentic Brain — 查询品牌上下文...", file=sys.stderr)
    session_id = gentic_init_session(GENTIC_BRAIN_URL, GENTIC_API_KEY)
    if not session_id:
        return ""
    result = gentic_call(GENTIC_BRAIN_URL, GENTIC_API_KEY, session_id,
        "brain_query", {"query":"ONIT 品牌定位、视觉风格、文案语气、绝对禁止事项"})
    if result:
        print(f"  ✓ 品牌上下文: {len(result)} 字符", file=sys.stderr)
    return result or ""

# ── Step 4: Claude 综合分析决策 ───────────────────────────────────────────

def analyze_and_decide(insights, market_intel, brand_context):
    print("🤖 Claude 分析决策...", file=sys.stderr)

    market_summary = ""
    if market_intel.get("reddit_insights"):
        market_summary += f"\n\n### Reddit 用户讨论（AI Agent 平台）\n{market_intel['reddit_insights'][:800]}"
    if market_intel.get("trends"):
        market_summary += f"\n\n### Google Trends\n{market_intel['trends'][:400]}"
    if market_intel.get("competitor_news"):
        market_summary += f"\n\n### 竞品最新动态\n{market_intel['competitor_news'][:600]}"

    brand_section = f"\n\n### ONIT 品牌知识（来自 Brain）\n{brand_context[:1000]}" if brand_context else ""

    prompt = f"""你是 ONIT 前端的感知 Agent，负责分析数据并生成具体的代码改进指令。

## 当前数据

### PostHog 行为数据
- 过去 7 天 pageviews: {insights['pageviews']}
- 自定义事件: {json.dumps(insights['custom_events'], ensure_ascii=False)}
- 冷启动: {insights['cold_start']}
- 统计周期: {insights['period']}
{brand_section}
{market_summary}

## 可优化的文件

1. components/hero.tsx — 首屏 Hero 区域（标题、副标题、CTA 按钮）
2. components/features.tsx — 功能特性区块
3. components/cta-footer.tsx — 底部 CTA 区块
4. components/marketplace-preview.tsx — Marketplace 预览区块

## 任务

综合以上三类信息（用户行为数据 + 市场动态 + 品牌知识），生成一个具体的代码改进指令。

选择策略：
- 如果 pageviews < 100，优先优化 hero.tsx（最高曝光）
- 如果市场情报显示某个用户痛点，选择最能解决该痛点的文件
- 否则轮流优化其他文件以提升整体质量

输出一个 JSON 对象，字段如下：
- directive: 给 Claude Code 的具体改进指令（英文，清晰描述改什么、怎么改）
- target_file: 从上面 4 个文件中选一个（完整路径）
- analysis_summary: 中文分析摘要（一句话说明为什么选这个文件、做什么改动，以及用到了哪类信息）
- cold_start: 是否冷启动（布尔值）
- priority: 优先级（"high" / "medium" / "low"）
- market_driven: 是否由市场情报驱动（布尔值）

只返回 JSON，不要任何解释。"""

    resp = requests.post("https://api.anthropic.com/v1/messages", headers={
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }, json={"model":"claude-sonnet-4-5","max_tokens":600,"messages":[{"role":"user","content":prompt}]})

    if resp.status_code != 200:
        print(f"  ⚠️  Claude API 失败: {resp.status_code}，使用默认指令", file=sys.stderr)
        return _default_instruction(insights)

    content = resp.json()["content"][0]["text"].strip()
    if "```json" in content:
        content = content[content.find("```json")+7:content.rfind("```")].strip()
    elif "```" in content:
        content = content[content.find("```")+3:content.rfind("```")].strip()

    try:
        instruction = json.loads(content)
        print(f"  ✓ 改进指令: {instruction.get('analysis_summary','')}", file=sys.stderr)
        print(f"  ✓ 市场驱动: {instruction.get('market_driven', False)}", file=sys.stderr)
        return instruction
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON 解析失败: {e}，使用默认指令", file=sys.stderr)
        return _default_instruction(insights)

_DEFAULT_INSTRUCTIONS = [
    {"directive":"Update the hero headline to emphasize that AI agents work autonomously 24/7. Change the main headline to 'Your AI Agent Team, Working 24/7'. Update the subheadline to: 'Deploy specialized AI agents that research, plan, and execute tasks autonomously — no human supervision required.' Change CTA button text to 'Deploy Your First Agent'.","target_file":"components/hero.tsx","analysis_summary":"冷启动优化：提升 Hero 文案的具体性，强调 Agent 自主性这一核心价值主张","priority":"medium","market_driven":False},
    {"directive":"Update the Features section to highlight three core AI-native capabilities: (1) Autonomous Execution — agents run 24/7 without human supervision, (2) Self-Healing — agents detect and fix issues automatically, (3) Composable — mix and match agents for any workflow. Make descriptions concrete and benefit-focused.","target_file":"components/features.tsx","analysis_summary":"优化 Features 文案，强调 AI Native 三大核心能力的具体性","priority":"medium","market_driven":False},
    {"directive":"Update the CTA section headline to 'Start Deploying Agents Today'. Change the description to: 'Join teams using AI agents to automate research, content, and operations. No setup required.' Update the button text to 'Deploy Free Agent'.","target_file":"components/cta-footer.tsx","analysis_summary":"优化 CTA 区块号召力，降低转化阈值","priority":"medium","market_driven":False},
]

def _default_instruction(insights):
    idx = (int(time.time()) // 86400) % len(_DEFAULT_INSTRUCTIONS)
    return {**_DEFAULT_INSTRUCTIONS[idx], "cold_start": insights["cold_start"]}

# ── 主流程 ────────────────────────────────────────────────────────────────

def main():
    print("=" * 60, file=sys.stderr)
    print("🔍 感知 Agent 启动", file=sys.stderr)
    print(f"   时间: {datetime.now(timezone.utc).isoformat()}", file=sys.stderr)
    print(f"   Gentic: {'已配置' if GENTIC_API_KEY else '未配置（跳过竞品感知）'}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    insights = fetch_posthog_insights()
    market_intel = fetch_market_intelligence()
    brand_context = fetch_brand_context()
    instruction = analyze_and_decide(insights, market_intel, brand_context)

    print(json.dumps(instruction, ensure_ascii=False, indent=2))
    print("\n✅ 感知 Agent 完成，指令已传递给 claude_worker", file=sys.stderr)

if __name__ == "__main__":
    main()
