import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Wallet, X } from 'lucide-react'
import { monthOf, monthName } from '../lib/finance.js'

export function MonthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [visibleYear, setVisibleYear] = useState(Number(value.slice(0, 4)))
  const pickerRef = useRef(null)
  useEffect(() => setVisibleYear(Number(value.slice(0, 4))), [value])
  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => { if (!pickerRef.current?.contains(event.target)) setOpen(false) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])
  function shift(delta) {
    const date = new Date(`${value}-15T12:00:00`)
    date.setMonth(date.getMonth() + delta)
    onChange(monthOf(date))
  }
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ key: `${visibleYear}-${String(index + 1).padStart(2, '0')}`, label: new Date(visibleYear, index, 15).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }))
  return <div className="month-picker"><button type="button" className="icon-button" aria-label="Mês anterior" title="Mês anterior" onClick={() => shift(-1)}><ArrowLeft size={16} /></button><div className="month-picker-select" ref={pickerRef}><button type="button" className="month-picker-trigger" aria-label="Escolher mês" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}><CalendarDays size={16} /><span>{monthName(value)}</span><ChevronDown size={14} className={open ? 'is-open' : ''} /></button>{open && <div className="month-picker-popover" role="dialog" aria-label="Escolher mês"><div className="month-picker-popover-head"><button type="button" className="icon-button" aria-label="Ano anterior" onClick={() => setVisibleYear((year) => year - 1)}><ArrowLeft size={15}/></button><strong>{visibleYear}</strong><button type="button" className="icon-button" aria-label="Próximo ano" onClick={() => setVisibleYear((year) => year + 1)}><ArrowRight size={15}/></button></div><div className="month-picker-month-grid">{monthOptions.map((month) => <button type="button" key={month.key} className={`${month.key === value ? 'selected' : ''} ${month.key === monthOf() ? 'current' : ''}`} onClick={() => { onChange(month.key); setOpen(false) }}>{month.label}</button>)}</div><div className="month-picker-popover-foot"><span>Selecione um mês</span><button type="button" onClick={() => { onChange(monthOf()); setOpen(false) }}>Este mês</button></div></div>}</div><button type="button" className="icon-button" aria-label="Próximo mês" title="Próximo mês" onClick={() => shift(1)}><ArrowRight size={16} /></button></div>
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

export function YearPicker({value,onChange}) {
  const [open,setOpen]=useState(false)
  const [visibleCenter,setVisibleCenter]=useState(Number(value))
  const pickerRef=useRef(null)
  useEffect(()=>setVisibleCenter(Number(value)),[value])
  useEffect(()=>{if(!open)return undefined;const closeOutside=event=>{if(!pickerRef.current?.contains(event.target))setOpen(false)};const closeOnEscape=event=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',closeOutside);document.addEventListener('keydown',closeOnEscape);return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeOnEscape)}},[open])
  return <div className="month-picker year-picker"><button type="button" className="icon-button" aria-label="Ano anterior" title="Ano anterior" onClick={()=>onChange(String(Number(value)-1))}><ArrowLeft size={16}/></button><div className="month-picker-select" ref={pickerRef}><button type="button" className="month-picker-trigger" aria-label="Escolher ano" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><CalendarDays size={16}/><span>{value}</span><ChevronDown size={14} className={open?'is-open':''}/></button>{open&&<div className="month-picker-popover year-picker-popover" role="dialog" aria-label="Escolher ano"><div className="month-picker-popover-head"><button type="button" className="icon-button" aria-label="Anos anteriores" onClick={()=>setVisibleCenter(year=>year-11)}><ArrowLeft size={15}/></button><strong>{visibleCenter-5}–{visibleCenter+5}</strong><button type="button" className="icon-button" aria-label="Próximos anos" onClick={()=>setVisibleCenter(year=>year+11)}><ArrowRight size={15}/></button></div><div className="year-picker-grid">{Array.from({length:11},(_,i)=>String(visibleCenter-5+i)).map(year=><button type="button" key={year} className={year===value?'selected':''} onClick={()=>{onChange(year);setOpen(false)}}>{year}</button>)}</div></div>}</div><button type="button" className="icon-button" aria-label="Próximo ano" title="Próximo ano" onClick={()=>onChange(String(Number(value)+1))}><ArrowRight size={16}/></button></div>
}
