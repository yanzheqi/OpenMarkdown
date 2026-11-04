import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Link2, Upload } from 'lucide-react'
import { useStore } from '../store/store'
import { insertLink } from '../editor/commands'
import { Modal, ModalHeader } from './ui'

export default function LinkDialog() {
  const dialog = useStore((state) => state.linkDialog)
  const open = Boolean(dialog)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const close = () => useStore.getState().setLinkDialog(null)
  const isImage = dialog?.kind === 'image'

  useEffect(() => {
    if (!dialog) return
    setText(dialog.text)
    setUrl(dialog.url)
  }, [dialog])

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    insertLink(text.trim(), trimmed, isImage)
  }

  const pickImage = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      useStore.getState().toast('请选择图片文件。', 'error')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      useStore.getState().toast('图片不能超过 8 MB。', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setUrl(String(reader.result ?? ''))
      if (!text.trim()) setText(file.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsDataURL(file)
  }

  return (
    <Modal open={open} onClose={close} className="link-modal" label={isImage ? '插入图片' : '插入链接'}>
      <ModalHeader
        title={isImage ? '插入图片' : '插入链接'}
        subtitle={isImage ? '上传图片或填写图片地址。' : '为文字添加一个跳转地址。'}
        onClose={close}
        icon={isImage ? <ImagePlus size={18} /> : <Link2 size={18} />}
      />
      <form
        className="link-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label>
          <span>{isImage ? '替代文本' : '链接文字'}</span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={isImage ? '描述这张图片' : '链接要显示的文字'}
            autoFocus={!isImage}
          />
        </label>
        <label>
          <span>{isImage ? '图片地址' : '链接地址'}</span>
          <div className="input-with-button">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              autoFocus={isImage}
            />
            {isImage && (
              <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                <Upload size={14} />
                上传
              </button>
            )}
          </div>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => pickImage(event.target.files?.[0])}
        />
        {isImage && url && (
          <div className="image-preview">
            <img src={url} alt="" />
          </div>
        )}
        {!isImage && (
          <p className="link-tip">
            提示：先选中文字再插入链接，或按 <kbd>Ctrl</kbd> + <kbd>K</kbd>。
          </p>
        )}
        <footer className="modal-footer link-footer">
          <button type="button" className="btn btn-ghost" onClick={close}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={!url.trim()}>
            插入{isImage ? '图片' : '链接'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
