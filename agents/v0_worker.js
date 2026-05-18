/**
 * v0 Worker — 内循环执行层
 *
 * 职责：
 * 1. 读取 Claude 生成的改进指令（JSON from stdin 或文件）
 * 2. 用 v0-sdk 把当前前端代码 + 改进指令发给 v0
 * 3. 等待 v0 生成改进后的代码
 * 4. 通过 GitHub API 推送到 main 分支，Vercel 自动部署
 *
 * 环境变量：
 *   V0_API_KEY       — v0 Platform API Key
 *   GITHUB_TOKEN     — GitHub Personal Access Token
 *   GITHUB_OWNER     — GitHub 组织（默认 piggya2a-labs）
 *   GITHUB_REPO      — GitHub 仓库名（默认 ainative-frontend）
 *
 * 用法：
 *   echo '{"instruction":"...","target_file":"components/hero.tsx"}' | node agents/v0_worker.js
 *   node agents/v0_worker.js < instruction.json
 */

import { createClient } from 'v0-sdk';
import { Octokit } from '@octokit/rest';

const V0_API_KEY = process.env.V0_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'piggya2a-labs';
const GITHUB_REPO = process.env.GITHUB_REPO || 'ainative-frontend';

if (!V0_API_KEY) throw new Error('V0_API_KEY 未设置');
if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN 未设置');

const v0 = createClient({ apiKey: V0_API_KEY });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ── 读取 stdin 中的改进指令 ──────────────────────────────────────────────
async function readInstruction() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error(`指令 JSON 解析失败: ${e.message}`)); }
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
    return { content: '', sha: '' };
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

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 v0 Worker 启动');

  // 1. 读取 Claude 的改进指令
  const instruction = await readInstruction();
  const { directive, target_file, analysis_summary, cold_start } = instruction;

  console.log(`📋 改进指令: ${directive}`);
  console.log(`📄 目标文件: ${target_file}`);

  // 2. 读取当前文件内容
  const { content: currentCode, sha } = await getGitHubFile(target_file);
  if (!currentCode) {
    console.error('❌ 无法读取目标文件，退出');
    process.exit(1);
  }

  // 3. 用 v0-sdk 初始化 chat，传入现有代码
  console.log('🎨 初始化 v0 chat，传入当前代码...');
  const initResponse = await v0.chats.init({
    type: 'files',
    files: [
      { name: target_file, content: currentCode },
    ],
    name: `AI Native 内循环优化 ${new Date().toISOString().slice(0, 10)}`,
    chatPrivacy: 'private',
  });

  const chatId = initResponse.id;
  console.log(`  ✓ Chat 创建成功: ${chatId}`);

  // 4. 发送改进指令，让 v0 生成代码
  console.log('✨ 发送改进指令给 v0...');
  const contextPrefix = cold_start
    ? `This is an AI Native product landing page Hero component. The site just launched (cold start). Apply best practices for AI agent product pages.\n\n`
    : `This is an AI Native product landing page Hero component. Analysis: ${analysis_summary}\n\n`;

  const sendResponse = await v0.chats.sendMessage({
    chatId,
    message: contextPrefix + directive,
    responseMode: 'sync',
  });

  console.log(`  ✓ v0 响应完成`);

  // 5. 提取生成的代码（从 latestVersion.files 或最后一条 assistant 消息）
  const targetFileName = target_file.split('/').pop();
  const versionFiles = sendResponse?.latestVersion?.files || [];
  let improvedCode = '';

  const matchedFile = versionFiles.find(f =>
    f.name === target_file || f.name === targetFileName || f.name.endsWith(targetFileName)
  );
  if (matchedFile) {
    improvedCode = matchedFile.content;
  } else {
    // 从最后一条 assistant 消息中提取代码块
    const messages = sendResponse?.messages || [];
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant?.content) {
      const codeBlocks = lastAssistant.content.match(/```(?:tsx?|typescript|jsx?)?\n([\s\S]*?)```/g);
      if (codeBlocks && codeBlocks.length > 0) {
        improvedCode = codeBlocks[0]
          .replace(/```(?:tsx?|typescript|jsx?)?\n/, '')
          .replace(/```$/, '')
          .trim();
      }
    }
  }

  if (!improvedCode) {
    console.error('❌ v0 未返回有效代码，退出');
    process.exit(1);
  }

  console.log(`  ✓ v0 生成了 ${improvedCode.length} 字符的新代码`);

  // 6. 推送到 GitHub
  console.log('🚀 推送到 GitHub...');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const commitMessage = `feat(v0-agent): 内循环优化 ${target_file} [${now}]\n\n${analysis_summary}`;

  const commitSha = await pushToGitHub(target_file, improvedCode, sha, commitMessage);
  console.log(`  ✓ 推送成功，commit: ${commitSha}`);
  console.log('  ✓ Vercel 将自动检测变更并重新部署');

  console.log('\n✅ v0 Worker 完成');
}

main().catch(e => {
  console.error('❌ v0 Worker 失败:', e.message);
  if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  process.exit(1);
});
