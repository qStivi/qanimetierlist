import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Vite emits the module script before the stylesheet link in the built HTML.
// Move the stylesheet first so the CSS blocks script execution; otherwise
// Firefox warns "Layout was forced before the page was fully loaded".
function cssBeforeScript(): Plugin {
  return {
    name: 'css-before-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const link = /[ \t]*<link rel="stylesheet"[^>]*>\n?/g
        const links = html.match(link)
        if (!links) return html
        const script = /[ \t]*<script type="module"[^>]*><\/script>\n?/
        return html.replace(link, '').replace(script, (s) => links.join('') + s)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cssBeforeScript()],
})
