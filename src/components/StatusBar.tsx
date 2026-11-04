import { useMemo } from 'react'
import { Circle, Minus, Plus, SpellCheck } from 'lucide-react'
import { countWords, readingTime } from '../lib/markdown'
import { findNode, useStore } from '../store/store'

export default function StatusBar() {
  const tree = useStore((state) => state.tree)
  const activeId = useStore((state) => state.activeId)
  const saveState = useStore((state) => state.saveState)
  const cursorLine = useStore((state) => state.cursorLine)
  const cursorCol = useStore((state) => state.cursorCol)
  const settings = useStore((state) => state.settings)
  const sourceMode = useStore((state) => state.sourceMode)
  const doc = findNode(tree, activeId)

  const stats = useMemo(() => countWords(doc?.content ?? ''), [doc?.content])

  const zoom = settings.zoom

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className={`save-state save-${saveState}`}>
          <Circle size={7} fill="currentColor" strokeWidth={0} />
          {saveState === 'saving' ? '保存中…' : saveState === 'error' ? '保存失败' : '已保存'}
        </span>
        {settings.showWordCount && (
          <>
            <span className="status-divider" />
            <span className="status-item">{stats.words.toLocaleString()} 词</span>
            <span className="status-item">{stats.chars.toLocaleString()} 字符</span>
            <span className="status-item">{readingTime(stats.words)} 分钟阅读</span>
          </>
        )}
        {!doc && <span className="status-item status-muted">未打开文档</span>}
      </div>
      <div className="status-center">
        <span className={`mode-pill${sourceMode ? ' is-source' : ''}`}>
          {sourceMode ? '源码' : '实时预览'}
        </span>
        {settings.focus && <span className="status-flag">专注</span>}
        {settings.typewriter && <span className="status-flag">打字机</span>}
      </div>
      <div className="status-right">
        <button
          className={`status-icon${settings.spellcheck ? ' is-on' : ''}`}
          title={settings.spellcheck ? '拼写检查：开' : '拼写检查：关'}
          onClick={() => useStore.getState().updateSettings({ spellcheck: !settings.spellcheck })}
        >
          <SpellCheck size={13} />
        </button>
        <span className="status-divider" />
        <span className="status-item status-pos">
          行 {cursorLine}，列 {cursorCol}
        </span>
        <span className="status-divider" />
        <div className="zoom-control">
          <button
            className="status-icon"
            title="缩小"
            onClick={() => useStore.getState().updateSettings({ zoom: Math.max(80, zoom - 10) })}
          >
            <Minus size={12} />
          </button>
          <button
            className="zoom-value"
            title="重置缩放"
            onClick={() => useStore.getState().updateSettings({ zoom: 100 })}
          >
            {zoom}%
          </button>
          <button
            className="status-icon"
            title="放大"
            onClick={() => useStore.getState().updateSettings({ zoom: Math.min(160, zoom + 10) })}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </footer>
  )
}
