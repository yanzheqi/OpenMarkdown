export type SidebarTab = 'files' | 'outline'

export type ThemeId = 'inkwell' | 'github' | 'night' | 'nord' | 'vue' | 'sepia'

export type DocSource = 'library' | 'fs'

export interface DocNode {
  id: string
  name: string
  kind: 'file' | 'folder'
  content?: string
  children?: DocNode[]
  createdAt: number
  updatedAt: number
  source?: DocSource
  path?: string
}

export interface Settings {
  theme: ThemeId
  fontFamily: 'sans' | 'serif' | 'system'
  fontSize: number
  lineHeight: number
  contentWidth: number
  spellcheck: boolean
  autoSave: boolean
  typewriter: boolean
  focus: boolean
  showWordCount: boolean
  zoom: number
}

export interface LinkDraft {
  text: string
  url: string
}

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
}

export interface OutlineItem {
  level: number
  text: string
  line: number
  id: string
}
