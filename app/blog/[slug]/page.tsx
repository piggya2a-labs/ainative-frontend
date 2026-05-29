import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig, getArticleBySlug, getArticles } from '@/lib/queries'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getLocale } from "gt-next/server";

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const articles = await getArticles()
  return articles.map((a) => ({ slug: a.slug.current }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  return {
    title: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 简单的 Portable Text 渲染（block 类型）
function renderBody(body: NonNullable<Awaited<ReturnType<typeof getArticleBySlug>>>['body']) {
  if (!body) return null
  return body.map((block) => {
    if (block._type === 'block') {
      const text = block.children?.map((c) => c.text).join('') || ''
      const style = block.style || 'normal'
      if (style === 'h1') return <h1 key={block._key} className="text-3xl font-bold mt-8 mb-4">{text}</h1>
      if (style === 'h2') return <h2 key={block._key} className="text-2xl font-semibold mt-7 mb-3">{text}</h2>
      if (style === 'h3') return <h3 key={block._key} className="text-xl font-semibold mt-6 mb-2">{text}</h3>
      if (style === 'blockquote') return (
        <blockquote key={block._key} className="border-l-4 border-border pl-4 my-4 text-muted-foreground italic">
          {text}
        </blockquote>
      )
      if (!text.trim()) return <div key={block._key} className="h-4" />
      return <p key={block._key} className="text-base leading-relaxed mb-4 text-foreground/90">{text}</p>
    }
    if (block._type === 'image' && block.asset?.url) {
      return (
        <div key={block._key} className="my-6 rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.asset.url} alt="" className="w-full" />
        </div>
      )
    }
    if (block._type === 'code_block' && block.code) {
      return (
        <pre key={block._key} className="bg-muted rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono">
          <code>{block.code}</code>
        </pre>
      )
    }
    return null
  })
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const [siteConfig, article] = await Promise.all([
    const locale = await getLocale();
    getSiteConfig(locale),
    getArticleBySlug(slug),
  ])

  if (!article) notFound()

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />
      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        {/* Back */}
        <Link
          href="/blog"
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-8 inline-block"
        >
          ← 返回文章列表
        </Link>

        {/* Cover */}
        {article.cover_image?.asset?.url && (
          <div className="mb-8 rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.cover_image.asset.url}
              alt={article.cover_image.alt || article.title}
              className="w-full h-64 sm:h-80 object-cover"
            />
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          {article.published_at && (
            <span className="text-xs text-muted-foreground font-mono">
              {formatDate(article.published_at)}
            </span>
          )}
          {article.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-6">
          {article.title}
        </h1>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 border-b border-border pb-8">
            {article.excerpt}
          </p>
        )}

        {/* Body */}
        <div className="prose-sm max-w-none">
          {renderBody(article.body)}
        </div>
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
