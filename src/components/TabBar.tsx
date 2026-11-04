import { useEffect, useRef } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { findNode, useStore } from '../store/store'

export default function TabBar() {
  const openTabs = useStore((state) => state.openTabs)
  const activeId = useStore((state) => state.activeId)
  const tree = useStore((state) => state.tree)
  const saveState = useStore((state) => state.saveState)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('.tab.is-active')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, openTabs.length])

  return (
    <div className="tabbar">
      <div className="tabs" ref={tabsRef}>
        {openTabs.map((id) => {
          const node = findNode(tree, id)
          if (!node) return null
          const isActive = id === activeId
          return (
            <div
              key={id}
              className={`tab${isActive ? ' is-active' : ''}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => useStore.getState().openDoc(id)}
              onAuxClick={(event) => {
                if (event.button === 1) useStore.getState().closeTab(id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') useStore.getState().openDoc(id)
              }}
              title={node.path ?? node.name}
            >
              <FileText size={13} className="tab-icon" />
              <span className="tab-name">{node.name.replace(/\.md$/i, '')}</span>
              {isActive && saveState === 'saving' && <span className="tab-dirty" />}
              <button
                className="tab-close"
                aria-label={`关闭 ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  useStore.getState().closeTab(id)
                }}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
        <button
          className="tab-new"
          onClick={() => useStore.getState().newFile()}
          title="新建文档"
          aria-label="新建文档"
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="tabbar-right">
        <span className="tabbar-hint">Markdown</span>
      </div>
    </div>
  )
}
