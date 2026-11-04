import MarkdownIt from 'markdown-it'
import type { OutlineItem } from '../store/types'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function renderInline(source: string): string {
  try {
    return md.renderInline(source)
  } catch {
    return escapeHtml(source)
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function stripMarkdown(source: string): string {
  try {
    const html = md.renderInline(source)
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent ?? source
  } catch {
    return source
  }
}

export interface Heading {
  level: number
  text: string
  line: number
  id: string
}

export function parseHeadings(content: string): Heading[] {
  let tokens
  try {
    tokens = md.parse(content, {})
  } catch {
    return []
  }
  const headings: Heading[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'heading_open') continue
    const inline = tokens[i + 1]
    const text = inline?.content ? stripMarkdown(inline.content) : ''
    const level = Number(token.tag.replace('h', '')) || 1
    const line = (token.map?.[0] ?? 0) + 1
    headings.push({ level, text, line, id: `${slugify(text)}-${line}` })
  }
  return headings
}

export function parseOutline(content: string): OutlineItem[] {
  return parseHeadings(content).map((heading) => ({
    level: heading.level,
    text: heading.text || '未命名标题',
    line: heading.line,
    id: heading.id,
  }))
}

export function countWords(content: string): { words: number; chars: number; charsNoSpaces: number } {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~=|[\]()-]/g, ' ')
  const cjk = plain.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0
  const latin = plain
    .replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length
  const chars = content.length
  const charsNoSpaces = content.replace(/\s/g, '').length
  return { words: latin + cjk, chars, charsNoSpaces }
}

export function readingTime(words: number): number {
  return Math.max(1, Math.round(words / 220))
}

export { md }
