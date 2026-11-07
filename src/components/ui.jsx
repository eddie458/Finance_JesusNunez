import { useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { plainMoney } from '../lib/money'

export const BrandMark = ({ size=34 }) => <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><path d="M18 21.5C18 17.91 20.91 15 24.5 15H44v8H25.5a2.5 2.5 0 0 0 0 5H42c2.76 0 5 2.24 5 5v9.5c0 3.59-2.91 6.5-6.5 6.5H21v-8h18.5a2.5 2.5 0 0 0 0-5H22c-2.21 0-4-1.79-4-4v-10.5Z" fill="currentColor"/></svg>

// --chars lets the stylesheet shrink a long amount until it fits its tile.
export function Amount({ cents, currency, loading=false }) {
  if (loading) return <span className="amount amount-loading" style={{'--chars':8}}>—</span>
  const text=plainMoney(cents,currency); const dot=text.lastIndexOf('.')
  return <span className="amount" style={{'--chars':text.length}}>{text.slice(0,dot)}<span className="amount-cents">{text.slice(dot)}</span></span>
}

export function useEscape(onEscape) { useEffect(()=>{const onKey=e=>{if(e.key==='Escape')onEscape()};window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey)},[onEscape]) }

export function PillSelect({ label, value, onChange, options, active=false }) {
  return <label className={`pill-select${active?' active':''}`}><span className="sr-only">{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown size={17} strokeWidth={2.2} aria-hidden="true"/></label>
}
