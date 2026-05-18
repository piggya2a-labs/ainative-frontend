import { client } from './sanity'
import { HeroContent, FeatureCard, AgentTool, SiteConfig, Article } from './sanity-schema'

export async function getHeroContent(): Promise<HeroContent | null> {
  try {
    const data = await client.fetch<HeroContent>(
      `*[_type == "heroContent"] | order(_updatedAt desc)[0]`
    )
    return data
  } catch {
    return null
  }
}

export async function getFeatureCards(): Promise<FeatureCard[]> {
  try {
    const data = await client.fetch<FeatureCard[]>(
      `*[_type == "featureCard" && visible == true] | order(order asc)`
    )
    return data || []
  } catch {
    return []
  }
}

export async function getAgentTools(): Promise<AgentTool[]> {
  try {
    const data = await client.fetch<AgentTool[]>(
      `*[_type == "agentTool"] | order(order asc)`
    )
    return data || []
  } catch {
    return []
  }
}

export async function getSiteConfig(): Promise<SiteConfig | null> {
  try {
    const data = await client.fetch<SiteConfig>(
      `*[_type == "siteConfig"][0]`,
      {},
      { next: { revalidate: 60 } }
    )
    return data
  } catch {
    return null
  }
}

export async function getArticles(): Promise<Article[]> {
  try {
    const data = await client.fetch<Article[]>(
      `*[_type == "article"] | order(published_at desc) {
        _id, _type, title, slug, excerpt, published_at, tags,
        cover_image { asset->{ url }, alt }
      }`,
      {},
      { next: { revalidate: 60 } }
    )
    return data || []
  } catch {
    return []
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const data = await client.fetch<Article>(
      `*[_type == "article" && slug.current == $slug][0] {
        _id, _type, title, slug, excerpt, published_at, tags,
        seo_title, seo_description,
        cover_image { asset->{ url }, alt },
        body[] {
          ...,
          _type == "image" => { ..., asset->{ url } }
        }
      }`,
      { slug },
      { next: { revalidate: 60 } }
    )
    return data || null
  } catch {
    return null
  }
}
