/// <reference types="vite/client" />

declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  export const gfm: TurndownService.Plugin
  export const tables: TurndownService.Plugin
  export const strikethrough: TurndownService.Plugin
  export const taskListItems: TurndownService.Plugin
}

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'
  const footnote: MarkdownIt.PluginSimple
  export default footnote
}

interface NativeOpenResult {
  canceled: boolean
  filePath?: string
  fileName?: string
  content?: string
  error?: string
}

interface NativeSaveResult {
  canceled: boolean
  filePath?: string
  fileName?: string
  error?: string
}

interface NativeFileFilter {
  name: string
  extensions: string[]
}

interface OpenMarkdownNative {
  isNative: true
  platform: string
  openMarkdownFile: () => Promise<NativeOpenResult>
  writeFile: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>
  saveFileAs: (options: {
    defaultName: string
    content: string
    filters?: NativeFileFilter[]
  }) => Promise<NativeSaveResult>
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
}

interface Window {
  openMarkdownNative?: OpenMarkdownNative
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle[]>
}
