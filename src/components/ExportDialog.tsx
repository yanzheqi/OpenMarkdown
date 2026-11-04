import { useEffect, useState } from 'react'
import {
  Check,
  Download,
  FileCode2,
  FileText,
  FileType2,
  Loader2,
  Printer,
} from 'lucide-react'
import { findNode, useStore } from '../store/store'
import {
  copyHtmlToClipboard,
  exportHtmlFile,
  exportWordFile,
  printDocument,
} from '../lib/export'
import { saveAsMarkdown } from '../lib/files'
import { Modal, ModalHeader, SettingRow, Toggle } from './ui'

type Format = 'html' | 'pdf' | 'word' | 'md'

const formats: { id: Format; title: string; description: string; icon: typeof FileCode2 }[] = [
  { id: 'html', title: 'HTML', description: '一个排版精美、可独立打开的网页', icon: FileCode2 },
  { id: 'pdf', title: 'PDF', description: '通过浏览器打印为 PDF', icon: Printer },
  { id: 'word', title: 'Word', description: '可在 Word / Pages 中编辑的 .doc', icon: FileType2 },
  { id: 'md', title: 'Markdown', description: '未改动的纯文本源文件', icon: FileText },
]

export default function ExportDialog() {
  const open = useStore((state) => state.exportOpen)
  const tree = useStore((state) => state.tree)
  const activeId = useStore((state) => state.activeId)
  const settings = useStore((state) => state.settings)
  const doc = findNode(tree, activeId)
  const [format, setFormat] = useState<Format>('html')
  const [dark, setDark] = useState(settings.theme === 'night' || settings.theme === 'nord')
  const [includeToc, setIncludeToc] = useState(true)
  const [busy, setBusy] = useState(false)
  const close = () => useStore.getState().setExportOpen(false)

  useEffect(() => {
    if (open) setDark(settings.theme === 'night' || settings.theme === 'nord')
  }, [open, settings.theme])

  const run = async () => {
    if (!doc) return
    const options = {
      title: doc.name,
      markdown: doc.content ?? '',
      dark,
      includeToc,
    }
    setBusy(true)
    try {
      let saved = true
      if (format === 'md') saved = await saveAsMarkdown()
      else if (format === 'html') saved = await exportHtmlFile(options)
      else if (format === 'word') saved = await exportWordFile(options)
      else {
        saved = await printDocument(options)
        if (!saved) {
          useStore.getState().toast('请允许弹出窗口，才能打印或另存为 PDF。', 'error')
        }
      }
      if (!saved) return
      if (format !== 'pdf') {
        useStore.getState().toast(
          format === 'md' ? 'Markdown 已导出' : `${format.toUpperCase()} 已导出`,
          'success',
        )
      }
      close()
    } catch {
      useStore.getState().toast('导出失败，请重试。', 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyHtml = async () => {
    if (!doc) return
    const ok = await copyHtmlToClipboard({
      title: doc.name,
      markdown: doc.content ?? '',
      dark,
      includeToc,
    })
    useStore.getState().toast(ok ? 'HTML 已复制到剪贴板' : '复制失败', ok ? 'success' : 'error')
  }

  return (
    <Modal open={open} onClose={close} className="export-modal" label="导出文档">
      <ModalHeader
        title="导出"
        subtitle={doc ? `将“${doc.name.replace(/\.md$/i, '')}”导出为可分享的文件。` : '请先打开一篇文档。'}
        onClose={close}
        icon={<Download size={18} />}
      />
      <div className="export-body">
        <div className="export-formats">
          {formats.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`export-format${format === item.id ? ' is-active' : ''}`}
                onClick={() => setFormat(item.id)}
              >
                <span className="export-format-icon">
                  <Icon size={18} />
                </span>
                <span className="export-format-copy">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                {format === item.id && (
                  <span className="export-check">
                    <Check size={13} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="export-options">
          <h3>选项</h3>
          <SettingRow title="深色外观" description="在导出文件中使用深色配色。">
            <Toggle checked={dark} onChange={setDark} label="深色外观" />
          </SettingRow>
          <SettingRow title="包含目录" description="在标题之后加入可点击的目录。">
            <Toggle checked={includeToc} onChange={setIncludeToc} label="包含目录" />
          </SettingRow>
          <div className="export-hint">
            <FileCode2 size={14} />
            <span>
              {format === 'pdf'
                ? '会打开浏览器打印对话框，请选择“另存为 PDF”。'
                : format === 'html'
                  ? '样式、代码配色与图表都会嵌入同一个 HTML 文件。'
                  : format === 'word'
                    ? 'Word 可直接打开，标题、表格与代码都会保留。'
                    : '按原样保存 Markdown 源码，可交给任何其他工具继续处理。'}
            </span>
          </div>
        </div>
      </div>
      <footer className="modal-footer">
        <button className="btn btn-ghost" onClick={() => void copyHtml()} disabled={!doc || busy}>
          复制 HTML
        </button>
        <div className="modal-footer-right">
          <button className="btn btn-ghost" onClick={close}>
            取消
          </button>
          <button className="btn btn-primary" onClick={() => void run()} disabled={!doc || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {format === 'pdf' ? '打印' : '导出'}
          </button>
        </div>
      </footer>
    </Modal>
  )
}
