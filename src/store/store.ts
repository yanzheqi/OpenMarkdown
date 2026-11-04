import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { createSeedTree } from './seed'
import type { DocNode, Settings, SidebarTab, ThemeId, Toast } from './types'

export type SaveState = 'saved' | 'saving' | 'error'

export interface LinkDialogState {
  kind: 'link' | 'image'
  text: string
  url: string
}

interface AppState {
  tree: DocNode[]
  openTabs: string[]
  activeId: string | null
  expanded: Record<string, boolean>
  selectedId: string | null
  sidebarOpen: boolean
  sidebarTab: SidebarTab
  sourceMode: boolean
  settings: Settings
  settingsOpen: boolean
  exportOpen: boolean
  commandOpen: boolean
  linkDialog: LinkDialogState | null
  saveState: SaveState
  toasts: Toast[]
  zenMode: boolean
  cursorLine: number
  cursorCol: number

  setContent: (id: string, content: string) => void
  openDoc: (id: string) => void
  closeTab: (id: string) => void
  newFile: (folderId?: string | null) => string
  newFolder: (parentId?: string | null) => string
  renameNode: (id: string, name: string) => void
  setDocumentPath: (id: string, path: string, name?: string) => void
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  importFiles: (files: { name: string; content: string }[], folderId?: string | null) => number
  addExternalDocument: (name: string, content: string, path: string) => string
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, value: boolean) => void
  setSelected: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarTab: (tab: SidebarTab) => void
  setSourceMode: (on: boolean) => void
  updateSettings: (patch: Partial<Settings>) => void
  setSettingsOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setLinkDialog: (value: LinkDialogState | null) => void
  setSaveState: (value: SaveState) => void
  setZenMode: (on: boolean) => void
  setCursor: (line: number, col: number) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

const defaultSettings: Settings = {
  theme: 'inkwell',
  fontFamily: 'sans',
  fontSize: 17,
  lineHeight: 1.75,
  contentWidth: 760,
  spellcheck: true,
  autoSave: true,
  typewriter: false,
  focus: false,
  showWordCount: true,
  zoom: 100,
}

const memoryStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* quota exceeded — ignore, in-memory state remains */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

let pendingWrite: { name: string; value: string } | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null

const debouncedStorage: StateStorage = {
  getItem: memoryStorage.getItem,
  setItem: (name, value) => {
    pendingWrite = { name, value }
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(flushWrites, 320)
  },
  removeItem: (name) => {
    pendingWrite = null
    memoryStorage.removeItem(name)
  },
}

function flushWrites() {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (pendingWrite) {
    memoryStorage.setItem(pendingWrite.name, pendingWrite.value)
    pendingWrite = null
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushWrites)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushWrites()
  })
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 0

export function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function findNode(tree: DocNode[], id: string | null): DocNode | null {
  if (!id) return null
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

export function findParent(tree: DocNode[], id: string, parent: DocNode | null = null): DocNode | null {
  for (const node of tree) {
    if (node.id === id) return parent
    if (node.children) {
      const found = findParent(node.children, id, node)
      if (found !== null) return found
    }
  }
  return null
}

export function findPath(tree: DocNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of tree) {
    const next = [...trail, node.name]
    if (node.id === id) return next
    if (node.children) {
      const found = findPath(node.children, id, next)
      if (found) return found
    }
  }
  return null
}

export function flattenFiles(tree: DocNode[]): DocNode[] {
  const out: DocNode[] = []
  const walk = (nodes: DocNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'file') out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(tree)
  return out
}

function updateNode(tree: DocNode[], id: string, updater: (node: DocNode) => DocNode): DocNode[] {
  return tree.map((node) => {
    if (node.id === id) return updater(node)
    if (node.children) return { ...node, children: updateNode(node.children, id, updater) }
    return node
  })
}

function removeNode(tree: DocNode[], id: string): { tree: DocNode[]; removed: DocNode | null } {
  let removed: DocNode | null = null
  const walk = (nodes: DocNode[]): DocNode[] => {
    const next: DocNode[] = []
    for (const node of nodes) {
      if (node.id === id) {
        removed = node
        continue
      }
      if (node.children) next.push({ ...node, children: walk(node.children) })
      else next.push(node)
    }
    return next
  }
  return { tree: walk(tree), removed }
}

function collectIds(node: DocNode): string[] {
  const ids = [node.id]
  if (node.children) for (const child of node.children) ids.push(...collectIds(child))
  return ids
}

function uniqueName(tree: DocNode[], base: string): string {
  const names = new Set<string>()
  const walk = (nodes: DocNode[]) => {
    for (const n of nodes) {
      names.add(n.name)
      if (n.children) walk(n.children)
    }
  }
  walk(tree)
  if (!names.has(base)) return base
  const stem = base.replace(/\.[^.]+$/, '')
  const ext = base.slice(stem.length)
  let i = 2
  while (names.has(`${stem} ${i}${ext}`)) i++
  return `${stem} ${i}${ext}`
}

function ensureMd(name: string) {
  return /\.(md|markdown|txt)$/i.test(name) ? name : `${name}.md`
}

function dirForNew(state: AppState, folderId?: string | null): string | null {
  let target = folderId === undefined ? state.selectedId : folderId
  const node = findNode(state.tree, target)
  if (!node) return null
  if (node.kind === 'folder') return node.id
  return findParent(state.tree, node.id)?.id ?? null
}

function insertIntoFolder(tree: DocNode[], folderId: string | null, item: DocNode): DocNode[] {
  if (!folderId) return [...tree, item]
  return updateNode(tree, folderId, (folder) => ({
    ...folder,
    children: [...(folder.children ?? []), item],
    updatedAt: Date.now(),
  }))
}

function findSeedNode(nodes: DocNode[], id: string): DocNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findSeedNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

function localizeSeedTree(tree: DocNode[]): DocNode[] {
  const fresh = createSeedTree()
  const seedFileIds = new Set(['welcome', 'syntax', 'math', 'shortcuts'])

  const walk = (nodes: DocNode[]): DocNode[] =>
    nodes.map((node) => {
      if (node.id === 'guides' && node.kind === 'folder') {
        const freshFolder = findSeedNode(fresh, 'guides')
        const seedChildren = freshFolder?.children ?? []
        const seedChildIds = new Set(seedChildren.map((child) => child.id))
        const customChildren = (node.children ?? []).filter(
          (child) => !seedChildIds.has(child.id) && !seedFileIds.has(child.id),
        )
        return {
          ...node,
          name: freshFolder?.name ?? '指南',
          children: [...seedChildren, ...customChildren],
          updatedAt: Date.now(),
        }
      }
      if (seedFileIds.has(node.id) && node.kind === 'file') {
        const replacement = findSeedNode(fresh, node.id)
        if (replacement) return { ...replacement, createdAt: node.createdAt }
      }
      if (node.children) return { ...node, children: walk(node.children) }
      return node
    })

  return walk(tree)
}

function nodeWithIds(node: DocNode): DocNode {
  return {
    ...node,
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: node.children?.map(nodeWithIds),
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      tree: createSeedTree(),
      openTabs: ['welcome'],
      activeId: 'welcome',
      expanded: { guides: true },
      selectedId: 'welcome',
      sidebarOpen: true,
      sidebarTab: 'files',
      sourceMode: false,
      settings: defaultSettings,
      settingsOpen: false,
      exportOpen: false,
      commandOpen: false,
      linkDialog: null,
      saveState: 'saved',
      toasts: [],
      zenMode: false,
      cursorLine: 1,
      cursorCol: 1,

      setContent: (id, content) => {
        const current = findNode(get().tree, id)
        if (!current || current.content === content) return
        set((state) => ({
          tree: updateNode(state.tree, id, (node) => ({
            ...node,
            content,
            updatedAt: Date.now(),
          })),
          saveState: 'saving',
        }))
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => set({ saveState: 'saved' }), 700)
      },

      openDoc: (id) => {
        const node = findNode(get().tree, id)
        if (!node || node.kind !== 'file') return
        set((state) => ({
          activeId: id,
          selectedId: id,
          openTabs: state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id],
        }))
      },

      closeTab: (id) => {
        set((state) => {
          const index = state.openTabs.indexOf(id)
          const openTabs = state.openTabs.filter((tab) => tab !== id)
          let activeId = state.activeId
          if (activeId === id) {
            activeId = openTabs[Math.max(0, index - 1)] ?? openTabs[0] ?? null
          }
          return { openTabs, activeId }
        })
      },

      newFile: (folderId) => {
        const state = get()
        const parent = dirForNew(state, folderId)
        const name = uniqueName(state.tree, '未命名.md')
        const id = uid()
        const node: DocNode = {
          id,
          name,
          kind: 'file',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'library',
        }
        set((s) => ({
          tree: insertIntoFolder(s.tree, parent, node),
          activeId: id,
          selectedId: id,
          openTabs: [...s.openTabs, id],
          expanded: parent ? { ...s.expanded, [parent]: true } : s.expanded,
        }))
        return id
      },

      newFolder: (parentId) => {
        const state = get()
        const parent = dirForNew(state, parentId)
        const name = uniqueName(state.tree, '新建文件夹')
        const id = uid()
        const node: DocNode = {
          id,
          name,
          kind: 'folder',
          children: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({
          tree: insertIntoFolder(s.tree, parent, node),
          selectedId: id,
          expanded: { ...s.expanded, [id]: true },
        }))
        return id
      },

      renameNode: (id, rawName) => {
        const name = rawName.trim()
        if (!name) return
        const node = findNode(get().tree, id)
        if (!node) return
        const finalName = node.kind === 'file' ? ensureMd(name) : name
        set((state) => ({
          tree: updateNode(state.tree, id, (n) => ({ ...n, name: finalName, updatedAt: Date.now() })),
        }))
      },

      setDocumentPath: (id, filePath, name) => {
        set((state) => ({
          tree: updateNode(state.tree, id, (node) => ({
            ...node,
            path: filePath,
            name: name ? ensureMd(name) : node.name,
            updatedAt: Date.now(),
          })),
        }))
      },

      deleteNode: (id) => {
        const state = get()
        const node = findNode(state.tree, id)
        if (!node) return
        const ids = collectIds(node)
        const { tree } = removeNode(state.tree, id)
        const openTabs = state.openTabs.filter((tab) => !ids.includes(tab))
        let activeId = state.activeId
        if (activeId && ids.includes(activeId)) activeId = openTabs[0] ?? null
        set({
          tree,
          openTabs,
          activeId,
          selectedId: activeId,
        })
        get().toast(`已删除“${node.name}”`)
      },

      duplicateNode: (id) => {
        const state = get()
        const node = findNode(state.tree, id)
        if (!node) return
        const parent = findParent(state.tree, id)
        const copy = nodeWithIds(node)
        if (copy.kind === 'file') copy.name = uniqueName(state.tree, copy.name.replace(/(\.[^.]+)$/, ' 副本$1'))
        else copy.name = uniqueName(state.tree, `${copy.name} 副本`)
        set((s) => ({
          tree: insertIntoFolder(s.tree, parent?.id ?? null, copy),
          selectedId: copy.id,
        }))
        get().toast(`已创建副本“${node.name}”`)
      },

      importFiles: (files, folderId) => {
        const state = get()
        const parent = dirForNew(state, folderId)
        let tree = state.tree
        const newNodes: DocNode[] = []
        for (const file of files) {
          if (!/\.(md|markdown|txt|mdown|mkd)$/i.test(file.name)) continue
          const id = uid()
          const node: DocNode = {
            id,
            name: uniqueName(tree, file.name),
            kind: 'file',
            content: file.content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'library',
          }
          tree = insertIntoFolder(tree, parent, node)
          newNodes.push(node)
        }
        if (!newNodes.length) return 0
        set((s) => ({
          tree,
          openTabs: [...s.openTabs, newNodes[0].id],
          activeId: newNodes[0].id,
          selectedId: newNodes[0].id,
        }))
        get().toast(`已导入 ${newNodes.length} 篇文档`, 'success')
        return newNodes.length
      },

      addExternalDocument: (name, content, path) => {
        const state = get()
        const id = uid()
        const node: DocNode = {
          id,
          name: ensureMd(name),
          kind: 'file',
          content,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'fs',
          path,
        }
        set((s) => ({
          tree: [...s.tree, node],
          activeId: id,
          selectedId: id,
          openTabs: [...s.openTabs, id],
        }))
        return id
      },

      toggleExpanded: (id) =>
        set((state) => ({ expanded: { ...state.expanded, [id]: !state.expanded[id] } })),

      setExpanded: (id, value) =>
        set((state) => ({ expanded: { ...state.expanded, [id]: value } })),

      setSelected: (id) => set({ selectedId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarTab: (tab) => set({ sidebarTab: tab, sidebarOpen: true }),
      setSourceMode: (on) => set({ sourceMode: on }),
      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setExportOpen: (open) => set({ exportOpen: open }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setLinkDialog: (value) => set({ linkDialog: value }),
      setSaveState: (value) => set({ saveState: value }),
      setZenMode: (on) => set({ zenMode: on, sidebarOpen: on ? false : get().sidebarOpen }),
      setCursor: (line, col) => {
        const state = get()
        if (state.cursorLine === line && state.cursorCol === col) return
        set({ cursorLine: line, cursorCol: col })
      },

      toast: (message, tone = 'info') => {
        const id = ++toastId
        set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
        setTimeout(() => get().dismissToast(id), 3200)
      },

      dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: 'inkwell-workspace-v1',
      version: 3,
      storage: createJSONStorage(() => debouncedStorage),
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<AppState>
        if (version < 3 && Array.isArray(state.tree)) {
          state.tree = localizeSeedTree(state.tree)
        }
        return state as AppState
      },
      partialize: (state) => ({
        tree: state.tree,
        openTabs: state.openTabs,
        activeId: state.activeId,
        expanded: state.expanded,
        selectedId: state.selectedId,
        sidebarOpen: state.sidebarOpen,
        sidebarTab: state.sidebarTab,
        settings: state.settings,
        sourceMode: state.sourceMode,
      }),
    },
  ),
)

export function useActiveDoc(): DocNode | null {
  return useStore((state) => findNode(state.tree, state.activeId))
}

export function themeLabel(theme: ThemeId): string {
  return {
    inkwell: 'OpenMarkdown',
    github: 'GitHub',
    night: '午夜',
    nord: 'Nord',
    vue: 'Vue',
    sepia: '棕褐',
  }[theme]
}

export { defaultSettings }
