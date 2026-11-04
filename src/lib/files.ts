import { findNode, useStore } from '../store/store'

const fileHandles = new Map<string, FileSystemFileHandle>()

export function registerFileHandle(id: string, handle: FileSystemFileHandle) {
  fileHandles.set(id, handle)
}

export function getFileHandle(id: string) {
  return fileHandles.get(id)
}

export function hasFileSystemAccess() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

export function isDesktop() {
  return typeof window !== 'undefined' && Boolean(window.openMarkdownNative)
}

export function downloadFile(filename: string, content: string | Blob, mime = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '-')
}

function pickWithInput(multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain'
    input.multiple = multiple
    input.style.display = 'none'
    document.body.appendChild(input)
    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => finish([]))
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!settled && !input.files?.length) finish([])
        }, 800)
      },
      { once: true },
    )
    input.click()
  })
}

export async function openMarkdownFile(): Promise<string | null> {
  const store = useStore.getState()
  const native = window.openMarkdownNative
  try {
    if (native) {
      const result = await native.openMarkdownFile()
      if (result.canceled) return null
      if (result.error || !result.content || !result.filePath) {
        store.toast(result.error ? `无法打开文件：${result.error}` : '无法打开该文件。', 'error')
        return null
      }
      const name = result.fileName ?? result.filePath.split(/[\\/]/).pop() ?? '文档.md'
      const id = store.addExternalDocument(name, result.content, result.filePath)
      store.toast(`已打开“${name}”`, 'success')
      return id
    }

    if (hasFileSystemAccess()) {
      const handles = await (
        window as unknown as {
          showOpenFilePicker: (options?: unknown) => Promise<FileSystemFileHandle[]>
        }
      ).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'], 'text/plain': ['.txt'] },
          },
        ],
      })
      const handle = handles[0]
      if (!handle) return null
      const file = await handle.getFile()
      const content = await file.text()
      const id = store.addExternalDocument(file.name, content, file.name)
      registerFileHandle(id, handle)
      store.toast(`已打开“${file.name}”`, 'success')
      return id
    }

    const files = await pickWithInput(false)
    if (!files.length) return null
    const file = files[0]
    const content = await file.text()
    const id = store.addExternalDocument(file.name, content, file.name)
    store.toast(`已打开“${file.name}”`, 'success')
    return id
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    store.toast('无法打开该文件。', 'error')
    return null
  }
}

export async function importMarkdownFiles(): Promise<number> {
  const store = useStore.getState()
  const files = await pickWithInput(true)
  if (!files.length) return 0
  const markdownFiles = files.filter((file) => /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name))
  if (!markdownFiles.length) {
    store.toast('没有选择 Markdown 文件。', 'error')
    return 0
  }
  const loaded = await Promise.all(
    markdownFiles.map(async (file) => ({ name: file.name, content: await file.text() })),
  )
  return store.importFiles(loaded)
}

export async function saveActiveDocument(): Promise<boolean> {
  const store = useStore.getState()
  const doc = findNode(store.tree, store.activeId)
  if (!doc || doc.kind !== 'file') return false
  const native = window.openMarkdownNative

  if (native) {
    if (!doc.path) return saveAsMarkdown()
    try {
      const result = await native.writeFile(doc.path, doc.content ?? '')
      if (!result.ok) {
        store.toast(result.error ? `保存失败：${result.error}` : '保存失败。', 'error')
        return false
      }
      store.setSaveState('saved')
      store.toast(`已保存“${doc.name}”`, 'success')
      return true
    } catch {
      store.toast('无法写入文件，请检查磁盘权限。', 'error')
      return false
    }
  }

  const handle = fileHandles.get(doc.id)
  if (!handle) {
    store.setSaveState('saved')
    store.toast('已保存到资料库', 'success')
    return true
  }
  try {
    const writable = await handle.createWritable()
    await writable.write(doc.content ?? '')
    await writable.close()
    store.setSaveState('saved')
    store.toast(`已保存“${doc.name}”`, 'success')
    return true
  } catch {
    store.toast('无法写入文件，请检查磁盘权限。', 'error')
    return false
  }
}

export async function saveAsMarkdown(): Promise<boolean> {
  const state = useStore.getState()
  const doc = findNode(state.tree, state.activeId)
  if (!doc || doc.kind !== 'file') return false
  const filename = safeFileName(doc.name.replace(/\.(md|markdown|txt)$/i, '')) + '.md'
  const content = doc.content ?? ''
  const native = window.openMarkdownNative

  if (native) {
    try {
      const result = await native.saveFileAs({
        defaultName: filename,
        content,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })
      if (result.canceled) return false
      if (result.error) {
        state.toast(`保存失败：${result.error}`, 'error')
        return false
      }
      const savedName = result.fileName ?? filename
      if (result.filePath) state.setDocumentPath(doc.id, result.filePath, savedName)
      state.setSaveState('saved')
      state.toast(`已保存“${savedName}”`, 'success')
      return true
    } catch {
      state.toast('无法写入文件，请检查磁盘权限。', 'error')
      return false
    }
  }

  downloadFile(filename, content, 'text/markdown;charset=utf-8')
  state.toast(`已导出“${filename}”`, 'success')
  return true
}

export function downloadMarkdown(filename: string, content: string) {
  downloadFile(safeFileName(filename), content, 'text/markdown;charset=utf-8')
}
