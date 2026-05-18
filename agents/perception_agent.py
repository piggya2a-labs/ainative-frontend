"""
感知 Agent (Perception Agent)
职责：读取 PostHog 行为数据 → 用 LLM 分析 → 生成改进任务 → 写入 Sanity agentTasksBus

运行方式：python3 perception_agent.py
触发方式：Manus 定时任务，每天运行一次

环境变量（必须设置）：
  SANITY_API_WRITE_TOKEN   - Sanity 写权限 Token
  POSTHOG_PERSONAL_API_KEY - PostHog Personal API Key
  ANTHROPIC_API_KEY        - Anthropic Claude API Key
  POSTHOG_PROJECT_ID       - PostHog Project ID（默认 428900）
  SANITY_PROJECT_ID        - Sanity Project ID（默认 zae9ml5g）
"""
import os
import json
import uuid
import requests
from datetime import datetime, timedelta, timezone
import anthropic

# ── 配置（全部从环境变量读取）────────────────────────────────────────────
SANITY_PROJECT_ID = os.environ.get("SANITY_PROJECT_ID", "zae9ml5g")
SANITY_DATASET = os.environ.get("SANITY_DATASET", "production")
SANITY_TOKEN = os.environ["SANITY_API_WRITE_TOKEN"]

POSTHOG_HOST = "https://us.posthog.com"
POSTHOG_PERSONAL_API_KEY = os.environ["POSTHOG_PERSONAL_API_KEY"]
POSTHOG_PROJECT_ID = os.environ.get("POSTHOG_PROJECT_ID", "428900")

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

SANITY_MUTATIONS_URL = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/{SANITY_DATASET}"
SANITY_QUERY_URL = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/{SANITY_DATASET}"

sanity_headers = {
    "Authorization": f"Bearer {SANITY_TOKEN}",
    "Content-Type": "application/json"
}

posthog_headers = {
    "Authorization": f"Bearer {POSTHOG_PERSONAL_API_KEY}",
    "Content-Type": "application/json"
}

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── Step 1: 读取 PostHog 行为数据 ─────────────────────────────────────────
def fetch_posthog_analytics():
    """从 PostHog 拉取过去 7 天的关键行为数据"""
    print("[感知 Agent] 正在读取 PostHog 数据...")
    
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")
    
    analytics = {}
    
    # 1. 页面访问量
    try:
        resp = requests.get(
            f"{POSTHOG_HOST}/api/projects/{POSTHOG_PROJECT_ID}/insights/trend/",
            headers=posthog_headers,
            params={
                "events": json.dumps([{"id": "$pageview", "name": "Pageview", "type": "events"}]),
                "date_from": seven_days_ago,
                "date_to": today,
                "interval": "day"
            },
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("result", [])
            if results:
                total_views = sum(results[0].get("data", []))
                analytics["total_pageviews_7d"] = total_views
                analytics["daily_pageviews"] = results[0].get("data", [])
    except Exception as e:
        print(f"  [警告] 页面访问量查询失败: {e}")
        analytics["total_pageviews_7d"] = 0
        analytics["daily_pageviews"] = []

    # 2. 关键事件（CTA 点击、功能卡片点击等）
    try:
        resp = requests.get(
            f"{POSTHOG_HOST}/api/projects/{POSTHOG_PROJECT_ID}/insights/trend/",
            headers=posthog_headers,
            params={
                "events": json.dumps([
                    {"id": "cta_click", "name": "CTA Click", "type": "events"},
                    {"id": "feature_card_click", "name": "Feature Card Click", "type": "events"},
                    {"id": "hero_cta_click", "name": "Hero CTA Click", "type": "events"},
                    {"id": "nav_cta_click", "name": "Nav CTA Click", "type": "events"},
                ]),
                "date_from": seven_days_ago,
                "date_to": today,
            },
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("result", [])
            for r in results:
                event_name = r.get("action", {}).get("name", "unknown")
                total = sum(r.get("data", []))
                analytics[f"event_{event_name.lower().replace(' ', '_')}_7d"] = total
    except Exception as e:
        print(f"  [警告] 事件查询失败: {e}")

    # 3. 会话数量
    try:
        resp = requests.get(
            f"{POSTHOG_HOST}/api/projects/{POSTHOG_PROJECT_ID}/insights/trend/",
            headers=posthog_headers,
            params={
                "events": json.dumps([{"id": "$autocapture", "name": "Sessions", "type": "events", "math": "unique_session"}]),
                "date_from": seven_days_ago,
                "date_to": today,
            },
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("result", [])
            if results:
                analytics["unique_sessions_7d"] = sum(results[0].get("data", []))
    except Exception as e:
        print(f"  [警告] 会话数查询失败: {e}")
        analytics["unique_sessions_7d"] = 0

    print(f"  [感知 Agent] PostHog 数据: {json.dumps(analytics, ensure_ascii=False)}")
    return analytics

# ── Step 2: 读取当前 Sanity 内容 ──────────────────────────────────────────
def fetch_current_content():
    """读取当前 Sanity siteConfig 内容"""
    print("[感知 Agent] 读取当前网站内容...")
    resp = requests.get(
        SANITY_QUERY_URL,
        headers=sanity_headers,
        params={"query": '*[_id == "siteConfig"][0]'}
    )
    if resp.status_code == 200:
        result = resp.json().get("result", {})
        return result
    return {}

# ── Step 3: LLM 分析并生成改进任务 ───────────────────────────────────────
def analyze_and_generate_tasks(analytics: dict, current_content: dict) -> list:
    """用 LLM 分析数据，生成具体的内容改进任务"""
    print("[感知 Agent] 正在用 LLM 分析数据，生成改进任务...")

    current_hero = current_content.get("hero", {})
    current_features = current_content.get("features", [])
    current_cta = current_content.get("cta", {})

    prompt = f"""你是一个专业的 AI Native 产品运营 Agent。

你的任务是分析网站的用户行为数据，然后生成具体的内容改进任务。

## 当前网站内容
Hero 标题: {current_hero.get('headline', '未知')}
Hero 副标题: {current_hero.get('subheadline', '未知')}
Hero CTA: {current_hero.get('ctaText', '未知')}
功能数量: {len(current_features)} 个
CTA 标题: {current_cta.get('headline', '未知')}

## 过去 7 天的用户行为数据
{json.dumps(analytics, ensure_ascii=False, indent=2)}

## 分析要求
1. 如果数据为空或访问量很低（<50次），说明网站刚上线，需要优化内容吸引力
2. 如果 CTA 点击率低（点击数/访问量 < 3%），需要优化 CTA 文案
3. 如果功能卡片点击率低，需要优化功能描述
4. 基于数据生成 1-3 个具体的内容改进任务

## 输出格式（严格 JSON）
返回一个 JSON 数组，每个任务包含：
- id: 唯一 ID（字符串）
- type: 任务类型（"hero_update" | "feature_update" | "cta_update" | "nav_update"）
- priority: 优先级（"high" | "medium" | "low"）
- reason: 改进原因（基于数据的分析，中文，50字以内）
- changes: 具体的改动内容（对象，包含要修改的字段和新值）
- hypothesis: 预期效果（中文，30字以内）

只返回 JSON 数组，不要任何其他文字。"""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500
        )
        content = response.content[0].text.strip()
        # 清理可能的 markdown 代码块
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        tasks = json.loads(content)
        print(f"  [感知 Agent] 生成了 {len(tasks)} 个改进任务")
        for t in tasks:
            print(f"    - [{t.get('priority','?')}] {t.get('type','?')}: {t.get('reason','?')}")
        return tasks
    except Exception as e:
        print(f"  [错误] LLM 分析失败: {e}")
        # 降级：生成一个默认的优化任务
        return [{
            "id": str(uuid.uuid4())[:8],
            "type": "hero_update",
            "priority": "medium",
            "reason": "网站刚上线，优化 Hero 区域以提升第一印象",
            "changes": {
                "headline": "让 AI Agent 团队替你完成一切",
                "subheadline": "ONIT 将复杂的业务目标拆解为 Agent 可执行的任务，自动完成研究、规划、执行的全流程。"
            },
            "hypothesis": "更直接的价值主张提升用户理解度"
        }]

# ── Step 4: 写入 Sanity agentTasksBus ────────────────────────────────────
def write_tasks_to_sanity(tasks: list, analytics: dict):
    """将生成的任务写入 Sanity agentTasksBus"""
    print("[感知 Agent] 将任务写入 Sanity agentTasksBus...")
    
    now = datetime.now(timezone.utc).isoformat()
    
    enriched_tasks = []
    for task in tasks:
        enriched_tasks.append({
            "_key": task.get("id", str(uuid.uuid4())[:8]),
            "taskId": task.get("id", str(uuid.uuid4())[:8]),
            "type": task.get("type", "unknown"),
            "priority": task.get("priority", "medium"),
            "status": "pending",
            "reason": task.get("reason", ""),
            "hypothesis": task.get("hypothesis", ""),
            "changes": json.dumps(task.get("changes", {}), ensure_ascii=False),
            "createdAt": now,
            "executedAt": None,
            "result": None
        })
    
    mutations = [
        {
            "patch": {
                "id": "agentTasksBus",
                "setIfMissing": {"tasks": []},
                "insert": {
                    "after": "tasks[-1]",
                    "items": enriched_tasks
                }
            }
        },
        {
            "patch": {
                "id": "agentTasksBus",
                "set": {
                    "lastAnalysisAt": now,
                    "lastAnalyticsSnapshot": json.dumps(analytics, ensure_ascii=False)
                },
                "inc": {"cycleCount": 1}
            }
        }
    ]
    
    resp = requests.post(SANITY_MUTATIONS_URL, headers=sanity_headers, json={"mutations": mutations})
    if resp.status_code == 200:
        print(f"  [感知 Agent] 成功写入 {len(enriched_tasks)} 个任务")
    else:
        print(f"  [错误] 写入失败: {resp.json()}")

# ── 主流程 ────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print(f"[感知 Agent] 启动 — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)
    
    analytics = fetch_posthog_analytics()
    current_content = fetch_current_content()
    tasks = analyze_and_generate_tasks(analytics, current_content)
    
    if tasks:
        write_tasks_to_sanity(tasks, analytics)
    
    print("\n[感知 Agent] 完成。等待执行 Agent 处理任务。")
    print("=" * 60)

if __name__ == "__main__":
    main()
