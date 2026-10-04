import type { ReactNode } from 'react'

export type CodeLang = 'json' | 'bash' | 'js' | 'python' | 'http' | 'html' | 'css' | 'text' | 'sql' | 'yaml'

type Rule = [RegExp, string]

// ORVEX code palette — warm graphite with coral numerals; no blue.
const C = {
  key: 'text-[#5a4a3f] dark:text-[#e3d6c8]',
  str: 'text-[#1f7a5c] dark:text-[#86d4b6]',
  num: 'text-[#c43d1b] dark:text-[#ff9478]',
  kw: 'text-[#8a4f7d] dark:text-[#d8a7c9]',
  fn: 'text-[#8d6309] dark:text-[#ebc274]',
  com: 'text-fg-3 italic',
  punc: 'text-fg-3',
  flag: 'text-[#c43d1b] dark:text-[#ffab8f]',
  tag: 'text-[#b8371a] dark:text-[#ff8f70]',
  attr: 'text-[#8d6309] dark:text-[#ebc274]',
}

const RULES: Record<CodeLang, Rule[]> = {
  json: [
    [/"(?:[^"\\]|\\.)*"(?=\s*:)/y, C.key],
    [/"(?:[^"\\]|\\.)*"/y, C.str],
    [/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/y, C.num],
    [/\b(?:true|false|null)\b/y, C.kw],
    [/[{}[\],:]/y, C.punc],
  ],
  bash: [
    [/#.*$/my, C.com],
    [/"(?:[^"\\]|\\.)*"|'[^']*'/y, C.str],
    [/(?:^|(?<=\s))--?[a-zA-Z][\w-]*/y, C.flag],
    [/\b(?:curl|npm|npx|docker|export|cd|git|node)\b/y, C.fn],
    [/https?:\/\/[^\s'"\\]+/y, C.key],
    [/\$\w+|\$\{[^}]+\}/y, C.kw],
  ],
  js: [
    [/\/\/.*$/my, C.com],
    [/`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, C.str],
    [/\b(?:const|let|var|await|async|function|return|import|from|export|new|if|else|throw|try|catch|for|of|in|true|false|null|undefined)\b/y, C.kw],
    [/\b\d+(?:\.\d+)?\b/y, C.num],
    [/\b[a-zA-Z_]\w*(?=\()/y, C.fn],
    [/[{}()[\];,.]/y, C.punc],
  ],
  python: [
    [/#.*$/my, C.com],
    [/"""[\s\S]*?"""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y, C.str],
    [/\b(?:import|from|def|return|if|else|elif|for|in|as|with|True|False|None|try|except|raise|class)\b/y, C.kw],
    [/\b\d+(?:\.\d+)?\b/y, C.num],
    [/\b[a-zA-Z_]\w*(?=\()/y, C.fn],
  ],
  http: [
    [/^(?:GET|POST|PUT|PATCH|DELETE)\b/my, C.kw],
    [/^[\w-]+(?=:)/my, C.key],
    [/HTTP\/\d(?:\.\d)?\s+\d{3}.*$/my, C.fn],
    [/"(?:[^"\\]|\\.)*"/y, C.str],
  ],
  html: [
    [/<!--[\s\S]*?-->/y, C.com],
    [/<\/?[a-zA-Z][\w-]*/y, C.tag],
    [/\b[a-zA-Z-:]+(?==)/y, C.attr],
    [/"(?:[^"\\]|\\.)*"|'[^']*'/y, C.str],
    [/\{\{[^}]+\}\}/y, C.kw],
    [/\/?>/y, C.tag],
  ],
  css: [
    [/\/\*[\s\S]*?\*\//y, C.com],
    [/[.#]?[a-zA-Z][\w-]*(?=[^{}]*\{)/y, C.tag],
    [/[a-z-]+(?=\s*:)/y, C.key],
    [/#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms|vw|vh)?\b/y, C.num],
    [/var\(--[\w-]+\)/y, C.kw],
  ],
  sql: [
    [/--.*$/my, C.com],
    [/'(?:[^'\\]|\\.)*'/y, C.str],
    [/\b(?:CREATE|TABLE|INDEX|ON|PRIMARY|KEY|REFERENCES|NOT|NULL|DEFAULT|UNIQUE|ALTER|ADD|COLUMN|SELECT|FROM|WHERE|INSERT|INTO|VALUES|BEGIN|COMMIT|TEXT|INTEGER|BIGINT|NUMERIC|BOOLEAN|TIMESTAMPTZ|JSONB|UUID|IF|EXISTS)\b/y, C.kw],
    [/\b\d+(?:\.\d+)?\b/y, C.num],
  ],
  yaml: [
    [/#.*$/my, C.com],
    [/^\s*[\w.-]+(?=:)/my, C.key],
    [/"(?:[^"\\]|\\.)*"|'[^']*'/y, C.str],
    [/\b\d+(?:\.\d+)?\b/y, C.num],
  ],
  text: [],
}

export function highlight(code: string, lang: CodeLang): ReactNode[] {
  const rules = RULES[lang] ?? []
  if (!rules.length) return [code]
  const out: ReactNode[] = []
  let i = 0
  let plain = ''
  let k = 0
  while (i < code.length) {
    let matched = false
    for (const [re, cls] of rules) {
      re.lastIndex = i
      const m = re.exec(code)
      if (m && m.index === i && m[0].length > 0) {
        if (plain) {
          out.push(plain)
          plain = ''
        }
        out.push(
          <span key={k++} className={cls}>
            {m[0]}
          </span>,
        )
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      plain += code[i]
      i++
    }
  }
  if (plain) out.push(plain)
  return out
}
