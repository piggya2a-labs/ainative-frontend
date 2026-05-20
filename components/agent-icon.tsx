'use client'
import { useState } from 'react'

// 从任意 URL 提取 hostname，用于 Google Favicon API
function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// 根据名字生成一个稳定的柔和背景色
function nameToColor(name: string): string {
  const colors = [
    'oklch(0.75 0.12 30)',   // 橙
    'oklch(0.75 0.12 150)',  // 绿
    'oklch(0.75 0.12 240)',  // 蓝
    'oklch(0.75 0.12 290)',  // 紫
    'oklch(0.75 0.12 0)',    // 红
    'oklch(0.75 0.12 200)',  // 青
    'oklch(0.75 0.12 60)',   // 黄
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

interface AgentIconProps {
  name: string
  iconUrl?: string | null
  mcpUrl?: string | null
  url?: string | null
  size?: number
  className?: string
}

/**
 * 自动 Agent 头像：
 * 1. 优先用 icon_url（数据库里存的）
 * 2. 其次从 mcp_url / url 提取域名，用 Google Favicon API 自动获取
 * 3. 都没有 → 名字首字母彩色圆形 fallback
 */
export function AgentIcon({ name, iconUrl, mcpUrl, url, size = 24, className = '' }: AgentIconProps) {
  const [imgFailed, setImgFailed] = useState(false)

  // 确定要用的图片 URL
  let resolvedUrl: string | null = null
  if (iconUrl && !imgFailed) {
    resolvedUrl = iconUrl
  } else if (!imgFailed) {
    const domain = extractDomain(mcpUrl) ?? extractDomain(url)
    if (domain) {
      resolvedUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    }
  }

  const initials = name.trim().charAt(0).toUpperCase()
  const bg = nameToColor(name)

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    )
  }

  // Fallback: 首字母圆形
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 text-white font-semibold select-none ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.45 }}
      aria-label={name}
    >
      {initials}
    </span>
  )
}
