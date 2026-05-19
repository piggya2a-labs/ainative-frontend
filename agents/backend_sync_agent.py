"""
backend_sync_agent.py — 后端变化感知 Agent

被 .github/workflows/backend-sync.yml 调用。
从环境变量读取后端 commit 信息，拉取 diff，
让 Claude 分析前端影响，自动开 PR 或创建 issue。
"""
import os, sys, json, subprocess, requests
from datetime import datetime, timezone

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN      = os.environ.get("GITHUB_TOKEN", "")
COMMIT_SHA        = os.environ.get("COMMIT_SHA", "")
COMMIT_MSG        = os.environ.get("COMMIT_MSG", "")
CHANGED_FILES     = os.environ.get("CHANGED_FILES", "")
DIFF_URL          = os.environ.get("DIFF_URL", "")

FRONTEND_OWNER = "piggya2a-labs"
FRONTEND_REPO  = "ainative-frontend"
BACKEND_OWNER  = "piggya2a-labs"
BACKEND_REPO   = "agent-gateway"


def fetch_diff():
    """拉取 agent-gateway 的 commit diff"""
    if not COMMIT_SHA or COMMIT_SHA == "manual":
        return ""
    r = requests.get(
        f"https://api.github.com/repos/{BACKEND_OWNER}/{BACKEND_REPO}/commits/{COMMIT_SHA}",
        headers={"Authorization": f"token {GITHUB_TOKEN}",
                 "Accept": "application/vnd.github.v3.diff"},
        timeout=30
    )
    return r.text[:8000] if r.status_code == 200 else ""


def collect_frontend_context():
    """收集前端调用后端的关键文件"""
    context = {}
    scan_dirs = ["app/", "components/", "lib/"]
    for d in scan_dirs:
        if not os.path.isdir(d):
            continue
        result = subprocess.run(
            ["find", d, "-name", "*.ts", "-o", "-name", "*.tsx"],
            capture_output=True, text=True
        )
        for f in result.stdout.strip().split("\n"):
            if f and "node_modules" not in f:
                try:
                    content = open(f).read()
                    if any(kw in content for kw in ["fetch(", "supabase.", "functions/v1"]):
                        context[f] = content[:2000]
                except Exception:
                    pass
    return context


def analyze_with_claude(diff_content, frontend_context):
    """让 Claude 分析后端变化对前端的影响"""
    if not ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY 未配置，跳过分析", file=sys.stderr)
        return {"needs_frontend_change": False, "summary": "API key 未配置"}

    context_snippet = json.dumps(
        {k: v[:1000] for k, v in list(frontend_context.items())[:5]},
        ensure_ascii=False, indent=2
    )

    prompt = (
        "你是 ONIT AI Native 前端的代码同步 Agent。\n\n"
        f"后端仓库（agent-gateway）刚刚有新的 push：\n"
        f"- Commit: {COMMIT_SHA[:7] if COMMIT_SHA else 'unknown'} — {COMMIT_MSG}\n"
        f"- 变更文件: {CHANGED_FILES}\n\n"
        "Diff 内容（截取）：\n"
        f"{diff_content[:4000]}\n\n"
        "前端当前调用后端的关键文件（截取）：\n"
        f"{context_snippet}\n\n"
        "请分析：\n"
        "1. 这次后端变化对前端有什么影响？（新增了什么功能/接口/字段，修改了什么，删除了什么）\n"
        "2. 前端需要做哪些对应的改动？（具体到文件名和改动内容）\n"
        "3. 如果有需要立即修复的兼容性问题，给出具体的代码改动。\n\n"
        "返回 JSON 格式（不要加 markdown 代码块）：\n"
        '{"summary":"一句话总结后端变化","frontend_impact":"对前端的影响描述",'
        '"needs_frontend_change":true,"urgency":"high/medium/low",'
        '"changes":[{"file":"文件路径","reason":"为什么要改","code_snippet":"具体改动"}],'
        '"pr_title":"PR 标题","pr_body":"PR 描述（Markdown）"}'
    )

    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": "claude-sonnet-4-5", "max_tokens": 4096,
              "messages": [{"role": "user", "content": prompt}]},
        timeout=60
    )

    if r.status_code != 200:
        print(f"Claude API 失败: {r.status_code}", file=sys.stderr)
        return {"needs_frontend_change": False, "summary": "Claude 分析失败"}

    content = r.json()["content"][0]["text"].strip()
    # 去掉可能的 markdown 代码块
    if "```" in content:
        start = content.find("\n", content.find("```")) + 1
        end   = content.rfind("```")
        content = content[start:end].strip()

    try:
        return json.loads(content)
    except Exception:
        return {"needs_frontend_change": False, "summary": content[:200]}


def create_pr(analysis, timestamp):
    """创建 PR（高/中优先级且有具体改动时）"""
    branch = f"backend-sync/{COMMIT_SHA[:7] if COMMIT_SHA else 'manual'}-{timestamp}"

    subprocess.run(["git", "config", "user.email", "sync-agent@ainative.ai"], check=True)
    subprocess.run(["git", "config", "user.name",  "Backend Sync Agent"],     check=True)
    subprocess.run(["git", "checkout", "-b", branch], check=True)

    # 写 sync note 文件作为 PR 证据
    note_dir  = "docs/backend-sync"
    note_path = f"{note_dir}/{timestamp}.md"
    os.makedirs(note_dir, exist_ok=True)

    with open(note_path, "w") as f:
        f.write(f"# Backend Sync — {timestamp}\n\n")
        f.write(f"**来源 commit**: `{COMMIT_SHA}`\n\n")
        f.write(f"**摘要**: {analysis.get('summary', '')}\n\n")
        f.write(f"## 前端影响\n{analysis.get('frontend_impact', '')}\n\n")
        f.write("## 需要改动的文件\n")
        for c in analysis.get("changes", []):
            f.write(f"### `{c.get('file', '')}`\n{c.get('reason', '')}\n\n")
            if c.get("code_snippet"):
                f.write(f"```\n{c['code_snippet']}\n```\n\n")

    subprocess.run(["git", "add", note_path], check=True)
    subprocess.run(["git", "commit", "-m",
                    f"docs: backend-sync note for {COMMIT_SHA[:7] if COMMIT_SHA else 'manual'}"],
                   check=True)
    subprocess.run(["git", "push", "origin", branch], check=True)

    pr_body = (
        f"## 后端变化同步\n\n"
        f"**来源**: [`agent-gateway@{COMMIT_SHA[:7] if COMMIT_SHA else 'manual'}`]"
        f"(https://github.com/{BACKEND_OWNER}/{BACKEND_REPO}/commit/{COMMIT_SHA})\n\n"
        f"**Claude 分析**: {analysis.get('summary', '')}\n\n"
        f"{analysis.get('pr_body', '')}\n\n"
        "---\n*由 Backend Sync Agent 自动创建*"
    )

    r = requests.post(
        f"https://api.github.com/repos/{FRONTEND_OWNER}/{FRONTEND_REPO}/pulls",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        json={"title": analysis.get("pr_title", f"[Backend Sync] {analysis.get('summary', '')[:60]}"),
              "body": pr_body, "head": branch, "base": "main"},
        timeout=15
    )
    if r.status_code in (200, 201):
        print(f"PR 已创建: {r.json().get('html_url', '')}")
    else:
        print(f"PR 创建失败: {r.status_code} {r.text[:200]}", file=sys.stderr)


def create_issue(analysis):
    """创建 issue（低优先级或无需改动时）"""
    body = (
        f"## 后端变化记录\n\n"
        f"**来源**: [`agent-gateway@{COMMIT_SHA[:7] if COMMIT_SHA else 'manual'}`]"
        f"(https://github.com/{BACKEND_OWNER}/{BACKEND_REPO}/commit/{COMMIT_SHA})\n\n"
        f"**摘要**: {analysis.get('summary', '')}\n\n"
        f"**前端影响**: {analysis.get('frontend_impact', '无需改动')}\n\n"
        "---\n*由 Backend Sync Agent 自动记录*"
    )
    r = requests.post(
        f"https://api.github.com/repos/{FRONTEND_OWNER}/{FRONTEND_REPO}/issues",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        json={"title": f"[Backend Log] {analysis.get('summary', '')[:80]}",
              "body": body,
              "labels": ["backend-sync", "no-action-needed"]},
        timeout=15
    )
    if r.status_code in (200, 201):
        print(f"Issue 已创建: {r.json().get('html_url', '')}")
    else:
        print(f"Issue 创建失败: {r.status_code}", file=sys.stderr)


def main():
    print(f"Backend Sync Agent 启动", file=sys.stderr)
    print(f"Commit: {COMMIT_SHA[:7] if COMMIT_SHA else 'manual'} — {COMMIT_MSG}", file=sys.stderr)
    print(f"变更文件: {CHANGED_FILES[:200]}", file=sys.stderr)

    diff_content     = fetch_diff()
    frontend_context = collect_frontend_context()
    analysis         = analyze_with_claude(diff_content, frontend_context)

    print(f"分析完成: {analysis.get('summary', '')}", file=sys.stderr)
    print(f"需要前端改动: {analysis.get('needs_frontend_change', False)}", file=sys.stderr)
    print(f"紧急程度: {analysis.get('urgency', 'low')}", file=sys.stderr)

    timestamp    = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    needs_change = analysis.get("needs_frontend_change", False)
    urgency      = analysis.get("urgency", "low")
    changes      = analysis.get("changes", [])

    if needs_change and urgency in ("high", "medium") and changes:
        create_pr(analysis, timestamp)
    else:
        create_issue(analysis)


if __name__ == "__main__":
    main()
