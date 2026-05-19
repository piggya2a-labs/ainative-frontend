#!/usr/bin/env python3
"""
把品牌知识初始文档写入 Sanity。
之后直接在 Sanity Studio 的「品牌知识库」里编辑，不需要再跑这个脚本。
"""
import os, json, requests, datetime

SANITY_PROJECT_ID = os.environ.get("SANITY_PROJECT_ID", "zae9ml5g")
SANITY_DATASET = os.environ.get("SANITY_DATASET", "production")
SANITY_API_WRITE_TOKEN = os.environ.get("SANITY_API_WRITE_TOKEN", "")

MUTATIONS_URL = f"https://{SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/{SANITY_DATASET}"

doc = {
    "_id": "brandKnowledge",
    "_type": "brandKnowledge",
    "positioning": (
        "ONIT 是一个 Agent 雇主平台。"
        "它的工作不是做事，而是招募、培养、派遣和评估 Agent。"
        "任何外部能力接进来之后都变成有身份、有职能、可被派活的 Agent 团队成员，"
        "整个过程以用户定义的成功标准为终点，形成闭环。"
    ),
    "targetUser": (
        "中小企业主、独立创业者、小团队负责人。"
        "没有技术背景，但想用 AI 提升效率。"
        "不想学复杂工具，希望像雇佣和管理真实员工一样管理 AI。"
    ),
    "differentiation": [
        "雇主视角：用户是 Agent 的雇主，不是 AI 的用户",
        "外部能力即 Agent：任何 MCP 工具接进来都有身份和职能，不是匿名工具",
        "成功标准闭环：以用户定义的目标为终点，Agent 自动评估和迭代",
        "Telegram 原生：用最熟悉的沟通方式管理 AI 团队，零学习成本",
    ],
    "visualStyle": (
        "极简、克制、专业。黑白为主，ONIT Green (#22c55e) 作为唯一强调色。"
        "等宽字体用于技术细节，无衬线字体用于正文。"
        "不用渐变、不用卡通图标、不用过度装饰。数字说话：用具体指标而非形容词。"
    ),
    "voiceTone": (
        "直接、简洁，不废话。第二人称（你的团队而不是用户的团队）。"
        "用动词开头（招募、派遣、评估）。"
        "避免 AI 行业的过度营销词汇（革命性、颠覆性、赋能）。"
    ),
    "competitors": [
        {
            "_key": "gentic",
            "name": "Gentic.co",
            "url": "https://gentic.co",
            "learnFrom": "设计语言：极简黑白、数字结果说话、MCP-first 产品形态",
        },
        {
            "_key": "lindy",
            "name": "Lindy.ai",
            "url": "https://lindy.ai",
            "learnFrom": "产品定位：AI 员工概念，和 ONIT 最接近",
        },
        {
            "_key": "relevance",
            "name": "Relevance AI",
            "url": "https://relevanceai.com",
            "learnFrom": "UI 成熟度：Agent 团队管理界面的参照",
        },
    ],
    "hardRules": [
        "不硬编码用户可见文案（从 Sanity 读取）",
        "不用裸色值（用 CSS token）",
        "不引入新 UI 库（只用 Shadcn）",
        "不删除 /api/health 端点",
        "不破坏 /api/agent/update-content 端点",
        "不在没有用户授权的情况下修改数据库 schema",
    ],
    "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
}

resp = requests.post(
    MUTATIONS_URL,
    headers={
        "Authorization": f"Bearer {SANITY_API_WRITE_TOKEN}",
        "Content-Type": "application/json",
    },
    json={"mutations": [{"createOrReplace": doc}]},
    timeout=15,
)

if resp.status_code == 200:
    print("✅ brandKnowledge 文档已写入 Sanity")
    print(f"   在 Sanity Studio → 品牌知识库 里直接编辑即可")
else:
    print(f"❌ 写入失败: {resp.status_code} {resp.text[:200]}")
