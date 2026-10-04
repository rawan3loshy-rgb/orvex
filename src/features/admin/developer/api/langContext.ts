import { createContext } from 'react'

export type Lang = 'curl' | 'node' | 'python'

/* Language preference shared by every sample on the page. */
export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'curl', setLang: () => undefined })
