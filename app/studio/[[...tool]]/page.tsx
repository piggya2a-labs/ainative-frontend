'use client'

/**
 * Sanity Studio 内嵌页面
 * 路由：/studio
 * 用途：Agent 写入内容后可在此直接查看/编辑 CMS 内容
 */

import { NextStudio } from 'next-sanity/studio'
import config from '../../../sanity.config'

export default function StudioPage() {
  return <NextStudio config={config} />
}
