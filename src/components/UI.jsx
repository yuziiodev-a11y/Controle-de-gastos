import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Wallet, X } from 'lucide-react'
import { monthOf, monthName } from '../lib/finance.js'

export function MonthPicker({ value, onChange }) {
  function shift(delta) {
    const date = new Date(`${value}-15T12:00:00`)
    date.setMonth(date.getMonth() + delta)
    onChange(monthOf(date))
  }
  return <div className="month-picker"><button className="icon-button" aria-label="Mês anterior" title="Mês anterior" onClick={() => shift(-1)}><ArrowLeft size={16} /></button><label><CalendarDays size={16} /><span>{monthName(value)}</span><ChevronDown size={14} /><input aria-label="Escolher mês" type="month" value={value} onChange={(event) => onChange(event.target.value)} /></label><button className="icon-button" aria-label="Próximo mês" title="Próximo mês" onClick={() => shift(1)}><ArrowRight size={16} /></button></div>
}

export function SummaryCard({ label, value, detail, icon, tone }) {
  return <article className="summary-card"><div className="summary-top"><span>{label}</span><span className={`summary-icon ${tone}`}>{icon}</span></div><strong className="summary-value">{value}</strong><span className="summary-detail">{detail}</span></article>
}

export function PanelHeading({ title, subtitle, action }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

export function EmptyState({ title, text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Wallet size={19} /></span><b>{title}</b><span>{text}</span>{action}</div>
}

export function Modal({ title, onClose, children, className = '' }) {
  const [closing, setClosing] = useState(false)
  const close = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 170)
  }
  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })
  return <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" title="Fechar" aria-label="Fechar modal" onClick={close}><X size={18} /></button></div>{children}</section></div>
}

export function YearPicker({value,onChange}) { return <div className="month-picker"><button className="icon-button" aria-label="Ano anterior" title="Ano anterior" onClick={()=>onChange(String(Number(value)-1))}><ArrowLeft size={16}/></button><label><CalendarDays size={16}/><span>{value}</span><ChevronDown size={14}/><select aria-label="Escolher ano" value={value} onChange={e=>onChange(e.target.value)}>{Array.from({length:11},(_,i)=>String(new Date().getFullYear()-5+i)).map(y=><option key={y}>{y}</option>)}</select></label><button className="icon-button" aria-label="Próximo ano" title="Próximo ano" onClick={()=>onChange(String(Number(value)+1))}><ArrowRight size={16}/></button></div> }
