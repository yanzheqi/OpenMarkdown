import { useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'lucide-react'
import { Modal } from './ui'
import { themeLabel, useStore } from '../store/store'
import { openMarkdownFile, saveActiveDocument } from '../lib/files'
import {
  bold,
  code,
  highlight,
  insertCodeBlock,
  insertMathBlock,
  insertTable,
  italic,
  openImageDialog,
  openLinkDialog,
  setHeading,
  strike,
  toggleList,
  toggleQuote,
} from '../editor/menuActions'
import type { ThemeId } from '../store/types'

interface Item {
  label: string
  category: string
  shortcut?: string
  keywords?: string
  action: () => void
}

export default function CommandPalette() {
  const open = useStore((state) => state.commandOpen)
  const settings = useStore((state) => state.settings)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const close = () => useStore.getState().setCommandOpen(false)

  const commands = useMemo<Item[]>(() => {
    const toggleSource = () => useStore.getState().setSourceMode(!useStore.getState().sourceMode)
    const toggleFocus = () =>
      useStore.getState().updateSettings({ focus: !useStore.getState().settings.focus })
    const toggleTypewriter = () =>
      useStore.getState().updateSettings({ typewriter: !useStore.getState().settings.typewriter })
    const toggleSidebar = () =>
      useStore.getState().setSidebarOpen(!useStore.getState().sidebarOpen)
    return [
      {
        label: '新建文档',
        category: '文件',
        shortcut: 'Ctrl N',
        keywords: 'new document',
        action: () => useStore.getState().newFile(),
      },
      {
        label: '打开文件…',
        category: '文件',
        shortcut: 'Ctrl O',
        keywords: 'open file',
        action: () => void openMarkdownFile(),
      },
      {
        label: '保存',
        category: '文件',
        shortcut: 'Ctrl S',
        keywords: 'save',
        action: () => void saveActiveDocument(),
      },
      {
        label: '导出文档…',
        category: '文件',
        shortcut: 'Ctrl Shift S',
        keywords: 'export html pdf word',
        action: () => useStore.getState().setExportOpen(true),
      },
      {
        label: '偏好设置…',
        category: '文件',
        shortcut: 'Ctrl ,',
        keywords: 'preferences settings',
        action: () => useStore.getState().setSettingsOpen(true),
      },
      {
        label: '切换源码模式',
        category: '视图',
        shortcut: 'Ctrl /',
        keywords: 'source code',
        action: toggleSource,
      },
      {
        label: '切换专注模式',
        category: '视图',
        shortcut: 'F8',
        keywords: 'focus',
        action: toggleFocus,
      },
      {
        label: '切换打字机模式',
        category: '视图',
        shortcut: 'F9',
        keywords: 'typewriter',
        action: toggleTypewriter,
      },
      {
        label: '切换侧边栏',
        category: '视图',
        shortcut: 'Ctrl Shift L',
        keywords: 'sidebar',
        action: toggleSidebar,
      },
      {
        label: '显示大纲',
        category: '视图',
        keywords: 'outline',
        action: () => useStore.getState().setSidebarTab('outline'),
      },
      {
        label: '一级标题',
        category: '段落',
        shortcut: 'Ctrl 1',
        keywords: 'heading h1',
        action: () => setHeading(1),
      },
      {
        label: '二级标题',
        category: '段落',
        shortcut: 'Ctrl 2',
        keywords: 'heading h2',
        action: () => setHeading(2),
      },
      {
        label: '三级标题',
        category: '段落',
        shortcut: 'Ctrl 3',
        keywords: 'heading h3',
        action: () => setHeading(3),
      },
      {
        label: '正文',
        category: '段落',
        shortcut: 'Ctrl 0',
        keywords: 'paragraph normal',
        action: () => setHeading(0),
      },
      {
        label: '引用',
        category: '段落',
        keywords: 'quote blockquote',
        action: () => toggleQuote(),
      },
      {
        label: '无序列表',
        category: '段落',
        keywords: 'bullet list',
        action: () => toggleList('bullet'),
      },
      {
        label: '有序列表',
        category: '段落',
        keywords: 'ordered numbered list',
        action: () => toggleList('ordered'),
      },
      {
        label: '任务列表',
        category: '段落',
        keywords: 'task checklist todo',
        action: () => toggleList('task'),
      },
      {
        label: '表格',
        category: '插入',
        keywords: 'table',
        action: () => insertTable(),
      },
      {
        label: '代码块',
        category: '插入',
        keywords: 'code block',
        action: () => insertCodeBlock(),
      },
      {
        label: '数学块',
        category: '插入',
        keywords: 'math formula katex',
        action: () => insertMathBlock(),
      },
      {
        label: '图片…',
        category: '插入',
        keywords: 'image picture',
        action: () => openImageDialog(),
      },
      {
        label: '粗体',
        category: '格式',
        shortcut: 'Ctrl B',
        keywords: 'bold',
        action: () => bold(),
      },
      {
        label: '斜体',
        category: '格式',
        shortcut: 'Ctrl I',
        keywords: 'italic',
        action: () => italic(),
      },
      {
        label: '删除线',
        category: '格式',
        keywords: 'strikethrough',
        action: () => strike(),
      },
      {
        label: '高亮',
        category: '格式',
        keywords: 'highlight mark',
        action: () => highlight(),
      },
      {
        label: '行内代码',
        category: '格式',
        shortcut: 'Ctrl E',
        keywords: 'inline code',
        action: () => code(),
      },
      {
        label: '链接…',
        category: '格式',
        shortcut: 'Ctrl K',
        keywords: 'link',
        action: () => openLinkDialog(),
      },
      ...(['inkwell', 'github', 'night', 'nord', 'vue', 'sepia'] as ThemeId[]).map((theme) => ({
        label: `主题：${themeLabel(theme)}`,
        category: '主题',
        keywords: 'appearance color colour theme 外观 配色',
        action: () => useStore.getState().updateSettings({ theme }),
      })),
    ]
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((item) =>
      `${item.label} ${item.category} ${item.keywords ?? ''}`.toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setIndex(0)
      return
    }
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>('.command-item.is-active')
    node?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (item: Item | undefined) => {
    if (!item) return
    close()
    item.action()
  }

  return (
    <Modal open={open} onClose={close} className="command-modal" label="命令面板">
      <div className="command-palette">
        <div className="command-search">
          <Command size={17} />
          <input
            ref={inputRef}
            value={query}
            placeholder="输入命令…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setIndex((current) => Math.min(filtered.length - 1, current + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setIndex((current) => Math.max(0, current - 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                run(filtered[index])
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="command-empty">没有匹配的命令</div>
          ) : (
            filtered.map((item, itemIndex) => (
              <button
                key={`${item.category}-${item.label}`}
                className={`command-item${itemIndex === index ? ' is-active' : ''}`}
                onMouseEnter={() => setIndex(itemIndex)}
                onClick={() => run(item)}
              >
                <span className="command-category">{item.category}</span>
                <span className="command-label">{item.label}</span>
                {item.shortcut && <span className="command-shortcut">{item.shortcut}</span>}
              </button>
            ))
          )}
        </div>
        <div className="command-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>↵</kbd> 执行
          </span>
          <span className="command-brand">OpenMarkdown</span>
        </div>
      </div>
    </Modal>
  )
}
