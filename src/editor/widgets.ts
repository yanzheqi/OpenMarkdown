import { WidgetType, EditorView } from '@codemirror/view'
import katex from 'katex'
import DOMPurify from 'dompurify'
import { renderInline } from '../lib/markdown'

function reveal(view: EditorView, pos: number, offset = 0) {
  view.dispatch({ selection: { anchor: Math.max(0, pos + offset) }, scrollIntoView: true })
  view.focus()
}

function stop(event: Event) {
  event.preventDefault()
  event.stopPropagation()
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

const copyIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`
const checkIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 12 5 5L20 6"/></svg>`

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly block: boolean,
    readonly pos: number,
  ) {
    super()
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt && other.block === this.block
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement(this.block ? 'figure' : 'span')
    wrap.className = this.block ? 'md-image-block' : 'md-image-inline'
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    img.draggable = false
    if (this.alt) img.title = this.alt
    const fallback = document.createElement('span')
    fallback.className = 'md-image-fallback'
    fallback.textContent = this.alt ? `图片：${this.alt}` : '图片加载失败'
    img.addEventListener('error', () => {
      img.style.display = 'none'
      fallback.style.display = 'inline-flex'
    })
    wrap.append(img, fallback)
    wrap.addEventListener('mousedown', (event) => {
      event.preventDefault()
      reveal(view, this.pos)
    })
    return wrap
  }

  ignoreEvent() {
    return false
  }
}

export class HrWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const el = document.createElement('div')
    el.className = 'md-hr'
    el.innerHTML = '<span></span>'
    return el
  }
  ignoreEvent() {
    return true
  }
}

export class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super()
  }
  eq(other: BulletWidget) {
    return other.depth === this.depth
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = this.depth > 0 ? 'md-bullet md-bullet-nested' : 'md-bullet'
    el.textContent = this.depth > 0 ? '◦' : '•'
    return el
  }
  ignoreEvent() {
    return true
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super()
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos
  }
  toDOM(view: EditorView) {
    const label = document.createElement('label')
    label.className = 'md-task'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.setAttribute('aria-label', this.checked ? '标记任务为未完成' : '标记任务为已完成')
    input.addEventListener('change', () => {
      const next = input.checked ? 'x' : ' '
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: next },
      })
    })
    label.appendChild(input)
    label.addEventListener('mousedown', (event) => event.stopPropagation())
    return label
  }
  ignoreEvent() {
    return false
  }
}

export class CodeHeaderWidget extends WidgetType {
  constructor(
    readonly language: string,
    readonly code: string,
  ) {
    super()
  }
  eq(other: CodeHeaderWidget) {
    return other.language === this.language && other.code === this.code
  }
  toDOM() {
    const el = document.createElement('div')
    el.className = 'md-code-header'
    const lang = document.createElement('span')
    lang.className = 'md-code-lang'
    lang.textContent = this.language || '文本'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'md-code-copy'
    button.innerHTML = `${copyIcon}<span>复制</span>`
    button.title = '复制代码'
    button.addEventListener('mousedown', (event) => event.stopPropagation())
    button.addEventListener('click', async (event) => {
      stop(event)
      const ok = await copyText(this.code)
      button.innerHTML = ok ? `${checkIcon}<span>已复制</span>` : '<span>复制失败</span>'
      setTimeout(() => {
        button.innerHTML = `${copyIcon}<span>复制</span>`
      }, 1400)
    })
    el.append(lang, button)
    return el
  }
  ignoreEvent() {
    return false
  }
}

export class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
    readonly pos: number,
  ) {
    super()
  }
  eq(other: MathWidget) {
    return other.tex === this.tex && other.display === this.display
  }
  toDOM(view: EditorView) {
    const el = document.createElement(this.display ? 'div' : 'span')
    el.className = this.display ? 'md-math-block' : 'md-math-inline'
    el.title = '点击编辑公式'
    try {
      katex.render(this.tex, el, {
        displayMode: this.display,
        throwOnError: false,
        strict: false,
        trust: false,
      })
    } catch (error) {
      el.textContent = `$${this.tex}$`
      el.classList.add('md-math-error')
    }
    el.addEventListener('mousedown', (event) => {
      event.preventDefault()
      reveal(view, this.pos)
    })
    return el
  }
  ignoreEvent() {
    return false
  }
}

export interface TableData {
  headers: string[]
  rows: string[][]
  align: ('left' | 'center' | 'right' | 'default')[]
  pos: number
}

export class TableWidget extends WidgetType {
  constructor(readonly data: TableData) {
    super()
  }
  eq(other: TableWidget) {
    return JSON.stringify(other.data) === JSON.stringify(this.data)
  }
  toDOM(view: EditorView) {
    const wrapper = document.createElement('div')
    wrapper.className = 'md-table-block'
    wrapper.title = '点击编辑表格'
    const table = document.createElement('table')
    table.className = 'md-table'
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    this.data.headers.forEach((cell, index) => {
      const th = document.createElement('th')
      th.innerHTML = renderInline(cell)
      applyAlign(th, this.data.align[index])
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    const tbody = document.createElement('tbody')
    this.data.rows.forEach((row) => {
      const tr = document.createElement('tr')
      this.data.headers.forEach((_, index) => {
        const td = document.createElement('td')
        td.innerHTML = renderInline(row[index] ?? '')
        applyAlign(td, this.data.align[index])
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.append(thead, tbody)
    const hint = document.createElement('span')
    hint.className = 'md-table-hint'
    hint.textContent = '点击编辑'
    wrapper.append(table, hint)
    wrapper.addEventListener('mousedown', (event) => {
      event.preventDefault()
      reveal(view, this.data.pos)
    })
    return wrapper
  }
  ignoreEvent() {
    return false
  }
}

function applyAlign(el: HTMLElement, align: TableData['align'][number]) {
  if (align && align !== 'default') el.style.textAlign = align
}

export class TocWidget extends WidgetType {
  constructor(readonly items: { level: number; text: string; pos: number }[]) {
    super()
  }
  eq(other: TocWidget) {
    return JSON.stringify(other.items) === JSON.stringify(this.items)
  }
  toDOM(view: EditorView) {
    const nav = document.createElement('nav')
    nav.className = 'md-toc'
    const title = document.createElement('div')
    title.className = 'md-toc-title'
    title.textContent = '目录'
    nav.appendChild(title)
    if (!this.items.length) {
      const empty = document.createElement('div')
      empty.className = 'md-toc-empty'
      empty.textContent = '添加标题后即可生成目录。'
      nav.appendChild(empty)
      return nav
    }
    for (const item of this.items) {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = `md-toc-item md-toc-level-${item.level}`
      link.textContent = item.text
      link.addEventListener('mousedown', (event) => {
        event.preventDefault()
        reveal(view, item.pos)
      })
      nav.appendChild(link)
    }
    return nav
  }
  ignoreEvent() {
    return false
  }
}

export class InlineHtmlWidget extends WidgetType {
  constructor(
    readonly html: string,
    readonly pos: number,
  ) {
    super()
  }
  eq(other: InlineHtmlWidget) {
    return other.html === this.html
  }
  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'md-inline-html'
    span.innerHTML = DOMPurify.sanitize(this.html, { USE_PROFILES: { html: true } })
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      reveal(view, this.pos)
    })
    return span
  }
  ignoreEvent() {
    return false
  }
}

export interface FrontmatterData {
  entries: { key: string; value: string }[]
  raw: string
  pos: number
}

export class FrontmatterWidget extends WidgetType {
  constructor(readonly data: FrontmatterData) {
    super()
  }
  eq(other: FrontmatterWidget) {
    return other.data.raw === this.data.raw
  }
  toDOM(view: EditorView) {
    const card = document.createElement('div')
    card.className = 'md-frontmatter'
    card.title = '点击编辑元数据'
    const title = document.createElement('div')
    title.className = 'md-frontmatter-title'
    title.textContent = '元数据'
    const list = document.createElement('dl')
    list.className = 'md-frontmatter-list'
    for (const entry of this.data.entries) {
      const row = document.createElement('div')
      row.className = 'md-frontmatter-row'
      const dt = document.createElement('dt')
      dt.textContent = entry.key
      const dd = document.createElement('dd')
      dd.textContent = entry.value
      row.append(dt, dd)
      list.appendChild(row)
    }
    card.append(title, list)
    card.addEventListener('mousedown', (event) => {
      event.preventDefault()
      reveal(view, this.data.pos)
    })
    return card
  }
  ignoreEvent() {
    return false
  }
}

export class HtmlWidget extends WidgetType {
  constructor(readonly html: string) {
    super()
  }
  eq(other: HtmlWidget) {
    return other.html === this.html
  }
  toDOM() {
    const el = document.createElement('div')
    el.className = 'md-html-block'
    el.innerHTML = DOMPurify.sanitize(this.html, { USE_PROFILES: { html: true } })
    return el
  }
  ignoreEvent() {
    return true
  }
}

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null
let mermaidTheme = ''

async function getMermaid(theme: 'default' | 'dark') {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  const mermaid = await mermaidPromise
  if (mermaidTheme !== theme) {
    mermaidTheme = theme
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables:
        theme === 'dark'
          ? {
              primaryColor: '#2f2a25',
              primaryTextColor: '#e8e3d9',
              primaryBorderColor: '#9b7650',
              lineColor: '#8b8478',
              secondaryColor: '#3a2b1e',
              tertiaryColor: '#232329',
              background: '#1b1b20',
              mainBkg: '#2f2a25',
              nodeBorder: '#9b7650',
              clusterBkg: '#24242b',
              clusterBorder: '#3e3e48',
              titleColor: '#e8e3d9',
              edgeLabelBackground: '#1b1b20',
              fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
            }
          : {
              primaryColor: '#f6e7da',
              primaryTextColor: '#29251f',
              primaryBorderColor: '#c98a63',
              lineColor: '#8b8274',
              secondaryColor: '#f1ddcf',
              tertiaryColor: '#fffdf8',
              background: '#fffdf8',
              mainBkg: '#f6e7da',
              nodeBorder: '#c98a63',
              clusterBkg: '#f8f2e8',
              clusterBorder: '#e2d3ba',
              titleColor: '#29251f',
              edgeLabelBackground: '#fffdf8',
              fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
            },
      flowchart: { curve: 'basis', padding: 16 },
      sequence: { useMaxWidth: true },
    })
  }
  return mermaid
}

export class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly theme: 'default' | 'dark',
    readonly pos: number,
  ) {
    super()
  }
  eq(other: MermaidWidget) {
    return other.code === this.code && other.theme === this.theme
  }
  toDOM(view: EditorView) {
    const wrapper = document.createElement('div')
    wrapper.className = 'md-mermaid'
    wrapper.title = '点击编辑图表'
    const loading = document.createElement('div')
    loading.className = 'md-mermaid-loading'
    loading.textContent = '正在渲染图表…'
    wrapper.appendChild(loading)
    const id = `openmarkdown-mermaid-${Math.random().toString(36).slice(2, 10)}`
    getMermaid(this.theme)
      .then((mermaid) => mermaid.render(id, this.code))
      .then(({ svg }) => {
        if (!wrapper.isConnected) return
        wrapper.innerHTML = svg
        wrapper.classList.add('is-rendered')
      })
      .catch((error: unknown) => {
        if (!wrapper.isConnected) return
        wrapper.innerHTML = ''
        const message = document.createElement('div')
        message.className = 'md-mermaid-error'
        message.textContent = `图表错误：${error instanceof Error ? error.message : String(error)}`
        const pre = document.createElement('pre')
        pre.textContent = this.code
        wrapper.append(message, pre)
      })
    wrapper.addEventListener('mousedown', (event) => {
      event.preventDefault()
      reveal(view, this.pos)
    })
    return wrapper
  }
  ignoreEvent() {
    return false
  }
}
