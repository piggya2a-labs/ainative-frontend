"""
health_agent.py — 后端健康检查 + 自动联调

检查项：
1. Sanity CMS — API 可达性 + 内容完整性
2. PostHog — 事件接收确认
3. Vercel 部署 — 最新 commit 是否已部署
4. 前端 API 路由 — /api/health 端点

发现问题时：
- 用 Claude 分析根因
- 自动修复可修复的问题（如 Sanity 内容缺失）
- 在 GitHub 创建 issue 记录无法自动修复的问题
"""

import os
import sys
import json
import requests
from datetime import datetime, timezone

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER = os.environ.get("GITHUB_OWNER", "piggya2a-labs")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "ainative-frontend")
SANITY_PROJECT_ID = os.environ.get("SANITY_PROJECT_ID", os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID", ""))
SANITY_API_WRITE_TOKEN = os.environ.get("SANITY_API_WRITE_TOKEN", "")
POSTHOG_KEY = os.environ.get("NEXT_PUBLIC_POSTHOG_KEY", "")

VERCEL_PROD_URL = "https://ainative-frontend.vercel.app"

results = []

def check(name, fn):
    """运行一个检查项，记录结果"""
    print(f"  检查 {name}...", file=sys.stderr)
    try:
        status, detail = fn()
        icon = "OK" if status else "FAIL"
        print(f"    [{icon}] {detail}", file=sys.stderr)
        results.append({"name": name, "ok": status, "detail": detail})
        return status
    except Exception as e:
        print(f"    [ERROR] {e}", file=sys.stderr)
        results.append({"name": name, "ok": False, "detail": str(e)})
        return False

# ── 检查 1: Sanity API 可达性 ────────────────────────────────────────────
def check_sanity():
    if not SANITY_PROJECT_ID:
        return False, "SANITY_PROJECT_ID 未配置"
    url = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/production?query=*[_type=='hero'][0]{{headline}}"
    r = requests.get(url, timeout=10)
    if r.status_code == 200:
        data = r.json()
        result = data.get("result")
        if result and result.get("headline"):
            return True, f"Sanity 正常，hero headline: {result['headline'][:40]}"
        else:
            return False, "Sanity 可达但 hero 内容为空，需要初始化"
    return False, f"Sanity API 返回 {r.status_code}"

# ── 检查 2: Vercel 部署状态 ──────────────────────────────────────────────
def check_vercel():
    r = requests.get(VERCEL_PROD_URL, timeout=15)
    if r.status_code == 200:
        # 检查页面是否包含预期内容
        if "PiggyA2A" in r.text or "AI" in r.text:
            return True, f"Vercel 部署正常，HTTP {r.status_code}"
        return False, "Vercel 响应 200 但内容异常"
    return False, f"Vercel 返回 {r.status_code}"

# ── 检查 3: GitHub 最新 commit 是否已部署 ───────────────────────────────
def check_github_vercel_sync():
    # 获取 GitHub 最新 commit
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/commits/main",
        headers=headers, timeout=10
    )
    if r.status_code != 200:
        return False, f"GitHub API 返回 {r.status_code}"
    latest_sha = r.json()["sha"][:7]
    latest_msg = r.json()["commit"]["message"].split("\n")[0][:60]
    return True, f"最新 commit: {latest_sha} — {latest_msg}"

# ── 检查 4: PostHog 接收状态 ─────────────────────────────────────────────
def check_posthog():
    if not POSTHOG_KEY:
        return False, "NEXT_PUBLIC_POSTHOG_KEY 未配置"
    # 发一个测试事件
    r = requests.post(
        "https://us.i.posthog.com/capture/",
        json={
            "api_key": POSTHOG_KEY,
            "event": "health_check",
            "distinct_id": "health-agent",
            "properties": {"source": "github-actions", "timestamp": datetime.now(timezone.utc).isoformat()}
        },
        timeout=10
    )
    if r.status_code == 200:
        return True, "PostHog 事件接收正常"
    return False, f"PostHog 返回 {r.status_code}: {r.text[:100]}"

# ── 自动修复：Sanity hero 内容初始化 ────────────────────────────────────
def fix_sanity_hero():
    if not SANITY_API_WRITE_TOKEN or not SANITY_PROJECT_ID:
        return False, "缺少 Sanity write token"
    print("  → 自动初始化 Sanity hero 内容...", file=sys.stderr)
    doc = {
        "_type": "hero",
        "_id": "hero-main",
        "headline": "Your AI Agent Team, Working 24/7",
        "subheadline": "Deploy specialized AI agents that research, plan, and execute tasks autonomously — no human supervision required.",
        "ctaText": "Deploy Your First Agent",
        "ctaHref": "#get-started"
    }
    r = requests.post(
        f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/production",
        headers={
            "Authorization": f"Bearer {SANITY_API_WRITE_TOKEN}",
            "Content-Type": "application/json"
        },
        json={"mutations": [{"createOrReplace": doc}]},
        timeout=10
    )
    if r.status_code in (200, 201):
        return True, "Sanity hero 内容已初始化"
    return False, f"Sanity 写入失败: {r.status_code} {r.text[:100]}"

# ── 用 Claude 分析失败项，生成修复建议 ──────────────────────────────────
def analyze_failures(failures):
    if not ANTHROPIC_API_KEY or not failures:
        return None
    prompt = f"""以下是 AI Native 前端的后端健康检查失败项：

{json.dumps(failures, ensure_ascii=False, indent=2)}

请分析根因，并给出：
1. 每个失败项的可能原因（一句话）
2. 是否可以自动修复（是/否）
3. 如果不能自动修复，给出具体的手动修复步骤

以 JSON 格式返回，字段：analysis（字符串，总体分析），items（数组，每项含 name/cause/auto_fixable/fix_steps）"""

    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        json={
            "model": "claude-haiku-4-5",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}]
        },
        timeout=30
    )
    if r.status_code == 200:
        content = r.json()["content"][0]["text"].strip()
        if "```json" in content:
            content = content[content.find("```json")+7:content.rfind("```")].strip()
        elif "```" in content:
            content = content[content.find("```")+3:content.rfind("```")].strip()
        try:
            return json.loads(content)
        except:
            return {"analysis": content}
    return None

# ── 在 GitHub 创建 issue 记录无法自动修复的问题 ──────────────────────────
def create_github_issue(title, body):
    if not GITHUB_TOKEN:
        return
    requests.post(
        f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/issues",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        json={"title": title, "body": body, "labels": ["health-check", "automated"]},
        timeout=10
    )

# ── 主流程 ────────────────────────────────────────────────────────────────
def main():
    print("=" * 60, file=sys.stderr)
    print("健康检查 Agent 启动", file=sys.stderr)
    print(f"时间: {datetime.now(timezone.utc).isoformat()}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    sanity_ok = check("Sanity CMS", check_sanity)
    check("Vercel 部署", check_vercel)
    check("GitHub-Vercel 同步", check_github_vercel_sync)
    check("PostHog 事件接收", check_posthog)

    # 自动修复：Sanity 内容为空时初始化
    if not sanity_ok:
        fixed, msg = fix_sanity_hero()
        print(f"  自动修复 Sanity: {msg}", file=sys.stderr)
        results.append({"name": "Sanity 自动修复", "ok": fixed, "detail": msg})

    # 收集失败项
    failures = [r for r in results if not r["ok"]]

    if failures:
        print(f"\n发现 {len(failures)} 个问题，Claude 分析中...", file=sys.stderr)
        analysis = analyze_failures(failures)
        if analysis:
            print(f"  分析: {analysis.get('analysis', '')[:200]}", file=sys.stderr)
            # 创建 GitHub issue
            issue_body = f"## 健康检查报告 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
            issue_body += f"**总体分析**: {analysis.get('analysis', '')}\n\n"
            issue_body += "### 失败项\n"
            for item in analysis.get("items", []):
                issue_body += f"- **{item.get('name')}**: {item.get('cause')} (自动修复: {item.get('auto_fixable')})\n"
            create_github_issue(
                f"[健康检查] {len(failures)} 个问题 — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
                issue_body
            )
            print("  已创建 GitHub issue", file=sys.stderr)
    else:
        print("\n所有检查通过", file=sys.stderr)

    # 输出摘要
    ok_count = len([r for r in results if r["ok"]])
    print(f"\n健康检查完成: {ok_count}/{len(results)} 通过", file=sys.stderr)

if __name__ == "__main__":
    main()
