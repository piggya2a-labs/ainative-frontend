import { Navbar } from '@/components/navbar'
import { CTASection, Footer } from '@/components/cta-footer'
import { getSiteConfig, getArticles } from '@/lib/queries'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export const revalidate = 60

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogPage() {
  const [siteConfig, articles] = await Promise.all([getSiteConfig(), getArticles()])

  return (
    <div className="min-h-screen bg-background">
      <Navbar siteConfig={siteConfig} />
      <main className="max-w-4xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Articles
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            关于 AI Agent 的一切
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            深入理解 AI Agent 如何工作，以及它如何改变你的工作方式。
          </p>
        </div>

        {/* 文章列表 */}
        {articles.length === 0 ? (
          <p className="text-center text-muted-foreground py-20 text-sm font-mono">
            暂无文章，敬请期待。
          </p>
        ) : (
          <div className="space-y-8">
            {articles.map((article) => (
              <Link
                key={article._id}
                href={`/blog/${article.slug.current}`}
                className="group block"
              >
                <article className="rounded-lg border border-border p-6 hover:border-foreground/20 transition-colors">
                  {/* 封面图 */}
                  {article.cover_image?.asset?.url && (
                    <div className="mb-4 overflow-hidden rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={article.cover_image.asset.url}
                        alt={article.cover_image.alt || article.title}
                        className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-3">
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
                  <h2 className="text-lg font-semibold leading-snug mb-2 group-hover:underline">
                    {article.title}
                  </h2>

                  {/* Excerpt */}
                  {article.excerpt && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  )}

                  <div className="mt-4 text-xs text-muted-foreground font-mono">
                    阅读全文 →
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
      <CTASection siteConfig={siteConfig} />
      <Footer siteConfig={siteConfig} />
    </div>
  )
}
