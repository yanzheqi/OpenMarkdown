import { useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import TabBar from './components/TabBar'
import Editor from './editor/Editor'
import StatusBar from './components/StatusBar'
import SettingsDialog from './components/SettingsDialog'
import ExportDialog from './components/ExportDialog'
import LinkDialog from './components/LinkDialog'
import CommandPalette from './components/CommandPalette'
import Toasts from './components/Toasts'
import EmptyState from './components/EmptyState'
import { findNode, useStore } from './store/store'
import { openMarkdownFile, saveActiveDocument } from './lib/files'
import { hideSearch, showSearch } from './editor/commands'
import { printDocument } from './lib/export'

const fontStacks = {
  sans: '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  serif:
    '"Iowan Old Style", "Palatino Linotype", "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", "Book Antiqua", Georgia, "Times New Roman", serif',
  system:
    'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Roboto, "Helvetica Neue", Arial, sans-serif',
}

export default function App() {
  const sidebarOpen = useStore((state) => state.sidebarOpen)
  const zenMode = useStore((state) => state.zenMode)
  const tree = useStore((state) => state.tree)
  const activeId = useStore((state) => state.activeId)
  const settings = useStore((state) => state.settings)
  const activeDoc = findNode(tree, activeId)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    const zoom = settings.zoom / 100
    root.style.setProperty('--editor-font-size', `${settings.fontSize * zoom}px`)
    root.style.setProperty('--line-height', String(settings.lineHeight))
    root.style.setProperty('--content-width', `${Math.round(settings.contentWidth * zoom)}px`)
    root.style.setProperty('--font-text', fontStacks[settings.fontFamily])
    root.style.setProperty('--zoom', String(zoom))
  }, [settings.theme, settings.fontSize, settings.lineHeight, settings.contentWidth, settings.fontFamily, settings.zoom])

  useEffect(() => {
    document.title = activeDoc
      ? `${activeDoc.name.replace(/\.md$/i, '')} · OpenMarkdown`
      : 'OpenMarkdown — 优雅的 Markdown 编辑器'
  }, [activeDoc])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (mod && key === 's') {
        event.preventDefault()
        if (event.shiftKey) useStore.getState().setExportOpen(true)
        else void saveActiveDocument()
        return
      }
      if (mod && key === 'o') {
        event.preventDefault()
        void openMarkdownFile()
        return
      }
      if (mod && key === 'n') {
        event.preventDefault()
        useStore.getState().newFile()
        return
      }
      if (mod && key === 'w') {
        event.preventDefault()
        const state = useStore.getState()
        if (state.activeId) state.closeTab(state.activeId)
        return
      }
      if (mod && key === 'p' && !event.shiftKey) {
        event.preventDefault()
        const state = useStore.getState()
        const doc = findNode(state.tree, state.activeId)
        if (doc) {
          void printDocument({
            title: doc.name,
            markdown: doc.content ?? '',
            dark: state.settings.theme === 'night' || state.settings.theme === 'nord',
            includeToc: true,
          })
        }
        return
      }
      if (mod && event.shiftKey && key === 'p') {
        event.preventDefault()
        useStore.getState().setCommandOpen(true)
        return
      }
      if (mod && key === '/') {
        event.preventDefault()
        useStore.getState().setSourceMode(!useStore.getState().sourceMode)
        return
      }
      if (mod && key === 'f') {
        event.preventDefault()
        showSearch()
        return
      }
      if (mod && key === 'h') {
        event.preventDefault()
        showSearch(true)
        return
      }
      if (mod && key === ',') {
        event.preventDefault()
        useStore.getState().setSettingsOpen(true)
        return
      }
      if (mod && (key === '=' || key === '+')) {
        event.preventDefault()
        const state = useStore.getState()
        state.updateSettings({ zoom: Math.min(160, state.settings.zoom + 10) })
        return
      }
      if (mod && key === '-') {
        event.preventDefault()
        const state = useStore.getState()
        state.updateSettings({ zoom: Math.max(80, state.settings.zoom - 10) })
        return
      }
      if (mod && event.shiftKey && key === 'l') {
        event.preventDefault()
        useStore.getState().setSidebarOpen(!useStore.getState().sidebarOpen)
        return
      }
      if (mod && event.shiftKey && key === 'f') {
        event.preventDefault()
        const state = useStore.getState()
        state.updateSettings({ focus: !state.settings.focus })
        return
      }
      if (event.key === 'F8') {
        event.preventDefault()
        const state = useStore.getState()
        state.updateSettings({ focus: !state.settings.focus })
        return
      }
      if (event.key === 'F9') {
        event.preventDefault()
        const state = useStore.getState()
        state.updateSettings({ typewriter: !state.settings.typewriter })
        return
      }
      if (event.key === 'F11') {
        event.preventDefault()
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen?.()
        return
      }
      if (event.key === 'Escape') {
        hideSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={`app${zenMode ? ' is-zen' : ''}`}>
      {!zenMode && <TitleBar />}
      <div className="workbench">
        {sidebarOpen && !zenMode && <Sidebar />}
        <main className="main-pane">
          {!zenMode && <TabBar />}
          <div className="document-area">
            {activeDoc ? <Editor key={activeDoc.id} doc={activeDoc} /> : <EmptyState />}
          </div>
        </main>
      </div>
      <StatusBar />
      <SettingsDialog />
      <ExportDialog />
      <LinkDialog />
      <CommandPalette />
      <Toasts />
    </div>
  )
}
