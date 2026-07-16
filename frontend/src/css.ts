import type { CSSProperties } from 'react'

// Convertit une chaîne CSS ("height:52px;flex:none") en objet style React.
// Permet de coller les styles inline du design Claude Design quasi tels quels
// (fidélité maximale, transformation minimale). Les custom props (--tx) passent tel quel.
export function css(text: string): CSSProperties {
  const o: Record<string, string> = {}
  for (const rule of text.split(';')) {
    const i = rule.indexOf(':')
    if (i < 0) continue
    const k = rule.slice(0, i).trim()
    if (!k) continue
    const v = rule.slice(i + 1).trim()
    const key = k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
    o[key] = v
  }
  return o as CSSProperties
}
