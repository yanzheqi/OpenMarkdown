import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Hash,
  ListTree,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Copy,
  ChevronsDownUp,
  FolderTree,
} from 'lucide-react'
import { countWords, parseOutline } from '../lib/markdown'
import { findNode, findParent, useStore } from '../store/store'
import type { DocNode } from '../store/types'
import { gotoLine } from '../editor/commands'
import { importMarkdownFiles, openMarkdownFile } from '../lib/files'

function countFiles(nodes: DocNode[]): number {
  return nodes.reduce(
    (total, node) => total + (node.kind === 'file' ? 1 : countFiles(node.children ?? [])),
    0,
  )
}

function filterTree(nodes: DocNode[], query: string): DocNode[] {
  const q = query.toLowerCase()
  if (!q) return nodes
  const result: DocNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') {
      if (node.name.toLowerCase().includes(q)) result.push(node)
    } else {
      const children = filterTree(node.children ?? [], query)
      if (children.length || node.name.toLowerCase().includes(q)) {
        result.push({ ...node, children })
      }
    }
  }
  return result
}

export default function Sidebar() {
  const tab = useStore((state) => state.sidebarTab)
  const tree = useStore((state) => state.tree)
  const [query, setQuery] = useState('')

  return (
    <aside className="sidebar">
      <div className="sidebar-switcher">
        <button
          className={tab === 'files' ? 'is-active' : ''}
          onClick={() => useStore.getState().setSidebarTab('files')}
        >
          <FolderTree size={14} />
          文件
        </button>
        <button
          className={tab === 'outline' ? 'is-active' : ''}
          onClick={() => useStore.getState().setSidebarTab('outline')}
        >
          <ListTree size={14} />
          大纲
        </button>
      </div>
      {tab === 'files' ? (
        <FilesPanel tree={tree} query={query} setQuery={setQuery} />
      ) : (
        <OutlinePanel />
      )}
    </aside>
  )
}

function FilesPanel({
  tree,
  query,
  setQuery,
}: {
  tree: DocNode[]
  query: string
  setQuery: (value: string) => void
}) {
  const expanded = useStore((state) => state.expanded)
  const selectedId = useStore((state) => state.selectedId)
  const activeId = useStore((state) => state.activeId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const visible = query ? filterTree(tree, query) : tree
  const files = countFiles(tree)
  const selected = findNode(tree, selectedId)

  const createFile = () => {
    const folderId = selected?.kind === 'folder' ? selected.id : undefined
    useStore.getState().newFile(folderId)
    setEditingId(null)
  }

  const createFolder = () => {
    const parentId = selected?.kind === 'folder' ? selected.id : undefined
    const id = useStore.getState().newFolder(parentId)
    setEditingId(id)
  }

  const collapseAll = () => {
    useStore.setState({ expanded: {} })
  }

  return (
    <>
      <div className="sidebar-section-head">
        <div className="sidebar-section-title">
          <span>资料库</span>
          <span className="sidebar-count">{files}</span>
        </div>
        <div className="sidebar-head-actions">
          <button className="mini-btn" title="新建文档" onClick={createFile}>
            <FilePlus2 size={14} />
          </button>
          <button className="mini-btn" title="新建文件夹" onClick={createFolder}>
            <FolderPlus size={14} />
          </button>
          <button className="mini-btn" title="全部折叠" onClick={collapseAll}>
            <ChevronsDownUp size={14} />
          </button>
        </div>
      </div>
      <div className="sidebar-search">
        <Search size={13} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选文档…"
          spellCheck={false}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="清除筛选">
            ×
          </button>
        )}
      </div>
      <div
        className={`file-tree${dropActive ? ' is-drop-target' : ''}`}
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes('Files')) {
            event.preventDefault()
            setDropActive(true)
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={async (event) => {
          event.preventDefault()
          setDropActive(false)
          const files = Array.from(event.dataTransfer.files).filter((file) =>
            /\.(md|markdown|mdown|txt)$/i.test(file.name),
          )
          if (!files.length) return
          const loaded = await Promise.all(
            files.map(async (file) => ({ name: file.name, content: await file.text() })),
          )
          useStore.getState().importFiles(loaded)
        }}
      >
        {visible.length === 0 ? (
          <div className="sidebar-empty">
            <FileText size={20} />
            <p>{query ? '没有匹配的文档。' : '资料库还是空的。'}</p>
            <button onClick={createFile}>新建文档</button>
          </div>
        ) : (
          visible.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              activeId={activeId}
              selectedId={selectedId}
              editingId={editingId}
              setEditingId={setEditingId}
              forceOpen={Boolean(query)}
            />
          ))
        )}
      </div>
      <div className="sidebar-footer">
        <button className="sidebar-action" onClick={() => void openMarkdownFile()}>
          <FolderOpen size={14} />
          打开文件…
        </button>
        <button className="sidebar-action" onClick={() => void importMarkdownFiles()}>
          <Upload size={14} />
          导入
        </button>
        <div className="sidebar-note">
          <span className="local-dot" />
          本地资料库 · 自动保存
        </div>
      </div>
    </>
  )
}

function TreeRow({
  node,
  depth,
  expanded,
  activeId,
  selectedId,
  editingId,
  setEditingId,
  forceOpen,
}: {
  node: DocNode
  depth: number
  expanded: Record<string, boolean>
  activeId: string | null
  selectedId: string | null
  editingId: string | null
  setEditingId: (id: string | null) => void
  forceOpen: boolean
}) {
  const isFolder = node.kind === 'folder'
  const isOpen = forceOpen || Boolean(expanded[node.id])
  const isActive = !isFolder && node.id === activeId
  const isSelected = node.id === selectedId
  const isEditing = editingId === node.id
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const row = (
    <div
      className={`tree-row${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => {
        useStore.getState().setSelected(node.id)
        if (isFolder) useStore.getState().toggleExpanded(node.id)
        else useStore.getState().openDoc(node.id)
      }}
      onDoubleClick={() => setEditingId(node.id)}
      role="treeitem"
      aria-expanded={isFolder ? isOpen : undefined}
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          if (isFolder) useStore.getState().toggleExpanded(node.id)
          else useStore.getState().openDoc(node.id)
        }
        if (event.key === 'F2') setEditingId(node.id)
      }}
    >
      {isFolder ? (
        <span className={`tree-chevron${isOpen ? ' is-open' : ''}`}>
          <ChevronRight size={12} />
        </span>
      ) : (
        <span className="tree-chevron-spacer" />
      )}
      <span className={`tree-icon${isActive ? ' is-active' : ''}`}>
        {isFolder ? isOpen ? <FolderOpen size={14} /> : <Folder size={14} /> : <FileText size={14} />}
      </span>
      {isEditing ? (
        <input
          ref={inputRef}
          className="tree-rename"
          defaultValue={node.name}
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => {
            useStore.getState().renameNode(node.id, event.target.value)
            setEditingId(null)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              useStore.getState().renameNode(node.id, event.currentTarget.value)
              setEditingId(null)
            }
            if (event.key === 'Escape') setEditingId(null)
          }}
        />
      ) : (
        <span className="tree-name">{node.name.replace(/\.md$/i, '')}</span>
      )}
      <span className="tree-actions">
        {isFolder && (
          <button
            title="在此文件夹中新建文档"
            onClick={(event) => {
              event.stopPropagation()
              useStore.getState().setExpanded(node.id, true)
              useStore.getState().newFile(node.id)
            }}
          >
            <Plus size={12} />
          </button>
        )}
        <button
          title="重命名"
          onClick={(event) => {
            event.stopPropagation()
            setEditingId(node.id)
          }}
        >
          <Pencil size={11} />
        </button>
        {!isFolder && (
          <button
            title="创建副本"
            onClick={(event) => {
              event.stopPropagation()
              useStore.getState().duplicateNode(node.id)
            }}
          >
            <Copy size={11} />
          </button>
        )}
        <button
          title="删除"
          onClick={(event) => {
            event.stopPropagation()
            if (window.confirm(`删除“${node.name}”？此操作无法撤销。`)) {
              useStore.getState().deleteNode(node.id)
            }
          }}
        >
          <Trash2 size={11} />
        </button>
      </span>
    </div>
  )

  return (
    <>
      {row}
      {isFolder && isOpen && (
        <div role="group">
          {(node.children ?? []).map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              activeId={activeId}
              selectedId={selectedId}
              editingId={editingId}
              setEditingId={setEditingId}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      )}
    </>
  )
}

function OutlinePanel() {
  const tree = useStore((state) => state.tree)
  const activeId = useStore((state) => state.activeId)
  const cursorLine = useStore((state) => state.cursorLine)
  const doc = findNode(tree, activeId)
  const [query, setQuery] = useState('')
  const activeRef = useRef<HTMLButtonElement>(null)

  const outline = useMemo(() => (doc ? parseOutline(doc.content ?? '') : []), [doc?.content])
  const filtered = query
    ? outline.filter((item) => item.text.toLowerCase().includes(query.toLowerCase()))
    : outline

  let activeIndex = -1
  outline.forEach((item, index) => {
    if (item.line <= cursorLine) activeIndex = index
  })

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <>
      <div className="sidebar-section-head outline-head">
        <div className="sidebar-section-title">
          <span>大纲</span>
          <span className="sidebar-count">{outline.length}</span>
        </div>
      </div>
      <div className="sidebar-search">
        <Search size={13} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选标题…"
          spellCheck={false}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="清除筛选">
            ×
          </button>
        )}
      </div>
      {!doc ? (
        <div className="sidebar-empty">
          <Hash size={20} />
          <p>打开文档后即可查看大纲。</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sidebar-empty">
          <Hash size={20} />
          <p>{query ? '没有匹配的标题。' : '添加标题后会自动生成大纲。'}</p>
        </div>
      ) : (
        <div className="outline-list">
          {filtered.map((item) => {
            const index = outline.findIndex((entry) => entry.id === item.id)
            const active = index === activeIndex
            return (
              <button
                key={item.id}
                ref={active ? activeRef : undefined}
                className={`outline-item${active ? ' is-active' : ''}`}
                style={{ paddingLeft: 14 + (item.level - 1) * 13 }}
                onClick={() => gotoLine(item.line)}
                title={item.text}
              >
                <span className={`outline-level level-${item.level}`}>{item.level}</span>
                <span className="outline-text">{item.text}</span>
              </button>
            )
          })}
        </div>
      )}
      {doc && (
        <div className="outline-footer">
          {countWords(doc.content ?? '').words.toLocaleString()} 词 · {outline.length} 个标题
        </div>
      )}
    </>
  )
}
