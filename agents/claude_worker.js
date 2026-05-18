/**
 * Claude Worker — 内循环执行层（v0 的替代方案）
 *
 * 职责：
 * 1. 读取 perception_agent 的改进指令（JSON from stdin pipe）
 * 2. 从 GitHub 读取当前目标文件的代码
 * 3. 用 Claude 生成改进后的代码
 * 4. 通过 GitHub API 推送到 main 分支，Vercel 自动部署
 *
 * 环境变量：
 *   ANTHROPIC_API_KEY — Claude API Key
 *   GITHUB_TOKEN      — GitHub Personal Access Token
 *   GITHUB_OWNER      — GitHub 组织（默认 piggya2a-labs）
 *   GITHUB_REPO       — GitHub 仓库名（默认 ainative-frontend）
 *
 * 用法：
 *   python3 agents/perception_agent.py | node agents/claude_worker.js
 */

import { Octokit } from '@octokit/rest';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'piggya2a-labs';
const GITHUB_REPO = process.env.GITHUB_REPO || 'ainative-frontend';

if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 未设置');
if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN 未设置');

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ── 读取 stdin 中的改进指令 ──────────────────────────────────────────────
async function readInstruction() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error(`指令 JSON 解析失败: ${e.message}\n原始内容: ${data.slice(0, 200)}`)); }
    });
    process.stdin.on('error', reject);
  });
}

// ── 从 GitHub 读取当前文件内容 ────────────────────────────────────────────
async function getGitHubFile(path) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
    });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (e) {
    console.error(`  ⚠️  读取 ${path} 失败: ${e.message}`);
    return { content: null, sha: null };
  }
}

// ── 推送改进后的文件到 GitHub ─────────────────────────────────────────────
async function pushToGitHub(path, content, sha, commitMessage) {
  const encoded = Buffer.from(content).toString('base64');
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path,
    message: commitMessage,
    content: encoded,
    sha,
    branch: 'main',
  });
  return data.commit.sha.slice(0, 7);
}

// ── 用 Claude 生成改进后的代码 ────────────────────────────────────────────
async function generateWithClaude(currentCode, instruction) {
  const { directive, analysis_summary, cold_start, target_file } = instruction;

  const systemPrompt = `You are an expert React/Next.js developer specializing in AI Native product landing pages.
Your task is to improve a React component based on specific instructions.

Rules:
1. Return ONLY the complete, improved TypeScript/TSX code
2. Do NOT include any explanation, markdown, or code fences
3. Keep all existing imports and dependencies
4. Maintain TypeScript types and shadcn/ui components
5. The code must be production-ready and compile without errors
6. Keep the same component structure and export pattern`;

  const userPrompt = `Current ${target_file}:
\`\`\`tsx
${currentCode}
\`\`\`

${cold_start ? 'Context: This is a cold start optimization (site just launched, no user data yet).' : `Context: ${analysis_summary}`}

Improvement directive:
${directive}

Return the complete improved component code (no markdown, no explanation):`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API 失败: ${response.status} ${err}`);
  }

  const result = await response.json();
  let code = result.content[0].text.trim();

  // 清理可能的 markdown 代码块
  if (code.startsWith('```')) {
    const lines = code.split('\n');
    const start = 1; // 跳过第一行 ```tsx
    const end = lines.lastIndexOf('```');
    code = lines.slice(start, end > 0 ? end : lines.length).join('\n').trim();
  }

  return code;
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Claude Worker 启动');

  // 1. 读取改进指令
  const instruction = await readInstruction();
  const { directive, target_file, analysis_summary, cold_start } = instruction;

  console.log(`📋 改进指令: ${directive.slice(0, 100)}...`);
  console.log(`📄 目标文件: ${target_file}`);
  console.log(`📊 分析摘要: ${analysis_summary}`);

  // 2. 读取当前文件内容
  const { content: currentCode, sha } = await getGitHubFile(target_file);
  if (!currentCode) {
    console.error('❌ 无法读取目标文件，退出');
    process.exit(1);
  }
  console.log(`  ✓ 读取到当前代码: ${currentCode.length} 字符`);

  // 3. 用 Claude 生成改进后的代码
  console.log('🧠 Claude 生成改进代码...');
  const improvedCode = await generateWithClaude(currentCode, instruction);

  if (!improvedCode || improvedCode.length < 100) {
    console.error('❌ Claude 未返回有效代码');
    process.exit(1);
  }
  console.log(`  ✓ 生成了 ${improvedCode.length} 字符的新代码`);

  // 4. 推送到 GitHub
  console.log('🚀 推送到 GitHub...');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const commitMessage = `feat(claude-agent): 内循环优化 ${target_file} [${now}]\n\n${analysis_summary}`;

  const commitSha = await pushToGitHub(target_file, improvedCode, sha, commitMessage);
  console.log(`  ✓ 推送成功，commit: ${commitSha}`);
  console.log('  ✓ Vercel 将自动检测变更并重新部署');

  console.log('\n✅ Claude Worker 完成');
}

main().catch(e => {
  console.error('❌ Claude Worker 失败:', e.message);
  if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  process.exit(1);
});
