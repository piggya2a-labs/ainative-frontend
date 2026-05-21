// Type declarations for the Zapier MCP Web Component
// https://docs.zapier.com/powered-by-zapier/embedding-zapier-mcp/getting-started

declare namespace JSX {
  interface IntrinsicElements {
    'zapier-mcp': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      'embed-id'?: string
      width?: string
      height?: string
      'class-name'?: string
      'sign-up-email'?: string
      'sign-up-first-name'?: string
      'sign-up-last-name'?: string
      ref?: React.Ref<HTMLElement>
    }
  }
}
