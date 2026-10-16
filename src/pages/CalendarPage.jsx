import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, CreditCard } from 'lucide-react'
import { brl, fmtDate, monthName } from '../lib/finance.js'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function CalendarPage({ month, events, onOpenEntry, onOpenInvoice, onCreateEntry }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay()
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const today = new Date()
  const todayKey = dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const [selectedDate, setSelectedDate] = useState(() => todayKey.startsWith(month) ? todayKey : dateKey(year, monthNumber, 1))

  useEffect(() => {
    setSelectedDate(todayKey.startsWith(month) ? todayKey : dateKey(year, monthNumber, 1))
  }, [month, year, monthNumber])

  const eventsByDate = useMemo(() => events.reduce((grouped, event) => {
    if (!event.date) return grouped
    grouped[event.date] ||= []
    grouped[event.date].push(event)
    return grouped
  }, {}), [events])
  const selectedEvents = eventsByDate[selectedDate] || []
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1
    return day > 0 && day <= daysInMonth ? day : null
  })

  return <div className="calendar-page">
    <section className="panel calendar-legend-panel">
      <div className="calendar-legend-title"><CalendarDays size={18}/><span><b>Seu mês em calendário</b><small>Selecione um dia para ver contas, receitas e vencimentos.</small></span></div>
      <div className="calendar-legend" aria-label="Legenda do calendário">
        <span><i className="expense"/> Contas</span>
        <span><i className="income"/> Receitas</span>
        <span><i className="invoice"/> Faturas</span>
      </div>
    </section>

    <div className="calendar-layout">
      <section className="panel calendar-month-panel" aria-label={`Calendário de ${monthName(month)}`}>
        <div className="calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-empty-day" key={`empty-${index}`} aria-hidden="true" />
            const date = dateKey(year, monthNumber, day)
            const dayEvents = eventsByDate[date] || []
            const types = [...new Set(dayEvents.map((event) => event.type))]
            return <button type="button" key={date} className={`calendar-day ${selectedDate === date ? 'selected' : ''} ${todayKey === date ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''}`} aria-pressed={selectedDate === date} aria-label={`${day} de ${monthName(month)}, ${dayEvents.length} ${dayEvents.length === 1 ? 'item' : 'itens'}`} onClick={() => setSelectedDate(date)}>
              <span className="calendar-day-number">{day}</span>
              {dayEvents.length > 0 && <span className="calendar-day-events"><span>{dayEvents.length} {dayEvents.length === 1 ? 'item' : 'itens'}</span><i className="calendar-day-dots">{types.slice(0, 3).map((type) => <i className={type} key={type}/>)}</i></span>}
            </button>
          })}
        </div>
        <div className="calendar-month-foot"><span>{events.length} compromisso{events.length === 1 ? '' : 's'} no mês</span><button type="button" className="button subtle" onClick={onCreateEntry}>Adicionar lançamento</button></div>
      </section>

      <section className="panel calendar-day-panel" aria-live="polite">
        <header className="calendar-day-heading"><div><span className="eyebrow">DIA SELECIONADO</span><h2>{fmtDate(selectedDate)}</h2></div><span className="count-pill">{selectedEvents.length} {selectedEvents.length === 1 ? 'item' : 'itens'}</span></header>
        {selectedEvents.length ? <div className="calendar-event-list">{selectedEvents.map((event) => <article className={`calendar-event ${event.type}`} key={event.id}>
          <span className={`calendar-event-icon ${event.type}`}>{event.type === 'income' ? <ArrowDownLeft size={16}/> : event.type === 'expense' ? <ArrowUpRight size={16}/> : <CreditCard size={16}/>}</span>
          <span className="calendar-event-copy"><b>{event.title}</b><small>{event.subtitle}</small></span>
          <strong className={`calendar-event-amount ${event.type === 'income' ? 'income-text' : event.type === 'expense' ? 'withdrawal-text' : ''}`}>{brl(event.amount)}</strong>
          {event.type === 'invoice' ? <span className={`calendar-event-status ${event.paid ? 'paid' : ''}`}>{event.paid ? 'Paga' : 'Em aberto'}</span> : <span className={`calendar-event-status ${event.status === 'settled' ? 'paid' : ''}`}>{event.status === 'settled' ? (event.type === 'income' ? 'Recebida' : 'Paga') : 'Pendente'}</span>}
          <button type="button" className="calendar-event-open" aria-label={event.type === 'invoice' ? `Ver fatura ${event.title}` : `Abrir lançamento ${event.title}`} title={event.type === 'invoice' ? 'Ver fatura' : 'Abrir lançamento'} onClick={() => event.type === 'invoice' ? onOpenInvoice(event.cardId) : onOpenEntry(event.entry)}><span>{event.type === 'invoice' ? 'Ver fatura' : 'Abrir'}</span><ChevronRight size={15}/></button>
        </article>)}</div> : <div className="calendar-day-empty"><span className="calendar-empty-icon"><Check size={18}/></span><b>Nenhum compromisso neste dia</b><small>Suas contas, receitas e faturas aparecerão aqui.</small><button type="button" className="button subtle" onClick={onCreateEntry}>Adicionar lançamento</button></div>}
      </section>
    </div>
  </div>
}
