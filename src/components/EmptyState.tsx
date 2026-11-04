import { FilePlus2, FolderOpen } from 'lucide-react'
import { useStore } from '../store/store'
import { openMarkdownFile } from '../lib/files'

export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-mark">M</div>
      <h2>尚未打开文档，一切皆有可能。</h2>
      <p>新建一篇文档，或从电脑中打开 Markdown 文件。</p>
      <div className="empty-actions">
        <button className="btn btn-primary" onClick={() => useStore.getState().newFile()}>
          <FilePlus2 size={15} />
          新建文档
        </button>
        <button className="btn btn-ghost" onClick={() => void openMarkdownFile()}>
          <FolderOpen size={15} />
          打开文件…
        </button>
      </div>
      <div className="empty-shortcuts">
        <span>
          <kbd>Ctrl</kbd> <kbd>N</kbd> 新建
        </span>
        <span>
          <kbd>Ctrl</kbd> <kbd>O</kbd> 打开
        </span>
        <span>
          <kbd>Ctrl</kbd> <kbd>/</kbd> 源码
        </span>
      </div>
    </div>
  )
}
