import { useState } from 'react'
import { Keyboard, Palette, SlidersHorizontal, Sparkles } from 'lucide-react'
import { defaultSettings, themeLabel, useStore } from '../store/store'
import type { ThemeId } from '../store/types'
import { Modal, ModalHeader, Segmented, SettingRow, Toggle } from './ui'

type Tab = 'appearance' | 'editor' | 'about'

const themes: { id: ThemeId; description: string }[] = [
  { id: 'inkwell', description: '暖纸与朱砂，安静的写作空间' },
  { id: 'github', description: '干净、熟悉的 GitHub 风格' },
  { id: 'night', description: '温暖的深夜色' },
  { id: 'nord', description: '清冷的极地蓝' },
  { id: 'vue', description: '清爽的 Vue 绿' },
  { id: 'sepia', description: '书卷气的棕褐色' },
]

export default function SettingsDialog() {
  const open = useStore((state) => state.settingsOpen)
  const settings = useStore((state) => state.settings)
  const [tab, setTab] = useState<Tab>('appearance')
  const close = () => useStore.getState().setSettingsOpen(false)
  const update = (patch: Partial<typeof settings>) => useStore.getState().updateSettings(patch)

  return (
    <Modal open={open} onClose={close} className="settings-modal" label="偏好设置">
      <ModalHeader
        title="偏好设置"
        subtitle="让 OpenMarkdown 更符合你的写作习惯。"
        onClose={close}
        icon={<SlidersHorizontal size={18} />}
      />
      <div className="settings-body">
        <nav className="settings-nav">
          <button className={tab === 'appearance' ? 'is-active' : ''} onClick={() => setTab('appearance')}>
            <Palette size={15} />
            外观
          </button>
          <button className={tab === 'editor' ? 'is-active' : ''} onClick={() => setTab('editor')}>
            <SlidersHorizontal size={15} />
            编辑器
          </button>
          <button className={tab === 'about' ? 'is-active' : ''} onClick={() => setTab('about')}>
            <Sparkles size={15} />
            关于
          </button>
        </nav>
        <div className="settings-content">
          {tab === 'appearance' && (
            <>
              <section className="settings-section">
                <h3>主题</h3>
                <p className="settings-lead">六套配色，为长时间写作而调校。</p>
                <div className="theme-grid">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      className={`theme-card${settings.theme === theme.id ? ' is-active' : ''}`}
                      data-theme={theme.id}
                      onClick={() => update({ theme: theme.id })}
                    >
                      <span className="theme-preview">
                        <span className="theme-preview-side" />
                        <span className="theme-preview-page">
                          <span className="theme-preview-title" />
                          <span className="theme-preview-line" />
                          <span className="theme-preview-line short" />
                          <span className="theme-preview-code" />
                        </span>
                      </span>
                      <span className="theme-meta">
                        <strong>{themeLabel(theme.id)}</strong>
                        <small>{theme.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-section">
                <h3>排版</h3>
                <SettingRow title="字体" description="决定文档的气质与阅读节奏。">
                  <Segmented
                    value={settings.fontFamily}
                    onChange={(fontFamily) => update({ fontFamily })}
                    options={[
                      { value: 'sans', label: '无衬线' },
                      { value: 'serif', label: '衬线' },
                      { value: 'system', label: '系统' },
                    ]}
                  />
                </SettingRow>
                <SettingRow title="字号" description={`${settings.fontSize}px`}>
                  <input
                    type="range"
                    min={14}
                    max={24}
                    step={1}
                    value={settings.fontSize}
                    onChange={(event) => update({ fontSize: Number(event.target.value) })}
                  />
                </SettingRow>
                <SettingRow title="行高" description={settings.lineHeight.toFixed(2)}>
                  <input
                    type="range"
                    min={1.4}
                    max={2.2}
                    step={0.05}
                    value={settings.lineHeight}
                    onChange={(event) => update({ lineHeight: Number(event.target.value) })}
                  />
                </SettingRow>
                <SettingRow title="内容宽度" description={`${settings.contentWidth}px`}>
                  <input
                    type="range"
                    min={600}
                    max={1080}
                    step={20}
                    value={settings.contentWidth}
                    onChange={(event) => update({ contentWidth: Number(event.target.value) })}
                  />
                </SettingRow>
              </section>
            </>
          )}

          {tab === 'editor' && (
            <>
              <section className="settings-section">
                <h3>写作</h3>
                <SettingRow title="拼写检查" description="输入时使用浏览器词典检查拼写。">
                  <Toggle
                    checked={settings.spellcheck}
                    onChange={(spellcheck) => update({ spellcheck })}
                    label="拼写检查"
                  />
                </SettingRow>
                <SettingRow title="专注模式" description="淡化当前段落以外的内容，减少干扰。">
                  <Toggle checked={settings.focus} onChange={(focus) => update({ focus })} label="专注模式" />
                </SettingRow>
                <SettingRow title="打字机模式" description="让正在编辑的行始终靠近屏幕中央。">
                  <Toggle
                    checked={settings.typewriter}
                    onChange={(typewriter) => update({ typewriter })}
                    label="打字机模式"
                  />
                </SettingRow>
                <SettingRow title="字数统计" description="在状态栏显示词数、字符数和阅读时间。">
                  <Toggle
                    checked={settings.showWordCount}
                    onChange={(showWordCount) => update({ showWordCount })}
                    label="字数统计"
                  />
                </SettingRow>
              </section>
              <section className="settings-section">
                <h3>缩放</h3>
                <SettingRow title="编辑器缩放" description={`${settings.zoom}%`}>
                  <input
                    type="range"
                    min={80}
                    max={160}
                    step={10}
                    value={settings.zoom}
                    onChange={(event) => update({ zoom: Number(event.target.value) })}
                  />
                </SettingRow>
              </section>
              <section className="settings-section">
                <h3>重置</h3>
                <div className="reset-row">
                  <p>将所有偏好恢复为 OpenMarkdown 的默认设置。</p>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      useStore.getState().updateSettings(defaultSettings)
                      useStore.getState().toast('已恢复默认设置', 'success')
                    }}
                  >
                    恢复默认设置
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === 'about' && (
            <section className="about-panel">
              <div className="about-mark">M</div>
              <h3>OpenMarkdown</h3>
              <p className="about-version">版本 1.0.0 · 类 Typora 的 Markdown 编辑器</p>
              <p className="about-copy">
                OpenMarkdown 让页面与源码待在同一处。排版随输入即时呈现，语法只在需要时出现，
                每一篇文档都保持为纯粹的 Markdown 文本。
              </p>
              <div className="about-grid">
                <span>
                  <Keyboard size={15} /> 40+ 快捷键
                </span>
                <span>
                  <Palette size={15} /> 6 套主题
                </span>
                <span>
                  <Sparkles size={15} /> KaTeX &amp; Mermaid
                </span>
              </div>
              <p className="about-note">用 CodeMirror、React，以及对纯文本的敬意构建。</p>
            </section>
          )}
        </div>
      </div>
    </Modal>
  )
}
