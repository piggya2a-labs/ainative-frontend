import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'zae9ml5g'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

// ── Schema 定义（与 lib/sanity-schema.ts 保持一致）────────────────────────
const siteConfigSchema = {
  name: 'siteConfig',
  title: '网站配置',
  type: 'document' as const,
  fields: [
    {
      name: 'hero',
      title: 'Hero 区块',
      type: 'object',
      fields: [
        { name: 'hero_title', title: '主标题', type: 'string' },
        { name: 'hero_subtitle', title: '副标题', type: 'text' },
        { name: 'ctaText', title: 'CTA 按钮文字', type: 'string' },
        { name: 'ctaUrl', title: 'CTA 链接', type: 'string' },
        { name: 'secondaryCtaText', title: '次要 CTA 文字', type: 'string' },
        { name: 'eyebrow', title: 'Eyebrow 标签', type: 'string' },
      ],
    },
    {
      name: 'features',
      title: 'Features 列表',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', title: '标题', type: 'string' },
            { name: 'description', title: '描述', type: 'text' },
            { name: 'icon', title: '图标名', type: 'string' },
          ],
        },
      ],
    },
    {
      name: 'cta',
      title: 'CTA 区块',
      type: 'object',
      fields: [
        { name: 'headline', title: '标题', type: 'string' },
        { name: 'description', title: '描述', type: 'text' },
        { name: 'buttonText', title: '按钮文字', type: 'string' },
      ],
    },
    {
      name: 'meta',
      title: '元信息',
      type: 'object',
      fields: [
        { name: 'title', title: '页面标题', type: 'string' },
        { name: 'description', title: '页面描述', type: 'text' },
        { name: 'version', title: '版本号', type: 'number' },
        { name: 'lastUpdatedBy', title: '最后更新者', type: 'string' },
        { name: 'lastUpdatedAt', title: '最后更新时间', type: 'string' },
      ],
    },
  ],
}

const articleSchema = {
  name: 'article',
  title: '文章',
  type: 'document' as const,
  fields: [
    { name: 'title', title: '标题', type: 'string' },
    { name: 'slug', title: 'URL Slug', type: 'slug', options: { source: 'title', maxLength: 96 } },
    { name: 'excerpt', title: '摘要', type: 'text', rows: 3 },
    { name: 'cover_image', title: '封面图', type: 'image', options: { hotspot: true } },
    { name: 'published_at', title: '发布日期', type: 'datetime' },
    { name: 'tags', title: '标签', type: 'array', of: [{ type: 'string' }] },
    { name: 'seo_title', title: 'SEO 标题', type: 'string' },
    { name: 'seo_description', title: 'SEO 描述', type: 'text', rows: 2 },
    {
      name: 'body',
      title: '正文',
      type: 'array',
      of: [
        { type: 'block' },
        { type: 'image', options: { hotspot: true } },
        {
          type: 'object',
          name: 'code_block',
          title: '代码块',
          fields: [
            { name: 'language', title: '语言', type: 'string' },
            { name: 'code', title: '代码', type: 'text' },
          ],
        },
      ],
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'excerpt', media: 'cover_image' },
  },
}

const agentTasksBusSchema = {
  name: 'agentTasksBus',
  title: 'Agent 任务总线',
  type: 'document' as const,
  fields: [
    { name: 'cycleCount', title: '循环次数', type: 'number' },
    { name: 'lastAnalysisAt', title: '最后分析时间', type: 'string' },
    {
      name: 'tasks',
      title: '任务列表',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'id', title: 'ID', type: 'string' },
            { name: 'type', title: '类型', type: 'string' },
            { name: 'status', title: '状态', type: 'string' },
            { name: 'payload', title: '内容 (JSON)', type: 'text' },
            { name: 'createdAt', title: '创建时间', type: 'string' },
            { name: 'completedAt', title: '完成时间', type: 'string' },
          ],
        },
      ],
    },
  ],
}

export default defineConfig({
  name: 'ainative-studio',
  title: 'AI Native Studio',
  projectId,
  dataset,
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('内容管理')
          .items([
            S.listItem()
              .title('网站配置')
              .child(S.document().schemaType('siteConfig').documentId('siteConfig')),
            S.listItem()
              .title('Agent 任务总线')
              .child(S.document().schemaType('agentTasksBus').documentId('agentTasksBus')),
            S.listItem()
              .title('文章')
              .child(S.documentTypeList('article').title('文章列表')),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: [siteConfigSchema, agentTasksBusSchema, articleSchema],
  },
})
