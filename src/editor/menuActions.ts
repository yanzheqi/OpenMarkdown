import { useStore } from '../store/store'
import {
  clearFormatting,
  getEditorView,
  indentSelection,
  insertCodeBlock as insertCodeBlockCommand,
  insertHorizontalRule as insertHorizontalRuleCommand,
  insertMathBlock as insertMathBlockCommand,
  insertTable as insertTableCommand,
  insertToc as insertTocCommand,
  setHeading as setHeadingCommand,
  toggleBold,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleList as toggleListCommand,
  toggleQuote as toggleQuoteCommand,
  toggleStrike,
} from './commands'

export function bold() {
  toggleBold()
}
export function italic() {
  toggleItalic()
}
export function strike() {
  toggleStrike()
}
export function code() {
  toggleCode()
}
export function highlight() {
  toggleHighlight()
}

export function setHeading(level: number) {
  setHeadingCommand(getEditorView(), level)
}

export function toggleList(kind: 'bullet' | 'ordered' | 'task') {
  toggleListCommand(getEditorView(), kind)
}

export function toggleQuote() {
  toggleQuoteCommand(getEditorView())
}

export function insertTable(rows = 3, columns = 3) {
  insertTableCommand(rows, columns)
}

export function insertCodeBlock(language = '') {
  insertCodeBlockCommand(language)
}

export function insertMathBlock() {
  insertMathBlockCommand()
}

export function insertHorizontalRule() {
  insertHorizontalRuleCommand()
}

export function insertToc() {
  insertTocCommand()
}

export function indent(more: boolean) {
  indentSelection(more)
}

export function clearFormat() {
  clearFormatting()
}

export function setSourceMode(on: boolean) {
  useStore.getState().setSourceMode(on)
}

export function openLinkDialog() {
  const view = getEditorView()
  if (!view) {
    useStore.getState().toast('请先打开一篇文档。', 'error')
    return
  }
  const selection = view.state.selection.main
  const text = view.state.doc.sliceString(selection.from, selection.to)
  useStore.getState().setLinkDialog({ kind: 'link', text, url: '' })
}

export function openImageDialog() {
  useStore.getState().setLinkDialog({ kind: 'image', text: '', url: '' })
}
