import { EditorState, Range, StateField, Transaction } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { previewOptions } from './previewSettings'
import {
  BulletWidget,
  CheckboxWidget,
  CodeHeaderWidget,
  FrontmatterWidget,
  HrWidget,
  InlineHtmlWidget,
  HtmlWidget,
  ImageWidget,
  MathWidget,
  MermaidWidget,
  TableWidget,
  TocWidget,
  type TableData,
} from './widgets'

interface Span {
  from: number
  to: number
}

const FOCUS_BLOCKS = new Set([
  'Paragraph',
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
  'SetextHeading1',
  'SetextHeading2',
  'Blockquote',
  'ListItem',
  'FencedCode',
  'IndentedCode',
  'Table',
  'HTMLBlock',
  'HorizontalRule',
])

function headingText(text: string) {
  return text
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/\s+#+\s*$/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim()
}

function splitTableRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1)
  const cells: string[] = []
  let current = ''
  let escaped = false
  for (const char of text) {
    if (escaped) {
      current += char === '|' ? '|' : `\\${char}`
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function tableData(state: EditorState, from: number, to: number): TableData | null {
  const first = state.doc.lineAt(from)
  const last = state.doc.lineAt(to)
  if (last.number <= first.number) return null
  const lines: string[] = []
  for (let n = first.number; n <= last.number; n++) lines.push(state.doc.line(n).text)
  const delimiterIndex = lines.findIndex((line, index) => {
    if (index === 0) return false
    const cells = splitTableRow(line)
    return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()))
  })
  if (delimiterIndex < 1) return null
  const headers = splitTableRow(lines[0])
  const delimiter = splitTableRow(lines[delimiterIndex])
  const align = delimiter.map((cell) => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center' as const
    if (right) return 'right' as const
    if (left) return 'left' as const
    return 'default' as const
  })
  const rows = lines
    .slice(delimiterIndex + 1)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells = splitTableRow(line)
      while (cells.length < headers.length) cells.push('')
      return cells.slice(0, headers.length)
    })
  return { headers, rows, align, pos: from }
}

function blockRange(state: EditorState, from: number, to: number): Span {
  const first = state.doc.lineAt(from)
  const last = state.doc.lineAt(Math.max(from, to))
  const end = last.to < state.doc.length ? last.to + 1 : last.to
  return { from: first.from, to: end }
}

function inSpans(spans: Span[], pos: number): boolean {
  for (const span of spans) {
    if (pos >= span.from && pos < span.to) return true
  }
  return false
}

function overlaps(spans: Span[], from: number, to: number): boolean {
  for (const span of spans) {
    if (from < span.to && to > span.from) return true
  }
  return false
}

function parseImage(raw: string): { alt: string; src: string } | null {
  const match = raw.match(/^!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)$/)
  if (!match) return null
  return { alt: match[1] ?? '', src: (match[2] ?? match[3] ?? '').trim() }
}

function parseLinkHref(raw: string): string | null {
  const inline = raw.match(/^\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)$/)
  if (inline) return (inline[1] ?? inline[2] ?? '').trim()
  const auto = raw.match(/^<([^>]+)>$/)
  if (auto) return auto[1]
  return null
}

function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.doc
  const tree = syntaxTree(state)
  const options = state.facet(previewOptions)
  const ranges: Range<Decoration>[] = []
  const replacements: Span[] = []
  const protectedSpans: Span[] = []
  const headings: { level: number; text: string; pos: number }[] = []
  let frontmatter: Span | null = null
  if (doc.lines >= 3 && doc.line(1).text.trim() === '---') {
    for (let n = 2; n <= doc.lines; n++) {
      if (doc.line(n).text.trim() === '---') {
        frontmatter = { from: doc.line(1).from, to: doc.line(n).to }
        break
      }
    }
  }
  const taskLines = new Set<number>()
  const cursor = state.selection.ranges

  const touched = (from: number, to: number) =>
    cursor.some((range) =>
      range.empty ? range.from >= from && range.from <= to : range.from < to && range.to > from,
    )

  const hide = (from: number, to: number) => {
    if (to > from) ranges.push(Decoration.replace({}).range(from, to))
  }

  const lineClass = (pos: number, className: string) => {
    ranges.push(Decoration.line({ class: className }).range(pos))
  }

  const addReplace = (from: number, to: number, widget?: WidgetType, block = false) => {
    if (to <= from) return
    ranges.push(Decoration.replace({ widget, block }).range(from, to))
    replacements.push({ from, to })
  }

  tree.iterate({
    enter(nodeRef) {
      const node = nodeRef.node
      const name = node.name
      const text = state.sliceDoc(node.from, node.to)

      if (frontmatter && node.from >= frontmatter.from && node.to <= frontmatter.to) return false

      if (/^ATXHeading[1-6]$/.test(name)) {
        const level = Number(name.slice(-1))
        const line = doc.lineAt(node.from)
        lineClass(line.from, `cm-heading cm-h${level}`)
        headings.push({ level, text: headingText(line.text), pos: line.from })
        return
      }

      if (name === 'SetextHeading1' || name === 'SetextHeading2') {
        const level = name.endsWith('1') ? 1 : 2
        const line = doc.lineAt(node.from)
        lineClass(line.from, `cm-heading cm-h${level}`)
        const endLine = doc.lineAt(Math.max(node.from, node.to - 1))
        if (endLine.number > line.number && /^\s*(=+|-+)\s*$/.test(endLine.text)) {
          const range = blockRange(state, endLine.from, endLine.to)
          addReplace(range.from, range.to, undefined, true)
        }
        headings.push({ level, text: headingText(line.text), pos: line.from })
        return
      }

      if (name === 'HeaderMark') {
        const line = doc.lineAt(node.from)
        if (line.text.trimStart().startsWith('#')) {
          let end = node.to
          if (state.sliceDoc(end, end + 1) === ' ') end += 1
          hide(node.from, end)
        }
        return
      }

      if (name === 'Blockquote') {
        const first = doc.lineAt(node.from).number
        const last = doc.lineAt(Math.max(node.from, node.to - 1)).number
        for (let n = first; n <= last; n++) lineClass(doc.line(n).from, 'cm-quote')
        return
      }

      if (name === 'QuoteMark') {
        let end = node.to
        if (state.sliceDoc(end, end + 1) === ' ') end += 1
        hide(node.from, end)
        return
      }

      if (name === 'ListMark') {
        const line = doc.lineAt(node.from)
        const after = state.sliceDoc(node.to, line.to)
        const isTask = /^[ \t]+\[[ xX]\]/.test(after)
        if (isTask) {
          taskLines.add(line.number)
          return
        }
        if (/^\d+[.)]$/.test(text)) {
          ranges.push(Decoration.mark({ class: 'cm-list-number' }).range(node.from, node.to))
          return
        }
        const indent = line.text.match(/^\s*/)?.[0].length ?? 0
        const depth = Math.floor(indent / 2)
        ranges.push(
          Decoration.replace({ widget: new BulletWidget(depth) }).range(node.from, node.to),
        )
        return
      }

      if (name === 'FencedCode') {
        const openLine = doc.lineAt(node.from)
        const rawOpen = openLine.text
        const openMatch = rawOpen.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)/)
        const fenceChar = openMatch?.[1]?.[0] ?? '`'
        const language = (openMatch?.[2] ?? '').replace(/^\{?\.?/, '').replace(/\}$/, '')
        const lastPos = Math.max(node.from, node.to - 1)
        const endLine = doc.lineAt(lastPos)
        const closingIsFence =
          endLine.number > openLine.number &&
          new RegExp(`^\\s*${fenceChar}{3,}\\s*$`).test(endLine.text)
        const closeLine = closingIsFence ? endLine : null
        const codeStart = Math.min(openLine.to + 1, doc.length)
        const codeEnd = closeLine ? closeLine.from : node.to
        const code = state.sliceDoc(codeStart, Math.max(codeStart, codeEnd)).replace(/\n$/, '')
        protectedSpans.push({ from: node.from, to: node.to })

        const blockTouched = touched(openLine.from, closeLine?.to ?? node.to)

        // An empty fence stays visible so it can be filled in.
        if (codeEnd <= codeStart) return false

        if (language.toLowerCase() === 'mermaid' && codeEnd > codeStart) {
          if (!blockTouched) {
            const range = blockRange(state, node.from, node.to)
            addReplace(
              range.from,
              range.to,
              new MermaidWidget(
                code,
                options.theme === 'night' || options.theme === 'nord' ? 'dark' : 'default',
                codeStart,
              ),
              true,
            )
          } else {
            for (let n = openLine.number + 1; n <= (closeLine?.number ?? doc.lines) - 1; n++) {
              lineClass(doc.line(n).from, 'cm-code-line')
            }
          }
          return false
        }

        if (codeEnd > codeStart) {
          const firstCode = doc.lineAt(codeStart)
          const lastCode = doc.lineAt(Math.max(codeStart, codeEnd - 1))
          const lineNumber = firstCode.number
          const endNumber = closeLine ? Math.min(lastCode.number, closeLine.number - 1) : lastCode.number
          for (let n = lineNumber; n <= endNumber; n++) {
            const line = doc.line(n)
            let cls = 'cm-code-line'
            if (n === lineNumber) cls += ' cm-code-first'
            if (n === endNumber) cls += ' cm-code-last'
            lineClass(line.from, cls)
          }
          ranges.push(
            Decoration.widget({
              widget: new CodeHeaderWidget(language, code),
              block: true,
              side: -1,
            }).range(codeStart),
          )
        }

        // Fence lines are folded away with CSS so they do not disturb the
        // block widget that carries the code header.
        lineClass(openLine.from, 'cm-code-fence-hidden')
        if (closeLine) lineClass(closeLine.from, 'cm-code-fence-hidden')
        return false
      }

      if (name === 'IndentedCode') {
        const first = doc.lineAt(node.from).number
        const last = doc.lineAt(Math.max(node.from, node.to - 1)).number
        for (let n = first; n <= last; n++) lineClass(doc.line(n).from, 'cm-code-line')
        protectedSpans.push({ from: node.from, to: node.to })
        return false
      }

      if (name === 'Table') {
        const first = doc.lineAt(node.from)
        const last = doc.lineAt(Math.max(node.from, node.to - 1))
        const range = blockRange(state, first.from, last.to)
        const tableTouched = touched(node.from, node.to)
        protectedSpans.push({ from: node.from, to: node.to })
        if (tableTouched) {
          for (let n = first.number; n <= last.number; n++) lineClass(doc.line(n).from, 'cm-table-source')
        } else {
          const data = tableData(state, node.from, node.to)
          if (data) addReplace(range.from, range.to, new TableWidget(data), true)
          else {
            for (let n = first.number; n <= last.number; n++) lineClass(doc.line(n).from, 'cm-table-source')
          }
        }
        return false
      }

      if (name === 'HTMLBlock') {
        protectedSpans.push({ from: node.from, to: node.to })
        if (!touched(node.from, node.to) && text.trim()) {
          const range = blockRange(state, node.from, node.to)
          addReplace(range.from, range.to, new HtmlWidget(text), true)
        }
        return false
      }

      if (name === 'HorizontalRule') {
        if (frontmatter && node.from >= frontmatter.from && node.to <= frontmatter.to) return false
        const range = blockRange(state, node.from, node.to)
        if (touched(node.from, node.to)) lineClass(range.from, 'cm-hr-source')
        else addReplace(range.from, range.to, new HrWidget(), true)
        return false
      }

      if (name === 'Image') {
        const parsed = parseImage(text)
        const line = doc.lineAt(node.from)
        const isBlock = line.text.trim() === text.trim()
        if (touched(node.from, node.to)) {
          lineClass(line.from, 'cm-image-source')
          return false
        }
        if (parsed && parsed.src) {
          const widget = new ImageWidget(parsed.src, parsed.alt, isBlock, node.from)
          if (isBlock) {
            lineClass(line.from, 'cm-image-line')
            ranges.push(Decoration.replace({ widget, block: true }).range(node.from, node.to))
          } else {
            ranges.push(Decoration.replace({ widget }).range(node.from, node.to))
          }
        }
        return false
      }

      if (name === 'Link') {
        if (text.trim() === '[TOC]' || text.trim().startsWith('[^')) return false
        if (touched(node.from, node.to)) return false
        const href = parseLinkHref(text)
        const isAutolink = text.startsWith('<')
        if (isAutolink) {
          hide(node.from, node.from + 1)
          hide(node.to - 1, node.to)
        } else {
          const close = text.indexOf(']')
          if (close < 0) return false
          hide(node.from, node.from + 1)
          hide(node.from + close, node.to)
        }
        ranges.push(
          Decoration.mark({
            class: 'cm-link',
            attributes: href ? { 'data-href': href, title: href } : {},
          }).range(node.from, node.to),
        )
        protectedSpans.push({ from: node.from, to: node.to })
        return false
      }

      if (name === 'InlineCode') {
        const first = text.charAt(0)
        if (first === '`') {
          let count = 0
          while (text.charAt(count) === '`') count++
          hide(node.from, node.from + count)
          hide(node.to - count, node.to)
        }
        ranges.push(Decoration.mark({ class: 'cm-inline-code' }).range(node.from, node.to))
        protectedSpans.push({ from: node.from, to: node.to })
        return false
      }

      if (name === 'Emphasis') {
        ranges.push(Decoration.mark({ class: 'cm-em' }).range(node.from, node.to))
        return
      }

      if (name === 'StrongEmphasis') {
        ranges.push(Decoration.mark({ class: 'cm-strong' }).range(node.from, node.to))
        return
      }

      if (name === 'Strikethrough') {
        ranges.push(Decoration.mark({ class: 'cm-strike' }).range(node.from, node.to))
        return
      }

      if (name === 'EmphasisMark' || name === 'StrikethroughMark') {
        hide(node.from, node.to)
        return
      }

      if (name === 'Escape') {
        lineClass(doc.lineAt(node.from).from, 'cm-escape-line')
      }

      if (name === 'URL') {
        // Bare URLs are only styled when not part of an already rendered link.
        ranges.push(Decoration.mark({ class: 'cm-url' }).range(node.from, node.to))
        return false
      }

      return
    },
  })

  if (frontmatter) {
    const range = blockRange(state, frontmatter.from, frontmatter.to)
    const raw = state.sliceDoc(frontmatter.from, frontmatter.to)
    const entries: { key: string; value: string }[] = []
    for (const lineText of raw.split(/\r?\n/)) {
      if (lineText.trim() === '---') continue
      const match = lineText.match(/^\s*([^:#][^:]*):\s*(.*)$/)
      if (match) entries.push({ key: match[1].trim(), value: match[2].trim() })
    }
    if (!touched(frontmatter.from, frontmatter.to)) {
      addReplace(
        range.from,
        range.to,
        new FrontmatterWidget({ entries, raw, pos: frontmatter.from }),
        true,
      )
    } else {
      for (let n = doc.lineAt(frontmatter.from).number; n <= doc.lineAt(frontmatter.to).number; n++) {
        lineClass(doc.line(n).from, 'cm-frontmatter-source')
      }
    }
    protectedSpans.push({ from: frontmatter.from, to: frontmatter.to })
  }

  const isProtected = (pos: number) => inSpans(protectedSpans, pos) || inSpans(replacements, pos)

  // Task lists, including ordered tasks.
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (isProtected(line.from)) continue
    const match = line.text.match(/^([ \t]*)([-*+]|\d+[.)])[ \t]+\[([ xX])\]([ \t]+)/)
    if (!match) continue
    taskLines.add(n)
    const bracketOffset = line.text.indexOf('[')
    const markerFrom = line.from + bracketOffset
    const markerTo = markerFrom + 3
    const replaceFrom = line.from + match[1].length
    const replaceTo = line.from + match[0].length
    if (match[3].toLowerCase() === 'x') lineClass(line.from, 'cm-task-done')
    lineClass(line.from, 'cm-task-line')
    if (touched(markerFrom, markerTo + 1)) continue
    ranges.push(
      Decoration.replace({
        widget: new CheckboxWidget(match[3].toLowerCase() === 'x', markerFrom),
      }).range(replaceFrom, replaceTo),
    )
    replacements.push({ from: replaceFrom, to: replaceTo })
  }

  // Block math.
  const mathBlocks: Span[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (isProtected(line.from)) continue
    const trimmed = line.text.trim()
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      const tex = trimmed.slice(2, -2).trim()
      if (!touched(line.from, line.to)) {
        const range = blockRange(state, line.from, line.to)
        addReplace(range.from, range.to, new MathWidget(tex, true, line.from + 2), true)
      }
      mathBlocks.push({ from: line.from, to: line.to })
      continue
    }
    if (trimmed !== '$$') continue
    let end = -1
    for (let m = n + 1; m <= doc.lines; m++) {
      const candidate = doc.line(m)
      if (isProtected(candidate.from) && m === n + 1) break
      if (candidate.text.trim().endsWith('$$')) {
        end = m
        break
      }
    }
    if (end < 0) continue
    const lastLine = doc.line(end)
    const tex = doc.sliceString(line.from + 2, lastLine.to - 2).trim()
    const block = { from: line.from, to: lastLine.to }
    if (!touched(block.from, block.to)) {
      addReplace(block.from, block.to, new MathWidget(tex, true, line.from + 2), true)
    } else {
      for (let m = n; m <= end; m++) lineClass(doc.line(m).from, 'cm-math-source')
    }
    mathBlocks.push({ from: block.from, to: block.to })
    n = end
  }

  const inMath = (pos: number) => inSpans(mathBlocks, pos)

  // Inline math, highlights, footnote references, and the [TOC] marker.
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (isProtected(line.from)) continue
    const text = line.text

    if (text.trim() === '[TOC]' && !inMath(line.from)) {
      if (!touched(line.from, line.to)) {
        const items = headings.map((heading) => ({
          level: heading.level,
          text: heading.text || 'Untitled',
          pos: heading.pos,
        }))
        const range = blockRange(state, line.from, line.to)
        addReplace(range.from, range.to, new TocWidget(items), true)
      }
      continue
    }

    if (inMath(line.from)) continue

    const mathPattern = /(?<!\\)\$(?!\$)([^$\n]+?)\$(?!\$)/g
    let match: RegExpExecArray | null
    while ((match = mathPattern.exec(text)) !== null) {
      const from = line.from + match.index
      const to = from + match[0].length
      if (isProtected(from) || overlaps(mathBlocks, from, to)) continue
      if (touched(from, to)) continue
      ranges.push(
        Decoration.replace({
          widget: new MathWidget(match[1], false, from),
        }).range(from, to),
      )
      replacements.push({ from, to })
    }

    const highlightPattern = /==([^=\n]+?)==/g
    while ((match = highlightPattern.exec(text)) !== null) {
      const from = line.from + match.index
      const to = from + match[0].length
      if (isProtected(from) || overlaps(replacements, from, to)) continue
      if (touched(from, to)) continue
      hide(from, from + 2)
      hide(to - 2, to)
      ranges.push(Decoration.mark({ class: 'cm-highlight' }).range(from + 2, to - 2))
    }

    const htmlPattern = /<(kbd|mark|u|sup|sub|small|ins|del|s|em|strong|code|span)\b[^>]*>[\s\S]*?<\/\1>/gi
    while ((match = htmlPattern.exec(text)) !== null) {
      const from = line.from + match.index
      const to = from + match[0].length
      if (isProtected(from) || overlaps(replacements, from, to)) continue
      if (touched(from, to)) continue
      ranges.push(
        Decoration.replace({ widget: new InlineHtmlWidget(match[0], from) }).range(from, to),
      )
      replacements.push({ from, to })
    }

    const footnotePattern = /\[\^[^\]]+\]/g
    while ((match = footnotePattern.exec(text)) !== null) {
      const from = line.from + match.index
      const to = from + match[0].length
      if (isProtected(from)) continue
      ranges.push(Decoration.mark({ class: 'cm-footnote-ref' }).range(from, to))
    }

    if (/^\s*\[\^[^\]]+\]:/.test(text)) {
      lineClass(line.from, 'cm-footnote-def')
    }
  }

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (line.text.length === 0) lineClass(line.from, 'cm-empty-line')
  }

  if (options.focus) {
    const head = state.selection.main.head
    let node: SyntaxNode | null = tree.resolveInner(head, 1)
    while (node && node.parent && !FOCUS_BLOCKS.has(node.name)) node = node.parent
    if (node && FOCUS_BLOCKS.has(node.name)) {
      const first = doc.lineAt(node.from).number
      const last = doc.lineAt(Math.max(node.from, node.to - 1)).number
      for (let n = 1; n <= doc.lines; n++) {
        if (n < first || n > last) lineClass(doc.line(n).from, 'cm-dim')
      }
    }
  }

  return Decoration.set(ranges, true)
}

export const livePreview = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(value, transaction: Transaction) {
    if (transaction.docChanged || transaction.selection || transaction.reconfigured) {
      return buildDecorations(transaction.state)
    }
    return value
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

export { buildDecorations }
