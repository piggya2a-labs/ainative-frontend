// Type declarations for the Zapier MCP Web Component
// https://docs.zapier.com/powered-by-zapier/embedding-zapier-mcp/getting-started

import type { HTMLAttributes, DetailedHTMLProps, Ref } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'zapier-mcp': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'embed-id'?: string
        width?: string
        height?: string
        'class-name'?: string
        'sign-up-email'?: string
        'sign-up-first-name'?: string
        'sign-up-last-name'?: string
        ref?: Ref<HTMLElement>
      }
    }
  }
}
