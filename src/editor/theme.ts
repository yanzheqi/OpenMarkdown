import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const markdownHighlight = HighlightStyle.define([
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: 'var(--link)' },
  { tag: t.url, color: 'var(--text-muted)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)' },
  { tag: t.keyword, color: 'var(--syn-keyword)' },
  { tag: t.controlKeyword, color: 'var(--syn-keyword)' },
  { tag: t.moduleKeyword, color: 'var(--syn-keyword)' },
  { tag: t.operatorKeyword, color: 'var(--syn-keyword)' },
  { tag: t.string, color: 'var(--syn-string)' },
  { tag: t.special(t.string), color: 'var(--syn-string)' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.bool, color: 'var(--syn-number)' },
  { tag: t.null, color: 'var(--syn-number)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.lineComment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.blockComment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: 'var(--syn-function)' },
  { tag: t.function(t.propertyName), color: 'var(--syn-function)' },
  { tag: t.definition(t.variableName), color: 'var(--syn-function)' },
  { tag: t.typeName, color: 'var(--syn-type)' },
  { tag: t.className, color: 'var(--syn-type)' },
  { tag: t.propertyName, color: 'var(--syn-property)' },
  { tag: t.attributeName, color: 'var(--syn-property)' },
  { tag: t.variableName, color: 'var(--text)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.punctuation, color: 'var(--text-muted)' },
  { tag: t.bracket, color: 'var(--text-muted)' },
  { tag: t.regexp, color: 'var(--syn-string)' },
  { tag: t.escape, color: 'var(--syn-keyword)' },
  { tag: t.meta, color: 'var(--syn-comment)' },
])

export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-text)',
    fontSize: 'var(--editor-font-size)',
    lineHeight: 'var(--line-height)',
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    padding: '0',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--bg-elev)',
    color: 'var(--text)',
    borderColor: 'var(--border)',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--border)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--search-match)',
    outline: '1px solid var(--accent-soft)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--search-match-active)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-lg)',
    color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-contrast)',
  },
  '.cm-placeholder': {
    color: 'var(--text-faint)',
    fontStyle: 'italic',
  },
})

export const editorExtensions = [editorTheme, syntaxHighlighting(markdownHighlight)]
