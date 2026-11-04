import { useEffect, useRef, useState } from 'react'
import {
  Code2,
  Download,
  Focus,
  Minus,
  Moon,
  PanelLeft,
  Settings2,
  Square,
  Sun,
  Type,
  X,
} from 'lucide-react'
import { findNode, findPath, themeLabel, useStore } from '../store/store'
import type { ThemeId } from '../store/types'
import {
  copyHtmlToClipboard,
  exportWordFile,
  printDocument,
} from '../lib/export'
import {
  importMarkdownFiles,
  openMarkdownFile,
  saveActiveDocument,
  saveAsMarkdown,
} from '../lib/files'
import { insertTextAtCursor } from '../editor/commands'
import {
  bold,
  clearFormat,
  code,
  highlight,
  indent,
  insertCodeBlock,
  insertHorizontalRule,
  insertMathBlock,
  insertTable,
  insertToc,
  italic,
  openImageDialog,
  openLinkDialog,
  setHeading,
  setSourceMode,
  strike,
  toggleList,
  toggleQuote,
} from '../editor/menuActions'

type MenuItem =
  | {
      type?: 'item'
      label: string
      shortcut?: string
      checked?: boolean
      danger?: boolean
      disabled?: boolean
      action: () => void
    }
  | { type: 'separator' }

interface MenuDef {
  label: string
  items: MenuItem[]
}

export default function TitleBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const tree = useStore((state) => state.tree)
  const activeId = useStore((state) => state.activeId)
  const activeDoc = findNode(tree, activeId)
  const settings = useStore((state) => state.settings)
  const sourceMode = useStore((state) => state.sourceMode)
  const sidebarOpen = useStore((state) => state.sidebarOpen)
  const native = typeof window !== 'undefined' ? window.openMarkdownNative : undefined

  useEffect(() => {
    if (!openMenu) return
    const onPointerDown = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpenMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenu])

  const close = () => setOpenMenu(null)
  const store = useStore.getState()

  const activateDoc = (id: string) => {
    const node = findNode(useStore.getState().tree, id)
    if (node) useStore.getState().openDoc(id)
    else useStore.getState().toast('该指南已不在资料库中。', 'error')
  }

  const withDoc = (action: () => void) => () => {
    if (!activeDoc) {
      useStore.getState().toast('请先打开一篇文档。', 'error')
      return
    }
    action()
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  const zoomBy = (delta: number) => {
    const current = useStore.getState().settings.zoom
    useStore.getState().updateSettings({ zoom: Math.min(160, Math.max(80, current + delta)) })
  }

  const copySelection = async () => {
    const { getEditorView } = await import('../editor/commands')
    const view = getEditorView()
    if (!view) return
    const selection = view.state.selection.main
    const text = view.state.sliceDoc(selection.from, selection.to)
    if (!text) return
    await navigator.clipboard.writeText(text)
    useStore.getState().toast('已复制', 'success')
  }

  const cutSelection = async () => {
    const { getEditorView } = await import('../editor/commands')
    const view = getEditorView()
    if (!view) return
    const selection = view.state.selection.main
    const text = view.state.sliceDoc(selection.from, selection.to)
    if (!text) return
    await navigator.clipboard.writeText(text)
    view.dispatch({ changes: { from: selection.from, to: selection.to } })
    view.focus()
  }

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) insertTextAtCursor(text)
    } catch {
      useStore.getState().toast('浏览器阻止了剪贴板访问。', 'error')
    }
  }

  const exportNow = (kind: 'html' | 'pdf' | 'word') => {
    if (!activeDoc) return
    const options = {
      title: activeDoc.name,
      markdown: activeDoc.content ?? '',
      dark: settings.theme === 'night' || settings.theme === 'nord',
      includeToc: true,
    }
    if (kind === 'html') {
      void import('../lib/export').then(({ exportHtmlFile }) =>
        exportHtmlFile(options)
          .then((ok) => {
            if (ok) store.toast('HTML 已导出', 'success')
          })
          .catch(() => store.toast('导出失败，请重试。', 'error')),
      )
    } else if (kind === 'word') {
      void exportWordFile(options)
        .then((ok) => {
          if (ok) store.toast('Word 文档已导出', 'success')
        })
        .catch(() => store.toast('导出失败，请重试。', 'error'))
    } else {
      void printDocument(options).then((ok) => {
        if (!ok) store.toast('请允许弹出窗口，才能打印或另存为 PDF。', 'error')
      })
    }
  }

  const menuDefs: MenuDef[] = [
    {
      label: '文件',
      items: [
        { label: '新建文档', shortcut: 'Ctrl N', action: () => useStore.getState().newFile() },
        { label: '打开文件…', shortcut: 'Ctrl O', action: () => void openMarkdownFile() },
        { label: '导入 Markdown…', action: () => void importMarkdownFiles() },
        { type: 'separator' },
        { label: '保存', shortcut: 'Ctrl S', action: () => void saveActiveDocument() },
        { label: '另存为 Markdown…', shortcut: 'Ctrl Shift S', action: saveAsMarkdown },
        { type: 'separator' },
        { label: '导出 HTML…', action: () => exportNow('html') },
        { label: '导出 Word…', action: () => exportNow('word') },
        { label: '打印 / 另存为 PDF…', shortcut: 'Ctrl P', action: () => exportNow('pdf') },
        { type: 'separator' },
        {
          label: '创建副本',
          action: withDoc(() => {
            if (activeId) useStore.getState().duplicateNode(activeId)
          }),
        },
        {
          label: '关闭标签页',
          shortcut: 'Ctrl W',
          action: () => activeId && useStore.getState().closeTab(activeId),
        },
      ],
    },
    {
      label: '编辑',
      items: [
        {
          label: '撤销',
          shortcut: 'Ctrl Z',
          action: () => import('../editor/commands').then(({ undoCommand }) => undoCommand()),
        },
        {
          label: '重做',
          shortcut: 'Ctrl Shift Z',
          action: () => import('../editor/commands').then(({ redoCommand }) => redoCommand()),
        },
        { type: 'separator' },
        { label: '剪切', shortcut: 'Ctrl X', action: () => void cutSelection() },
        { label: '复制', shortcut: 'Ctrl C', action: () => void copySelection() },
        { label: '粘贴', shortcut: 'Ctrl V', action: () => void pasteClipboard() },
        { type: 'separator' },
        {
          label: '查找…',
          shortcut: 'Ctrl F',
          action: () => import('../editor/commands').then(({ showSearch }) => showSearch()),
        },
        {
          label: '查找和替换…',
          shortcut: 'Ctrl H',
          action: () => import('../editor/commands').then(({ showSearch }) => showSearch(true)),
        },
        {
          label: '命令面板…',
          shortcut: 'Ctrl Shift P',
          action: () => useStore.getState().setCommandOpen(true),
        },
        { type: 'separator' },
        {
          label: '复制为 Markdown',
          action: withDoc(() => {
            if (!activeDoc) return
            void navigator.clipboard.writeText(activeDoc.content ?? '')
            store.toast('Markdown 已复制', 'success')
          }),
        },
        {
          label: '复制为 HTML',
          action: withDoc(() => {
            if (!activeDoc) return
            void copyHtmlToClipboard({
              title: activeDoc.name,
              markdown: activeDoc.content ?? '',
              dark: settings.theme === 'night' || settings.theme === 'nord',
              includeToc: false,
            }).then((ok) => store.toast(ok ? 'HTML 已复制' : '复制失败', ok ? 'success' : 'error'))
          }),
        },
      ],
    },
    {
      label: '段落',
      items: [
        { label: '一级标题', shortcut: 'Ctrl 1', action: () => setHeading(1) },
        { label: '二级标题', shortcut: 'Ctrl 2', action: () => setHeading(2) },
        { label: '三级标题', shortcut: 'Ctrl 3', action: () => setHeading(3) },
        { label: '四级标题', shortcut: 'Ctrl 4', action: () => setHeading(4) },
        { label: '五级标题', shortcut: 'Ctrl 5', action: () => setHeading(5) },
        { label: '六级标题', shortcut: 'Ctrl 6', action: () => setHeading(6) },
        { label: '正文', shortcut: 'Ctrl 0', action: () => setHeading(0) },
        { type: 'separator' },
        { label: '表格', shortcut: 'Ctrl Alt T', action: () => insertTable() },
        { label: '代码块', shortcut: 'Ctrl Shift `', action: () => insertCodeBlock() },
        { label: '数学块', shortcut: 'Ctrl Shift M', action: () => insertMathBlock() },
        { label: '引用', shortcut: 'Ctrl Shift Q', action: () => toggleQuote() },
        { type: 'separator' },
        { label: '无序列表', action: () => toggleList('bullet') },
        { label: '有序列表', action: () => toggleList('ordered') },
        { label: '任务列表', action: () => toggleList('task') },
        { type: 'separator' },
        { label: '分隔线', action: () => insertHorizontalRule() },
        { label: '目录', action: () => insertToc() },
        { type: 'separator' },
        {
          label: '增加缩进',
          shortcut: 'Tab',
          action: () => indent(true),
        },
        {
          label: '减少缩进',
          shortcut: 'Shift Tab',
          action: () => indent(false),
        },
      ],
    },
    {
      label: '格式',
      items: [
        {
          label: '粗体',
          shortcut: 'Ctrl B',
          action: () => bold(),
        },
        {
          label: '斜体',
          shortcut: 'Ctrl I',
          action: () => italic(),
        },
        {
          label: '删除线',
          shortcut: 'Ctrl Shift X',
          action: () => strike(),
        },
        {
          label: '高亮',
          shortcut: 'Ctrl Shift H',
          action: () => highlight(),
        },
        {
          label: '行内代码',
          shortcut: 'Ctrl E',
          action: () => code(),
        },
        { type: 'separator' },
        {
          label: '超链接…',
          shortcut: 'Ctrl K',
          action: withDoc(openLinkDialog),
        },
        {
          label: '图片…',
          action: withDoc(openImageDialog),
        },
        {
          label: '清除格式',
          action: () => clearFormat(),
        },
      ],
    },
    {
      label: '视图',
      items: [
        {
          label: '切换侧边栏',
          shortcut: 'Ctrl Shift L',
          checked: sidebarOpen,
          action: () => useStore.getState().setSidebarOpen(!useStore.getState().sidebarOpen),
        },
        {
          label: '大纲',
          checked: useStore.getState().sidebarTab === 'outline',
          action: () => useStore.getState().setSidebarTab('outline'),
        },
        {
          label: '源码模式',
          shortcut: 'Ctrl /',
          checked: sourceMode,
          action: () => setSourceMode(!sourceMode),
        },
        { type: 'separator' },
        {
          label: '专注模式',
          shortcut: 'F8',
          checked: settings.focus,
          action: () => useStore.getState().updateSettings({ focus: !settings.focus }),
        },
        {
          label: '打字机模式',
          shortcut: 'F9',
          checked: settings.typewriter,
          action: () => useStore.getState().updateSettings({ typewriter: !settings.typewriter }),
        },
        { type: 'separator' },
        { label: '放大', shortcut: 'Ctrl =', action: () => zoomBy(10) },
        { label: '缩小', shortcut: 'Ctrl -', action: () => zoomBy(-10) },
        { label: '实际大小', action: () => useStore.getState().updateSettings({ zoom: 100 }) },
        { type: 'separator' },
        { label: '全屏', shortcut: 'F11', action: toggleFullscreen },
      ],
    },
    {
      label: '主题',
      items: (['inkwell', 'github', 'night', 'nord', 'vue', 'sepia'] as ThemeId[]).map((theme) => ({
        label: themeLabel(theme),
        checked: settings.theme === theme,
        action: () => useStore.getState().updateSettings({ theme }),
      })),
    },
    {
      label: '帮助',
      items: [
        { label: 'Markdown 语法参考', action: () => activateDoc('syntax') },
        { label: '键盘快捷键', action: () => activateDoc('shortcuts') },
        { type: 'separator' },
        { label: '偏好设置…', shortcut: 'Ctrl ,', action: () => useStore.getState().setSettingsOpen(true) },
        { label: '关于 OpenMarkdown', action: () => useStore.getState().setSettingsOpen(true) },
      ],
    },
  ]

  const isDark = settings.theme === 'night' || settings.theme === 'nord'

  return (
    <header className={`titlebar${native ? ' is-desktop' : ''}`} ref={barRef}>
      <div className="titlebar-left">
        <button
          className="icon-btn sidebar-toggle"
          onClick={() => useStore.getState().setSidebarOpen(!sidebarOpen)}
          title="切换侧边栏 (Ctrl+Shift+L)"
          aria-label="切换侧边栏"
        >
          <PanelLeft size={17} />
        </button>
        <div className="brand" title="OpenMarkdown">
          <span className="brand-mark">O</span>
          <span className="brand-name">OpenMarkdown</span>
        </div>
        <nav className="menubar" aria-label="应用程序菜单">
          {menuDefs.map((menu) => (
            <div className="menu-root" key={menu.label}>
              <button
                className={`menu-trigger${openMenu === menu.label ? ' is-open' : ''}`}
                onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => {
                  if (openMenu) setOpenMenu(menu.label)
                }}
                aria-haspopup="menu"
                aria-expanded={openMenu === menu.label}
              >
                {menu.label}
              </button>
              {openMenu === menu.label && (
                <div className="menu-pop" role="menu">
                  {menu.items.map((item, index) =>
                    item.type === 'separator' ? (
                      <div className="menu-separator" key={`sep-${index}`} />
                    ) : (
                      <button
                        key={`${item.label}-${index}`}
                        className={`menu-item${item.danger ? ' is-danger' : ''}`}
                        role="menuitem"
                        disabled={item.disabled}
                        onClick={() => {
                          close()
                          item.action()
                        }}
                      >
                        <span className="menu-item-label">
                          {item.checked && <span className="menu-check">✓</span>}
                          {item.label}
                        </span>
                        {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="titlebar-center">
        {activeDoc ? (
          <div className="titlebar-doc">
            <span className="titlebar-path">
              {findPath(tree, activeDoc.id)?.slice(0, -1).join(' / ') || '资料库'}
            </span>
            <span className="titlebar-doc-name">{activeDoc.name.replace(/\.md$/i, '')}</span>
          </div>
        ) : (
          <span className="titlebar-dim">未打开文档</span>
        )}
      </div>

      <div className="titlebar-actions">
        <button
          className={`icon-btn${sourceMode ? ' is-active' : ''}`}
          title="源码模式 (Ctrl+/)"
          onClick={() => setSourceMode(!sourceMode)}
          aria-label="切换源码模式"
        >
          <Code2 size={16} />
        </button>
        <button
          className={`icon-btn${settings.focus ? ' is-active' : ''}`}
          title="专注模式 (F8)"
          onClick={() => useStore.getState().updateSettings({ focus: !settings.focus })}
          aria-label="切换专注模式"
        >
          <Focus size={16} />
        </button>
        <button
          className={`icon-btn${settings.typewriter ? ' is-active' : ''}`}
          title="打字机模式 (F9)"
          onClick={() => useStore.getState().updateSettings({ typewriter: !settings.typewriter })}
          aria-label="切换打字机模式"
        >
          <Type size={16} />
        </button>
        <span className="titlebar-divider" />
        <button
          className="icon-btn"
          title={isDark ? '切换到浅色主题' : '切换到深色主题'}
          onClick={() =>
            useStore.getState().updateSettings({ theme: isDark ? 'inkwell' : 'night' })
          }
          aria-label="切换主题"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className="icon-btn"
          title="导出 (Ctrl+Shift+S)"
          onClick={() => useStore.getState().setExportOpen(true)}
          aria-label="导出"
        >
          <Download size={16} />
        </button>
        <button
          className="icon-btn"
          title="偏好设置 (Ctrl+,)"
          onClick={() => useStore.getState().setSettingsOpen(true)}
          aria-label="偏好设置"
        >
          <Settings2 size={16} />
        </button>
        {native && (
          <div className="window-controls">
            <button title="最小化" aria-label="最小化" onClick={() => native.minimize()}>
              <Minus size={16} />
            </button>
            <button title="最大化 / 还原" aria-label="最大化或还原" onClick={() => native.toggleMaximize()}>
              <Square size={11} />
            </button>
            <button
              className="window-close"
              title="关闭"
              aria-label="关闭窗口"
              onClick={() => native.close()}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
