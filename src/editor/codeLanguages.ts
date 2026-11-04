import type { Language, LanguageSupport } from '@codemirror/language'
import { cpp } from '@codemirror/lang-cpp'
import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { less } from '@codemirror/lang-less'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sass } from '@codemirror/lang-sass'
import { sql } from '@codemirror/lang-sql'
import { vue } from '@codemirror/lang-vue'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'

const cache = new Map<string, Language | null>()

export function codeLanguage(info: string): Language | null {
  const name = info.trim().toLowerCase().split(/\s+/)[0]?.replace(/^\{\.?/, '').replace(/\}$/, '')
  if (!name) return null
  if (cache.has(name)) return cache.get(name) ?? null
  let support: LanguageSupport | null = null
  switch (name) {
    case 'js':
    case 'javascript':
    case 'jsx':
      support = javascript({ jsx: true })
      break
    case 'ts':
    case 'typescript':
      support = javascript({ typescript: true })
      break
    case 'tsx':
      support = javascript({ typescript: true, jsx: true })
      break
    case 'py':
    case 'python':
      support = python()
      break
    case 'rs':
    case 'rust':
      support = rust()
      break
    case 'html':
    case 'htm':
      support = html()
      break
    case 'css':
      support = css()
      break
    case 'scss':
      support = sass()
      break
    case 'sass':
      support = sass({ indented: true })
      break
    case 'less':
      support = less()
      break
    case 'json':
    case 'jsonc':
      support = json()
      break
    case 'sql':
    case 'mysql':
    case 'postgresql':
    case 'sqlite':
      support = sql()
      break
    case 'java':
      support = java()
      break
    case 'c':
    case 'h':
    case 'cpp':
    case 'c++':
    case 'cc':
    case 'cxx':
      support = cpp()
      break
    case 'go':
    case 'golang':
      support = go()
      break
    case 'xml':
    case 'svg':
      support = xml()
      break
    case 'yaml':
    case 'yml':
      support = yaml()
      break
    case 'php':
      support = php()
      break
    case 'vue':
      support = vue()
      break
    case 'md':
    case 'markdown':
      support = markdown()
      break
    default:
      support = null
  }
  const language = support?.language ?? null
  cache.set(name, language)
  return language
}
