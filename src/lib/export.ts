import MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import hljs from 'highlight.js'
import katex from 'katex'
import githubCss from 'highlight.js/styles/github.css?raw'
import githubDarkCss from 'highlight.js/styles/github-dark.css?raw'
import { escapeHtml } from './markdown'

let slugCounts: Record<string, number> = {}

function slug(text: string) {
  const base = text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  const n = (slugCounts[base] = (slugCounts[base] ?? 0) + 1)
  return n === 1 ? base || 'section' : `${base}-${n}`
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
})

md.use(footnote)
md.validateLink = (url: string) =>
  /^(https?:|mailto:|tel:|#|\/|\.{0,2}\/|data:image\/)/i.test(url.trim())

md.inline.ruler.after('escape', 'math_inline', (state: any, silent: boolean) => {
  const start = state.pos
  if (state.src[start] !== '$' || state.src[start + 1] === '$') return false
  if (start > 0 && state.src[start - 1] === '\\') return false
  let end = start + 1
  while ((end = state.src.indexOf('$', end)) !== -1) {
    if (state.src[end - 1] !== '\\') break
    end++
  }
  if (end < 0 || end === start + 1) return false
  if (state.src[end + 1] === '$') return false
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = state.src.slice(start + 1, end)
    token.markup = '$'
  }
  state.pos = end + 1
  return true
})

md.inline.ruler.after('escape', 'highlight', (state: any, silent: boolean) => {
  const start = state.pos
  if (state.src.slice(start, start + 2) !== '==') return false
  const end = state.src.indexOf('==', start + 2)
  if (end < 0) return false
  if (!silent) {
    const token = state.push('highlight', 'mark', 0)
    token.content = state.src.slice(start + 2, end)
    token.markup = '=='
  }
  state.pos = end + 2
  return true
})

md.renderer.rules.highlight = (tokens, index) => `<mark>${md.renderInline(tokens[index].content)}</mark>`

md.block.ruler.before('fence', 'math_block', (state: any, startLine: number, endLine: number, silent: boolean) => {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  const line = state.src.slice(start, max).trim()
  if (!line.startsWith('$$')) return false
  let content = ''
  let nextLine = startLine
  if (line.length > 4 && line.endsWith('$$')) {
    content = line.slice(2, -2).trim()
  } else {
    const body: string[] = []
    nextLine = startLine + 1
    let closed = false
    for (; nextLine < endLine; nextLine++) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineEnd = state.eMarks[nextLine]
      const text = state.src.slice(lineStart, lineEnd)
      if (text.trim().endsWith('$$')) {
        closed = true
        body.push(text.slice(0, text.lastIndexOf('$$')))
        break
      }
      body.push(text)
    }
    if (!closed) return false
    content = body.join('\n').trim()
  }
  if (silent) return true
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content
  token.map = [startLine, nextLine + 1]
  token.markup = '$$'
  state.line = nextLine + 1
  return true
})

md.renderer.rules.math_inline = (tokens, index) => {
  try {
    return katex.renderToString(tokens[index].content, { throwOnError: false, displayMode: false })
  } catch {
    return escapeHtml(`$${tokens[index].content}$`)
  }
}
md.renderer.rules.math_block = (tokens, index) => {
  try {
    return `<div class="math-block">${katex.renderToString(tokens[index].content, {
      throwOnError: false,
      displayMode: true,
    })}</div>\n`
  } catch {
    return `<pre class="math-block">${escapeHtml(tokens[index].content)}</pre>\n`
  }
}

md.renderer.rules.heading_open = (tokens, index) => {
  const token = tokens[index]
  const inline = tokens[index + 1]
  const text = inline?.content ?? ''
  return `<${token.tag} id="${slug(text)}">`
}

md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]
  const info = token.info.trim()
  const language = info.split(/\s+/)[0] ?? ''
  if (language.toLowerCase() === 'mermaid') {
    return `<div class="mermaid" data-code="${encodeURIComponent(token.content)}"></div>\n`
  }
  let highlighted = ''
  if (language && hljs.getLanguage(language)) {
    try {
      highlighted = hljs.highlight(token.content, { language }).value
    } catch {
      highlighted = escapeHtml(token.content)
    }
  } else {
    highlighted = escapeHtml(token.content)
  }
  return `<pre class="hljs"><code class="language-${escapeHtml(language)}">${highlighted}</code></pre>\n`
}

md.core.ruler.after('inline', 'task-lists', (state: any) => {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'inline' || !token.children) continue
    const match = token.content.match(/^\[([ xX])\]\s+/)
    if (!match) continue
    let parent = i - 1
    while (parent >= 0 && tokens[parent].type !== 'list_item_open') parent--
    if (parent < 0) continue
    const checkbox = new state.Token('html_inline', '', 0)
    checkbox.content = `<input type="checkbox" class="task-checkbox" disabled${
      match[1].toLowerCase() === 'x' ? ' checked' : ''
    }> `
    token.children.unshift(checkbox)
    const prefixLength = match[0].length
    for (const child of token.children) {
      if (child.type === 'text') {
        child.content = child.content.slice(Math.min(prefixLength, child.content.length))
        break
      }
    }
  }
})

async function renderMermaid(html: string, dark: boolean): Promise<string> {
  if (!html.includes('class="mermaid"')) return html
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' })
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>('.mermaid'))
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const code = decodeURIComponent(node.dataset.code ?? '')
    try {
      const { svg } = await mermaid.render(`export-mermaid-${Date.now()}-${i}`, code)
      const wrapper = doc.createElement('div')
      wrapper.className = 'mermaid-rendered'
      wrapper.innerHTML = svg
      node.replaceWith(wrapper)
    } catch (error) {
      node.textContent = `图表错误：${error instanceof Error ? error.message : String(error)}`
    }
  }
  return doc.body.innerHTML
}

export interface ExportOptions {
  title: string
  markdown: string
  dark?: boolean
  includeToc?: boolean
  standalone?: boolean
}

const exportStyles = (dark: boolean) => `
:root {
  color-scheme: ${dark ? 'dark' : 'light'};
  --page: ${dark ? '#1e1e23' : '#ffffff'};
  --text: ${dark ? '#e7e3da' : '#25221e'};
  --soft: ${dark ? '#b8b2a6' : '#5f5a51'};
  --muted: ${dark ? '#8a8478' : '#8c8578'};
  --line: ${dark ? '#33333b' : '#e7e2d9'};
  --code: ${dark ? '#191920' : '#f6f3ec'};
  --accent: ${dark ? '#e0a469' : '#b4532a'};
  --mark: ${dark ? '#5a4a24' : '#f7e6a4'};
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: ${dark ? '#151519' : '#f4f1ea'};
  color: var(--text);
  font-family: "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.75;
}
.page {
  max-width: 800px;
  margin: 48px auto;
  padding: 72px 80px 96px;
  background: var(--page);
  border-radius: 4px;
  box-shadow: 0 20px 60px rgba(20, 16, 10, .08);
}
h1, h2, h3, h4, h5, h6 {
  line-height: 1.28;
  margin: 1.7em 0 .6em;
  font-weight: 700;
  letter-spacing: -.012em;
}
h1 { font-size: 2.1em; margin-top: .2em; }
h2 { font-size: 1.55em; padding-bottom: .28em; border-bottom: 1px solid var(--line); }
h3 { font-size: 1.28em; }
h4 { font-size: 1.1em; }
h5 { font-size: 1em; }
h6 { font-size: .92em; color: var(--soft); }
p { margin: 0 0 1.05em; }
a { color: var(--accent); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
a:hover { border-bottom-color: var(--accent); }
strong { font-weight: 700; }
em { font-style: italic; }
del { color: var(--muted); }
mark { background: var(--mark); color: inherit; padding: .08em .2em; border-radius: 3px; }
blockquote {
  margin: 1.2em 0;
  padding: .35em 1.1em;
  border-left: 3px solid var(--accent);
  color: var(--soft);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  border-radius: 0 8px 8px 0;
}
blockquote p:last-child { margin-bottom: 0; }
ul, ol { padding-left: 1.5em; margin: .6em 0 1.1em; }
li { margin: .25em 0; }
li > p { margin-bottom: .3em; }
.task-checkbox { accent-color: var(--accent); width: 15px; height: 15px; margin: 0 .45em 0 -1.3em; vertical-align: -2px; }
hr { border: none; border-top: 1px solid var(--line); margin: 2em 0; }
code {
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: .88em;
  background: var(--code);
  padding: .16em .4em;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}
pre.hljs {
  background: var(--code);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px 18px;
  overflow-x: auto;
  line-height: 1.6;
  margin: 1.2em 0 1.4em;
}
pre.hljs code { background: none; border: none; padding: 0; font-size: .86em; }
table { border-collapse: collapse; width: 100%; margin: 1.3em 0; font-size: .95em; }
th, td { border: 1px solid var(--line); padding: 9px 13px; text-align: left; vertical-align: top; }
th { background: color-mix(in srgb, var(--line) 38%, transparent); font-weight: 650; }
tr:nth-child(even) td { background: color-mix(in srgb, var(--line) 16%, transparent); }
img { max-width: 100%; height: auto; border-radius: 8px; }
.math-block { margin: 1.2em 0; overflow-x: auto; text-align: center; }
.katex-display { margin: 1em 0; }
.mermaid { text-align: center; margin: 1.4em 0; }
.mermaid-rendered { text-align: center; margin: 1.4em 0; }
.mermaid-rendered svg { max-width: 100%; height: auto; }
.footnotes { margin-top: 3em; font-size: .9em; color: var(--soft); border-top: 1px solid var(--line); padding-top: 1em; }
.footnotes-sep { display: none; }
.footnote-ref a { font-size: .75em; padding: 0 .15em; }
.footnote-backref { text-decoration: none; border: none; }
.toc {
  margin: 1.5em 0 2em;
  padding: 16px 20px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--line) 14%, transparent);
}
.toc-title { font-size: .75em; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: .5em; }
.toc a { display: block; padding: 2px 0; border: none; color: var(--soft); }
.toc .toc-2 { padding-left: 1.2em; }
.toc .toc-3 { padding-left: 2.4em; }
.toc .toc-4 { padding-left: 3.6em; }
.export-meta { color: var(--muted); font-size: .8em; margin-bottom: 2em; letter-spacing: .04em; }
@media (max-width: 720px) {
  .page { margin: 0; padding: 36px 24px 60px; border-radius: 0; }
}
@media print {
  body { background: #fff; }
  .page { margin: 0; max-width: none; padding: 0; box-shadow: none; border-radius: 0; }
  pre, blockquote, table, img, .mermaid-rendered { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
  a { color: inherit; border: none; }
}
`

export async function renderDocumentHtml(options: ExportOptions): Promise<string> {
  slugCounts = {}
  const frontmatter = options.markdown.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/)
  const markdown = frontmatter ? options.markdown.slice(frontmatter[0].length) : options.markdown
  let body = md.render(markdown)
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html')
  if (options.includeToc) {
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4'))
    if (headings.length) {
      const nav = doc.createElement('nav')
      nav.className = 'toc'
      nav.innerHTML = `<div class="toc-title">目录</div>`
      for (const heading of headings) {
        const link = doc.createElement('a')
        link.href = `#${heading.id}`
        link.className = `toc-${heading.tagName.slice(1)}`
        link.textContent = heading.textContent
        nav.appendChild(link)
      }
      doc.body.insertBefore(nav, doc.body.firstChild)
    }
  }
  body = doc.body.innerHTML
  body = await renderMermaid(body, Boolean(options.dark))

  const dark = Boolean(options.dark)
  const highlightCss = dark ? githubDarkCss : githubCss
  return `<!doctype html>
<html lang="zh-CN" data-theme="${dark ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<script>
window.MathJax = undefined;
</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
<style>${highlightCss}</style>
<style>${exportStyles(dark)}</style>
</head>
<body>
<div class="page">
<div class="export-meta">${escapeHtml(options.title)} · ${new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}</div>
${body}
</div>
</body>
</html>`
}

async function saveGeneratedFile(
  defaultName: string,
  content: string,
  mime: string,
  filters: NativeFileFilter[],
): Promise<boolean> {
  const native = window.openMarkdownNative
  if (native) {
    const result = await native.saveFileAs({ defaultName, content, filters })
    if (result.error) throw new Error(result.error)
    return !result.canceled
  }
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = defaultName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return true
}

export async function exportHtmlFile(options: ExportOptions): Promise<boolean> {
  const html = await renderDocumentHtml({ ...options, standalone: true })
  return saveGeneratedFile(
    `${safeBase(options.title)}.html`,
    html,
    'text/html;charset=utf-8',
    [{ name: 'HTML', extensions: ['html', 'htm'] }],
  )
}

export async function printDocument(options: ExportOptions): Promise<boolean> {
  const html = await renderDocumentHtml({ ...options, standalone: true })
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html.replace('</body>', '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 500))</script></body>'))
  win.document.close()
  return true
}

export async function exportWordFile(options: ExportOptions): Promise<boolean> {
  const html = await renderDocumentHtml({ ...options, standalone: true })
  const word = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(
    options.title,
  )}</title><style>body{font-family:"Calibri",sans-serif;font-size:11pt;line-height:1.6}pre{background:#f4f4f4;padding:10px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}</style></head><body>${html
    .replace(/^.*<body>/s, '')
    .replace(/<\/body>.*$/s, '')}</body></html>`
  return saveGeneratedFile(
    `${safeBase(options.title)}.doc`,
    `\ufeff${word}`,
    'application/msword',
    [{ name: 'Word 文档', extensions: ['doc'] }],
  )
}

export async function copyHtmlToClipboard(options: ExportOptions): Promise<boolean> {
  const html = await renderDocumentHtml(options)
  const fragment = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? html
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([fragment], { type: 'text/html' }),
      'text/plain': new Blob([options.markdown], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    return true
  } catch {
    try {
      await navigator.clipboard.writeText(html)
      return true
    } catch {
      return false
    }
  }
}

function safeBase(name: string) {
  return name.replace(/\.(md|markdown|txt)$/i, '').replace(/[\\/:*?"<>|]/g, '-') || '文档'
}
