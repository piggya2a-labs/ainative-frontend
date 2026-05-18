"""
执行 Agent (Execution Agent)
职责：读取 Sanity agentTasksBus 中的 pending 任务 → 执行内容更新 → 标记完成

运行方式：python3 execution_agent.py
触发方式：Manus 定时任务，每小时运行一次
"""
import os
import json
import requests
from datetime import datetime, timezone

# ── 配置（全部从环境变量读取）────────────────────────────────────────────
SANITY_PROJECT_ID = os.environ.get("SANITY_PROJECT_ID", "zae9ml5g")
SANITY_DATASET = os.environ.get("SANITY_DATASET", "production")
SANITY_TOKEN = os.environ["SANITY_API_WRITE_TOKEN"]

SANITY_MUTATIONS_URL = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/{SANITY_DATASET}"
SANITY_QUERY_URL = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/{SANITY_DATASET}"

sanity_headers = {
    "Authorization": f"Bearer {SANITY_TOKEN}",
    "Content-Type": "application/json"
}

# ── Step 1: 读取 pending 任务 ─────────────────────────────────────────────
def fetch_pending_tasks() -> list:
    """从 agentTasksBus 读取所有 pending 状态的任务"""
    print("[执行 Agent] 检查 agentTasksBus 中的待处理任务...")
    
    resp = requests.get(
        SANITY_QUERY_URL,
        headers=sanity_headers,
        params={"query": '*[_id == "agentTasksBus"][0]{tasks[status == "pending"], cycleCount, lastAnalysisAt}'}
    )
    
    if resp.status_code != 200:
        print(f"  [错误] 查询失败: {resp.json()}")
        return []
    
    result = resp.json().get("result", {})
    if not result:
        print("  [执行 Agent] agentTasksBus 不存在")
        return []
    
    tasks = result.get("tasks", []) or []
    cycle = result.get("cycleCount", 0)
    last_analysis = result.get("lastAnalysisAt", "未知")
    
    print(f"  [执行 Agent] 发现 {len(tasks)} 个待处理任务（第 {cycle} 轮循环，上次分析: {last_analysis}）")
    return tasks

# ── Step 2: 执行任务 ──────────────────────────────────────────────────────
def execute_task(task: dict) -> dict:
    """执行单个内容更新任务"""
    task_id = task.get("taskId", task.get("_key", "unknown"))
    task_type = task.get("type", "unknown")
    changes_raw = task.get("changes", "{}")
    
    print(f"\n  [执行 Agent] 执行任务 {task_id} ({task_type})...")
    
    try:
        changes = json.loads(changes_raw) if isinstance(changes_raw, str) else changes_raw
    except:
        changes = {}
    
    if not changes:
        return {"success": False, "error": "changes 为空"}
    
    # 根据任务类型构建 Sanity patch
    patch_set = {}
    
    if task_type == "hero_update":
        for field, value in changes.items():
            patch_set[f"hero.{field}"] = value
    
    elif task_type == "feature_update":
        # changes 格式: {"feature_key": "f1", "field": "description", "value": "新描述"}
        feature_key = changes.get("feature_key")
        if feature_key:
            for field, value in changes.items():
                if field not in ("feature_key",):
                    patch_set[f"features[_key==\"{feature_key}\"].{field}"] = value
        else:
            # 批量更新
            for field, value in changes.items():
                patch_set[f"features[0].{field}"] = value
    
    elif task_type == "cta_update":
        for field, value in changes.items():
            patch_set[f"cta.{field}"] = value
    
    elif task_type == "nav_update":
        for field, value in changes.items():
            patch_set[f"nav.{field}"] = value
    
    else:
        # 通用更新：直接设置顶层字段
        patch_set = changes
    
    if not patch_set:
        return {"success": False, "error": "无法构建 patch"}
    
    # 更新 siteConfig 版本号和更新时间
    now = datetime.now(timezone.utc).isoformat()
    patch_set["meta.lastUpdatedBy"] = "execution_agent"
    patch_set["meta.lastUpdatedAt"] = now
    
    # 执行 Sanity patch
    mutations = [{
        "patch": {
            "id": "siteConfig",
            "set": patch_set,
            "inc": {"meta.version": 1}
        }
    }]
    
    resp = requests.post(SANITY_MUTATIONS_URL, headers=sanity_headers, json={"mutations": mutations})
    
    if resp.status_code == 200:
        print(f"    ✓ 成功更新 siteConfig: {list(patch_set.keys())}")
        return {"success": True, "updated_fields": list(patch_set.keys())}
    else:
        error = resp.json()
        print(f"    ✗ 更新失败: {error}")
        return {"success": False, "error": str(error)}

# ── Step 3: 标记任务状态 ──────────────────────────────────────────────────
def mark_task_done(task_key: str, result: dict):
    """将任务标记为 done 或 failed"""
    now = datetime.now(timezone.utc).isoformat()
    status = "done" if result.get("success") else "failed"
    
    mutations = [{
        "patch": {
            "id": "agentTasksBus",
            "set": {
                f"tasks[_key==\"{task_key}\"].status": status,
                f"tasks[_key==\"{task_key}\"].executedAt": now,
                f"tasks[_key==\"{task_key}\"].result": json.dumps(result, ensure_ascii=False),
                "lastExecutionAt": now
            }
        }
    }]
    
    resp = requests.post(SANITY_MUTATIONS_URL, headers=sanity_headers, json={"mutations": mutations})
    if resp.status_code == 200:
        print(f"    ✓ 任务 {task_key} 标记为 {status}")
    else:
        print(f"    ✗ 标记失败: {resp.json()}")

# ── Step 4: 验证更新结果 ──────────────────────────────────────────────────
def verify_update():
    """验证 siteConfig 是否已更新"""
    resp = requests.get(
        SANITY_QUERY_URL,
        headers=sanity_headers,
        params={"query": '*[_id == "siteConfig"][0]{meta, "heroHeadline": hero.headline}'}
    )
    if resp.status_code == 200:
        result = resp.json().get("result", {})
        meta = result.get("meta", {})
        print(f"\n  [执行 Agent] 验证结果:")
        print(f"    - 当前版本: v{meta.get('version', '?')}")
        print(f"    - 最后更新: {meta.get('lastUpdatedAt', '?')}")
        print(f"    - 更新者: {meta.get('lastUpdatedBy', '?')}")
        print(f"    - Hero 标题: {result.get('heroHeadline', '?')}")

# ── 主流程 ────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print(f"[执行 Agent] 启动 — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)
    
    # 1. 读取 pending 任务
    tasks = fetch_pending_tasks()
    
    if not tasks:
        print("\n[执行 Agent] 没有待处理任务，退出。")
        print("=" * 60)
        return
    
    # 2. 按优先级排序执行
    priority_order = {"high": 0, "medium": 1, "low": 2}
    tasks.sort(key=lambda t: priority_order.get(t.get("priority", "low"), 2))
    
    executed = 0
    for task in tasks:
        task_key = task.get("_key", task.get("taskId", "unknown"))
        print(f"\n  处理任务: {task_key} [{task.get('priority','?')}] {task.get('type','?')}")
        print(f"  原因: {task.get('reason','?')}")
        print(f"  预期: {task.get('hypothesis','?')}")
        
        result = execute_task(task)
        mark_task_done(task_key, result)
        executed += 1
    
    # 3. 验证
    verify_update()
    
    print(f"\n[执行 Agent] 完成。共处理 {executed} 个任务。")
    print("Vercel 将在下次访问时自动渲染最新内容。")
    print("=" * 60)

if __name__ == "__main__":
    main()
