import { useEffect, useRef, useState } from 'react'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  keymap,
  placeholder,
  rectangularSelection,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { bracketMatching, foldKeymap, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkup,
  markdown,
  markdownLanguage,
} from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns3,
  Rows3,
  Trash2,
} from 'lucide-react'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { useStore } from '../store/store'
import type { DocNode as DocNodeType } from '../store/types'
import { livePreview } from './livePreview'
import { previewOptions } from './previewSettings'
import { editorExtensions } from './theme'
import { codeLanguage } from './codeLanguages'
import {
  applyTableAction,
  getTableContext,
  insertImageFiles,
  setEditorView,
  toggleBold,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  insertTable,
  setHeading,
  toggleQuote,
  toggleList,
  insertMathBlock,
  insertCodeBlock,
  insertHorizontalRule,
  insertToc,
} from './commands'

interface EditorProps {
  doc: DocNodeType
}

interface TableHud {
  top: number
  left: number
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  hr: '---',
})
turndown.use(gfm)

function isSafeHref(href: string) {
  return /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(href.trim())
}

export default function Editor({ doc }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const modeCompartment = useRef(new Compartment())
  const optionsCompartment = useRef(new Compartment())
  const spellcheckCompartment = useRef(new Compartment())
  const settings = useStore((state) => state.settings)
  const sourceMode = useStore((state) => state.sourceMode)
  const settingsRef = useRef(settings)
  const sourceRef = useRef(sourceMode)
  const hudRef = useRef<TableHud | null>(null)
  const [tableHud, setTableHud] = useState<TableHud | null>(null)
  const [dragging, setDragging] = useState(false)
  const [docId, setDocId] = useState(doc.id)

  settingsRef.current = settings
  sourceRef.current = sourceMode

  useEffect(() => {
    setDocId(doc.id)
  }, [doc.id])

  useEffect(() => {
    if (!hostRef.current) return
    const initialDoc = useStore.getState().tree
    const node = findDoc(initialDoc, doc.id)
    const content = node?.content ?? ''
    const state = EditorState.create({
      doc: content,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        EditorState.phrases.of({
          Find: '查找',
          Replace: '替换',
          next: '下一个',
          previous: '上一个',
          all: '全部',
          'match case': '区分大小写',
          regexp: '正则表达式',
          'by word': '全词匹配',
          replace: '替换',
          'replace all': '全部替换',
          close: '关闭',
          'Go to line': '跳转到行',
          go: '跳转',
          'current match': '当前匹配',
          'on line': '位于行',
          'replaced $ matches': '已替换 $ 处匹配',
          'replaced match on line $': '已替换第 $ 行的匹配',
        }),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSpecialChars(),
        highlightSelectionMatches(),
        rectangularSelection(),
        crosshairCursor(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          spellcheck: settingsRef.current.spellcheck ? 'true' : 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
        spellcheckCompartment.current.of([]),
        modeCompartment.current.of(sourceRef.current ? [] : [livePreview]),
        optionsCompartment.current.of(
          previewOptions.of({ focus: settingsRef.current.focus, theme: settingsRef.current.theme }),
        ),
        markdown({
          base: markdownLanguage,
          codeLanguages: codeLanguage,
          extensions: [...GFM],
        }),
        editorExtensions,
        placeholder('开始写作，语法会跟上你的思路。'),
        keymap.of([
          { key: 'Enter', run: insertNewlineContinueMarkup },
          { key: 'Backspace', run: deleteMarkupBackward },
          { key: 'Mod-b', run: (view) => (toggleBold(view), true) },
          { key: 'Mod-i', run: (view) => (toggleItalic(view), true) },
          { key: 'Mod-e', run: (view) => (toggleCode(view), true) },
          { key: 'Mod-k', run: (view) => (openLinkDialog(view), true) },
          { key: 'Mod-Shift-x', run: (view) => (toggleStrike(view), true) },
          {
            key: 'Mod-Shift-h',
            run: (view) => (toggleHighlight(view), true),
          },
          { key: 'Mod-Shift-q', run: (view) => (toggleQuote(view), true) },
          { key: 'Mod-Shift-m', run: () => (insertMathBlock(), true) },
          { key: 'Mod-Shift-`', run: () => (insertCodeBlock(), true) },
          { key: 'Mod-Alt-t', run: () => (insertTable(), true) },
          { key: 'Mod-Alt-r', run: () => (insertHorizontalRule(), true) },
          { key: 'Mod-Alt-o', run: () => (insertToc(), true) },
          { key: 'Mod-1', run: (view) => (setHeading(view, 1), true) },
          { key: 'Mod-2', run: (view) => (setHeading(view, 2), true) },
          { key: 'Mod-3', run: (view) => (setHeading(view, 3), true) },
          { key: 'Mod-4', run: (view) => (setHeading(view, 4), true) },
          { key: 'Mod-5', run: (view) => (setHeading(view, 5), true) },
          { key: 'Mod-6', run: (view) => (setHeading(view, 6), true) },
          { key: 'Mod-0', run: (view) => (setHeading(view, 0), true) },
          {
            key: 'Mod-Shift-8',
            run: (view) => (toggleList(view, 'bullet'), true),
          },
          {
            key: 'Mod-Shift-7',
            run: (view) => (toggleList(view, 'ordered'), true),
          },
          {
            key: 'Mod-Shift-9',
            run: (view) => (toggleList(view, 'task'), true),
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            useStore.getState().setContent(doc.id, update.state.doc.toString())
          }
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            useStore.getState().setCursor(line.number, head - line.from + 1)
            if (settingsRef.current.typewriter) {
              requestAnimationFrame(() => centerCursor(update.view))
            }
            scheduleTableHud()
          }
          if (update.docChanged) scheduleTableHud()
        }),
        EditorView.domEventHandlers({
          click(event) {
            const target = event.target as HTMLElement | null
            const link = target?.closest<HTMLElement>('.cm-link')
            if (!link) return false
            const href = link.dataset.href
            if (!href) return false
            if (event.metaKey || event.ctrlKey) {
              event.preventDefault()
              if (isSafeHref(href)) window.open(href, '_blank', 'noopener,noreferrer')
              else useStore.getState().toast('此链接使用了不受支持的协议。', 'error')
              return true
            }
            return false
          },
        }),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    setEditorView(view)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __openMarkdownView?: EditorView }).__openMarkdownView = view
    }
    view.scrollDOM.scrollTop = 0
    const raf = requestAnimationFrame(() => view.focus())
    const scroller = view.scrollDOM
    const onScroll = () => scheduleTableHud()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scheduleTableHud()

    return () => {
      cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', onScroll)
      setEditorView(null)
      view.destroy()
      viewRef.current = null
      setTableHud(null)
    }
    // The editor is deliberately recreated only when the active document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: modeCompartment.current.reconfigure(sourceMode ? [] : [livePreview]),
    })
    view.requestMeasure()
  }, [sourceMode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: optionsCompartment.current.reconfigure(
        previewOptions.of({ focus: settings.focus, theme: settings.theme }),
      ),
    })
  }, [settings.focus, settings.theme])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: spellcheckCompartment.current.reconfigure(
        EditorView.contentAttributes.of({
          spellcheck: settings.spellcheck ? 'true' : 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
      ),
    })
  }, [settings.spellcheck])

  useEffect(() => {
    viewRef.current?.requestMeasure()
  }, [settings.fontFamily, settings.fontSize, settings.lineHeight, settings.contentWidth])

  function scheduleTableHud() {
    requestAnimationFrame(() => {
      const view = viewRef.current
      const wrapper = wrapperRef.current
      if (!view || !wrapper) return
      const context = getTableContext(view)
      if (!context) {
        if (hudRef.current) {
          hudRef.current = null
          setTableHud(null)
        }
        return
      }
      const coords = view.coordsAtPos(context.from)
      if (!coords) return
      const rect = wrapper.getBoundingClientRect()
      const top = coords.top - rect.top
      if (top < -20 || top > rect.height + 20) {
        if (hudRef.current) {
          hudRef.current = null
          setTableHud(null)
        }
        return
      }
      const hud = {
        top: Math.max(8, top - 40),
        left: Math.min(Math.max(16, coords.left - rect.left), Math.max(16, rect.width - 300)),
      }
      const previous = hudRef.current
      if (!previous || Math.abs(previous.top - hud.top) > 1 || Math.abs(previous.left - hud.left) > 1) {
        hudRef.current = hud
        setTableHud(hud)
      }
    })
  }

  function centerCursor(view: EditorView) {
    const coords = view.coordsAtPos(view.state.selection.main.head)
    if (!coords) return
    const scroller = view.scrollDOM
    const rect = scroller.getBoundingClientRect()
    const delta = coords.top - rect.top - rect.height / 2
    if (Math.abs(delta) > 8) scroller.scrollTop += delta
  }

  function openLinkDialog(view: EditorView) {
    const selection = view.state.selection.main
    const text = view.state.doc.sliceString(selection.from, selection.to)
    useStore.getState().setLinkDialog({ kind: 'link', text, url: '' })
  }

  function handlePaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? [])
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length) {
      event.preventDefault()
      insertImageFiles(images)
      return
    }
    const html = event.clipboardData?.getData('text/html') ?? ''
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (html && /<(table|img|h[1-6]|blockquote|ul|ol|pre|code)[\s>]/i.test(html)) {
      try {
        const markdownText = turndown.turndown(html)
        if (markdownText.trim()) {
          event.preventDefault()
          const view = viewRef.current
          if (!view) return
          const selection = view.state.selection.main
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: markdownText },
            selection: EditorSelection.cursor(selection.from + markdownText.length),
            scrollIntoView: true,
          })
          return
        }
      } catch {
        /* fall through to the browser's native paste */
      }
    }
    if (!text) return
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (!files.length) return
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length) {
      insertImageFiles(images)
      return
    }
    const markdownFiles = files.filter((file) => /\.(md|markdown|mdown|txt)$/i.test(file.name))
    if (markdownFiles.length) {
      const imported = await Promise.all(
        markdownFiles.map(async (file) => ({ name: file.name, content: await file.text() })),
      )
      useStore.getState().importFiles(imported)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={`editor-wrap${sourceMode ? ' source-mode' : ''}${dragging ? ' is-dragging' : ''}`}
      onPaste={(event) => handlePaste(event.nativeEvent)}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('Files')) {
          event.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false)
      }}
      onDrop={(event) => void handleDrop(event.nativeEvent)}
    >
      <div ref={hostRef} className="editor-host" data-doc={docId} />
      {tableHud && !sourceMode && (
        <div className="table-hud" style={{ top: tableHud.top, left: tableHud.left }}>
          <span className="table-hud-label">表格</span>
          <button title="在下方添加行" onClick={() => applyTableAction('row-below')}>
            <Rows3 size={14} />
          </button>
          <button title="在右侧添加列" onClick={() => applyTableAction('col-after')}>
            <Columns3 size={14} />
          </button>
          <span className="table-hud-sep" />
          <button title="左对齐" onClick={() => applyTableAction('align-left')}>
            <AlignLeft size={14} />
          </button>
          <button title="居中对齐" onClick={() => applyTableAction('align-center')}>
            <AlignCenter size={14} />
          </button>
          <button title="右对齐" onClick={() => applyTableAction('align-right')}>
            <AlignRight size={14} />
          </button>
          <span className="table-hud-sep" />
          <button title="删除行" onClick={() => applyTableAction('delete-row')}>
            <Trash2 size={14} />
          </button>
          <button title="删除列" onClick={() => applyTableAction('delete-col')}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card">
            <strong>拖放以添加</strong>
            <span>图片会被内嵌，Markdown 文件会被导入。</span>
          </div>
        </div>
      )}
    </div>
  )
}

function findDoc(tree: DocNodeType[], id: string): DocNodeType | null {
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children) {
      const found = findDoc(node.children, id)
      if (found) return found
    }
  }
  return null
}
