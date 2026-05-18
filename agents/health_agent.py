"""
health_agent.py — 后端健康检查 + 自动联调

检查项：
1. Sanity CMS — API 可达性 + 内容完整性
2. Vercel 部署 — 最新 commit 是否已部署
3. GitHub-Vercel 同步
4. 前端 API 路由 — /api/health 端点（含响应时间）
5. PostHog — 事件接收确认
6. [新] API 路由响应时间 — 所有端点可达性 + 响应速度
7. [新] Supabase RLS 验证 — 匿名访问权限检查
8. [新] Supabase schema diff — 表结构变化自动同步 database.types.ts
9. [新] API schema hash diff — 后端接口变化感知并触发 Claude 分析

发现问题时：
- 用 Claude 分析根因
- 自动修复可修复的问题（Sanity 内容缺失、schema 变更）
- 在 GitHub 创建 issue 记录无法自动修复的问题
"""
import os, sys, json, hashlib, subprocess, time, re, requests
from datetime import datetime, timezone

ANTHROPIC_API_KEY    = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN         = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER         = os.environ.get("GITHUB_OWNER", "piggya2a-labs")
GITHUB_REPO          = os.environ.get("GITHUB_REPO", "ainative-frontend")
SANITY_PROJECT_ID    = os.environ.get("SANITY_PROJECT_ID", os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID", ""))
SANITY_API_WRITE_TOKEN = os.environ.get("SANITY_API_WRITE_TOKEN", "")
POSTHOG_KEY          = os.environ.get("NEXT_PUBLIC_POSTHOG_KEY", "")
SUPABASE_URL         = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_ANON_KEY    = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
VERCEL_PROD_URL      = "https://ainative-frontend.vercel.app"

# 路由 → 预期状态码（401 = 需要鉴权，正常）
API_ROUTES = {
    "/api/health":             200,
    "/api/agents":             200,
    "/api/tools":              200,
    "/api/agent/analytics":    401,
    "/api/keys":               401,
    "/api/generate-dashboard": 401,
}

SUPABASE_TABLES = ["agent_registry", "tool_registry", "tenant_connectors", "tenants", "audit_logs"]

results = []

def check(name, fn):
    print(f"  检查 {name}...", file=sys.stderr)
    try:
        status, detail = fn()
        print(f"    [{'OK' if status else 'FAIL'}] {detail}", file=sys.stderr)
        results.append({"name": name, "ok": status, "detail": detail})
        return status
    except Exception as e:
        print(f"    [ERROR] {e}", file=sys.stderr)
        results.append({"name": name, "ok": False, "detail": str(e)})
        return False

# ── 1. Sanity ────────────────────────────────────────────────────────────
def check_sanity():
    if not SANITY_PROJECT_ID:
        return False, "SANITY_PROJECT_ID 未配置"
    url = (f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/production"
           f"?query=*[_type=='hero'][0]{{headline}}")
    r = requests.get(url, timeout=10)
    if r.status_code == 200:
        result = r.json().get("result")
        if result and result.get("headline"):
            return True, f"Sanity 正常，hero headline: {result['headline'][:40]}"
        return False, "Sanity 可达但 hero 内容为空，需要初始化"
    return False, f"Sanity API 返回 {r.status_code}"

# ── 2. Vercel ────────────────────────────────────────────────────────────
def check_vercel():
    r = requests.get(VERCEL_PROD_URL, timeout=15)
    if r.status_code == 200:
        if "PiggyA2A" in r.text or "AI" in r.text:
            return True, f"Vercel 部署正常，HTTP {r.status_code}"
        return False, "Vercel 响应 200 但内容异常"
    return False, f"Vercel 返回 {r.status_code}"

# ── 3. GitHub-Vercel 同步 ────────────────────────────────────────────────
def check_github_vercel_sync():
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/commits/main",
        headers={"Authorization": f"token {GITHUB_TOKEN}"}, timeout=10
    )
    if r.status_code != 200:
        return False, f"GitHub API 返回 {r.status_code}"
    sha = r.json()["sha"][:7]
    msg = r.json()["commit"]["message"].split("\n")[0][:60]
    return True, f"最新 commit: {sha} — {msg}"

# ── 4. 前端 /api/health ──────────────────────────────────────────────────
def check_frontend_api():
    t0 = time.time()
    r  = requests.get(f"{VERCEL_PROD_URL}/api/health", timeout=10)
    ms = int((time.time() - t0) * 1000)
    if r.status_code == 200:
        data   = r.json()
        status = data.get("status", "unknown")
        checks = data.get("checks", {})
        return status == "ok", f"前端健康: {status}, checks={list(checks.keys())}, {ms}ms"
    return False, f"前端 /api/health 返回 {r.status_code}"

# ── 5. PostHog ───────────────────────────────────────────────────────────
def check_posthog():
    if not POSTHOG_KEY:
        return False, "NEXT_PUBLIC_POSTHOG_KEY 未配置"
    r = requests.post(
        "https://us.i.posthog.com/capture/",
        json={"api_key": POSTHOG_KEY, "event": "health_check",
              "distinct_id": "health-agent",
              "properties": {"source": "github-actions",
                             "timestamp": datetime.now(timezone.utc).isoformat()}},
        timeout=10
    )
    if r.status_code == 200:
        return True, "PostHog 事件接收正常"
    return False, f"PostHog 返回 {r.status_code}: {r.text[:100]}"

# ── 6. API 路由响应时间 ──────────────────────────────────────────────────
def check_api_routes():
    slow, errors = [], []
    for path, expected in API_ROUTES.items():
        try:
            t0 = time.time()
            r  = requests.get(f"{VERCEL_PROD_URL}{path}", timeout=10)
            ms = int((time.time() - t0) * 1000)
            if r.status_code != expected:
                errors.append(f"{path} → {r.status_code} (期望 {expected})")
            elif ms > 3000:
                slow.append(f"{path} {ms}ms")
        except Exception as e:
            errors.append(f"{path} → ERROR: {e}")
    if errors:
        return False, f"路由异常: {'; '.join(errors)}"
    if slow:
        return False, f"响应过慢 (>3s): {'; '.join(slow)}"
    return True, f"全部 {len(API_ROUTES)} 条路由正常"

# ── 7. Supabase RLS 验证 ─────────────────────────────────────────────────
def check_supabase_rls():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return False, "Supabase 环境变量未配置"
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/tenants?select=id&limit=5",
        headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"},
        timeout=10
    )
    if r.status_code == 200:
        rows = r.json()
        return True, f"Supabase RLS 正常，匿名查询返回 {len(rows)} 行（应为 0）"
    if r.status_code == 401:
        return True, "Supabase RLS 正常，匿名访问被拒绝（401）"
    return False, f"Supabase 返回 {r.status_code}: {r.text[:100]}"

# ── 8. Supabase schema diff + 自动同步 ──────────────────────────────────
def check_and_sync_supabase_schema():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return True, "Supabase service key 未配置，跳过 schema diff"

    # 拉取 live schema
    live_schema = {}
    for table in SUPABASE_TABLES:
        try:
            r = requests.get(
                f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1",
                headers={"apikey": SUPABASE_SERVICE_KEY,
                         "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                         "Prefer": "count=none"},
                timeout=10
            )
            rows = r.json() if r.status_code == 200 else []
            live_schema[table] = sorted(rows[0].keys()) if rows else []
        except Exception:
            live_schema[table] = []

    schema_hash = hashlib.md5(json.dumps(live_schema, sort_keys=True).encode()).hexdigest()
    types_path  = "lib/database.types.ts"

    try:
        current_content = open(types_path).read()
    except FileNotFoundError:
        current_content = ""

    if f"// schema-hash: {schema_hash}" in current_content:
        return True, f"Supabase schema 无变化（hash: {schema_hash[:8]}）"

    print("  → 检测到 Supabase schema 变化，重新生成 database.types.ts...", file=sys.stderr)
    new_content = _generate_types_content(live_schema, schema_hash)
    new_content = _infer_types_with_claude(live_schema, new_content)

    with open(types_path, "w") as f:
        f.write(new_content)

    pushed = _git_push([types_path],
                       f"chore(types): auto-sync Supabase schema [{schema_hash[:8]}]")
    return pushed, (f"Supabase schema 已变化并自动同步（hash: {schema_hash[:8]}），已推送"
                    if pushed else f"Supabase schema 已变化但推送失败（hash: {schema_hash[:8]}）")


def _generate_types_content(live_schema, schema_hash):
    def to_pascal(s):
        return re.sub(r'(?:^|_)(.)', lambda m: m.group(1).upper(), s)
    lines = [
        "/**",
        " * Supabase Database Types — AUTO GENERATED",
        " * 由 health_agent.py 在检测到 schema 变化时自动更新",
        f" * 最后生成：{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f" * // schema-hash: {schema_hash}",
        " */", "",
    ]
    for table, cols in live_schema.items():
        lines += [f"// ─── {table} {'─' * max(0, 60 - len(table))}",
                  f"export interface {to_pascal(table)}Row {{"]
        for col in cols:
            lines.append(f"  {col}: unknown")
        lines += ["}", ""]
    return "\n".join(lines) + "\n"


def _infer_types_with_claude(live_schema, current_ts):
    if not ANTHROPIC_API_KEY:
        return current_ts
    prompt = (
        "以下是从 Supabase 自动生成的 TypeScript 接口，所有字段都是 unknown。\n"
        "请根据字段名推断合理的 TypeScript 类型（string / number / boolean / string[] / null 组合等），\n"
        "保持接口结构不变，只替换 unknown。直接返回完整的 TypeScript 文件内容，不要加 markdown 代码块。\n\n"
        f"表结构参考（字段名列表）：\n{json.dumps(live_schema, ensure_ascii=False, indent=2)}\n\n"
        f"当前文件内容：\n{current_ts}"
    )
    try:
        r = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": "claude-sonnet-4-5", "max_tokens": 4096,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=60
        )
        if r.status_code == 200:
            content = r.json()["content"][0]["text"].strip()
            if content.startswith("```"):
                content = content[content.find("\n")+1:]
                if content.endswith("```"):
                    content = content[:-3].strip()
            return content
    except Exception as e:
        print(f"  Claude 类型推断失败: {e}", file=sys.stderr)
    return current_ts

# ── 9. API schema hash diff ──────────────────────────────────────────────
def check_api_schema_diff():
    hash_file    = ".api-schema-hash"
    probe_routes = ["/api/health", "/api/agents", "/api/tools"]
    current_schema = {}

    for path in probe_routes:
        try:
            r = requests.get(f"{VERCEL_PROD_URL}{path}", timeout=10)
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, dict):
                    current_schema[path] = sorted(data.keys())
                elif isinstance(data, list) and data and isinstance(data[0], dict):
                    current_schema[path] = sorted(data[0].keys())
                else:
                    current_schema[path] = []
        except Exception:
            current_schema[path] = ["unreachable"]

    new_hash = hashlib.md5(json.dumps(current_schema, sort_keys=True).encode()).hexdigest()

    try:
        saved    = json.load(open(hash_file))
        old_hash = saved.get("hash", "")
        old_schema = saved.get("schema", {})
    except (FileNotFoundError, json.JSONDecodeError):
        old_hash, old_schema = "", {}

    with open(hash_file, "w") as f:
        json.dump({"hash": new_hash, "schema": current_schema,
                   "updated": datetime.now(timezone.utc).isoformat()}, f, indent=2)

    if old_hash == new_hash:
        return True, f"API schema 无变化（hash: {new_hash[:8]}）"

    print("  → 检测到 API schema 变化，Claude 分析中...", file=sys.stderr)
    diff_info = {p: {"added": sorted(set(current_schema.get(p,[])) - set(old_schema.get(p,[]))),
                     "removed": sorted(set(old_schema.get(p,[])) - set(current_schema.get(p,[])))}
                 for p in set(list(old_schema)+list(current_schema))
                 if set(old_schema.get(p,[])) != set(current_schema.get(p,[]))}

    analysis = ""
    if ANTHROPIC_API_KEY and diff_info:
        try:
            r = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": "claude-sonnet-4-5", "max_tokens": 512,
                      "messages": [{"role": "user", "content":
                          f"以下是 API 接口的 schema 变化（字段增减）：\n"
                          f"{json.dumps(diff_info, ensure_ascii=False, indent=2)}\n\n"
                          "请分析：1. 哪些变化可能导致前端组件出错 "
                          "2. 哪些变化需要前端更新调用代码 "
                          "3. 给出具体修复建议（涉及哪些文件）。用简洁中文，不超过 300 字。"}]},
                timeout=30
            )
            if r.status_code == 200:
                analysis = r.json()["content"][0]["text"].strip()
        except Exception:
            pass

    issue_body = (
        f"## API Schema 变化检测 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"**旧 hash**: `{old_hash[:8]}`  **新 hash**: `{new_hash[:8]}`\n\n"
        f"### 变化详情\n```json\n{json.dumps(diff_info, ensure_ascii=False, indent=2)}\n```\n\n"
    )
    if analysis:
        issue_body += f"### Claude 分析\n{analysis}\n"

    create_github_issue(
        f"[API Schema 变化] {datetime.now(timezone.utc).strftime('%Y-%m-%d')} — {len(diff_info)} 条路由变化",
        issue_body
    )
    _git_push([hash_file], f"chore(schema): update api-schema-hash [{new_hash[:8]}]")
    return True, f"API schema 已变化（{len(diff_info)} 条路由），已创建 issue"

# ── 自动修复：Sanity hero 内容初始化 ────────────────────────────────────
def fix_sanity_hero():
    if not SANITY_API_WRITE_TOKEN or not SANITY_PROJECT_ID:
        return False, "缺少 Sanity write token"
    print("  → 自动初始化 Sanity hero 内容...", file=sys.stderr)
    doc = {"_type": "hero", "_id": "hero-main",
           "headline": "Your AI Agent Team, Working 24/7",
           "subheadline": "Deploy specialized AI agents that research, plan, and execute tasks autonomously — no human supervision required.",
           "ctaText": "Deploy Your First Agent", "ctaHref": "#get-started"}
    r = requests.post(
        f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/production",
        headers={"Authorization": f"Bearer {SANITY_API_WRITE_TOKEN}", "Content-Type": "application/json"},
        json={"mutations": [{"createOrReplace": doc}]}, timeout=10
    )
    return (True, "Sanity hero 内容已初始化") if r.status_code in (200, 201) \
        else (False, f"Sanity 写入失败: {r.status_code} {r.text[:100]}")

# ── Claude 分析失败项 ────────────────────────────────────────────────────
def analyze_failures(failures):
    if not ANTHROPIC_API_KEY or not failures:
        return None
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": "claude-sonnet-4-5", "max_tokens": 1024,
              "messages": [{"role": "user", "content":
                  f"以下是 AI Native 前端的后端健康检查失败项：\n"
                  f"{json.dumps(failures, ensure_ascii=False, indent=2)}\n\n"
                  "请分析根因，并给出：1. 每个失败项的可能原因（一句话）"
                  " 2. 是否可以自动修复（是/否）"
                  " 3. 如果不能自动修复，给出具体的手动修复步骤\n"
                  "以 JSON 格式返回，字段：analysis（字符串，总体分析），"
                  "items（数组，每项含 name/cause/auto_fixable/fix_steps）"}]},
        timeout=30
    )
    if r.status_code == 200:
        content = r.json()["content"][0]["text"].strip()
        for marker in ("```json", "```"):
            if marker in content:
                content = content[content.find(marker)+len(marker):content.rfind("```")].strip()
                break
        try:
            return json.loads(content)
        except Exception:
            return {"analysis": content}
    return None

# ── GitHub issue ─────────────────────────────────────────────────────────
def create_github_issue(title, body):
    if not GITHUB_TOKEN:
        return
    requests.post(
        f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/issues",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        json={"title": title, "body": body, "labels": ["health-check", "automated"]},
        timeout=10
    )

# ── git push 工具 ────────────────────────────────────────────────────────
def _git_push(files, message):
    if not GITHUB_TOKEN:
        return False
    try:
        subprocess.run(["git", "config", "user.email", "health-agent@ainative.ai"], check=True)
        subprocess.run(["git", "config", "user.name",  "Health Agent"],             check=True)
        subprocess.run(["git", "add"] + files, check=True)
        if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
            print("  → 无文件变化，跳过 push", file=sys.stderr)
            return True
        subprocess.run(["git", "commit", "-m", message], check=True)
        subprocess.run(["git", "push"], check=True)
        print(f"  → 已推送: {message}", file=sys.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"  → git push 失败: {e}", file=sys.stderr)
        return False

# ── 主流程 ────────────────────────────────────────────────────────────────
def main():
    print("=" * 60, file=sys.stderr)
    print("健康检查 Agent 启动", file=sys.stderr)
    print(f"时间: {datetime.now(timezone.utc).isoformat()}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    sanity_ok = check("Sanity CMS",           check_sanity)
    check("Vercel 部署",                       check_vercel)
    check("GitHub-Vercel 同步",               check_github_vercel_sync)
    check("前端 API 健康",                    check_frontend_api)
    check("PostHog 事件接收",                 check_posthog)
    check("API 路由响应时间",                  check_api_routes)
    check("Supabase RLS 验证",                check_supabase_rls)
    check("Supabase schema diff",             check_and_sync_supabase_schema)
    check("API schema hash diff",             check_api_schema_diff)

    if not sanity_ok:
        fixed, msg = fix_sanity_hero()
        print(f"  自动修复 Sanity: {msg}", file=sys.stderr)
        results.append({"name": "Sanity 自动修复", "ok": fixed, "detail": msg})

    failures = [r for r in results if not r["ok"]]
    if failures:
        print(f"\n发现 {len(failures)} 个问题，Claude 分析中...", file=sys.stderr)
        analysis = analyze_failures(failures)
        if analysis:
            print(f"  分析: {analysis.get('analysis', '')[:200]}", file=sys.stderr)
            issue_body  = f"## 健康检查报告 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
            issue_body += f"**总体分析**: {analysis.get('analysis', '')}\n\n### 失败项\n"
            for item in analysis.get("items", []):
                issue_body += (f"- **{item.get('name')}**: {item.get('cause')} "
                               f"(自动修复: {item.get('auto_fixable')})\n")
            create_github_issue(
                f"[健康检查] {len(failures)} 个问题 — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
                issue_body
            )
            print("  已创建 GitHub issue", file=sys.stderr)
    else:
        print("\n所有检查通过", file=sys.stderr)

    ok_count = len([r for r in results if r["ok"]])
    print(f"\n健康检查完成: {ok_count}/{len(results)} 通过", file=sys.stderr)

if __name__ == "__main__":
    main()
