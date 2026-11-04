import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  indentLess,
  indentMore,
  insertTab,
  redo,
  undo,
} from '@codemirror/commands'
import { closeSearchPanel, openSearchPanel } from '@codemirror/search'
import { useStore } from '../store/store'

let currentView: EditorView | null = null

export function setEditorView(view: EditorView | null) {
  currentView = view
}

export function getEditorView(): EditorView | null {
  return currentView
}

export function focusEditor() {
  currentView?.focus()
}

function activeLines(view: EditorView): { from: number; to: number } {
  const state = view.state
  const selection = state.selection.main
  const fromLine = state.doc.lineAt(selection.from)
  const toLine = state.doc.lineAt(selection.to)
  return { from: fromLine.from, to: toLine.to }
}

function replaceSelection(view: EditorView, text: string, selectFrom?: number, selectTo?: number) {
  const selection = view.state.selection.main
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: EditorSelection.range(
      selectFrom ?? selection.from,
      selectTo ?? (selectFrom !== undefined ? selectFrom : selection.from + text.length),
    ),
    scrollIntoView: true,
  })
  view.focus()
}

export function wrapInline(view: EditorView | null, marker: string) {
  if (!view) return
  const state = view.state
  const selection = state.selection.main
  const doc = state.doc
  const length = marker.length

  if (selection.empty) {
    const before = doc.sliceString(Math.max(0, selection.from - length), selection.from)
    const after = doc.sliceString(selection.to, Math.min(doc.length, selection.to + length))
    if (before === marker && after === marker) {
      view.dispatch({
        changes: [
          { from: selection.from - length, to: selection.from },
          { from: selection.to, to: selection.to + length },
        ],
        selection: EditorSelection.cursor(selection.from - length),
      })
      view.focus()
      return
    }
    view.dispatch({
      changes: { from: selection.from, insert: `${marker}${marker}` },
      selection: EditorSelection.cursor(selection.from + length),
      scrollIntoView: true,
    })
    view.focus()
    return
  }

  const text = doc.sliceString(selection.from, selection.to)
  if (text.startsWith(marker) && text.endsWith(marker) && text.length >= length * 2) {
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: text.slice(length, -length) },
      selection: EditorSelection.range(selection.from, selection.to - length * 2),
    })
    view.focus()
    return
  }
  const before = doc.sliceString(Math.max(0, selection.from - length), selection.from)
  const after = doc.sliceString(selection.to, Math.min(doc.length, selection.to + length))
  if (before === marker && after === marker) {
    view.dispatch({
      changes: [
        { from: selection.from - length, to: selection.from },
        { from: selection.to, to: selection.to + length },
      ],
      selection: EditorSelection.range(selection.from - length, selection.to - length),
    })
    view.focus()
    return
  }
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: `${marker}${text}${marker}` },
    selection: EditorSelection.range(selection.from + length, selection.to + length),
    scrollIntoView: true,
  })
  view.focus()
}

export function toggleBold(view = currentView) {
  wrapInline(view, '**')
}
export function toggleItalic(view = currentView) {
  wrapInline(view, '*')
}
export function toggleStrike(view = currentView) {
  wrapInline(view, '~~')
}
export function toggleCode(view = currentView) {
  wrapInline(view, '`')
}
export function toggleHighlight(view = currentView) {
  wrapInline(view, '==')
}

export function setHeading(view: EditorView | null, level: number) {
  if (!view) return
  const { from, to } = activeLines(view)
  const state = view.state
  const changes: { from: number; to: number; insert: string }[] = []
  let cursor = state.selection.main.head
  for (let pos = from; pos <= to; ) {
    const line = state.doc.lineAt(pos)
    const match = line.text.match(/^(\s*)#{1,6}\s+/)
    const indent = line.text.match(/^\s*/)?.[0] ?? ''
    if (match) {
      const next = level > 0 ? `${indent}${'#'.repeat(level)} ` : indent
      changes.push({ from: line.from, to: line.from + match[0].length, insert: next })
      if (line.from + match[0].length <= cursor) {
        cursor += next.length - match[0].length
      }
    } else if (level > 0) {
      const prefix = `${indent}${'#'.repeat(level)} `
      changes.push({ from: line.from, to: line.from + indent.length, insert: prefix })
      if (line.from <= cursor) cursor += prefix.length - indent.length
    }
    if (line.to >= to) break
    pos = line.to + 1
  }
  if (!changes.length) return
  view.dispatch({ changes, selection: EditorSelection.cursor(cursor), scrollIntoView: true })
  view.focus()
}

type ListKind = 'bullet' | 'ordered' | 'task'

export function toggleList(view: EditorView | null, kind: ListKind) {
  if (!view) return
  const { from, to } = activeLines(view)
  const state = view.state
  const changes: { from: number; to: number; insert: string }[] = []
  let cursor = state.selection.main.head
  let index = 1
  for (let pos = from; pos <= to; ) {
    const line = state.doc.lineAt(pos)
    const pattern = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/
    const match = line.text.match(pattern)
    const indent = match?.[1] ?? line.text.match(/^\s*/)?.[0] ?? ''
    const prefix =
      kind === 'bullet' ? `${indent}- ` : kind === 'ordered' ? `${indent}${index}. ` : `${indent}- [ ] `
    changes.push({
      from: line.from,
      to: line.from + (match ? match[0].length : indent.length),
      insert: prefix,
    })
    if (line.from <= cursor) {
      cursor += prefix.length - (match ? match[0].length : indent.length)
    }
    index++
    if (line.to >= to) break
    pos = line.to + 1
  }
  view.dispatch({ changes, selection: EditorSelection.cursor(cursor), scrollIntoView: true })
  view.focus()
}

export function toggleQuote(view: EditorView | null) {
  if (!view) return
  const { from, to } = activeLines(view)
  const state = view.state
  const changes: { from: number; to: number; insert: string }[] = []
  let cursor = state.selection.main.head
  for (let pos = from; pos <= to; ) {
    const line = state.doc.lineAt(pos)
    const match = line.text.match(/^(\s*)>\s?/)
    if (match) {
      changes.push({ from: line.from, to: line.from + match[0].length, insert: match[1] })
      if (line.from + match[0].length <= cursor) cursor -= match[0].length - match[1].length
    } else {
      const indent = line.text.match(/^\s*/)?.[0] ?? ''
      changes.push({ from: line.from, to: line.from + indent.length, insert: `${indent}> ` })
      if (line.from <= cursor) cursor += 2
    }
    if (line.to >= to) break
    pos = line.to + 1
  }
  view.dispatch({ changes, selection: EditorSelection.cursor(cursor), scrollIntoView: true })
  view.focus()
}

export function insertBlock(text: string, cursorOffset?: number) {
  const view = currentView
  if (!view) return
  const selection = view.state.selection.main
  const before = view.state.doc.sliceString(0, selection.from)
  const prefix = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const after = view.state.doc.sliceString(selection.to)
  const suffix = after.startsWith('\n') ? '\n' : '\n\n'
  const insert = `${prefix}${text}${suffix}`
  const cursor = selection.from + prefix.length + (cursorOffset ?? text.length)
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: EditorSelection.cursor(cursor),
    scrollIntoView: true,
  })
  view.focus()
}

export function insertTable(rows = 3, columns = 3) {
  if (columns < 1) return
  const header = `| ${Array.from({ length: columns }, (_, i) => `列 ${i + 1}`).join(' | ')} |`
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  const empty = `| ${Array.from({ length: columns }, () => '   ').join(' | ')} |`
  const body = Array.from({ length: Math.max(1, rows - 1) }, () => empty).join('\n')
  insertBlock(`${header}\n${divider}\n${body}`, 2)
}

export function insertCodeBlock(language = '') {
  const view = currentView
  if (!view) return
  const snippet = `\`\`\`${language}\n\n\`\`\``
  const selection = view.state.selection.main
  const before = view.state.doc.sliceString(0, selection.from)
  const prefix = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const suffix = view.state.doc.sliceString(selection.to).startsWith('\n') ? '\n' : '\n\n'
  const insert = `${prefix}${snippet}${suffix}`
  const cursor = selection.from + prefix.length + 3 + language.length + 1
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: EditorSelection.cursor(cursor),
    scrollIntoView: true,
  })
  view.focus()
}

export function insertMathBlock() {
  insertBlock('$$\n\n$$', 3)
}

export function insertHorizontalRule() {
  insertBlock('---')
}

export function insertToc() {
  insertBlock('[TOC]')
}

export function insertTextAtCursor(text: string, selectOffset?: number) {
  const view = currentView
  if (!view) return
  const selection = view.state.selection.main
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: EditorSelection.cursor(selection.from + (selectOffset ?? text.length)),
    scrollIntoView: true,
  })
  view.focus()
}

export function insertLink(text: string, url: string, image = false) {
  const view = currentView
  if (!view) {
    useStore.getState().setLinkDialog(null)
    return
  }
  const selection = view.state.selection.main
  const selected = view.state.doc.sliceString(selection.from, selection.to)
  const label = text || selected || '文字'
  const markdown = image ? `![${label}](${url})` : `[${label}](${url})`
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: EditorSelection.cursor(selection.from + markdown.length),
    scrollIntoView: true,
  })
  useStore.getState().setLinkDialog(null)
  view.focus()
}

export function clearFormatting() {
  const view = currentView
  if (!view) return
  const selection = view.state.selection.main
  if (selection.empty) return
  const text = view.state.doc.sliceString(selection.from, selection.to)
  const cleaned = text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: cleaned },
    selection: EditorSelection.range(selection.from, selection.from + cleaned.length),
  })
  view.focus()
}

export function indentSelection(more: boolean) {
  const view = currentView
  if (!view) return
  if (more) indentMore(view)
  else indentLess(view)
}

export function undoCommand() {
  if (currentView) undo(currentView)
}
export function redoCommand() {
  if (currentView) redo(currentView)
}

export function showSearch(replace = false) {
  const view = currentView
  if (!view) return
  openSearchPanel(view)
  if (replace) {
    const input = view.dom.querySelector<HTMLInputElement>('.cm-search input[name="replace"]')
    setTimeout(() => input?.focus(), 30)
  }
}

export function hideSearch() {
  if (currentView) closeSearchPanel(currentView)
}

export function gotoLine(lineNumber: number) {
  const view = currentView
  if (!view) return
  const line = view.state.doc.line(Math.min(Math.max(1, lineNumber), view.state.doc.lines))
  view.dispatch({
    selection: EditorSelection.cursor(line.from),
    effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 90 }),
  })
  view.focus()
}

export function insertImageFiles(files: File[]) {
  const view = currentView
  if (!view) return
  const images = files.filter((file) => file.type.startsWith('image/'))
  if (!images.length) return
  const store = useStore.getState()
  images.forEach((file, index) => {
    if (file.size > 8 * 1024 * 1024) {
      store.toast(`“${file.name}”超过 8 MB，已跳过。`, 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result ?? '')
      if (!src) return
      const alt = file.name.replace(/\.[^.]+$/, '')
      const snippet = `\n\n![${alt}](${src})\n\n`
      const active = getEditorView()
      if (!active) return
      const selection = active.state.selection.main
      active.dispatch({
        changes: { from: selection.from, insert: snippet },
        selection: EditorSelection.cursor(selection.from + snippet.length),
        scrollIntoView: true,
      })
      if (index === images.length - 1) active.focus()
    }
    reader.readAsDataURL(file)
  })
  if (images.length) store.toast(`已嵌入 ${images.length} 张图片`, 'success')
}

export type TableAction =
  | 'row-above'
  | 'row-below'
  | 'col-before'
  | 'col-after'
  | 'delete-row'
  | 'delete-col'
  | 'align-left'
  | 'align-center'
  | 'align-right'

function splitRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|')) text = text.slice(0, -1)
  return text.split(/(?<!\\)\|/).map((cell) => cell.trim())
}

function formatRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

export interface TableContext {
  from: number
  to: number
  startLine: number
  endLine: number
  rowIndex: number
  columnIndex: number
  headers: string[]
  align: ('left' | 'center' | 'right' | 'default')[]
  rows: string[][]
}

export function getTableContext(view: EditorView | null = currentView): TableContext | null {
  if (!view) return null
  const state = view.state
  const head = state.selection.main.head
  const cursorLine = state.doc.lineAt(head)
  if (!cursorLine.text.includes('|')) return null
  let start = cursorLine.number
  let end = cursorLine.number
  while (start > 1 && state.doc.line(start - 1).text.includes('|') && state.doc.line(start - 1).text.trim()) start--
  while (end < state.doc.lines && state.doc.line(end + 1).text.includes('|') && state.doc.line(end + 1).text.trim()) end++
  if (end - start < 2) return null
  const lines: string[] = []
  for (let n = start; n <= end; n++) lines.push(state.doc.line(n).text)
  const delimiterIndex = lines.findIndex((line, index) => {
    if (index === 0) return false
    const cells = splitRow(line)
    return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell))
  })
  if (delimiterIndex < 1) return null
  const headers = splitRow(lines[0])
  const delimiter = splitRow(lines[delimiterIndex])
  const align = delimiter.map((cell) => {
    const left = cell.startsWith(':')
    const right = cell.endsWith(':')
    if (left && right) return 'center' as const
    if (right) return 'right' as const
    if (left) return 'left' as const
    return 'default' as const
  })
  const rows = lines.slice(delimiterIndex + 1).filter(Boolean).map(splitRow)
  const rowIndex = Math.min(Math.max(0, cursorLine.number - start), lines.length - 1)
  const beforeCursor = state.doc.sliceString(state.doc.line(cursorLine.number).from, head)
  const columnIndex = Math.min(headers.length - 1, Math.max(0, (beforeCursor.match(/\|/g)?.length ?? 0) - 1))
  return {
    from: state.doc.line(start).from,
    to: state.doc.line(end).to,
    startLine: start,
    endLine: end,
    rowIndex,
    columnIndex,
    headers,
    align,
    rows,
  }
}

export function applyTableAction(action: TableAction) {
  const view = currentView
  if (!view) return
  const ctx = getTableContext(view)
  if (!ctx) return
  const headers = [...ctx.headers]
  const rows = ctx.rows.map((row) => [...row])
  const align = [...ctx.align]
  const col = ctx.columnIndex
  const row = ctx.rowIndex
  const dataRow = row - 1
  let cursorColumn = col

  switch (action) {
    case 'row-above':
      rows.splice(Math.max(0, dataRow), 0, headers.map(() => ''))
      break
    case 'row-below':
      rows.splice(Math.max(0, dataRow + 1), 0, headers.map(() => ''))
      break
    case 'col-before':
      headers.splice(col, 0, `列 ${headers.length + 1}`)
      align.splice(col, 0, 'default')
      for (const r of rows) r.splice(col, 0, '')
      break
    case 'col-after':
      headers.splice(col + 1, 0, `列 ${headers.length + 1}`)
      align.splice(col + 1, 0, 'default')
      for (const r of rows) r.splice(col + 1, 0, '')
      cursorColumn = col + 1
      break
    case 'delete-row':
      if (dataRow >= 0 && rows.length > 0) rows.splice(dataRow, 1)
      break
    case 'delete-col':
      if (headers.length > 1) {
        headers.splice(col, 1)
        align.splice(col, 1)
        for (const r of rows) r.splice(col, 1)
        cursorColumn = Math.max(0, col - 1)
      }
      break
    case 'align-left':
      align[col] = 'left'
      break
    case 'align-center':
      align[col] = 'center'
      break
    case 'align-right':
      align[col] = 'right'
      break
  }

  const delimiter = align.map((a) => (a === 'left' ? ':---' : a === 'center' ? ':---:' : a === 'right' ? '---:' : '---'))
  const output = [formatRow(headers), formatRow(delimiter), ...rows.map((r) => formatRow(r))].join('\n')
  view.dispatch({
    changes: { from: ctx.from, to: ctx.to, insert: output },
    selection: EditorSelection.cursor(ctx.from + 2 + cursorColumn * 3),
    scrollIntoView: true,
  })
  view.focus()
}

export { insertTab }
