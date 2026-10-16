import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Banknote, CalendarDays,
  Check, ChevronDown, CreditCard, LayoutDashboard, LogOut, Pencil, Plus, PiggyBank,
  ReceiptText, Trash2, Wallet, X, Repeat, Search, SlidersHorizontal, Target, Eye, EyeOff, ChartNoAxesCombined, Tags, Bell,
} from 'lucide-react'
import { configured, supabase } from './lib/supabase'

const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const monthOf = (date = new Date()) => localDate(date).slice(0, 7)
const monthStart = (key) => `${key}-01`
const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const monthName = (key, options = { month: 'long', year: 'numeric' }) => new Date(`${key}-15T12:00:00`).toLocaleDateString('pt-BR', options)
const paymentLabel = (item) => {
  if (item.payment_method === 'credit_card') return item.cards?.name || 'Cartão de crédito'
  if (item.payment_method === 'debit_card') return 'Cartão de débito'
  if (item.payment_method === 'pix') return 'Pix'
  if (item.payment_method === 'cash') return 'Dinheiro'
  return 'Outro'
}
const expenseCategories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Compras', 'Serviços', 'Educação', 'Outros']
const incomeCategories = ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Vendas', 'Outros']
const chartColors = ['#6d28d9', '#8428d8', '#9b36d7', '#5b21b6', '#ad5ce0', '#7336b8', '#bf7ae5', '#8b5ac7', '#d1a6eb']
const initialEntry = (monthKey = monthOf()) => {
  const date = monthKey === monthOf() ? localDate() : monthStart(monthKey)
  return { kind: 'expense', description: '', amount: '', category: 'Alimentação', spent_on: date, due_date: date, settled_on: '', status: 'pending', payment_method: 'pix', card_id: '', invoice_month: monthKey, installment_count: '1' }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState([])
  const [cards, setCards] = useState([])
  const [pots, setPots] = useState([])
  const [movements, setMovements] = useState([])
  const [activePage, setActivePage] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(monthOf())
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [userCategories, setUserCategories] = useState([])
  const [categoryForm, setCategoryForm] = useState({ kind: 'expense', name: '' })
  const [reminderSettings, setReminderSettings] = useState({ enabled: false, days_before: 1 })
  const [reminderModal, setReminderModal] = useState(false)
  const [entryModal, setEntryModal] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [entryForm, setEntryForm] = useState(initialEntry)
  const [cardModal, setCardModal] = useState(false)
  const [invoiceConfirm, setInvoiceConfirm] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [editingCardId, setEditingCardId] = useState(null)
  const [cardForm, setCardForm] = useState({ name: '', closing_day: 10, due_day: 17, credit_limit: '' })
  const [potModal, setPotModal] = useState(false)
  const [editingPotId, setEditingPotId] = useState(null)
  const [potForm, setPotForm] = useState({ name: '', goal_amount: '', goal_due_date: '', opening_balance: '0' })
  const [movementModal, setMovementModal] = useState(false)
  const [movementForm, setMovementForm] = useState({ pot_id: '', kind: 'deposit', amount: '', moved_on: localDate(), note: '' })
  const [budgets, setBudgets] = useState([])
  const [recurringRules, setRecurringRules] = useState([])
  const [budgetModal, setBudgetModal] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category: 'Alimentação', amount: '' })
  const [recurringModal, setRecurringModal] = useState(false)
  const [editingRecurringId, setEditingRecurringId] = useState(null)
  const [recurringForm, setRecurringForm] = useState({ kind: 'expense', description: '', amount: '', category: 'Moradia', day_of_month: '1', payment_method: 'pix', card_id: '', starts_on: monthStart(monthOf()), ends_on: '' })
  const [entryFilters, setEntryFilters] = useState({ search: '', kind: 'all', status: 'all', category: 'all', payment: 'all' })
  const [hideValues, setHideValues] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadData() }, [session, selectedMonth])

  async function loadData() {
    const { error: recurrenceError } = await supabase.rpc('generate_recurring_expenses', { p_month: monthStart(selectedMonth) })
    if (recurrenceError) setMessage(recurrenceError.message)
    const [cardResult, entryResult, potResult, movementResult, budgetResult, recurringResult, categoryResult, reminderResult] = await Promise.all([
      supabase.from('cards').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, cards(name)').order('due_date', { ascending: true }),
      supabase.from('savings_pots').select('*').order('created_at', { ascending: true }),
      supabase.from('savings_movements').select('*').order('moved_on', { ascending: false }),
      supabase.from('category_budgets').select('*').eq('month', monthStart(selectedMonth)),
      supabase.from('recurring_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('user_categories').select('*').order('name'),
      supabase.from('reminder_settings').select('*').maybeSingle(),
    ])
    if (cardResult.error || entryResult.error || potResult.error || movementResult.error || budgetResult.error || recurringResult.error || categoryResult.error || reminderResult.error) setMessage(cardResult.error?.message || entryResult.error?.message || potResult.error?.message || movementResult.error?.message || budgetResult.error?.message || recurringResult.error?.message || categoryResult.error?.message || reminderResult.error?.message || recurrenceError.message)
    else { setCards(cardResult.data || []); setEntries(entryResult.data || []); setPots(potResult.data || []); setMovements(movementResult.data || []); setBudgets(budgetResult.data || []); setRecurringRules(recurringResult.data || []); setUserCategories(categoryResult.data || []); setReminderSettings(reminderResult.data || { enabled: false, days_before: 1 }) }
  }

  function requestConfirmation({ title, message, details, confirmLabel = 'Excluir', onConfirm }) {
    setConfirmation({ title, message, details, confirmLabel, onConfirm })
  }

  async function runConfirmation() {
    if (!confirmation) return
    const action = confirmation.onConfirm
    setConfirmation(null)
    await action?.()
  }

  async function handleAuth(event) {
    event.preventDefault(); setMessage('')
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (result.error) setMessage(result.error.message)
    else if (authMode === 'signup' && !result.data.session) setMessage('Cadastro feito. Confirme seu e-mail para entrar.')
  }

  function openNewEntry() { setEditingEntryId(null); setEntryForm(initialEntry(selectedMonth)); setEntryModal(true) }
  function openEditEntry(item) {
    setEditingEntryId(item.id)
    setEntryForm({
      kind: item.kind || 'expense', description: item.description, amount: String(item.amount), category: item.category,
      spent_on: item.spent_on, due_date: item.due_date, settled_on: item.settled_on || '', status: item.status || 'settled',
      payment_method: item.payment_method || (item.card_id ? 'credit_card' : 'other'),
      card_id: item.card_id || '', invoice_month: item.invoice_month?.slice(0, 7) || selectedMonth, installment_count: '1',
    })
    setEntryModal(true)
  }

  async function saveEntry(event) {
    event.preventDefault(); setMessage('')
    const count = Number(entryForm.installment_count || 1)
    const amount = Number(entryForm.amount)
    const payload = {
      kind: entryForm.kind, description: entryForm.description.trim(), amount, category: entryForm.category,
      spent_on: entryForm.spent_on, due_date: entryForm.due_date, status: count > 1 ? 'pending' : entryForm.status,
      settled_on: count > 1 ? null : entryForm.status === 'settled' ? (entryForm.settled_on || entryForm.spent_on) : null,
      payment_method: entryForm.kind === 'expense' ? entryForm.payment_method : 'other',
      card_id: entryForm.kind === 'expense' && entryForm.payment_method === 'credit_card' ? (entryForm.card_id || null) : null,
      invoice_month: monthStart(entryForm.invoice_month || selectedMonth),
    }
    let result
    if (editingEntryId) result = await supabase.from('expenses').update(payload).eq('id', editingEntryId)
    else if (count > 1) {
      const start = new Date(`${entryForm.invoice_month || selectedMonth}-01T12:00:00`)
      const cents = Math.round(amount * 100), base = Math.floor(cents / count), remainder = cents % count
      const group = crypto.randomUUID()
      const card = cards.find((item) => item.id === entryForm.card_id)
      const rows = Array.from({ length: count }, (_, index) => {
        const invoiceDate = new Date(start); invoiceDate.setMonth(invoiceDate.getMonth() + index)
        const invoiceMonth = monthOf(invoiceDate)
        const endDay = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + 1, 0).getDate()
        const dueDay = Math.min(Number(card?.due_day || 1), endDay)
        return { ...payload, amount: (base + (index < remainder ? 1 : 0)) / 100, invoice_month: monthStart(invoiceMonth), due_date: `${invoiceMonth}-${String(dueDay).padStart(2, '0')}`, installment_group_id: group, installment_number: index + 1, installment_count: count }
      })
      result = await supabase.from('expenses').insert(rows)
    } else result = await supabase.from('expenses').insert(payload)
    if (result.error) setMessage(result.error.message)
    else { setEntryModal(false); setEditingEntryId(null); await loadData() }
  }

  function toggleInvoicePaid(card) {
    const invoiceEntries = entries.filter((item) => item.kind === 'expense' && item.card_id === card.id && item.invoice_month?.startsWith(selectedMonth))
    if (!invoiceEntries.length) return
    setInvoiceConfirm({ card, entries: invoiceEntries, reopening: card.invoicePaid })
  }

  async function confirmInvoiceChange() {
    if (!invoiceConfirm) return
    const { card, entries: invoiceEntries, reopening } = invoiceConfirm
    const ids = invoiceEntries.map((item) => item.id)
    const { error } = await supabase.from('expenses').update(reopening ? { status: 'pending', settled_on: null } : { status: 'settled', settled_on: localDate() }).in('id', ids)
    setInvoiceConfirm(null)
    if (error) setMessage(error.message); else await loadData()
  }

  async function settleEntry(item) {
    const { error } = await supabase.from('expenses').update({ status: 'settled', settled_on: localDate() }).eq('id', item.id)
    if (error) setMessage(error.message); else loadData()
  }

  function deleteEntry(item) {
    const isInstallmentGroup = Boolean(item.installment_group_id)
    requestConfirmation({
      title: isInstallmentGroup ? 'Excluir todas as parcelas?' : 'Excluir lançamento?',
      message: isInstallmentGroup ? `Você está prestes a excluir todas as ${item.installment_count} parcelas de “${item.description}”.` : `Você está prestes a excluir “${item.description}”.`,
      details: isInstallmentGroup ? 'Essa ação remove todas as parcelas vinculadas à compra.' : 'Essa ação não pode ser desfeita.',
      confirmLabel: isInstallmentGroup ? 'Excluir parcelas' : 'Excluir lançamento',
      onConfirm: async () => {
        setEntries((current) => current.filter((entry) => isInstallmentGroup ? entry.installment_group_id !== item.installment_group_id : entry.id !== item.id))
        const query = supabase.from('expenses').delete()
        const { error } = isInstallmentGroup ? await query.eq('installment_group_id', item.installment_group_id) : await query.eq('id', item.id)
        if (error) setMessage(error.message)
        await loadData()
      },
    })
  }

  function openNewCard() { setEditingCardId(null); setCardForm({ name: '', closing_day: 10, due_day: 17, credit_limit: '' }); setCardModal(true) }
  function openEditCard(item) { setEditingCardId(item.id); setCardForm({ name: item.name, closing_day: item.closing_day, due_day: item.due_day, credit_limit: item.credit_limit ?? '' }); setCardModal(true) }
  async function saveCard(event) {
    event.preventDefault(); setMessage('')
    const payload = { name: cardForm.name.trim(), closing_day: Number(cardForm.closing_day), due_day: Number(cardForm.due_day), credit_limit: cardForm.credit_limit === '' ? null : Number(cardForm.credit_limit) }
    const result = editingCardId
      ? await supabase.from('cards').update(payload).eq('id', editingCardId)
      : await supabase.from('cards').insert(payload)
    if (result.error) setMessage(result.error.message)
    else { setCardModal(false); setEditingCardId(null); await loadData() }
  }
  function deleteCard(item) {
    requestConfirmation({ title: 'Excluir cartão?', message: `Excluir o cartão “${item.name}”?`, details: 'Os lançamentos associados serão mantidos, mas ficarão sem cartão vinculado.', confirmLabel: 'Excluir cartão', onConfirm: async () => {
      setCards((current) => current.filter((card) => card.id !== item.id))
      setEntries((current) => current.map((entry) => entry.card_id === item.id ? { ...entry, card_id: null, cards: null } : entry))
      const { error } = await supabase.from('cards').delete().eq('id', item.id)
      if (error) setMessage(error.message)
      await loadData()
    } })
  }

  function openNewPot() { setEditingPotId(null); setPotForm({ name: '', goal_amount: '', goal_due_date: '', opening_balance: '0' }); setPotModal(true) }
  function openEditPot(item) { setEditingPotId(item.id); setPotForm({ name: item.name, goal_amount: item.goal_amount || '', goal_due_date: item.goal_due_date || '', opening_balance: String(item.opening_balance) }); setPotModal(true) }
  async function savePot(event) {
    event.preventDefault(); setMessage('')
    const payload = { name: potForm.name.trim(), goal_amount: potForm.goal_amount ? Number(potForm.goal_amount) : null, goal_due_date: potForm.goal_due_date || null, opening_balance: Number(potForm.opening_balance || 0) }
    const result = editingPotId ? await supabase.from('savings_pots').update(payload).eq('id', editingPotId) : await supabase.from('savings_pots').insert(payload)
    if (result.error) setMessage(result.error.message); else { setPotModal(false); await loadData() }
  }
  function openMovement(pot, kind) {
    setMovementForm({ pot_id: pot.id, kind, amount: '', moved_on: selectedMonth === monthOf() ? localDate() : monthStart(selectedMonth), note: '' })
    setMovementModal(true)
  }
  async function saveMovement(event) {
    event.preventDefault(); setMessage('')
    const amount = Number(movementForm.amount)
    const potBalance = Number(pots.find((item) => item.id === movementForm.pot_id)?.opening_balance || 0) + movements.filter((item) => item.pot_id === movementForm.pot_id).reduce((sum, item) => sum + (item.kind === 'deposit' ? Number(item.amount) : -Number(item.amount)), 0)
    if (movementForm.kind === 'withdrawal' && amount > potBalance) { setMessage('O valor da retirada é maior que o saldo deste cofrinho.'); return }
    const { error } = await supabase.from('savings_movements').insert({ ...movementForm, amount, note: movementForm.note.trim() || null })
    if (error) setMessage(error.message); else { setMovementModal(false); await loadData() }
  }
  function deleteMovement(item) {
    requestConfirmation({ title: 'Excluir movimentação?', message: 'Excluir esta movimentação do cofrinho?', details: 'O saldo do cofrinho será recalculado sem este registro.', confirmLabel: 'Excluir movimentação', onConfirm: async () => {
      setMovements((current) => current.filter((movement) => movement.id !== item.id))
      const { error } = await supabase.from('savings_movements').delete().eq('id', item.id)
      if (error) setMessage(error.message)
      await loadData()
    } })
  }
  function deletePot(item) {
    requestConfirmation({ title: 'Excluir cofrinho?', message: `Excluir o cofrinho “${item.name}” e suas movimentações?`, details: 'O saldo e o histórico deste cofrinho serão removidos.', confirmLabel: 'Excluir cofrinho', onConfirm: async () => {
      setPots((current) => current.filter((pot) => pot.id !== item.id))
      setMovements((current) => current.filter((movement) => movement.pot_id !== item.id))
      const { error } = await supabase.from('savings_pots').delete().eq('id', item.id)
      if (error) setMessage(error.message)
      await loadData()
    } })
  }

  async function saveBudget(event) {
    event.preventDefault(); setMessage('')
    const result = await supabase.from('category_budgets').upsert({ month: monthStart(selectedMonth), category: budgetForm.category, amount: Number(budgetForm.amount) }, { onConflict: 'user_id,month,category' })
    if (result.error) setMessage(result.error.message); else { setBudgetModal(false); await loadData() }
  }
  function deleteBudget(item) {
    requestConfirmation({ title: 'Remover limite?', message: `Remover o limite de ${item.category} deste mês?`, details: 'Isso remove apenas o limite planejado; os lançamentos continuam salvos.', confirmLabel: 'Remover limite', onConfirm: async () => {
      setBudgets((current) => current.filter((budget) => budget.id !== item.id))
      const { error } = await supabase.from('category_budgets').delete().eq('id', item.id)
      if (error) setMessage(error.message)
      await loadData()
    } })
  }
  function openNewRecurring() {
    setEditingRecurringId(null)
    setRecurringForm({ kind: 'expense', description: '', amount: '', category: 'Moradia', day_of_month: '1', payment_method: 'pix', card_id: '', starts_on: monthStart(selectedMonth), ends_on: '' })
    setRecurringModal(true)
  }
  function openEditRecurring(rule) {
    setEditingRecurringId(rule.id)
    setRecurringForm({
      kind: rule.kind, description: rule.description, amount: String(rule.amount), category: rule.category,
      day_of_month: String(rule.day_of_month), payment_method: rule.payment_method || 'pix',
      card_id: rule.card_id || '', starts_on: rule.starts_on, ends_on: rule.ends_on || '',
    })
    setRecurringModal(true)
  }
  async function saveRecurring(event) {
    event.preventDefault(); setMessage('')
    const payload = { ...recurringForm, amount: Number(recurringForm.amount), day_of_month: Number(recurringForm.day_of_month), card_id: recurringForm.payment_method === 'credit_card' ? (recurringForm.card_id || null) : null, ends_on: recurringForm.ends_on || null }
    const result = editingRecurringId
      ? await supabase.from('recurring_rules').update(payload).eq('id', editingRecurringId)
      : await supabase.from('recurring_rules').insert(payload)
    if (result.error) setMessage(result.error.message)
    else { setRecurringModal(false); setEditingRecurringId(null); await loadData() }
  }
  async function toggleRecurring(rule) {
    const { error } = await supabase.from('recurring_rules').update({ active: !rule.active }).eq('id', rule.id)
    if (error) setMessage(error.message); else await loadData()
  }
  function deleteRecurring(rule) {
    requestConfirmation({ title: 'Excluir recorrência?', message: `Excluir a regra “${rule.description}”?`, details: 'Os lançamentos que já foram criados por essa regra serão mantidos.', confirmLabel: 'Excluir recorrência', onConfirm: async () => {
      setRecurringRules((current) => current.filter((item) => item.id !== rule.id))
      const { error } = await supabase.from('recurring_rules').delete().eq('id', rule.id)
      if (error) setMessage(error.message)
      await loadData()
    } })
  }

  const allExpenseCategories = [...expenseCategories, ...userCategories.filter((item) => item.kind === 'expense').map((item) => item.name)]
  const allIncomeCategories = [...incomeCategories, ...userCategories.filter((item) => item.kind === 'income').map((item) => item.name)]
  const allCategories = [...new Set([...allExpenseCategories, ...allIncomeCategories])]
  const todayKey = localDate()
  const dueSoonDate = new Date(`${todayKey}T12:00:00`)
  dueSoonDate.setDate(dueSoonDate.getDate() + 7)
  const dueSoonCutoff = localDate(dueSoonDate)
  const overdueEntries = entries.filter((item) => item.status === 'pending' && item.due_date < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const dueInSevenDays = entries.filter((item) => item.status === 'pending' && item.due_date >= todayKey && item.due_date <= dueSoonCutoff).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const monthEntries = useMemo(() => entries.filter((item) => {
    const relevantDate = item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on)
    return relevantDate?.startsWith(selectedMonth)
  }), [entries, selectedMonth])
  const pendingPayables = monthEntries.filter((item) => item.kind === 'expense' && item.status === 'pending')
  const pendingReceivables = monthEntries.filter((item) => item.kind === 'income' && item.status === 'pending')
  const monthIncome = monthEntries.filter((item) => item.kind === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
  const monthOutgo = monthEntries.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
  const monthResult = monthIncome - monthOutgo
  const savedThisMonth = movements.filter((item) => item.kind === 'deposit' && item.moved_on?.startsWith(selectedMonth)).reduce((sum, item) => sum + Number(item.amount), 0)
  const availableEstimate = monthResult - savedThisMonth + movements.filter((item) => item.kind === 'withdrawal' && item.moved_on?.startsWith(selectedMonth)).reduce((sum, item) => sum + Number(item.amount), 0)
  const monthBudgetUsage = budgets.map((budget) => ({ ...budget, spent: monthEntries.filter((item) => item.kind === 'expense' && item.category === budget.category).reduce((sum, item) => sum + Number(item.amount), 0) }))
  const priorMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${selectedMonth}-15T12:00:00`); date.setMonth(date.getMonth() - (5 - index))
    const key = monthOf(date)
    const records = entries.filter((item) => (item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on))?.startsWith(key))
    return { key, income: records.filter((item) => item.kind === 'income').reduce((sum, item) => sum + Number(item.amount), 0), expenses: records.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + Number(item.amount), 0) }
  })
  const categoryTotals = monthEntries.filter((item) => item.kind === 'expense').reduce((grouped, item) => {
    grouped[item.category] = (grouped[item.category] || 0) + Number(item.amount)
    return grouped
  }, {})
  const categories = Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const maxCategory = Math.max(...categories.map((item) => item.value), 1)
  const doughnut = categories.reduce((state, item, index) => {
    const start = state.offset
    const end = start + (item.value / (monthOutgo || 1)) * 100
    state.parts.push(`${chartColors[index % chartColors.length]} ${start}% ${end}%`)
    state.offset = end
    return state
  }, { offset: 0, parts: [] }).parts.join(', ')
  const monthCards = cards.map((card) => {
    const cardInvoices = entries.filter((item) => item.kind === 'expense' && item.card_id === card.id && item.invoice_month?.startsWith(selectedMonth))
    const unpaidPurchases = entries.filter((item) => item.kind === 'expense' && item.card_id === card.id && item.status === 'pending')
    const invoicePaid = cardInvoices.length > 0 && cardInvoices.every((item) => item.status === 'settled')
    const invoicePaidOn = invoicePaid ? cardInvoices.map((item) => item.settled_on).filter(Boolean).sort().at(-1) || null : null
    return {
      ...card,
      invoiceTotal: cardInvoices.reduce((sum, item) => sum + Number(item.amount), 0),
      invoiceEntries: cardInvoices,
      invoicePaid,
      invoicePaidOn,
      outstandingTotal: unpaidPurchases.reduce((sum, item) => sum + Number(item.amount), 0),
      availableCalculated: card.credit_limit == null ? null : Number(card.credit_limit) - unpaidPurchases.reduce((sum, item) => sum + Number(item.amount), 0),
      pendingCount: cardInvoices.filter((item) => item.status === 'pending').length,
    }
  })
  const sortedMonthEntries = [...monthEntries].sort((a, b) => (a.status === 'pending' ? a.due_date : (a.settled_on || a.spent_on)).localeCompare(b.status === 'pending' ? b.due_date : (b.settled_on || b.spent_on)))
  const filteredMonthEntries = sortedMonthEntries.filter((item) => {
    const query = entryFilters.search.trim().toLocaleLowerCase('pt-BR')
    const searchable = [item.description, item.category, paymentLabel(item), item.amount].join(' ').toLocaleLowerCase('pt-BR')
    return (!query || searchable.includes(query)) && (entryFilters.kind === 'all' || item.kind === entryFilters.kind) && (entryFilters.status === 'all' || item.status === entryFilters.status) && (entryFilters.category === 'all' || item.category === entryFilters.category) && (entryFilters.payment === 'all' || item.payment_method === entryFilters.payment)
  })
  const potBalances = pots.map((pot) => ({ ...pot, balance: Number(pot.opening_balance) + movements.filter((item) => item.pot_id === pot.id).reduce((sum, item) => sum + (item.kind === 'deposit' ? Number(item.amount) : -Number(item.amount)), 0) }))
  const monthMovements = movements.filter((item) => item.moved_on?.startsWith(selectedMonth))
  const monthDeposits = monthMovements.filter((item) => item.kind === 'deposit').reduce((sum, item) => sum + Number(item.amount), 0)
  const monthWithdrawals = monthMovements.filter((item) => item.kind === 'withdrawal').reduce((sum, item) => sum + Number(item.amount), 0)
  const cashflowByDate = monthEntries.reduce((grouped, item) => {
    const date = item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on)
    if (!date) return grouped
    grouped[date] ||= { date, income: 0, expenses: 0, entries: [] }
    grouped[date][item.kind === 'income' ? 'income' : 'expenses'] += Number(item.amount)
    grouped[date].entries.push(item)
    return grouped
  }, {})
  let runningCashflow = 0
  const cashflowRows = Object.values(cashflowByDate).sort((a, b) => a.date.localeCompare(b.date)).map((row) => {
    runningCashflow += row.income - row.expenses
    return { ...row, net: row.income - row.expenses, running: runningCashflow }
  })
  const activeRecurringRules = recurringRules.filter((rule) => rule.active && rule.starts_on?.slice(0, 7) <= selectedMonth && (!rule.ends_on || rule.ends_on.slice(0, 7) >= selectedMonth))
  const recurringExpensesTotal = activeRecurringRules.filter((rule) => rule.kind === 'expense').reduce((sum, rule) => sum + Number(rule.amount), 0)
  const recurringIncomeTotal = activeRecurringRules.filter((rule) => rule.kind === 'income').reduce((sum, rule) => sum + Number(rule.amount), 0)
  const savingsGoals = potBalances.filter((pot) => Number(pot.goal_amount) > 0)
  const totalGoalAmount = savingsGoals.reduce((sum, pot) => sum + Number(pot.goal_amount), 0)
  const totalGoalSaved = savingsGoals.reduce((sum, pot) => sum + Math.min(pot.balance, Number(pot.goal_amount)), 0)
  const totalGoalRemaining = savingsGoals.reduce((sum, pot) => sum + Math.max(0, Number(pot.goal_amount) - pot.balance), 0)

  if (loading) return <main className="center-screen">Carregando…</main>
  if (!configured) return <SetupScreen />
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={handleAuth} message={message} />

  return <div className={`app-shell ${hideValues ? 'values-hidden' : ''}`}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="brand"><span className="brand-mark"><Wallet size={19} /></span><span>meu<span className="brand-light">controle</span></span></div>
      <div className="sidebar-group-label">SEU DINHEIRO</div>
      <button className={`nav-item ${activePage === 'month' ? 'active' : ''}`} aria-current={activePage === 'month' ? 'page' : undefined} onClick={() => setActivePage('month')}><LayoutDashboard size={17} /> Visão mensal</button>
      <button className={`nav-item ${activePage === 'year' ? 'active' : ''}`} aria-current={activePage === 'year' ? 'page' : undefined} onClick={() => setActivePage('year')}><ChartNoAxesCombined size={17} /> Visão anual</button>
      <button className={`nav-item ${activePage === 'categories' ? 'active' : ''}`} aria-current={activePage === 'categories' ? 'page' : undefined} onClick={() => setActivePage('categories')}><Tags size={17} /> Categorias</button>
      <button className={`nav-item ${activePage === 'cards' ? 'active' : ''}`} aria-current={activePage === 'cards' ? 'page' : undefined} onClick={() => setActivePage('cards')}><CreditCard size={17} /> Cartões e faturas</button>
      <button className={`nav-item ${activePage === 'savings' ? 'active' : ''}`} aria-current={activePage === 'savings' ? 'page' : undefined} onClick={() => setActivePage('savings')}><PiggyBank size={17} /> Cofrinhos</button>
      <button className={`nav-item ${activePage === 'recurring' ? 'active' : ''}`} aria-current={activePage === 'recurring' ? 'page' : undefined} onClick={() => setActivePage('recurring')}><Repeat size={17} /> Recorrências</button>
      <div className="sidebar-tip"><div className="tip-icon"><CalendarDays size={17} /></div><b>Seu mês, sob controle</b><span>Planeje o que vai entrar e o que precisa sair.</span></div>
      <div className="sidebar-user"><span className="user-avatar">{session.user.email?.[0]?.toUpperCase()}</span><span className="user-email">{session.user.email}</span><button className="icon-button" aria-label="Sair da conta" title="Sair" onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button></div>
    </aside>

    <main className="main-content" id="main-content" tabIndex="-1">
      <header className="page-header">
        <div><p className="eyebrow">CONTROLE FINANCEIRO</p><h1>{activePage === 'month' ? 'Visão mensal' : activePage === 'year' ? 'Visão anual' : activePage === 'categories' ? 'Categorias' : activePage === 'cards' ? 'Cartões e faturas' : activePage === 'savings' ? 'Cofrinhos' : 'Recorrências'}</h1><p className="page-subtitle">{activePage === 'month' ? 'Acompanhe o que entra, o que sai e o que ainda está pendente.' : activePage === 'year' ? 'Compare suas entradas e despesas mês a mês.' : activePage === 'categories' ? 'Organize seus lançamentos com categorias próprias.' : activePage === 'cards' ? 'Gerencie seus cartões e acompanhe cada fatura.' : activePage === 'savings' ? 'Acompanhe o dinheiro que você separou para guardar.' : 'Automatize o registro mensal das contas e receitas fixas.'}</p></div>
        <div className="header-actions">
          <button className="icon-button privacy-toggle" type="button" aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={hideValues} title={hideValues ? 'Mostrar valores' : 'Ocultar valores'} onClick={() => setHideValues((hidden) => !hidden)}>{hideValues ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
          {activePage === 'year' ? <YearPicker value={selectedYear} onChange={setSelectedYear}/> : <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />}
          {activePage === 'month' && <button className="button primary" onClick={openNewEntry}><Plus size={17} /> Novo lançamento</button>}
          {activePage === 'cards' && <button className="button primary" onClick={openNewCard}><Plus size={17} /> Novo cartão</button>}
          {activePage === 'savings' && <button className="button primary" onClick={openNewPot}><Plus size={17} /> Novo cofrinho</button>}
          {activePage === 'recurring' && <button className="button primary" onClick={openNewRecurring}><Plus size={17} /> Nova recorrência</button>}
          {activePage === 'categories' && <button className="button primary" onClick={() => setCategoryForm({ kind: 'expense', name: '' })}><Plus size={17} /> Nova categoria</button>}
        </div>
      </header>

      {message && <div className="notice" role="status" aria-live="polite">{message}<button onClick={() => setMessage('')}><X size={15} /></button></div>}

      {activePage === 'month' ? <>
        <section className="panel reminder-strip" aria-labelledby="due-alert-title"><div><Bell size={18}/><span><b id="due-alert-title">Alertas de vencimento</b><small>{overdueEntries.length ? `${overdueEntries.length} conta${overdueEntries.length === 1 ? '' : 's'} atrasada${overdueEntries.length === 1 ? '' : 's'}. ` : ''}{dueInSevenDays.length ? `${dueInSevenDays.length} vencem nos próximos 7 dias.` : 'Nenhuma conta vence nos próximos 7 dias.'} Configure também o aviso automático por e-mail.</small></span></div><button className="button subtle" onClick={()=>setReminderModal(true)}>{reminderSettings.enabled?'Configurar':'Ativar e-mail'}</button>{(overdueEntries.length || dueInSevenDays.length) ? <div className="due-alert-list">{[...overdueEntries, ...dueInSevenDays].slice(0,4).map(item=><div className="due-alert-item" key={item.id}><span className={item.due_date < todayKey ? 'overdue-label' : ''}>{item.due_date < todayKey ? 'Atrasada' : `Vence ${fmtDate(item.due_date)}`}</span><b>{item.description}</b><strong>{brl(item.amount)}</strong><button className="button subtle" aria-label={item.kind === 'income' ? `Marcar ${item.description} como recebida` : `Marcar ${item.description} como paga`} onClick={()=>settleEntry(item)}>{item.kind === 'income' ? 'Recebi' : 'Paguei'}</button></div>)}</div> : null}</section>
        <section className="month-hero">
          <div className="hero-copy"><span className="hero-kicker">RESULTADO PREVISTO DE {monthName(selectedMonth).toLocaleUpperCase('pt-BR')}</span><strong className={monthResult < 0 ? 'negative' : ''}>{brl(monthResult)}</strong><span className="hero-caption">Entradas previstas menos saídas previstas no mês</span></div>
          <div className="hero-breakdown"><div><span><i className="dot income-dot" /> Entradas previstas</span><b>{brl(monthIncome)}</b></div><div><span><i className="dot expense-dot" /> Saídas previstas</span><b>{brl(monthOutgo)}</b></div></div>
          <div className="hero-mark"><Wallet size={22} /></div>
        </section>

        <section className="stats-grid">
          <SummaryCard label="Sobra estimada" value={brl(availableEstimate)} detail="Resultado do mês menos depósitos nos cofrinhos" icon={<Wallet size={17} />} tone={availableEstimate < 0 ? 'orange' : 'green'} />
          <SummaryCard label="A pagar" value={brl(pendingPayables.reduce((sum, item) => sum + Number(item.amount), 0))} detail={`${pendingPayables.length} conta${pendingPayables.length === 1 ? '' : 's'} pendente${pendingPayables.length === 1 ? '' : 's'}`} icon={<ArrowUpRight size={17} />} tone="orange" />
          <SummaryCard label="A receber" value={brl(pendingReceivables.reduce((sum, item) => sum + Number(item.amount), 0))} detail={`${pendingReceivables.length} recebimento${pendingReceivables.length === 1 ? '' : 's'} pendente${pendingReceivables.length === 1 ? '' : 's'}`} icon={<ArrowDownLeft size={17} />} tone="green" />
          <SummaryCard label="Despesas realizadas" value={brl(monthEntries.filter((item) => item.kind === 'expense' && item.status === 'settled').reduce((sum, item) => sum + Number(item.amount), 0))} detail="Pagas ou registradas" icon={<ReceiptText size={17} />} tone="blue" />
          <SummaryCard label="Receitas recebidas" value={brl(monthEntries.filter((item) => item.kind === 'income' && item.status === 'settled').reduce((sum, item) => sum + Number(item.amount), 0))} detail="Recebidas neste mês" icon={<Banknote size={17} />} tone="purple" />
        </section>

        <section className="dashboard-grid planning-grid">
          <article className="panel"><PanelHeading title="Orçamento por categoria" subtitle={`Limites de ${monthName(selectedMonth)}`} action={<button className="button subtle" onClick={() => { setBudgetForm({ category: 'Alimentação', amount: '' }); setBudgetModal(true) }}><Plus size={14}/> Definir limite</button>}/>
            {monthBudgetUsage.length ? <div className="budget-list">{monthBudgetUsage.map((item) => { const pct = Math.min(100, item.spent / Number(item.amount) * 100); return <div className="budget-row" key={item.id}><div><b>{item.category}</b><span>{brl(item.spent)} de {brl(item.amount)}</span><button className="icon-button danger" aria-label={`Remover limite de ${item.category}`} title="Remover limite" onClick={() => deleteBudget(item)}><X size={14}/></button></div><i className={pct >= 100 ? 'over' : pct >= 80 ? 'near' : ''}><span style={{ width: `${pct}%` }}/></i><small>{item.spent >= Number(item.amount) ? `Ultrapassou em ${brl(item.spent - Number(item.amount))}` : `Restam ${brl(Number(item.amount) - item.spent)}`}</small></div> })}</div> : <EmptyState title="Sem limites definidos" text="Defina um teto mensal por categoria para comparar o planejado com o gasto registrado." action={<button className="button subtle" onClick={() => { setBudgetForm({ category: 'Alimentação', amount: '' }); setBudgetModal(true) }}><Target size={14}/> Criar primeiro limite</button>}/>}</article>
          <article className="panel"><PanelHeading title="Últimos 6 meses" subtitle="Entradas e despesas por mês"/><div className="compare-chart">{priorMonths.map((item) => { const max = Math.max(...priorMonths.flatMap((month) => [month.income, month.expenses]), 1); return <div className="compare-month" key={item.key}><div className="compare-bars"><i className="income-bar" title={`Entradas ${brl(item.income)}`} style={{height:`${Math.max(item.income ? 4 : 0, item.income / max * 100)}%`}}/><i className="expense-bar" title={`Despesas ${brl(item.expenses)}`} style={{height:`${Math.max(item.expenses ? 4 : 0, item.expenses / max * 100)}%`}}/></div><span>{monthName(item.key,{month:'short'}).replace('.','')}</span><small>{brl(item.income-item.expenses)}</small></div> })}</div><div className="compare-legend"><span><i className="income-bar"/> Entradas</span><span><i className="expense-bar"/> Despesas</span></div></article>
        </section>

        <section className="panel cashflow-panel" aria-label="Fluxo de caixa do mês">
          <PanelHeading title="Fluxo de caixa do mês" subtitle="Variação acumulada das entradas e saídas registradas, por data." action={<span className="count-pill">{cashflowRows.length} dias com lançamentos</span>} />
          {cashflowRows.length ? <div className="cashflow-table-wrap"><table className="cashflow-table"><thead><tr><th scope="col">Data</th><th scope="col">Entradas</th><th scope="col">Saídas</th><th scope="col">Variação do dia</th><th scope="col">Acumulado no mês</th><th scope="col">Ações</th></tr></thead><tbody>{cashflowRows.map(row=><tr key={row.date}><th scope="row">{fmtDate(row.date)}</th><td className="income-text">{row.income ? `+ ${brl(row.income)}` : '—'}</td><td>{row.expenses ? `− ${brl(row.expenses)}` : '—'}</td><td className={row.net >= 0 ? 'income-text' : 'withdrawal-text'}>{row.net >= 0 ? '+' : '−'} {brl(Math.abs(row.net))}</td><td className={row.running >= 0 ? 'income-text' : 'withdrawal-text'}>{brl(row.running)}</td><td><div className="row-actions">{row.entries.filter(item=>item.status==='pending').map(item=><button className="icon-button settle-icon" key={item.id} aria-label={item.kind === 'income' ? `Marcar ${item.description} como recebida` : `Marcar ${item.description} como paga`} title={item.kind === 'income' ? 'Marcar como recebida' : 'Marcar como paga'} onClick={()=>settleEntry(item)}><Check size={15}/></button>)}</div></td></tr>)}</tbody></table></div> : <EmptyState title="Sem movimentações previstas" text="Adicione contas ou receitas para acompanhar a evolução do saldo neste mês." action={<button className="button subtle" onClick={openNewEntry}><Plus size={15}/> Registrar lançamento</button>} />}
        </section>

        <section className="dashboard-grid">
          <article className="panel category-panel">
            <PanelHeading title="Despesas por categoria" subtitle="Onde está indo o dinheiro neste mês" />
            {categories.length ? <div className="category-content"><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(${doughnut})` }}><div className="donut-hole"><span>Total de despesas</span><b>{brl(monthOutgo)}</b></div></div></div><div className="category-list">{categories.slice(0, 6).map((item, index) => <div className="category-item" key={item.name}><div className="category-label"><i style={{ background: chartColors[index % chartColors.length] }} /><span>{item.name}</span><b>{brl(item.value)}</b></div><div className="category-track"><span style={{ width: `${Math.max(5, item.value / maxCategory * 100)}%`, background: chartColors[index % chartColors.length] }} /></div></div>)}</div></div> : <EmptyState title="Sem despesas neste mês" text="Registre uma conta ou gasto para ver o resumo por categoria." />}
          </article>

          <article className="panel agenda-panel">
            <PanelHeading title="Próximos compromissos" subtitle="Contas a pagar e valores a receber" action={<span className="count-pill">{pendingPayables.length + pendingReceivables.length} pendentes</span>} />
            {pendingPayables.length + pendingReceivables.length ? <div className="agenda-list">{[...pendingPayables, ...pendingReceivables].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6).map((item) => <div className="agenda-row" key={item.id}><div className={`agenda-icon ${item.kind}`}><CalendarDays size={16} /></div><div className="agenda-description"><b>{item.description}</b><span>{item.kind === 'income' ? 'A receber' : 'A pagar'} · vence {fmtDate(item.due_date)}</span></div><strong className={item.kind === 'income' ? 'income-text' : ''}>{item.kind === 'income' ? '+' : '−'}{brl(item.amount)}</strong><button className="icon-button settle-icon" aria-label={item.kind === 'income' ? `Marcar ${item.description} como recebida` : `Marcar ${item.description} como paga`} title={item.kind === 'income' ? 'Marcar como recebido' : 'Marcar como pago'} onClick={() => settleEntry(item)}><Check size={16} /></button></div>)}</div> : <EmptyState title="Tudo em dia por aqui" text="Não há contas pendentes para este mês." action={<button className="button subtle" onClick={openNewEntry}><Plus size={15} /> Registrar conta</button>} />}
          </article>
        </section>

        <section className="panel entries-panel">
          <PanelHeading title="Lançamentos do mês" subtitle={`${filteredMonthEntries.length} de ${sortedMonthEntries.length} registros em ${monthName(selectedMonth)}`} action={<button className="button subtle" onClick={openNewEntry}><Plus size={15} /> Adicionar</button>} />
          <EntryFilters value={entryFilters} onChange={setEntryFilters} categories={allCategories} />
          {filteredMonthEntries.length ? <EntryTable entries={filteredMonthEntries} onEdit={openEditEntry} onDelete={deleteEntry} onSettle={settleEntry} /> : <EmptyState title={sortedMonthEntries.length ? 'Nenhum resultado para estes filtros' : 'Este mês ainda está vazio'} text={sortedMonthEntries.length ? 'Tente mudar a busca ou os filtros.' : 'Adicione suas contas a pagar, valores a receber ou gastos do dia a dia.'} action={!sortedMonthEntries.length && <button className="button primary" onClick={openNewEntry}><Plus size={15} /> Criar lançamento</button>} />}
        </section>
      </> : activePage === 'year' ? <>
        {(() => { const rows = Array.from({length:12},(_,i)=>{const key=`${selectedYear}-${String(i+1).padStart(2,'0')}`;const list=entries.filter(item=>(item.status==='pending'?item.due_date:(item.settled_on||item.spent_on))?.startsWith(key));return {key,income:list.filter(x=>x.kind==='income').reduce((a,x)=>a+Number(x.amount),0),expense:list.filter(x=>x.kind==='expense').reduce((a,x)=>a+Number(x.amount),0)}});const max=Math.max(...rows.flatMap(x=>[x.income,x.expense]),1);return <><section className="stats-grid"><SummaryCard label="Entradas no ano" value={brl(rows.reduce((a,x)=>a+x.income,0))} detail={`Receitas registradas em ${selectedYear}`} icon={<ArrowDownLeft size={17}/>} tone="purple"/><SummaryCard label="Despesas no ano" value={brl(rows.reduce((a,x)=>a+x.expense,0))} detail={`Despesas registradas em ${selectedYear}`} icon={<ArrowUpRight size={17}/>} tone="blue"/><SummaryCard label="Resultado anual" value={brl(rows.reduce((a,x)=>a+x.income-x.expense,0))} detail="Entradas menos despesas" icon={<Wallet size={17}/>} tone="green"/></section><section className="panel annual-panel"><PanelHeading title={`Resumo de ${selectedYear}`} subtitle="Selecione um mês para abrir seus detalhes e lançamentos."/><div className="annual-grid">{rows.map(row=><button className="annual-month" key={row.key} onClick={()=>{setSelectedMonth(row.key);setActivePage('month')}}><b>{monthName(row.key,{month:'long'})}</b><div className="annual-bars"><i className="income-bar" style={{height:`${Math.max(row.income?4:0,row.income/max*100)}%`}}/><i className="expense-bar" style={{height:`${Math.max(row.expense?4:0,row.expense/max*100)}%`}}/></div><span>Entradas {brl(row.income)}</span><span>Despesas {brl(row.expense)}</span><strong>{brl(row.income-row.expense)}</strong></button>)}</div></section></>})()}
      </> : activePage === 'cards' ? <>
        <section className="card-intro"><div><span className="eyebrow">ACOMPANHAMENTO DO MÊS</span><h2>Faturas de {monthName(selectedMonth)}</h2><p>Veja as compras lançadas em cada cartão e os dias de fechamento e vencimento.</p></div><div className="card-intro-total"><span>Total nas faturas</span><strong>{brl(monthCards.reduce((sum, item) => sum + item.invoiceTotal, 0))}</strong></div></section>
        {cards.length ? <section className="managed-card-grid">{monthCards.map((item, index) => <article className="managed-card" key={item.id}><div className={`bank-card bank-card-${index % 4}`}><div className="bank-card-top"><span>MEU CONTROLE</span><CreditCard size={20} /></div><div className="bank-card-chip" /><b>{item.name}</b><div className="bank-card-footer"><span>FECHAMENTO <strong>{String(item.closing_day).padStart(2, '0')}</strong></span><span>VENCIMENTO <strong>{String(item.due_day).padStart(2, '0')}</strong></span></div></div><div className="managed-card-body"><div><span>Fatura de {monthName(selectedMonth, { month: 'long' })}</span><strong>{brl(item.invoiceTotal)}</strong></div><div className="invoice-status-row">{item.invoiceEntries.length ? <><span className={`status-pill ${item.invoicePaid ? 'settled' : 'pending'}`}>{item.invoicePaid ? 'Fatura paga' : 'Em aberto'}</span>{item.invoicePaidOn && <small>em {fmtDate(item.invoicePaidOn)}</small>}<button className={`button ${item.invoicePaid ? 'subtle' : 'primary'}`} onClick={() => toggleInvoicePaid(item)}>{item.invoicePaid ? 'Reabrir fatura' : 'Marcar fatura paga'}</button></> : <span className="invoice-empty-label">Sem compras neste mês</span>}</div><div className="card-limit-row"><div><span>Limite total</span><strong>{item.credit_limit == null ? '—' : brl(item.credit_limit)}</strong></div><div><span>Disponível agora</span><strong>{item.availableCalculated == null ? '—' : brl(item.availableCalculated)}</strong><small className="limit-explanation">Limite total menos compras pendentes</small></div></div><p>{item.pendingCount} compra{item.pendingCount === 1 ? '' : 's'} ainda pendente{item.pendingCount === 1 ? '' : 's'}</p><div className="card-actions"><button className="button subtle" onClick={() => openEditCard(item)}><Pencil size={14} /> Editar cartão</button><button className="icon-button danger" aria-label={`Excluir cartão ${item.name}`} title="Excluir cartão" onClick={() => deleteCard(item)}><Trash2 size={16} /></button></div></div></article>)}</section> : <section className="panel card-empty"><EmptyState title="Cadastre seu primeiro cartão" text="Depois você poderá acompanhar o total das compras por mês e a data de cada fatura." action={<button className="button primary" onClick={openNewCard}><Plus size={15} /> Cadastrar cartão</button>} /></section>}
        <section className="panel entries-panel"><PanelHeading title="Compras nos cartões" subtitle={`Lançamentos associados à fatura de ${monthName(selectedMonth)}`} /><EntryTable entries={entries.filter((item) => item.kind === 'expense' && item.card_id && item.invoice_month?.startsWith(selectedMonth)).sort((a, b) => a.spent_on.localeCompare(b.spent_on))} onEdit={openEditEntry} onDelete={deleteEntry} onSettle={settleEntry} emptyText="Não há compras lançadas para as faturas deste mês." /></section>
      </> : activePage === 'savings' ? <>
        {savingsGoals.length > 0 && <section className="panel goal-summary-panel"><PanelHeading title="Resumo das metas" subtitle={`${savingsGoals.length} cofrinho${savingsGoals.length === 1 ? '' : 's'} com objetivo definido`}/><div className="goal-summary-grid"><div><span>Guardado para as metas</span><strong>{brl(totalGoalSaved)}</strong></div><div><span>Falta para alcançar</span><strong>{brl(totalGoalRemaining)}</strong></div><div><span>Valor total das metas</span><strong>{brl(totalGoalAmount)}</strong></div><div className="goal-summary-progress"><div><span>Progresso geral</span><b>{Math.round(totalGoalAmount ? totalGoalSaved / totalGoalAmount * 100 : 0)}%</b></div><i role="progressbar" aria-label="Progresso geral das metas" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(totalGoalAmount ? totalGoalSaved / totalGoalAmount * 100 : 0)}><span style={{width:`${Math.min(100,totalGoalAmount ? totalGoalSaved / totalGoalAmount * 100 : 0)}%`}}/></i></div></div></section>}
        <section className="savings-hero"><div><span className="hero-kicker">TOTAL GUARDADO</span><strong>{brl(potBalances.reduce((sum, pot) => sum + pot.balance, 0))}</strong><span className="hero-caption">Saldo somado dos seus cofrinhos</span></div><div className="savings-month"><span>Movimentações em {monthName(selectedMonth)}</span><b className="income-text">+ {brl(monthDeposits)} guardados</b><b className="withdrawal-text">− {brl(monthWithdrawals)} retirados</b></div><PiggyBank className="savings-hero-icon" size={35} /></section>
        <section className="panel savings-note"><PiggyBank size={18}/><span>Os valores dos cofrinhos são um acompanhamento manual separado das despesas. Assim, guardar dinheiro não aparece como um novo gasto no seu orçamento.</span></section>
        {potBalances.length ? <section className="savings-pot-grid">{potBalances.map((pot) => { const progress = pot.goal_amount ? Math.min(100, pot.balance / Number(pot.goal_amount) * 100) : null; return <article className="panel savings-pot" key={pot.id}><div className="pot-title"><span className="pot-icon"><PiggyBank size={19}/></span><div><h2>{pot.name}</h2><span>{pot.goal_amount ? `Meta: ${brl(pot.goal_amount)}` : 'Sem meta definida'}</span></div><div className="row-actions"><button className="icon-button" aria-label={`Editar cofrinho ${pot.name}`} title="Editar cofrinho" onClick={() => openEditPot(pot)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`Excluir cofrinho ${pot.name}`} title="Excluir cofrinho" onClick={() => deletePot(pot)}><Trash2 size={15}/></button></div></div><strong className="pot-balance">{brl(pot.balance)}</strong>{pot.goal_due_date && pot.goal_amount && <div className="goal-suggestion">{(() => { const remaining=Math.max(0,Number(pot.goal_amount)-pot.balance); const today=new Date(); const due=new Date(`${pot.goal_due_date}T12:00:00`); const months=Math.max(1,(due.getFullYear()-today.getFullYear())*12+due.getMonth()-today.getMonth()+1); return remaining===0?'Meta alcançada!':`Para chegar até ${fmtDate(pot.goal_due_date)}, guarde cerca de ${brl(remaining/months)} por mês.` })()}</div>}{progress !== null && <div className="pot-progress"><div><span>Progresso da meta</span><b>{Math.round(progress)}%</b></div><i><span style={{width:`${progress}%`}}/></i></div>}<div className="pot-actions"><button className="button subtle" onClick={() => openMovement(pot, 'deposit')}><ArrowDownLeft size={15}/> Guardar</button><button className="button subtle" onClick={() => openMovement(pot, 'withdrawal')}><ArrowUpRight size={15}/> Retirar</button></div></article> })}</section> : <section className="panel"><EmptyState title="Crie seu primeiro cofrinho" text="Pode ser sua reserva, uma viagem ou o saldo que quer manter guardado. Você informa o saldo inicial e registra entradas e retiradas." action={<button className="button primary" onClick={openNewPot}><Plus size={15}/> Criar cofrinho</button>}/></section>}
        <section className="panel entries-panel"><PanelHeading title="Movimentações do mês" subtitle={`Entradas e retiradas em ${monthName(selectedMonth)}`}/>{monthMovements.length ? <div className="table-wrap"><table className="entry-table"><thead><tr><th>Cofrinho</th><th>Tipo</th><th>Data</th><th>Observação</th><th className="align-right">Valor</th><th/></tr></thead><tbody>{[...monthMovements].sort((a,b)=>b.moved_on.localeCompare(a.moved_on)).map((item)=><tr key={item.id}><td>{pots.find(p=>p.id===item.pot_id)?.name || 'Cofrinho'}</td><td>{item.kind==='deposit'?'Guardado':'Retirado'}</td><td>{fmtDate(item.moved_on)}</td><td>{item.note || '—'}</td><td className={`align-right amount ${item.kind==='deposit'?'income-text':'withdrawal-text'}`}>{item.kind==='deposit'?'+':'−'} {brl(item.amount)}</td><td><button className="icon-button danger" aria-label={`Excluir movimentação de ${brl(item.amount)}`} title="Excluir movimentação" onClick={()=>deleteMovement(item)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div> : <EmptyState title="Sem movimentações neste mês" text="As movimentações que você registrar nos cofrinhos aparecerão aqui."/>}</section>
      </> : activePage === 'categories' ? <>
        <section className="panel categories-manager"><PanelHeading title="Categorias personalizadas" subtitle="Categorias removidas não apagam lançamentos antigos."/><form className="category-add" onSubmit={async(e)=>{e.preventDefault();const {error}=await supabase.from('user_categories').insert({kind:categoryForm.kind,name:categoryForm.name.trim()});if(error)setMessage(error.message);else{setCategoryForm({kind:'expense',name:''});await loadData()}}}><select value={categoryForm.kind} onChange={e=>setCategoryForm({...categoryForm,kind:e.target.value})}><option value="expense">Despesa</option><option value="income">Receita</option></select><input required maxLength="40" placeholder="Nome da categoria" value={categoryForm.name} onChange={e=>setCategoryForm({...categoryForm,name:e.target.value})}/><button className="button primary"><Plus size={15}/> Adicionar</button></form><div className="custom-category-list">{['expense','income'].map(kind=><div key={kind}><h3>{kind==='expense'?'Despesas':'Receitas'}</h3>{userCategories.filter(c=>c.kind===kind).length?userCategories.filter(c=>c.kind===kind).map(c=><div className="custom-category-row" key={c.id}><span>{c.name}</span><button className="icon-button danger" aria-label={`Excluir categoria ${c.name}`} title="Excluir categoria" onClick={()=>requestConfirmation({title:'Excluir categoria?',message:`Excluir a categoria “${c.name}”?`,details:'Os lançamentos antigos que usam essa categoria serão mantidos.',confirmLabel:'Excluir categoria',onConfirm:async()=>{setUserCategories(current=>current.filter(category=>category.id!==c.id));const {error}=await supabase.from('user_categories').delete().eq('id',c.id);if(error)setMessage(error.message);await loadData()}})}><Trash2 size={15}/></button></div>):<p>Nenhuma categoria personalizada.</p>}</div>)}</div></section>
      </> : <>
        <section className="stats-grid recurring-summary"><SummaryCard label="Regras ativas" value={String(activeRecurringRules.length)} detail={`${recurringRules.length - activeRecurringRules.length} pausada${recurringRules.length - activeRecurringRules.length === 1 ? '' : 's'}`} icon={<Repeat size={17}/>} tone="purple"/><SummaryCard label="Despesas fixas / mês" value={brl(recurringExpensesTotal)} detail="Contas geradas pelas regras ativas" icon={<ArrowUpRight size={17}/>} tone="blue"/><SummaryCard label="Receitas fixas / mês" value={brl(recurringIncomeTotal)} detail="Recebimentos gerados pelas regras ativas" icon={<ArrowDownLeft size={17}/>} tone="green"/><SummaryCard label="Saldo fixo previsto" value={brl(recurringIncomeTotal-recurringExpensesTotal)} detail="Receitas fixas menos despesas fixas" icon={<Wallet size={17}/>} tone={recurringIncomeTotal-recurringExpensesTotal < 0 ? 'orange' : 'purple'}/></section>
        <section className="panel recurring-intro"><Repeat size={20}/><div><b>Como funciona</b><span>As regras geram automaticamente uma conta ou receita pendente no mês selecionado. Ao trocar de mês, o sistema cria aquele mês uma única vez. Lançamentos já criados permanecem mesmo se você pausar ou excluir uma regra.</span></div></section>
        {recurringRules.length ? <section className="recurring-grid">{recurringRules.map((rule) => <article className={`panel recurring-card ${!rule.active?'inactive':''}`} key={rule.id}><div className="recurring-card-head"><span className={`agenda-icon ${rule.kind}`}><Repeat size={16}/></span><span className={`status-pill ${rule.active?'settled':'pending'}`}>{rule.active?'Ativa':'Pausada'}</span></div><h2>{rule.description}</h2><strong>{brl(rule.amount)} <small>/ mês</small></strong><p>{rule.kind==='income'?'Receita':'Despesa'} · dia {rule.day_of_month} · {rule.category}{rule.ends_on?` · até ${fmtDate(rule.ends_on)}`:''}</p><div className="card-actions"><button className="button subtle" onClick={()=>openEditRecurring(rule)}><Pencil size={14}/> Editar</button><button className="button subtle" onClick={()=>toggleRecurring(rule)}>{rule.active?'Pausar':'Ativar'}</button><button className="icon-button danger" aria-label={`Excluir recorrência ${rule.description}`} title="Excluir regra" onClick={()=>deleteRecurring(rule)}><Trash2 size={15}/></button></div></article>)}</section> : <section className="panel"><EmptyState title="Nenhuma recorrência cadastrada" text="Automatize aluguel, assinaturas, salário e outras contas ou receitas fixas." action={<button className="button primary" onClick={openNewRecurring}><Plus size={15}/> Criar recorrência</button>}/></section>}
      </>}
    </main>

    {entryModal && <EntryModal title={editingEntryId ? 'Editar lançamento' : 'Novo lançamento'} value={entryForm} cards={cards} customCategories={userCategories} onChange={setEntryForm} onClose={() => setEntryModal(false)} onSubmit={saveEntry} />}
    {cardModal && <CardModal title={editingCardId ? 'Editar cartão' : 'Cadastrar cartão'} value={cardForm} onChange={setCardForm} onClose={() => setCardModal(false)} onSubmit={saveCard} />}
    {invoiceConfirm && <InvoiceConfirmModal value={invoiceConfirm} month={selectedMonth} onClose={() => setInvoiceConfirm(null)} onConfirm={confirmInvoiceChange} />}
    {confirmation && <ConfirmationModal value={confirmation} onClose={() => setConfirmation(null)} onConfirm={runConfirmation} />}
    {potModal && <PotModal title={editingPotId ? 'Editar cofrinho' : 'Novo cofrinho'} value={potForm} onChange={setPotForm} onClose={() => setPotModal(false)} onSubmit={savePot} />}
    {movementModal && <MovementModal value={movementForm} pots={pots} onChange={setMovementForm} onClose={() => setMovementModal(false)} onSubmit={saveMovement} />}
    {budgetModal && <BudgetModal value={budgetForm} categories={allExpenseCategories} onChange={setBudgetForm} onClose={() => setBudgetModal(false)} onSubmit={saveBudget} />}
    {reminderModal && <ReminderModal value={reminderSettings} onChange={setReminderSettings} onClose={() => setReminderModal(false)} onSubmit={async(e)=>{e.preventDefault();const {error}=await supabase.from('reminder_settings').upsert({...reminderSettings,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)setMessage(error.message);else{setReminderModal(false);await loadData()}}} />}
    {recurringModal && <RecurringModal title={editingRecurringId ? 'Editar recorrência mensal' : 'Nova recorrência mensal'} submitLabel={editingRecurringId ? 'Salvar alterações' : 'Criar regra'} isEditing={Boolean(editingRecurringId)} value={recurringForm} cards={cards} customCategories={userCategories} onChange={setRecurringForm} onClose={() => { setRecurringModal(false); setEditingRecurringId(null) }} onSubmit={saveRecurring} />}
  </div>
}

function MonthPicker({ value, onChange }) {
  function shift(delta) {
    const date = new Date(`${value}-15T12:00:00`)
    date.setMonth(date.getMonth() + delta)
    onChange(monthOf(date))
  }
  return <div className="month-picker"><button className="icon-button" aria-label="Mês anterior" title="Mês anterior" onClick={() => shift(-1)}><ArrowLeft size={16} /></button><label><CalendarDays size={16} /><span>{monthName(value)}</span><ChevronDown size={14} /><input aria-label="Escolher mês" type="month" value={value} onChange={(event) => onChange(event.target.value)} /></label><button className="icon-button" aria-label="Próximo mês" title="Próximo mês" onClick={() => shift(1)}><ArrowRight size={16} /></button></div>
}

function SummaryCard({ label, value, detail, icon, tone }) {
  return <article className="summary-card"><div className="summary-top"><span>{label}</span><span className={`summary-icon ${tone}`}>{icon}</span></div><strong className="summary-value">{value}</strong><span className="summary-detail">{detail}</span></article>
}

function PanelHeading({ title, subtitle, action }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function EmptyState({ title, text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Wallet size={19} /></span><b>{title}</b><span>{text}</span>{action}</div>
}

function EntryTable({ entries, onEdit, onDelete, onSettle, emptyText = 'Não há lançamentos neste mês.' }) {
  if (!entries.length) return <EmptyState title="Nada para mostrar" text={emptyText} />
  return <div className="table-wrap"><table className="entry-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th>Data / vencimento</th><th>Situação</th><th className="align-right">Valor</th><th aria-label="Ações" /></tr></thead><tbody>{entries.map((item) => { const displayDate = item.card_id ? item.spent_on : item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on); return <tr key={item.id}><td><div className="entry-name"><span className={`entry-kind-icon ${item.kind}`} title={item.kind === 'income' ? 'Receita' : 'Despesa'}>{item.kind === 'income' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><span><b>{item.description}</b><small>{item.installment_number ? `Parcela ${item.installment_number} de ${item.installment_count}` : item.kind === 'income' ? 'Receita' : 'Despesa'}</small></span></div></td><td>{item.category}</td><td>{item.kind === 'income' ? '—' : paymentLabel(item)}</td><td>{fmtDate(displayDate)}</td><td><span className={`status-pill ${item.status}`}>{item.status === 'pending' ? 'Pendente' : item.kind === 'income' ? 'Recebida' : 'Paga'}</span></td><td className={`align-right amount ${item.kind === 'income' ? 'income-text' : ''}`}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount)}</td><td><div className="row-actions">{item.status === 'pending' && <button className="icon-button" aria-label={item.kind === 'income' ? `Marcar ${item.description} como recebida` : `Marcar ${item.description} como paga`} title={item.kind === 'income' ? 'Marcar recebida' : 'Marcar paga'} onClick={() => onSettle(item)}><Check size={15} /></button>}<button className="icon-button" aria-label={`Editar ${item.description}`} title="Editar" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`Excluir ${item.description}`} title="Excluir" onClick={() => onDelete(item)}><Trash2 size={15} /></button></div></td></tr> })}</tbody></table></div>
}

function EntryModal({ title, value, cards, customCategories = [], onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  const categories = [...(value.kind === 'income' ? incomeCategories : expenseCategories), ...customCategories.filter((item) => item.kind === value.kind).map((item) => item.name)]
  return <Modal title={title} onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Tipo de lançamento<select value={value.kind} onChange={(event) => onChange({ ...value, kind: event.target.value, category: (event.target.value === 'income' ? [...incomeCategories,...customCategories.filter(c=>c.kind==='income').map(c=>c.name)] : [...expenseCategories,...customCategories.filter(c=>c.kind==='expense').map(c=>c.name)])[0], payment_method: event.target.value === 'income' ? 'other' : 'pix', card_id: '' })}><option value="expense">Despesa / conta a pagar</option><option value="income">Receita / conta a receber</option></select></label>
    <label>Descrição<input required maxLength="100" value={value.description} onChange={(event) => set('description', event.target.value)} placeholder={value.kind === 'income' ? 'Ex.: salário' : 'Ex.: aluguel'} /></label>
    <div className="modal-form-two"><label>Valor<input type="number" min="0.01" step="0.01" required value={value.amount} onChange={(event) => set('amount', event.target.value)} placeholder="0,00" /></label><label>Categoria<select value={value.category} onChange={(event) => set('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
    <div className="modal-form-two"><label>Data do lançamento<input type="date" required value={value.spent_on} onChange={(event) => set('spent_on', event.target.value)} /></label><label>Vencimento / previsão<input type="date" required value={value.due_date} onChange={(event) => set('due_date', event.target.value)} /></label></div>
    <label>Situação<select value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value, settled_on: event.target.value === 'settled' ? (value.settled_on || value.spent_on) : '' })}><option value="pending">Pendente</option><option value="settled">Já paga / recebida</option></select></label>
    {value.kind === 'expense' && <label>Forma de pagamento<select value={value.payment_method || (value.card_id ? 'credit_card' : 'other')} onChange={(event) => onChange({ ...value, payment_method: event.target.value, card_id: event.target.value === 'credit_card' ? value.card_id : '' })}><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="debit_card">Cartão de débito</option><option value="credit_card">Cartão de crédito</option><option value="other">Outro</option></select></label>}
    {value.kind === 'expense' && value.payment_method === 'credit_card' && <label>Cartão de crédito<select required value={value.card_id} onChange={(event) => set('card_id', event.target.value)}><option value="">Escolha o cartão</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>}
    {value.kind === 'expense' && value.payment_method === 'credit_card' && value.card_id && <><label>Mês da primeira fatura<input type="month" required value={value.invoice_month} onChange={(event) => set('invoice_month', event.target.value)} /></label>{!title.startsWith('Editar') && <><label>Parcelas<select value={value.installment_count || '1'} onChange={event=>set('installment_count',event.target.value)}>{Array.from({length:24},(_,i)=>i+1).map(n=><option key={n} value={n}>{n===1?'À vista':`${n} parcelas`}</option>)}</select></label>{Number(value.installment_count)>1&&<p className="modal-help">O total será dividido entre as faturas mensais; as parcelas serão criadas como pendentes.</p>}</>}</>}
    {value.status === 'settled' && <label>Data de pagamento / recebimento<input type="date" value={value.settled_on || value.spent_on} onChange={(event) => set('settled_on', event.target.value)} /></label>}
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15} /> Salvar lançamento</button></div>
  </form></Modal>
}

function CardModal({ title, value, onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  return <Modal title={title} onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Nome do cartão<input required maxLength="60" value={value.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Cartão principal" /></label>
    <div className="modal-form-two"><label>Dia de fechamento<input type="number" min="1" max="31" required value={value.closing_day} onChange={(event) => set('closing_day', event.target.value)} /></label><label>Dia de vencimento<input type="number" min="1" max="31" required value={value.due_day} onChange={(event) => set('due_day', event.target.value)} /></label></div>
    <label>Limite total (opcional)<input type="number" min="0" step="0.01" value={value.credit_limit} onChange={(event) => set('credit_limit', event.target.value)} placeholder="Ex.: 5000,00" /></label>
    <p className="modal-help">O limite disponível será calculado automaticamente: limite total menos todas as compras de crédito ainda pendentes neste cartão. Marque as compras como pagas para liberar o limite no cálculo.</p>
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15} /> Salvar cartão</button></div>
  </form></Modal>
}

function PotModal({ title, value, onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  return <Modal title={title} onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Nome do cofrinho<input required maxLength="60" value={value.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Reserva de emergência" /></label>
    <div className="modal-form-two"><label>Saldo inicial<input type="number" min="0" step="0.01" required value={value.opening_balance} onChange={(event) => set('opening_balance', event.target.value)} /></label><label>Meta (opcional)<input type="number" min="0.01" step="0.01" value={value.goal_amount} onChange={(event) => set('goal_amount', event.target.value)} placeholder="Ex.: 5000,00" /></label></div>
    <label>Prazo da meta (opcional)<input type="date" value={value.goal_due_date || ''} onChange={event=>set('goal_due_date',event.target.value)}/></label><p className="modal-help">O saldo inicial é o valor que já está guardado hoje. Com uma meta e prazo, o cofrinho calcula quanto guardar por mês.</p>
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15} /> Salvar cofrinho</button></div>
  </form></Modal>
}

function MovementModal({ value, pots, onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  return <Modal title={value.kind === 'deposit' ? 'Guardar dinheiro' : 'Retirar dinheiro'} onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Cofrinho<select value={value.pot_id} onChange={(event) => set('pot_id', event.target.value)}>{pots.map((pot) => <option key={pot.id} value={pot.id}>{pot.name}</option>)}</select></label>
    <div className="modal-form-two"><label>Valor<input type="number" min="0.01" step="0.01" required value={value.amount} onChange={(event) => set('amount', event.target.value)} placeholder="0,00" /></label><label>Data<input type="date" required value={value.moved_on} onChange={(event) => set('moved_on', event.target.value)} /></label></div>
    <label>Observação (opcional)<input maxLength="120" value={value.note} onChange={(event) => set('note', event.target.value)} placeholder="Ex.: depósito do salário" /></label>
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15} /> Salvar movimentação</button></div>
  </form></Modal>
}

function BudgetModal({ value, categories, onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  return <Modal title="Definir limite mensal" onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Categoria<select value={value.category} onChange={(event) => set('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label>Limite para o mês<input type="number" min="0.01" step="0.01" required value={value.amount} onChange={(event) => set('amount', event.target.value)} placeholder="Ex.: 800,00" /></label>
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15}/> Salvar limite</button></div>
  </form></Modal>
}

function EntryFilters({ value, onChange, categories }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  const active = value.search || value.kind !== 'all' || value.status !== 'all' || value.category !== 'all' || value.payment !== 'all'
  return <div className="entry-filters"><label className="search-field"><Search size={16}/><input aria-label="Buscar por descrição, categoria, forma de pagamento ou valor" placeholder="Buscar lançamento" value={value.search} onChange={(event) => set('search', event.target.value)}/></label><label><SlidersHorizontal size={14}/><select aria-label="Filtrar por tipo" value={value.kind} onChange={(event) => set('kind', event.target.value)}><option value="all">Todos os tipos</option><option value="expense">Despesas</option><option value="income">Receitas</option></select></label><label><select aria-label="Filtrar por situação" value={value.status} onChange={(event) => set('status', event.target.value)}><option value="all">Todas as situações</option><option value="pending">Pendentes</option><option value="settled">Pagas / recebidas</option></select></label><label><select aria-label="Filtrar por categoria" value={value.category} onChange={(event) => set('category', event.target.value)}><option value="all">Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><select aria-label="Filtrar por forma de pagamento" value={value.payment} onChange={(event) => set('payment', event.target.value)}><option value="all">Todas as formas</option><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option><option value="other">Outro</option></select></label>{active && <button type="button" className="button subtle clear-filters" onClick={() => onChange({search:'',kind:'all',status:'all',category:'all',payment:'all'})}>Limpar filtros</button>}</div>
}

function RecurringModal({ title, submitLabel, isEditing, value, cards, customCategories = [], onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  const categories = [...(value.kind === 'income' ? incomeCategories : expenseCategories), ...customCategories.filter((item) => item.kind === value.kind).map((item) => item.name)]
  return <Modal title={title} onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Tipo<select value={value.kind} onChange={(event) => { const kind = event.target.value; onChange({ ...value, kind, category: (kind === 'income' ? [...incomeCategories,...customCategories.filter(c=>c.kind==='income').map(c=>c.name)] : [...expenseCategories,...customCategories.filter(c=>c.kind==='expense').map(c=>c.name)])[0], payment_method: kind === 'income' ? 'other' : 'pix', card_id: '' }) }}><option value="expense">Despesa / conta a pagar</option><option value="income">Receita / conta a receber</option></select></label>
    <label>Descrição<input required maxLength="100" value={value.description} onChange={(event) => set('description', event.target.value)} placeholder="Ex.: aluguel"/></label>
    <div className="modal-form-two"><label>Valor mensal<input type="number" min="0.01" step="0.01" required value={value.amount} onChange={(event) => set('amount', event.target.value)}/></label><label>Categoria<select value={value.category} onChange={(event) => set('category', event.target.value)}>{categories.map((item)=><option key={item}>{item}</option>)}</select></label></div>
    <div className="modal-form-two"><label>Dia do mês<input type="number" min="1" max="31" required value={value.day_of_month} onChange={(event) => set('day_of_month', event.target.value)}/></label><label>Começa em<input type="month" required value={value.starts_on.slice(0,7)} onChange={(event) => set('starts_on', monthStart(event.target.value))}/></label></div>
    {isEditing && <p className="modal-help">As alterações serão usadas nos próximos lançamentos gerados. Lançamentos que já existem permanecem como estão.</p>}
    <label>Último mês (opcional)<input type="month" value={value.ends_on?.slice(0,7) || ''} onChange={(event) => set('ends_on', event.target.value ? monthStart(event.target.value) : '')}/></label>
    {value.kind === 'expense' && <label>Forma de pagamento<select value={value.payment_method} onChange={(event) => set('payment_method', event.target.value)}><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="debit_card">Cartão de débito</option><option value="credit_card">Cartão de crédito</option><option value="other">Outro</option></select></label>}
    {value.kind === 'expense' && value.payment_method === 'credit_card' && <label>Cartão<select required value={value.card_id} onChange={(event) => set('card_id', event.target.value)}><option value="">Escolha o cartão</option>{cards.map((card)=><option key={card.id} value={card.id}>{card.name}</option>)}</select></label>}
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15}/> {submitLabel}</button></div>
  </form></Modal>
}

function Modal({ title, onClose, children }) {
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
  return <div className={`modal-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" title="Fechar" aria-label="Fechar modal" onClick={close}><X size={18} /></button></div>{children}</section></div>
}

function AuthScreen({ mode, setMode, email, setEmail, password, setPassword, onSubmit, message }) {
  return <main className="auth-screen"><section className="auth-card"><div className="brand"><span className="brand-mark"><Wallet size={19} /></span><span>meu<span className="brand-light">controle</span></span></div><p className="eyebrow">SEU ESPAÇO FINANCEIRO</p><h1>{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1><p className="auth-copy">Organize seu mês e acompanhe suas contas em um só lugar.</p><form onSubmit={onSubmit}><label>E-mail<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label><label>Senha<input type="password" required minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" /></label>{message && <div className="notice">{message}</div>}<button className="button primary auth-submit">{mode === 'login' ? 'Entrar' : 'Criar conta'}</button></form><p className="auth-toggle">{mode === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'} <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Criar conta' : 'Fazer login'}</button></p><p className="privacy-note">Cada conta acessa somente os próprios dados.</p></section></main>
}

function SetupScreen() {
  return <main className="auth-screen"><section className="auth-card setup-card"><div className="brand"><span className="brand-mark"><Wallet size={19} /></span><span>meu<span className="brand-light">controle</span></span></div><p className="eyebrow">CONFIGURAÇÃO INICIAL</p><h1>Conecte seu projeto Supabase</h1><p className="auth-copy">Configure as variáveis locais e aplique as migrações da pasta <code>supabase/migrations</code>.</p><p className="privacy-note">Use somente a chave publicável no frontend. Nunca coloque chaves secretas neste projeto.</p></section></main>
}

function YearPicker({value,onChange}) { return <div className="month-picker"><button className="icon-button" aria-label="Ano anterior" title="Ano anterior" onClick={()=>onChange(String(Number(value)-1))}><ArrowLeft size={16}/></button><label><CalendarDays size={16}/><span>{value}</span><ChevronDown size={14}/><select aria-label="Escolher ano" value={value} onChange={e=>onChange(e.target.value)}>{Array.from({length:11},(_,i)=>String(new Date().getFullYear()-5+i)).map(y=><option key={y}>{y}</option>)}</select></label><button className="icon-button" aria-label="Próximo ano" title="Próximo ano" onClick={()=>onChange(String(Number(value)+1))}><ArrowRight size={16}/></button></div> }
function ReminderModal({value,onChange,onClose,onSubmit}) { return <Modal title="Lembretes por e-mail" onClose={onClose}><form className="modal-form" onSubmit={onSubmit}><label className="check-label"><input type="checkbox" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/> Ativar lembretes automáticos de vencimento</label><label>Enviar quantos dias antes?<select value={value.days_before} onChange={e=>onChange({...value,days_before:Number(e.target.value)})}><option value="1">1 dia</option><option value="2">2 dias</option><option value="3">3 dias</option><option value="7">7 dias</option></select></label><p className="modal-help">O envio automático requer configurar a função de e-mail do Supabase e uma conta Resend. Consulte o passo a passo no README.</p><div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Bell size={15}/> Salvar lembretes</button></div></form></Modal> }

function InvoiceConfirmModal({value,month,onClose,onConfirm}) { const total=value.entries.reduce((sum,item)=>sum+Number(item.amount),0); const title=value.reopening?'Reabrir fatura':'Confirmar pagamento da fatura'; return <Modal title={title} onClose={onClose}><div className="invoice-confirm-content"><span className={`invoice-confirm-icon ${value.reopening?'reopen':''}`}><CreditCard size={21}/></span><p>{value.reopening?<>As compras de <b>{value.card.name}</b> na fatura de <b>{monthName(month)}</b> voltarão a ficar pendentes.</>:<>Confirma que a fatura de <b>{value.card.name}</b> de <b>{monthName(month)}</b> foi paga?</>}</p><div className="invoice-confirm-summary"><span>{value.entries.length} compra{value.entries.length===1?'':'s'} nesta fatura</span><strong>{brl(total)}</strong></div>{!value.reopening&&<small>As compras serão marcadas como pagas com a data de hoje. Isso também atualiza o limite disponível calculado.</small>}<div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button type="button" className={`button ${value.reopening?'subtle':'primary'}`} onClick={onConfirm}>{value.reopening?'Sim, reabrir fatura':'Sim, marcar como paga'}</button></div></div></Modal> }

function ConfirmationModal({value,onClose,onConfirm}) { return <Modal title={value.title} onClose={onClose}><div className="invoice-confirm-content"><span className="invoice-confirm-icon reopen"><Trash2 size={21}/></span><p>{value.message}</p>{value.details&&<small>{value.details}</small>}<div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button type="button" className="button confirm-danger" onClick={onConfirm}>{value.confirmLabel}</button></div></div></Modal> }
