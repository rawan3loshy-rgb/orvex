/**
 * CodeMirror 6 editor themed with the app's design tokens (dark + light).
 * Highlights {{template.variables}} inline so authors can spot dynamic content.
 */
import { forwardRef, useMemo } from 'react'
import CodeMirror, { type ReactCodeMirrorRef, type Statistics } from '@uiw/react-codemirror'
import { Decoration, EditorView, MatchDecorator, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { tags as t } from '@lezer/highlight'
import { useUi } from '@/stores/ui'
import { cn } from '@/lib/cn'

export type CodeLanguage = 'html' | 'css' | 'js'

const MONO = '"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const PALETTE = {
  dark: { tag: '#ff8f70', attr: '#ebc274', string: '#86d4b6', keyword: '#d8a7c9', number: '#ff9478', comment: '#6e6b66', property: '#e3d6c8', fn: '#ebc274', punct: '#8d8a85', variable: '#ecebe7', cls: '#f2c98a', invalid: '#f25672' },
  light: { tag: '#b8371a', attr: '#8d6309', string: '#1f7a5c', keyword: '#8a4f7d', number: '#c43d1b', comment: '#9a968f', property: '#5a4a3f', fn: '#8d6309', punct: '#6b6b6b', variable: '#1d1c1a', cls: '#8d6309', invalid: '#cf2f4c' },
}

function buildTheme(dark: boolean): Extension {
  const p = dark ? PALETTE.dark : PALETTE.light
  const view = EditorView.theme(
    {
      '&': { color: 'var(--fg)', backgroundColor: 'transparent', fontSize: '12.5px', height: '100%' },
      '.cm-scroller': { fontFamily: MONO, lineHeight: '1.72', overflow: 'auto' },
      '.cm-content': { caretColor: 'var(--accent)', padding: '14px 0 48px' },
      '.cm-line': { padding: '0 18px 0 6px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'color-mix(in oklab, var(--accent) 26%, transparent) !important',
      },
      '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--fg) 3.5%, transparent)' },
      '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--fg-3)', border: 'none' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 14px', minWidth: '44px', fontVariantNumeric: 'tabular-nums', opacity: '0.75' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--fg)' },
      '.cm-activeLineGutter.cm-gutterElement': { opacity: '1' },
      '.cm-foldGutter .cm-gutterElement': { color: 'var(--fg-3)', padding: '0 4px', transition: 'color .15s' },
      '.cm-foldGutter .cm-gutterElement:hover': { color: 'var(--fg)' },
      '.cm-foldPlaceholder': { backgroundColor: 'var(--surface-3)', border: '1px solid var(--line-strong)', color: 'var(--fg-2)', borderRadius: '4px', padding: '0 6px', margin: '0 2px' },
      '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
        backgroundColor: 'color-mix(in oklab, var(--fg) 14%, transparent)',
        outline: '1px solid color-mix(in oklab, var(--fg) 40%, transparent)',
        borderRadius: '2px',
        color: 'inherit',
      },
      '.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'color-mix(in oklab, var(--danger) 25%, transparent)' },
      '.cm-selectionMatch': { backgroundColor: 'color-mix(in oklab, var(--accent) 12%, transparent)' },
      '.cm-searchMatch': { backgroundColor: 'color-mix(in oklab, var(--warning) 22%, transparent)', outline: '1px solid color-mix(in oklab, var(--warning) 50%, transparent)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in oklab, var(--warning) 40%, transparent)' },
      '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--line-strong)', borderRadius: '10px', boxShadow: 'var(--shadow-pop)', overflow: 'hidden' },
      '.cm-tooltip-autocomplete > ul': { fontFamily: MONO, fontSize: '12px', maxHeight: '240px', padding: '4px' },
      '.cm-tooltip-autocomplete > ul > li': { padding: '3px 8px !important', borderRadius: '6px' },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'color-mix(in oklab, var(--accent) 18%, transparent)', color: 'var(--fg)' },
      '.cm-completionIcon': { opacity: '0.55', width: '1.2em' },
      '.cm-completionDetail': { color: 'var(--fg-3)', fontStyle: 'normal' },
      '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--fg)' },
      '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--line)' },
      '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--line)' },
      '.cm-panel.cm-search': { padding: '8px 10px', fontSize: '12px', fontFamily: 'inherit' },
      '.cm-panel.cm-search label': { fontSize: '12px', color: 'var(--fg-2)' },
      '.cm-textfield': { backgroundColor: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: '6px', color: 'var(--fg)', padding: '3px 6px', fontSize: '12px' },
      '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--surface-3)', border: '1px solid var(--line-strong)', borderRadius: '6px', color: 'var(--fg)', fontSize: '12px', padding: '3px 8px' },
      '.cm-panel.cm-search [name=close]': { color: 'var(--fg-3)', fontSize: '16px' },
      '.cm-template-var': {
        color: 'var(--fg)',
        backgroundColor: 'color-mix(in oklab, var(--fg) 9%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--fg) 24%, transparent)',
        borderRadius: '4px',
      },
      '.cm-template-var *': { color: 'inherit !important' },
      '.cm-placeholder': { color: 'var(--fg-3)', fontStyle: 'italic' },
    },
    { dark },
  )

  const highlight = HighlightStyle.define([
    { tag: [t.tagName, t.angleBracket], color: p.tag },
    { tag: t.attributeName, color: p.attr },
    { tag: [t.string, t.attributeValue, t.special(t.string), t.regexp], color: p.string },
    { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.self], color: p.keyword },
    { tag: [t.number, t.bool, t.null, t.atom, t.unit, t.color, t.constant(t.variableName)], color: p.number },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: p.comment, fontStyle: 'italic' },
    { tag: [t.propertyName, t.definition(t.propertyName)], color: p.property },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: p.fn },
    { tag: [t.className, t.typeName, t.labelName, t.namespace], color: p.cls },
    { tag: [t.punctuation, t.separator, t.bracket, t.operator, t.derefOperator], color: p.punct },
    { tag: [t.variableName, t.definition(t.variableName), t.special(t.variableName)], color: p.variable },
    { tag: t.invalid, color: p.invalid },
    { tag: t.heading, fontWeight: '600' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: '600' },
    { tag: t.link, textDecoration: 'underline' },
  ])

  return [view, syntaxHighlighting(highlight)]
}

const themeCache: Partial<Record<'dark' | 'light', Extension>> = {}
function editorTheme(mode: 'dark' | 'light') {
  return (themeCache[mode] ??= buildTheme(mode === 'dark'))
}

const templateDecorator = new MatchDecorator({
  regexp: /\{\{\s*[a-z][a-z0-9_.]*\s*\}\}/gi,
  decoration: Decoration.mark({ class: 'cm-template-var' }),
})

const templateHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = templateDecorator.createDeco(view)
    }
    update(u: ViewUpdate) {
      this.decorations = templateDecorator.updateDeco(u, this.decorations)
    }
  },
  { decorations: (v) => v.decorations },
)

const LANG_EXTENSIONS: Record<CodeLanguage, () => Extension[]> = {
  html: () => [html({ autoCloseTags: true, matchClosingTags: true }), templateHighlighter],
  css: () => [css()],
  js: () => [javascript()],
}

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  lang: CodeLanguage
  className?: string
  placeholder?: string
  readOnly?: boolean
  wrap?: boolean
  onCursor?: (pos: { line: number; col: number; lines: number }) => void
  height?: string
}

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(function CodeEditor({ value, onChange, lang, className, placeholder, readOnly, wrap, onCursor, height = '100%' }, ref) {
  const mode = useUi((s) => s.theme)
  const extensions = useMemo(() => [...LANG_EXTENSIONS[lang](), ...(wrap ? [EditorView.lineWrapping] : [])], [lang, wrap])
  return (
    <div className={cn('h-full min-h-0 w-full', className)}>
      <CodeMirror
        ref={ref}
        value={value}
        onChange={onChange}
        height={height}
        theme={editorTheme(mode)}
        extensions={extensions}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
          tabSize: 2,
        }}
        onStatistics={
          onCursor
            ? (s: Statistics) => {
                const head = s.selectionAsSingle.head
                onCursor({ line: s.line.number, col: head - s.line.from + 1, lines: s.lineCount })
              }
            : undefined
        }
        className="h-full"
      />
    </div>
  )
})
