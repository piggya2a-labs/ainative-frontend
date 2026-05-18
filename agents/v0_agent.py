"""
内循环 Agent — AI Native Closed Loop

职责：
1. 读取 PostHog 过去 7 天的用户行为数据
2. 用 Claude 分析哪些页面区域需要改进
3. Claude 生成改进后的 React 组件代码
4. 通过 GitHub API 推送到 main 分支
5. Vercel 自动检测到 push，触发重新部署
6. 把改动记录写入 Sanity agentTasksBus

触发方式：Manus 定时任务，每周运行一次
环境变量：
  POSTHOG_PERSONAL_API_KEY — PostHog Personal API Key
  POSTHOG_PROJECT_ID       — PostHog Project ID（默认 428900）
  ANTHROPIC_API_KEY        — Claude API Key
  GITHUB_TOKEN             — GitHub Personal Access Token
  GITHUB_REPO_OWNER        — GitHub 组织（默认 piggya2a-labs）
  GITHUB_REPO_NAME         — GitHub 仓库名（默认 ainative-frontend）
  SANITY_PROJECT_ID        — Sanity Project ID（默认 zae9ml5g）
  SANITY_DATASET           — Sanity Dataset（默认 production）
  SANITY_API_WRITE_TOKEN   — Sanity Write Token
"""
import os
import json
import base64
import requests
from datetime import datetime, timezone

# ── 配置 ─────────────────────────────────────────────────────────────────
POSTHOG_PERSONAL_API_KEY = os.environ["POSTHOG_PERSONAL_API_KEY"]
POSTHOG_PROJECT_ID = os.environ.get("POSTHOG_PROJECT_ID", "428900")
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_OWNER = os.environ.get("GITHUB_REPO_OWNER", "piggya2a-labs")
GITHUB_REPO = os.environ.get("GITHUB_REPO_NAME", "ainative-frontend")
SANITY_PROJECT_ID = os.environ.get("SANITY_PROJECT_ID", "zae9ml5g")
SANITY_DATASET = os.environ.get("SANITY_DATASET", "production")
SANITY_TOKEN = os.environ["SANITY_API_WRITE_TOKEN"]

GITHUB_API = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}"
SANITY_MUTATIONS_URL = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/{SANITY_DATASET}"

# ── Step 1: 读 PostHog 行为数据 ──────────────────────────────────────────
def fetch_posthog_insights() -> dict:
    print("📊 读取 PostHog 行为数据...")
    headers = {"Authorization": f"Personal {POSTHOG_PERSONAL_API_KEY}"}
    base_url = f"https://us.posthog.com/api/projects/{POSTHOG_PROJECT_ID}"

    pageviews_resp = requests.get(f"{base_url}/events/?event=$pageview&limit=100", headers=headers)
    custom_resp = requests.get(f"{base_url}/events/?limit=200", headers=headers)

    insights = {"pageviews": 0, "custom_events": {}, "cold_start": False}

    if pageviews_resp.status_code == 200:
        results = pageviews_resp.json().get("results", [])
        insights["pageviews"] = len(results)
        print(f"  ✓ 页面浏览量: {len(results)}")

    if custom_resp.status_code == 200:
        results = custom_resp.json().get("results", [])
        custom = [e for e in results if not e.get("event", "").startswith("$")]
        for e in custom:
            name = e.get("event", "unknown")
            insights["custom_events"][name] = insights["custom_events"].get(name, 0) + 1
        print(f"  ✓ 自定义事件: {insights['custom_events']}")

    if insights["pageviews"] < 10:
        insights["cold_start"] = True
        print("  ℹ️  数据量不足，启用冷启动策略")

    return insights

# ── Step 2: 读取 GitHub 上的当前文件内容 ─────────────────────────────────
def get_github_file(path: str) -> tuple[str, str]:
    """返回 (decoded_content, sha)"""
    resp = requests.get(
        f"{GITHUB_API}/contents/{path}",
        headers={"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    )
    if resp.status_code == 200:
        data = resp.json()
        content = base64.b64decode(data["content"]).decode("utf-8")
        return content, data["sha"]
    return "", ""

# ── Step 3: Claude 分析 + 生成改进代码 ───────────────────────────────────
def analyze_and_generate(insights: dict) -> dict:
    print("🧠 Claude 分析并生成改进代码...")

    # 读取当前 Hero 组件（最高优先级改进目标）
    hero_code, hero_sha = get_github_file("components/hero.tsx")
    if not hero_code:
        print("  ⚠️  无法读取 hero.tsx")
        return {}

    cold_start_note = ""
    if insights["cold_start"]:
        cold_start_note = "注意：网站刚上线，数据量不足。使用冷启动策略，专注于提升首屏文案的清晰度和吸引力。"

    event_summary = json.dumps(insights["custom_events"], ensure_ascii=False) if insights["custom_events"] else "暂无数据"

    prompt = f"""你是一个 AI Native 产品的前端优化专家。

## 当前用户行为数据
- 页面浏览量：{insights['pageviews']}
- 事件分布：{event_summary}
{cold_start_note}

## 当前 Hero 组件代码
```tsx
{hero_code}
```

## 任务
基于以上数据，对 Hero 组件做一次有意义的改进。改进方向可以是：
- 优化标题文案，使价值主张更清晰
- 改进副标题，减少抽象描述，增加具体场景
- 优化 CTA 按钮文案
- 微调视觉层次（不改变整体结构）

要求：
1. 保持 Next.js + shadcn/ui 的技术栈不变
2. 保持组件接受 SiteConfig 类型的 props
3. 只返回完整的、可直接使用的 TypeScript 代码
4. 不要任何解释，只返回代码块

直接返回改进后的完整 hero.tsx 代码："""

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        json={
            "model": "claude-opus-4-5",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}]
        }
    )

    if resp.status_code != 200:
        print(f"  ⚠️  Claude API 失败: {resp.status_code} {resp.text[:200]}")
        return {}

    content = resp.json()["content"][0]["text"]

    # 提取代码块
    code = content
    if "```tsx" in content:
        start = content.find("```tsx") + 6
        end = content.rfind("```")
        code = content[start:end].strip()
    elif "```typescript" in content:
        start = content.find("```typescript") + 13
        end = content.rfind("```")
        code = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.rfind("```")
        code = content[start:end].strip()

    print(f"  ✓ Claude 生成了 {len(code)} 字符的新代码")
    return {
        "file": "components/hero.tsx",
        "sha": hero_sha,
        "original": hero_code,
        "improved": code,
        "analysis": f"基于 {insights['pageviews']} 次浏览，{'冷启动策略' if insights['cold_start'] else '数据驱动'}优化 Hero 文案"
    }

# ── Step 4: 通过 GitHub API 推送改进代码 ─────────────────────────────────
def push_to_github(result: dict) -> bool:
    print(f"🚀 推送改进代码到 GitHub: {result['file']}...")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    commit_message = f"feat(agent): 内循环优化 Hero 组件 [{now}]\n\n{result['analysis']}"

    encoded = base64.b64encode(result["improved"].encode("utf-8")).decode("utf-8")

    payload = {
        "message": commit_message,
        "content": encoded,
        "sha": result["sha"],
        "branch": "main"
    }

    resp = requests.put(
        f"{GITHUB_API}/contents/{result['file']}",
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        },
        json=payload
    )

    if resp.status_code in (200, 201):
        commit_sha = resp.json().get("commit", {}).get("sha", "")[:7]
        print(f"  ✓ 推送成功，commit: {commit_sha}")
        print(f"  ✓ Vercel 将自动检测到变更并重新部署")
        return True
    else:
        print(f"  ⚠️  推送失败: {resp.status_code} {resp.text[:300]}")
        return False

# ── Step 5: 记录到 Sanity agentTasksBus ──────────────────────────────────
def write_to_sanity(insights: dict, result: dict, pushed: bool):
    print("📝 写入 Sanity agentTasksBus...")
    now = datetime.now(timezone.utc).isoformat()
    task_id = f"inner-loop-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

    mutation = {
        "mutations": [{
            "createOrReplace": {
                "_id": task_id,
                "_type": "agentTask",
                "title": f"内循环迭代 - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
                "status": "completed" if pushed else "failed",
                "priority": "high",
                "targetArea": "hero",
                "analysis": result.get("analysis", ""),
                "posthogData": json.dumps(insights, ensure_ascii=False),
                "githubPushed": pushed,
                "createdAt": now,
                "completedAt": now,
                "agent": "inner-loop-agent"
            }
        }]
    }

    resp = requests.post(
        SANITY_MUTATIONS_URL,
        headers={"Authorization": f"Bearer {SANITY_TOKEN}", "Content-Type": "application/json"},
        json=mutation
    )
    if resp.status_code == 200:
        print(f"  ✓ 写入 Sanity 成功: {task_id}")
    else:
        print(f"  ⚠️  写入 Sanity 失败: {resp.status_code}")

# ── 主流程 ────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("🔄 内循环 Agent 启动")
    print(f"   时间: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    insights = fetch_posthog_insights()
    result = analyze_and_generate(insights)

    if not result:
        print("⚠️  未生成改进代码，本轮跳过")
        return

    pushed = push_to_github(result)
    write_to_sanity(insights, result, pushed)

    print("\n" + "=" * 60)
    print("✅ 内循环完成")
    print(f"   分析：{result.get('analysis', '')}")
    print(f"   部署：{'Vercel 自动部署中' if pushed else '推送失败'}")
    print("=" * 60)

if __name__ == "__main__":
    main()
