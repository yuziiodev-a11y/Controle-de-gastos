import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Banknote, CalendarDays,
  Check, ChevronDown, CreditCard, LayoutDashboard, LogOut, Pencil, Plus, PiggyBank,
  ReceiptText, Trash2, Wallet, X, Repeat, Search, SlidersHorizontal, Target, Eye, EyeOff, ChartNoAxesCombined, Tags, Bell, FileUp, Download, Paperclip, History, Users,
} from 'lucide-react'
import { configured, supabase } from './lib/supabase'

const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const monthOf = (date = new Date()) => localDate(date).slice(0, 7)
const monthStart = (key) => `${key}-01`
const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const monthName = (key, options = { month: 'long', year: 'numeric' }) => new Date(`${key}-15T12:00:00`).toLocaleDateString('pt-BR', options)
const normalizeSearchText = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
const userDisplayName = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || 'Eu'
const responsibleDetailsFor = (item, fallbackName) => {
  if (item.responsible_details?.length) return item.responsible_details
  return [{ name: item.responsible_person || fallbackName || 'Eu', percentage: 100 }]
}
const responsibleNamesFor = (item, fallbackName) => responsibleDetailsFor(item, fallbackName).map((person) => person.name)
const responsibilityAmountsFor = (item, fallbackName) => {
  const details = responsibleDetailsFor(item, fallbackName)
  const totalCents = Math.round(Number(item.amount) * 100)
  const exact = details.map((person) => totalCents * Number(person.percentage) / 100)
  const cents = exact.map(Math.floor)
  let remainder = totalCents - cents.reduce((sum, amount) => sum + amount, 0)
  exact.map((amount, index) => ({ index, fraction: amount - cents[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index).slice(0, remainder).forEach(({ index }) => { cents[index] += 1 })
  return details.map((person, index) => ({ name: person.name, amount: cents[index] / 100 }))
}
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
const cardColors = [
  { id: 'violet', label: 'Violeta', start: '#371067', end: '#6422b6' },
  { id: 'purple', label: 'Roxo', start: '#4a1685', end: '#8338d2' },
  { id: 'indigo', label: 'Índigo', start: '#30205f', end: '#6040a7' },
  { id: 'blue', label: 'Azul', start: '#173b73', end: '#326bd1' },
  { id: 'cyan', label: 'Ciano', start: '#07536a', end: '#168bb0' },
  { id: 'pink', label: 'Rosa', start: '#74214f', end: '#c04488' },
  { id: 'rose', label: 'Vinho', start: '#5a1d3c', end: '#9b386c' },
  { id: 'graphite', label: 'Grafite', start: '#303448', end: '#596078' },
  { id: 'navy', label: 'Azul-marinho', start: '#071b3e', end: '#174a8b' },
  { id: 'sky', label: 'Azul-claro', start: '#176a9b', end: '#39a9d6' },
  { id: 'teal', label: 'Turquesa', start: '#075b59', end: '#159b88' },
  { id: 'emerald', label: 'Esmeralda', start: '#075b43', end: '#15956b' },
  { id: 'lime', label: 'Lima', start: '#3e5c17', end: '#7e9c2f' },
  { id: 'red', label: 'Vermelho', start: '#771f2b', end: '#c43e4d' },
  { id: 'coral', label: 'Coral', start: '#9b3d35', end: '#e4775e' },
  { id: 'brown', label: 'Marrom', start: '#53331f', end: '#96613a' },
  { id: 'black', label: 'Preto', start: '#17191f', end: '#3b414d' },
  { id: 'silver', label: 'Prata', start: '#59636f', end: '#a2aab3' },
]
const initialEntry = (monthKey = monthOf()) => {
  const date = monthKey === monthOf() ? localDate() : monthStart(monthKey)
  return { kind: 'expense', description: '', amount: '', category: 'Alimentação', spent_on: date, due_date: date, settled_on: '', status: 'pending', payment_method: 'pix', card_id: '', invoice_month: monthKey, installment_count: '1', paid_by: '', responsible_person: '', responsible_details: [], shared_with: '', share_details: [], notes: '', attachmentFiles: [] }
}

function shareBreakdown(item) {
  if (item.share_details?.length) return item.share_details.map((share) => `${share.name}: ${brl(share.amount)}`).join(' · ')
  const names = [...new Set((item.shared_with || []).map((name) => name.trim()).filter(Boolean))]
  if (!names.length) return ''
  const cents = Math.round(Number(item.amount) * 100)
  const base = Math.floor(cents / names.length), extra = cents % names.length
  return names.map((name, index) => `${name}: ${brl((base + (index < extra ? 1 : 0)) / 100)}`).join(' · ')
}

function sharesFor(item) {
  if (item.share_details?.length) return item.share_details
  const names = [...new Set((item.shared_with || []).map((name) => name.trim()).filter(Boolean))]
  if (!names.length) return []
  const cents = Math.round(Number(item.amount) * 100), base = Math.floor(cents / names.length), remainder = cents % names.length
  return names.map((name, index) => ({ name, amount: (base + (index < remainder ? 1 : 0)) / 100, settled: name.toLocaleLowerCase('pt-BR') === (item.paid_by || '').trim().toLocaleLowerCase('pt-BR'), settled_on: null }))
}

function allocateShareAmounts(total, shares) {
  const totalCents = Math.round(Number(total) * 100)
  const sourceCents = shares.map((share) => Math.max(0, Math.round(Number(share.amount) * 100)))
  const sourceTotal = sourceCents.reduce((sum, cents) => sum + cents, 0)
  if (!sourceTotal) return shares.map((share) => ({ ...share, amount: 0 }))
  const exact = sourceCents.map((cents) => totalCents * cents / sourceTotal)
  const cents = exact.map(Math.floor)
  let remainder = totalCents - cents.reduce((sum, value) => sum + value, 0)
  exact.map((value, index) => ({ index, fraction: value - cents[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index).slice(0, remainder).forEach(({ index }) => { cents[index] += 1 })
  return shares.map((share, index) => ({ ...share, amount: cents[index] / 100 }))
}

function parseCsv(text) {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) || []).length > (text.split(/\r?\n/, 1)[0].match(/,/g) || []).length ? ';' : ','
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted && char === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
    else if (char === '"') quoted = !quoted
    else if (!quoted && char === delimiter) { row.push(field.trim()); field = '' }
    else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = '' }
    else field += char
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row)
  if (rows.length < 2) return { rows: [], error: 'O arquivo precisa ter cabeçalho e ao menos um lançamento.' }
  const headers = rows[0].map((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replaceAll(' ', '_'))
  const required = ['tipo', 'descricao', 'valor', 'categoria', 'data']
  const missing = required.filter((header) => !headers.includes(header))
  if (missing.length) return { rows: [], error: `Colunas obrigatórias ausentes: ${missing.join(', ')}.` }
  const dateValue = (value) => {
    const v = value.trim()
    let iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''
    const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!iso && match) iso = `${match[3]}-${match[2]}-${match[1]}`
    if (!iso) return ''
    const parsed = new Date(`${iso}T12:00:00`)
    return Number.isNaN(parsed.getTime()) || localDate(parsed) !== iso ? '' : iso
  }
  const result = rows.slice(1).map((cells, index) => {
    const data = Object.fromEntries(headers.map((header, column) => [header, cells[column] || '']))
    const errors = []
    const kindValue = data.tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const description = data.descricao.trim()
    const category = data.categoria.trim() || 'Outros'
    if (!description) errors.push('descrição obrigatória')
    if (description.length > 100) errors.push('descrição excede 100 caracteres')
    if (category.length > 40) errors.push('categoria excede 40 caracteres')
    const kind = ['receita', 'income', 'entrada'].includes(kindValue) ? 'income' : ['despesa', 'expense', 'saida'].includes(kindValue) ? 'expense' : ''
    if (!kind) errors.push('tipo inválido')
    const amountString = data.valor.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
    const amount = Number(amountString)
    if (!Number.isFinite(amount) || amount <= 0) errors.push('valor inválido')
    const spentOn = dateValue(data.data)
    if (!spentOn) errors.push('data inválida (use AAAA-MM-DD ou DD/MM/AAAA)')
    const dueDate = data.vencimento ? dateValue(data.vencimento) : spentOn
    if (!dueDate) errors.push('vencimento inválido (use AAAA-MM-DD ou DD/MM/AAAA)')
    const statusValue = (data.situacao || 'pendente').toLowerCase()
    const status = ['paga', 'pago', 'recebida', 'recebido', 'settled'].includes(statusValue) ? 'settled' : ['pendente', 'pending'].includes(statusValue) ? 'pending' : ''
    if (!status) errors.push('situação inválida')
    const methodValue = (data.forma_pagamento || 'outro').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const paymentMethod = ({ pix: 'pix', dinheiro: 'cash', cash: 'cash', debito: 'debit_card', debit_card: 'debit_card', credito: 'credit_card', credit_card: 'credit_card', outro: 'other', other: 'other' })[methodValue]
    if (kind === 'expense' && !paymentMethod) errors.push('forma_pagamento inválida')
    return { line: index + 2, error: errors.join('; '), raw: data, value: { kind, description, amount, category, spent_on: spentOn, due_date: dueDate, settled_on: status === 'settled' ? (dateValue(data.pago_em) || spentOn) : null, status, payment_method: kind === 'expense' ? paymentMethod : 'other', card_name: data.cartao.trim(), invoice_month: monthStart((data.mes_fatura && dateValue(data.mes_fatura + '-01')) ? data.mes_fatura : spentOn.slice(0, 7)), paid_by: data.pagador.trim(), shared_with: (data.dividido_com || '').split(/[|;]/).map((name) => name.trim()).filter(Boolean), notes: data.observacoes.trim() } }
  })
  return { rows: result, error: '' }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [message, setMessage] = useState('')
  const [profileModal, setProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [entries, setEntries] = useState([])
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [highlightedEntryId, setHighlightedEntryId] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [historyModal, setHistoryModal] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [recentHistory, setRecentHistory] = useState([])
  const [historySearch, setHistorySearch] = useState('')
  const [historyAction, setHistoryAction] = useState('all')
  const [shareModal, setShareModal] = useState(null)
  const [attachmentModal, setAttachmentModal] = useState(null)
  const [csvModal, setCsvModal] = useState(false)
  const [csvRows, setCsvRows] = useState([])
  const [csvError, setCsvError] = useState('')
  const [csvBusy, setCsvBusy] = useState(false)
  const [monthClosure, setMonthClosure] = useState(null)
  const [cards, setCards] = useState([])
  const [pots, setPots] = useState([])
  const [movements, setMovements] = useState([])
  const [activePage, setActivePage] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(monthOf())
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [cardResponsibleFilter, setCardResponsibleFilter] = useState('all')
  const [expandedResponsibleDetails, setExpandedResponsibleDetails] = useState(null)
  const [cashflowDayDate, setCashflowDayDate] = useState(null)
  const [cashflowConfirmAll, setCashflowConfirmAll] = useState(false)
  const [cashflowBulkBusy, setCashflowBulkBusy] = useState(false)
  const [invoiceCardFilter, setInvoiceCardFilter] = useState('all')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all')
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
  const [cardForm, setCardForm] = useState({ name: '', closing_day: 10, due_day: 17, credit_limit: '', color: 'violet' })
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
  const [entryFilters, setEntryFilters] = useState({ search: '', kind: 'all', status: 'all', category: 'all', payment: 'all', responsible: 'all' })
  const [hideValues, setHideValues] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, value) => {
      setSession(value)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadData() }, [session, selectedMonth])

  useEffect(() => {
    if (!highlightedEntryId) return undefined
    const scrollTimer = window.setTimeout(() => document.querySelector(`[data-entry-id="${highlightedEntryId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220)
    const clearTimer = window.setTimeout(() => setHighlightedEntryId(null), 4200)
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer) }
  }, [highlightedEntryId, activePage, selectedMonth, entries])

  useEffect(() => {
    const handleGlobalSearchShortcut = (event) => {
      const target = event.target
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping && !globalSearchOpen) {
        event.preventDefault(); setGlobalSearchQuery(''); setGlobalSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleGlobalSearchShortcut)
    return () => window.removeEventListener('keydown', handleGlobalSearchShortcut)
  }, [globalSearchOpen])

  async function loadData() {
    const { error: recurrenceError } = await supabase.rpc('generate_recurring_expenses', { p_month: monthStart(selectedMonth) })
    if (recurrenceError) setMessage(recurrenceError.message)
    const [cardResult, entryResult, potResult, movementResult, budgetResult, recurringResult, categoryResult, reminderResult, attachmentResult, closureResult, historyResult] = await Promise.all([
      supabase.from('cards').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, cards(name)').order('due_date', { ascending: true }),
      supabase.from('savings_pots').select('*').order('created_at', { ascending: true }),
      supabase.from('savings_movements').select('*').order('moved_on', { ascending: false }),
      supabase.from('category_budgets').select('*').eq('month', monthStart(selectedMonth)),
      supabase.from('recurring_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('user_categories').select('*').order('name'),
      supabase.from('reminder_settings').select('*').maybeSingle(),
      supabase.from('expense_attachments').select('*').order('created_at', { ascending: false }),
      supabase.from('month_closures').select('*').eq('month', monthStart(selectedMonth)).maybeSingle(),
      supabase.from('expense_history').select('*').order('changed_at', { ascending: false }).limit(100),
    ])
    if (cardResult.error || entryResult.error || potResult.error || movementResult.error || budgetResult.error || recurringResult.error || categoryResult.error || reminderResult.error || attachmentResult.error || closureResult.error || historyResult.error) setMessage(cardResult.error?.message || entryResult.error?.message || potResult.error?.message || movementResult.error?.message || budgetResult.error?.message || recurringResult.error?.message || categoryResult.error?.message || reminderResult.error?.message || attachmentResult.error?.message || closureResult.error?.message || historyResult.error?.message || recurrenceError.message)
    else { setCards(cardResult.data || []); setEntries(entryResult.data || []); setPots(potResult.data || []); setMovements(movementResult.data || []); setBudgets(budgetResult.data || []); setRecurringRules(recurringResult.data || []); setUserCategories(categoryResult.data || []); setReminderSettings(reminderResult.data || { enabled: false, days_before: 1 }); setAttachments(attachmentResult.data || []); setMonthClosure(closureResult.data || null); setRecentHistory(historyResult.data || []) }
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
    if (authMode === 'signup' && username.trim().length < 2) { setMessage('O nome de usuário precisa ter pelo menos 2 caracteres.'); return }
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: username.trim() } } })
    if (result.error) setMessage(authErrorMessage(result.error, authMode))
    else if (authMode === 'signup' && !result.data.session) setMessage('Cadastro feito. Confirme seu e-mail para entrar.')
  }

  async function saveProfileName(event) {
    event.preventDefault(); setMessage('')
    const nextName = profileName.trim()
    if (nextName.length < 2) { setMessage('O nome de usuário precisa ter pelo menos 2 caracteres.'); return }
    const oldAutoName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Eu'
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: nextName } })
    if (error) { setMessage(error.message); return }
    if (data.user) setSession((current) => current ? { ...current, user: data.user } : current)
    const changedGroups = new Set()
    let syncError = null
    for (const item of entries) {
      if (item.kind !== 'expense' || item.responsible_person !== oldAutoName || item.responsible_person === nextName) continue
      const details = responsibleDetailsFor(item, oldAutoName).map((person) => ({ ...person, name: person.name === oldAutoName ? nextName : person.name }))
      if (item.installment_group_id) {
        if (changedGroups.has(item.installment_group_id)) continue
        changedGroups.add(item.installment_group_id)
        const { error: updateError } = await supabase.from('expenses').update({ responsible_person: nextName, responsible_details: details }).eq('installment_group_id', item.installment_group_id)
        if (updateError) { syncError = updateError; break }
      } else {
        const { error: updateError } = await supabase.from('expenses').update({ responsible_person: nextName, responsible_details: details }).eq('id', item.id)
        if (updateError) { syncError = updateError; break }
      }
    }
    setProfileModal(false)
    if (syncError) setMessage(`Nome atualizado, mas alguns responsáveis antigos não foram sincronizados: ${syncError.message}`)
    await loadData()
  }

  async function signOut() {
    setSession(null)
    setLoading(false)
    setPasswordRecovery(false)
    setMessage('')
    setProfileModal(false)
    setEntryModal(false)
    setCardModal(false)
    setPotModal(false)
    setMovementModal(false)
    setBudgetModal(false)
    setRecurringModal(false)
    setEntries([])
    setCards([])
    setPots([])
    setMovements([])
    setBudgets([])
    setRecurringRules([])
    setAttachments([])
    setRecentHistory([])
    setUserCategories([])
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMessage(`Não foi possível sair da conta: ${error.message}`)
      const { data } = await supabase.auth.getSession()
      if (data.session) setSession(data.session)
    }
  }

  async function sendPasswordRecovery(event) {
    event.preventDefault(); setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    if (error) setMessage(authErrorMessage(error, 'recovery'))
    else setMessage('Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha.')
  }

  async function updateRecoveredPassword(event) {
    event.preventDefault(); setMessage('')
    if (password.length < 6) { setMessage('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (password !== confirmPassword) { setMessage('As senhas não são iguais. Confira e tente novamente.'); return }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(authErrorMessage(error, 'signup'))
    else {
      setPasswordRecovery(false); setPassword(''); setConfirmPassword('')
      setMessage('Senha atualizada com sucesso.')
    }
  }

  function openNewEntry() { setEditingEntryId(null); const name = userDisplayName(session.user); setEntryForm({ ...initialEntry(selectedMonth), responsible_person: name, responsible_details: [{ name, percentage: 100 }] }); setEntryModal(true) }
  function openEditEntry(item) {
    setEditingEntryId(item.id)
    setEntryForm({
      kind: item.kind || 'expense', description: item.description, amount: String(item.amount), category: item.category,
      spent_on: item.spent_on, due_date: item.due_date, settled_on: item.settled_on || '', status: item.status || 'settled',
      payment_method: item.payment_method || (item.card_id ? 'credit_card' : 'other'),
      card_id: item.card_id || '', invoice_month: item.invoice_month?.slice(0, 7) || selectedMonth, installment_count: '1',
      paid_by: item.paid_by || '', responsible_person: responsibleNamesFor(item, userDisplayName(session.user)).join(', '), responsible_details: responsibleDetailsFor(item, userDisplayName(session.user)), shared_with: (item.shared_with || []).join(', '), share_details: item.share_details || [], notes: item.notes || '', attachmentFiles: [],
    })
    setEntryModal(true)
  }

  async function saveEntry(event) {
    event.preventDefault(); setMessage('')
    const count = Number(entryForm.installment_count || 1)
    const amount = Number(entryForm.amount)
    const participantNames = entryForm.kind === 'expense' ? [...new Set(entryForm.shared_with.split(/[,;]/).map((name) => name.trim()).filter(Boolean))] : []
    const responsibleNames = entryForm.kind === 'expense' ? [...new Set((entryForm.responsible_person || '').split(/[,;]/).map((name) => name.trim()).filter(Boolean))] : []
    if (entryForm.kind === 'expense' && !responsibleNames.length) responsibleNames.push(userDisplayName(session.user))
    const enteredResponsibleDetails = entryForm.responsible_details || []
    const responsibleDetails = responsibleNames.map((name) => ({ name, percentage: Number(enteredResponsibleDetails.find((person) => person.name === name)?.percentage ?? (responsibleNames.length === 1 ? 100 : 0)) }))
    if (responsibleDetails.some((person) => !Number.isFinite(person.percentage) || person.percentage < 0) || Math.round(responsibleDetails.reduce((sum, person) => sum + person.percentage, 0) * 100) !== 10000) {
      setMessage('A divisão da responsabilidade precisa somar exatamente 100%.'); return
    }
    const enteredShares = entryForm.share_details || []
    let shareDetails = []
    if (participantNames.length) {
      const customAmounts = enteredShares.some((share) => String(share.amount ?? '').trim() !== '')
      if (customAmounts) {
        shareDetails = participantNames.map((name) => { const previous = enteredShares.find((share) => share.name === name); const ownShare = name.toLocaleLowerCase('pt-BR') === entryForm.paid_by.trim().toLocaleLowerCase('pt-BR'); return { name, amount: Number(previous?.amount || 0), settled: ownShare || Boolean(previous?.settled), settled_on: ownShare ? (previous?.settled_on || entryForm.spent_on) : (previous?.settled_on || null) } })
        const sharesTotal = Math.round(shareDetails.reduce((sum, share) => sum + share.amount, 0) * 100)
        if (shareDetails.some((share) => !Number.isFinite(share.amount) || share.amount <= 0) || sharesTotal !== Math.round(amount * 100)) { setMessage('Informe um valor positivo para cada pessoa e confira se a soma das partes é igual ao total da despesa.'); return }
      } else {
        const cents = Math.round(amount * 100), base = Math.floor(cents / participantNames.length), remainder = cents % participantNames.length
        shareDetails = participantNames.map((name, index) => { const previous = enteredShares.find((share) => share.name === name); const ownShare = name.toLocaleLowerCase('pt-BR') === entryForm.paid_by.trim().toLocaleLowerCase('pt-BR'); return { name, amount: (base + (index < remainder ? 1 : 0)) / 100, settled: ownShare || Boolean(previous?.settled), settled_on: ownShare ? (previous?.settled_on || entryForm.spent_on) : (previous?.settled_on || null) } })
      }
    }
    const payload = {
      kind: entryForm.kind, description: entryForm.description.trim(), amount, category: entryForm.category,
      spent_on: entryForm.spent_on, due_date: entryForm.due_date, status: count > 1 ? 'pending' : entryForm.status,
      settled_on: count > 1 ? null : entryForm.status === 'settled' ? (entryForm.settled_on || entryForm.spent_on) : null,
      payment_method: entryForm.kind === 'expense' ? entryForm.payment_method : 'other',
      card_id: entryForm.kind === 'expense' && entryForm.payment_method === 'credit_card' ? (entryForm.card_id || null) : null,
      invoice_month: monthStart(entryForm.invoice_month || selectedMonth),
      paid_by: entryForm.kind === 'expense' ? (entryForm.paid_by.trim() || null) : null,
      responsible_person: entryForm.kind === 'expense' ? responsibleNames.join(', ') : null,
      responsible_details: entryForm.kind === 'expense' ? responsibleDetails : [],
      shared_with: participantNames,
      share_details: shareDetails,
      notes: entryForm.notes.trim() || null,
    }
    let result
    if (editingEntryId) result = await supabase.from('expenses').update(payload).eq('id', editingEntryId).select('id').single()
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
        const installmentAmount = (base + (index < remainder ? 1 : 0)) / 100
        return { ...payload, amount: installmentAmount, share_details: allocateShareAmounts(installmentAmount, shareDetails), invoice_month: monthStart(invoiceMonth), due_date: `${invoiceMonth}-${String(dueDay).padStart(2, '0')}`, installment_group_id: group, installment_number: index + 1, installment_count: count }
      })
      result = await supabase.from('expenses').insert(rows).select('id')
    } else result = await supabase.from('expenses').insert(payload).select('id').single()
    if (result.error) { setMessage(result.error.message); return }
    const editedEntry = editingEntryId ? entries.find((item) => item.id === editingEntryId) : null
    if (editedEntry?.installment_group_id) {
      const { error } = await supabase.from('expenses').update({ responsible_person: payload.responsible_person, responsible_details: payload.responsible_details }).eq('installment_group_id', editedEntry.installment_group_id)
      if (error) { setMessage(`Lançamento atualizado, mas não foi possível atualizar o responsável nas outras parcelas: ${error.message}`); await loadData(); return }
    }
    const savedEntries = Array.isArray(result.data) ? result.data : [result.data]
    const attachmentEntryId = savedEntries[0]?.id
    const files = entryForm.attachmentFiles || []
    for (const file of files) {
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
      const storagePath = `${session.user.id}/${attachmentEntryId}/${crypto.randomUUID()}-${safeName}`
      const uploaded = await supabase.storage.from('expense-receipts').upload(storagePath, file, { contentType: file.type, upsert: false })
      if (uploaded.error) { setMessage(`Lançamento salvo, mas o anexo “${file.name}” não foi enviado: ${uploaded.error.message}`); continue }
      const attachmentResult = await supabase.from('expense_attachments').insert({ expense_id: attachmentEntryId, storage_path: storagePath, file_name: file.name, mime_type: file.type, size_bytes: file.size })
      if (attachmentResult.error) {
        await supabase.storage.from('expense-receipts').remove([storagePath])
        setMessage(`Lançamento salvo, mas não foi possível registrar o anexo: ${attachmentResult.error.message}`)
      }
    }
    setEntryModal(false); setEditingEntryId(null); await loadData()
  }

  function deleteAttachment(file) {
    requestConfirmation({ title: 'Excluir anexo?', message: `Excluir o arquivo “${file.file_name}”?`, details: 'O comprovante será removido permanentemente.', confirmLabel: 'Excluir anexo', onConfirm: async () => {
      const removed = await supabase.storage.from('expense-receipts').remove([file.storage_path])
      if (removed.error) { setMessage(removed.error.message); return }
      const { error } = await supabase.from('expense_attachments').delete().eq('id', file.id)
      if (error) setMessage(error.message)
      await loadData()
      setAttachmentModal((current) => current ? { ...current, files: current.files.filter((item) => item.id !== file.id) } : null)
    } })
  }

  async function openHistory(item) {
    const { data, error } = await supabase.from('expense_history').select('*').eq('expense_id', item.id).order('changed_at', { ascending: false })
    if (error) setMessage(error.message)
    else { setHistoryRows(data || []); setHistoryModal(item) }
  }

  async function openAttachment(item) {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    const { data, error } = await supabase.storage.from('expense-receipts').createSignedUrl(item.storage_path, 60)
    if (error) { tab?.close(); setMessage(error.message) }
    else if (tab) tab.location.href = data.signedUrl
    else setMessage('O navegador bloqueou a nova aba. Permita pop-ups para abrir o comprovante.')
  }

  async function importCsvFile(file) {
    setCsvError(''); setCsvRows([])
    if (!file.name.toLocaleLowerCase('pt-BR').endsWith('.csv')) { setCsvError('Escolha um arquivo com extensão .csv.'); return }
    if (file.size > 2 * 1024 * 1024) { setCsvError('O arquivo deve ter no máximo 2 MB.'); return }
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.error) setCsvError(parsed.error)
      else setCsvRows(parsed.rows)
    } catch (error) { setCsvError(`Não foi possível ler o arquivo: ${error.message}`) }
  }

  async function importCsvRows() {
    const valid = csvRows.filter((row) => !row.error)
    if (!valid.length) { setCsvError('Não há linhas válidas para importar.'); return }
    if (valid.length > 500) { setCsvError('Importe até 500 lançamentos por arquivo.'); return }
    const prepared = valid.map(({ value, line }) => {
      const card = value.card_name ? cards.find((item) => item.name.trim().toLocaleLowerCase('pt-BR') === value.card_name.toLocaleLowerCase('pt-BR')) : null
      if (value.card_name && value.payment_method !== 'credit_card') return { line, error: 'a coluna cartao só pode ser usada com forma_pagamento=credito' }
      if (value.card_name && !card) return { line, error: `cartão “${value.card_name}” não encontrado` }
      if (value.payment_method === 'credit_card' && !card) return { line, error: 'informe um cartão existente na coluna cartao para pagamento em crédito' }
      const { card_name, ...record } = value
      const defaultResponsible = value.kind === 'expense' ? userDisplayName(session.user) : null
      return { value: { ...record, paid_by: value.kind === 'expense' ? (value.paid_by || null) : null, responsible_person: defaultResponsible, responsible_details: defaultResponsible ? [{ name: defaultResponsible, percentage: 100 }] : [], shared_with: value.kind === 'expense' ? value.shared_with : [], card_id: value.payment_method === 'credit_card' ? card.id : null, invoice_month: value.payment_method === 'credit_card' ? value.invoice_month : monthStart(value.spent_on.slice(0, 7)) } }
    })
    const invalid = prepared.filter((row) => row.error)
    if (invalid.length) { setCsvError(invalid.slice(0, 5).map((row) => `Linha ${row.line}: ${row.error}`).join(' · ')); return }
    setCsvBusy(true)
    const { error } = await supabase.from('expenses').insert(prepared.map(({ value }) => value))
    setCsvBusy(false)
    if (error) setCsvError(`Importação não concluída: ${error.message}`)
    else { setCsvModal(false); setCsvRows([]); setCsvError(''); setMessage(`${valid.length} lançamento${valid.length === 1 ? '' : 's'} importado${valid.length === 1 ? '' : 's'}.`); await loadData() }
  }

  function downloadCsvTemplate() {
    const content = 'tipo;descricao;valor;categoria;data;vencimento;situacao;forma_pagamento;cartao;mes_fatura;pagador;dividido_com;observacoes\ndespesa;Aluguel;1500,00;Moradia;2026-10-05;2026-10-10;pendente;pix;;;David;David|Amigo;Aluguel dividido\nreceita;Salário;4500,00;Salário;2026-10-01;2026-10-01;recebida;outro;;;;;'
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'modelo-lancamentos.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  async function closeSelectedMonth() {
    const byCategory = monthBudgetUsage.map((item) => ({ category: item.category, planned: Number(item.amount), actual: item.spent, difference: Number(item.amount) - item.spent }))
    const plannedExpenses = budgets.reduce((sum, item) => sum + Number(item.amount), 0)
    const actualExpenses = monthEntries.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
    const snapshot = { planned_expenses: plannedExpenses, actual_expenses: actualExpenses, actual_income: monthIncome, net_result: monthResult, categories: byCategory, closed_entry_count: monthEntries.length }
    const { error } = await supabase.from('month_closures').upsert({ month: monthStart(selectedMonth), snapshot, closed_at: new Date().toISOString() }, { onConflict: 'user_id,month' }).select().single()
    if (error) setMessage(error.message)
    else await loadData()
  }

  function openEmergencyFund() {
    const monthKeys = Array.from({ length: 3 }, (_, index) => { const date = new Date(`${selectedMonth}-15T12:00:00`); date.setMonth(date.getMonth() - index); return monthOf(date) })
    const essential = new Set(['Moradia', 'Alimentação', 'Saúde', 'Transporte'])
    const monthlyTotals = monthKeys.map((key) => entries.filter((item) => item.kind === 'expense' && essential.has(item.category) && (item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on))?.startsWith(key)).reduce((sum, item) => sum + Number(item.amount), 0))
    const suggested = monthlyTotals.reduce((sum, value) => sum + value, 0) / monthlyTotals.length * 3
    const due = new Date(); due.setFullYear(due.getFullYear() + 1)
    const existing = pots.find((pot) => pot.name.toLocaleLowerCase('pt-BR') === 'reserva de emergência')
    if (existing) {
      setEditingPotId(existing.id); setPotForm({ name: existing.name, opening_balance: String(existing.opening_balance), goal_amount: (suggested || Number(existing.goal_amount) || '').toString(), goal_due_date: existing.goal_due_date || localDate(due) })
    } else {
      setEditingPotId(null); setPotForm({ name: 'Reserva de emergência', opening_balance: '0', goal_amount: suggested ? suggested.toFixed(2) : '', goal_due_date: localDate(due) })
    }
    setPotModal(true)
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

  async function settleCashflowDay() {
    const row = cashflowRows.find((item) => item.date === cashflowDayDate)
    const pendingIds = row?.entries.filter((item) => item.status === 'pending').map((item) => item.id) || []
    if (!pendingIds.length) { setCashflowConfirmAll(false); return }
    setCashflowBulkBusy(true)
    const { error } = await supabase.from('expenses').update({ status: 'settled', settled_on: localDate() }).in('id', pendingIds)
    setCashflowBulkBusy(false)
    if (error) setMessage(error.message)
    else { setCashflowDayDate(null); setCashflowConfirmAll(false); await loadData() }
  }

  async function saveShareSettlement(item, shareIndex, settled) {
    const shares = (item.share_details || []).map((share, index) => index === shareIndex ? { ...share, settled, settled_on: settled ? localDate() : null } : share)
    const { error } = await supabase.from('expenses').update({ share_details: shares }).eq('id', item.id)
    if (error) setMessage(error.message)
    else { setShareModal({ ...item, share_details: shares }); await loadData() }
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
        const groupIds = isInstallmentGroup ? entries.filter((entry) => entry.installment_group_id === item.installment_group_id).map((entry) => entry.id) : [item.id]
        const storedAttachments = await supabase.from('expense_attachments').select('storage_path').in('expense_id', groupIds)
        if (storedAttachments.data?.length) await supabase.storage.from('expense-receipts').remove(storedAttachments.data.map((file) => file.storage_path))
        const query = supabase.from('expenses').delete()
        const { error } = isInstallmentGroup ? await query.eq('installment_group_id', item.installment_group_id) : await query.eq('id', item.id)
        if (error) setMessage(error.message)
        await loadData()
      },
    })
  }

  function openNewCard() { setEditingCardId(null); setCardForm({ name: '', closing_day: 10, due_day: 17, credit_limit: '', color: 'violet' }); setCardModal(true) }
  function openEditCard(item) { setEditingCardId(item.id); setCardForm({ name: item.name, closing_day: item.closing_day, due_day: item.due_day, credit_limit: item.credit_limit ?? '', color: item.color || 'violet' }); setCardModal(true) }
  async function saveCard(event) {
    event.preventDefault(); setMessage('')
    const payload = { name: cardForm.name.trim(), closing_day: Number(cardForm.closing_day), due_day: Number(cardForm.due_day), credit_limit: cardForm.credit_limit === '' ? null : Number(cardForm.credit_limit), color: cardForm.color || 'violet' }
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
  const overdueEntries = entries.filter((item) => item.status === 'pending' && item.due_date < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const reminderDays = reminderSettings.enabled ? Number(reminderSettings.days_before || 1) : 7
  const dueSoonCutoff = new Date(`${todayKey}T12:00:00`); dueSoonCutoff.setDate(dueSoonCutoff.getDate() + reminderDays)
  const dueSoonKey = localDate(dueSoonCutoff)
  const dueInSevenDays = entries.filter((item) => item.status === 'pending' && item.due_date >= todayKey && item.due_date <= dueSoonKey).sort((a, b) => a.due_date.localeCompare(b.due_date))
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
  const liveMonthSnapshot = { planned_expenses: budgets.reduce((sum, item) => sum + Number(item.amount), 0), actual_expenses: monthEntries.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + Number(item.amount), 0), actual_income: monthIncome, net_result: monthResult, categories: monthBudgetUsage.map((item) => ({ category: item.category, planned: Number(item.amount), actual: item.spent, difference: Number(item.amount) - item.spent })), closed_entry_count: monthEntries.length }
  const displayedMonthSnapshot = monthClosure?.snapshot || liveMonthSnapshot
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
      responsibleTotals: cardInvoices.reduce((totals, expense) => {
        for (const person of responsibilityAmountsFor(expense, userDisplayName(session.user))) {
          totals[person.name] = (totals[person.name] || 0) + person.amount
        }
        return totals
      }, {}),
      pendingCount: cardInvoices.filter((item) => item.status === 'pending').length,
    }
  })
  const filteredMonthCards = monthCards.filter((card) => {
    const matchesCard = invoiceCardFilter === 'all' || card.id === invoiceCardFilter
    const matchesStatus = invoiceStatusFilter === 'all' || (invoiceStatusFilter === 'paid' ? card.invoiceEntries.length > 0 && card.invoicePaid : card.invoiceEntries.length > 0 && !card.invoicePaid)
    return matchesCard && matchesStatus
  })
  const todayForInvoiceAlert = new Date(`${todayKey}T12:00:00`)
  const invoiceDueAlerts = filteredMonthCards.flatMap((card) => {
    if (!card.invoiceEntries.length || card.invoicePaid) return []
    const [year, month] = selectedMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const dueDate = `${selectedMonth}-${String(Math.min(Number(card.due_day), lastDay)).padStart(2, '0')}`
    const due = new Date(`${dueDate}T12:00:00`)
    const daysRemaining = Math.round((due.getTime() - todayForInvoiceAlert.getTime()) / 86400000)
    return daysRemaining <= 7 ? [{ card, dueDate, daysRemaining }] : []
  }).sort((a, b) => a.daysRemaining - b.daysRemaining)
  const responsibleMonthlyPayments = entries
    .filter((item) => item.kind === 'expense' && item.card_id && item.status === 'pending' && item.invoice_month?.startsWith(selectedMonth))
    .reduce((people, item) => {
      for (const allocation of responsibilityAmountsFor(item, userDisplayName(session.user))) {
        people[allocation.name] ||= { name: allocation.name, total: 0, cards: {} }
        people[allocation.name].total += allocation.amount
        const cardId = item.card_id
        people[allocation.name].cards[cardId] ||= { name: item.cards?.name || cards.find((card) => card.id === cardId)?.name || 'Cartão', total: 0, entries: [] }
        people[allocation.name].cards[cardId].total += allocation.amount
        people[allocation.name].cards[cardId].entries.push({ ...item, responsibilityAmount: allocation.amount })
      }
      return people
    }, {})
  const responsibleMonthlyPaymentList = Object.values(responsibleMonthlyPayments).sort((a, b) => b.total - a.total)
  const cardMonthEntries = entries.filter((item) => item.kind === 'expense' && item.card_id && item.invoice_month?.startsWith(selectedMonth) && (invoiceCardFilter === 'all' || item.card_id === invoiceCardFilter) && (invoiceStatusFilter === 'all' || (invoiceStatusFilter === 'paid' ? item.status === 'settled' : item.status === 'pending'))).sort((a, b) => a.spent_on.localeCompare(b.spent_on))
  const filteredCardMonthEntries = cardMonthEntries.filter((item) => cardResponsibleFilter === 'all' || responsibleNamesFor(item, userDisplayName(session.user)).includes(cardResponsibleFilter))
  const sortedMonthEntries = [...monthEntries].sort((a, b) => (a.status === 'pending' ? a.due_date : (a.settled_on || a.spent_on)).localeCompare(b.status === 'pending' ? b.due_date : (b.settled_on || b.spent_on)))
  const responsibleOptions = [...new Set(entries.filter((item) => item.kind === 'expense').flatMap((item) => responsibleNamesFor(item, userDisplayName(session.user))))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filteredMonthEntries = sortedMonthEntries.filter((item) => {
    const query = entryFilters.search.trim().toLocaleLowerCase('pt-BR')
    const searchable = [item.description, item.category, paymentLabel(item), item.amount, ...responsibleNamesFor(item, userDisplayName(session.user))].join(' ').toLocaleLowerCase('pt-BR')
    const responsibleMatch = entryFilters.responsible === 'all' || responsibleNamesFor(item, userDisplayName(session.user)).includes(entryFilters.responsible)
    return (!query || searchable.includes(query)) && (entryFilters.kind === 'all' || item.kind === entryFilters.kind) && (entryFilters.status === 'all' || item.status === entryFilters.status) && (entryFilters.category === 'all' || item.category === entryFilters.category) && (entryFilters.payment === 'all' || item.payment_method === entryFilters.payment) && responsibleMatch
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
  const visibleHistory = recentHistory.filter((row) => (historyAction === 'all' || row.action === historyAction) && (!historySearch || row.description.toLocaleLowerCase('pt-BR').includes(historySearch.toLocaleLowerCase('pt-BR'))))
  const globalSearchResults = globalSearchQuery.trim() ? entries.filter((item) => {
    const query = normalizeSearchText(globalSearchQuery)
    const searchable = [item.description, item.category, paymentLabel(item), item.amount, item.notes, item.paid_by, ...responsibleNamesFor(item, userDisplayName(session.user)), ...(item.shared_with || []), item.cards?.name, item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on), item.invoice_month].map(normalizeSearchText).join(' ')
    return searchable.includes(query)
  }).sort((a, b) => (b.status === 'pending' ? b.due_date : (b.settled_on || b.spent_on)).localeCompare(a.status === 'pending' ? a.due_date : (a.settled_on || a.spent_on))) : []

  function openGlobalSearchResult(item) {
    const relevantDate = item.card_id ? (item.invoice_month || item.spent_on) : (item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on))
    setGlobalSearchOpen(false); setGlobalSearchQuery(''); setEntryFilters({ search: '', kind: 'all', status: 'all', category: 'all', payment: 'all', responsible: 'all' })
    setSelectedMonth(relevantDate.slice(0, 7)); setActivePage(item.card_id ? 'cards' : 'month'); setHighlightedEntryId(item.id)
  }

  if (loading) return <main className="center-screen">Carregando…</main>
  if (!configured) return <SetupScreen />
  if (passwordRecovery && session) return <AuthScreen mode="reset" setMode={setAuthMode} email={email} setEmail={setEmail} username={username} setUsername={setUsername} password={password} setPassword={setPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} onSubmit={updateRecoveredPassword} message={message} onCancelRecovery={() => { setPasswordRecovery(false); setMessage('') }} />
  if (!session) return <AuthScreen mode={authMode} setMode={(nextMode) => { setAuthMode(nextMode); setMessage(''); setPassword('') }} email={email} setEmail={setEmail} username={username} setUsername={setUsername} password={password} setPassword={setPassword} onSubmit={authMode === 'forgot' ? sendPasswordRecovery : handleAuth} message={message} />

  return <div className={`app-shell ${hideValues ? 'values-hidden' : ''}`}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <aside className="sidebar" aria-label="Navegação principal">
      <div className="brand"><span className="brand-mark"><Wallet size={19} /></span><span>meu<span className="brand-light">controle</span></span></div>
      <div className="sidebar-group-label">SEU DINHEIRO</div>
      <button className={`nav-item ${activePage === 'month' ? 'active' : ''}`} aria-current={activePage === 'month' ? 'page' : undefined} onClick={() => setActivePage('month')}><LayoutDashboard size={17} /> Visão mensal</button>
      <button className={`nav-item ${activePage === 'year' ? 'active' : ''}`} aria-current={activePage === 'year' ? 'page' : undefined} onClick={() => setActivePage('year')}><ChartNoAxesCombined size={17} /> Visão anual</button>
      <button className={`nav-item ${activePage === 'categories' ? 'active' : ''}`} aria-current={activePage === 'categories' ? 'page' : undefined} onClick={() => setActivePage('categories')}><Tags size={17} /> Categorias</button>
      <button className={`nav-item ${activePage === 'cards' ? 'active' : ''}`} aria-current={activePage === 'cards' ? 'page' : undefined} onClick={() => setActivePage('cards')}><CreditCard size={17} /> Cartões e faturas</button>
      <button className={`nav-item ${activePage === 'responsible' ? 'active' : ''}`} aria-current={activePage === 'responsible' ? 'page' : undefined} onClick={() => setActivePage('responsible')}><Users size={17} /> Por pessoa</button>
      <button className={`nav-item ${activePage === 'savings' ? 'active' : ''}`} aria-current={activePage === 'savings' ? 'page' : undefined} onClick={() => setActivePage('savings')}><PiggyBank size={17} /> Cofrinhos</button>
      <button className={`nav-item ${activePage === 'recurring' ? 'active' : ''}`} aria-current={activePage === 'recurring' ? 'page' : undefined} onClick={() => setActivePage('recurring')}><Repeat size={17} /> Recorrências</button>
      <div className="sidebar-tip"><div className="tip-icon"><CalendarDays size={17} /></div><b>Seu mês, sob controle</b><span>Planeje o que vai entrar e o que precisa sair.</span></div>
      <div className="sidebar-user"><span className="user-avatar">{userDisplayName(session.user)[0]?.toUpperCase()}</span><span className="user-email"><b>{userDisplayName(session.user)}</b><small>{session.user.email}</small></span><button className="icon-button" aria-label="Alterar nome de usuário" title="Editar perfil" onClick={() => { setProfileName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''); setProfileModal(true) }}><Pencil size={16}/></button><button className="icon-button" aria-label="Sair da conta" title="Sair" onClick={signOut}><LogOut size={17} /></button></div>
    </aside>

    <main className="main-content" id="main-content" tabIndex="-1">
      <header className="page-header">
        <div><p className="eyebrow">CONTROLE FINANCEIRO</p><h1>{activePage === 'month' ? 'Visão mensal' : activePage === 'year' ? 'Visão anual' : activePage === 'categories' ? 'Categorias' : activePage === 'cards' ? 'Cartões e faturas' : activePage === 'responsible' ? 'Por pessoa' : activePage === 'savings' ? 'Cofrinhos' : 'Recorrências'}</h1><p className="page-subtitle">{activePage === 'month' ? 'Acompanhe o que entra, o que sai e o que ainda está pendente.' : activePage === 'year' ? 'Compare suas entradas e despesas mês a mês.' : activePage === 'categories' ? 'Organize seus lançamentos com categorias próprias.' : activePage === 'cards' ? 'Gerencie seus cartões e acompanhe cada fatura.' : activePage === 'responsible' ? 'Confira quanto cada responsável tem a pagar nas faturas.' : activePage === 'savings' ? 'Acompanhe o dinheiro que você separou para guardar.' : 'Automatize o registro mensal das contas e receitas fixas.'}</p></div>
        <div className="header-actions">
          <div className="header-utility-actions">
            <button className="icon-button privacy-toggle" type="button" aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={hideValues} title={hideValues ? 'Mostrar valores' : 'Ocultar valores'} onClick={() => setHideValues((hidden) => !hidden)}>{hideValues ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
            <button className="icon-button mobile-profile-button" type="button" aria-label="Editar nome de usuário" title="Editar perfil" onClick={() => { setProfileName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''); setProfileModal(true) }}><Pencil size={16}/></button>
            <button className="global-search-trigger" type="button" onClick={() => { setGlobalSearchQuery(''); setGlobalSearchOpen(true) }}><Search size={16}/><span>Buscar lançamentos</span><kbd>/</kbd></button>
          </div>
          <div className="header-page-actions">
            {activePage === 'year' ? <YearPicker value={selectedYear} onChange={setSelectedYear}/> : <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />}
            {activePage === 'month' && <button className="button primary" onClick={openNewEntry}><Plus size={17} /> Novo lançamento</button>}
            {activePage === 'cards' && <button className="button primary" onClick={openNewCard}><Plus size={17} /> Novo cartão</button>}
            {activePage === 'savings' && <button className="button primary" onClick={openNewPot}><Plus size={17} /> Novo cofrinho</button>}
            {activePage === 'recurring' && <button className="button primary" onClick={openNewRecurring}><Plus size={17} /> Nova recorrência</button>}
            {activePage === 'categories' && <button className="button primary" onClick={() => setCategoryForm({ kind: 'expense', name: '' })}><Plus size={17} /> Nova categoria</button>}
          </div>
        </div>
      </header>

      {message && <div className="notice" role="status" aria-live="polite">{message}<button onClick={() => setMessage('')}><X size={15} /></button></div>}

      {activePage === 'month' ? <>
        <section className="panel reminder-strip" aria-labelledby="due-alert-title"><div><Bell size={18}/><span><b id="due-alert-title">Alertas de vencimento</b><small>{overdueEntries.length ? `${overdueEntries.length} conta${overdueEntries.length === 1 ? '' : 's'} atrasada${overdueEntries.length === 1 ? '' : 's'}. ` : ''}{dueInSevenDays.length ? `${dueInSevenDays.length} vencem nos próximos ${reminderDays} dias.` : `Nenhuma conta vence nos próximos ${reminderDays} dias.`} Os avisos aparecem aqui quando você abre o sistema.</small></span></div><button className="button subtle" onClick={()=>setReminderModal(true)}>{reminderSettings.enabled?'Configurar':'Configurar avisos'}</button>{(overdueEntries.length || dueInSevenDays.length) ? <div className="due-alert-list">{[...overdueEntries, ...dueInSevenDays].slice(0,4).map(item=><div className="due-alert-item" key={item.id}><span className={item.due_date < todayKey ? 'overdue-label' : ''}>{item.due_date < todayKey ? 'Atrasada' : `Vence ${fmtDate(item.due_date)}`}</span><b>{item.description}</b><strong>{brl(item.amount)}</strong><button className="button subtle" aria-label={item.kind === 'income' ? `Marcar ${item.description} como recebida` : `Marcar ${item.description} como paga`} onClick={()=>settleEntry(item)}>{item.kind === 'income' ? 'Recebi' : 'Paguei'}</button></div>)}</div> : null}</section>
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
          {cashflowRows.length ? <div className="cashflow-table-wrap"><table className="cashflow-table"><thead><tr><th scope="col">Data</th><th scope="col">Entradas</th><th scope="col">Saídas</th><th scope="col">Variação do dia</th><th scope="col">Acumulado no mês</th><th scope="col">Lançamentos</th></tr></thead><tbody>{cashflowRows.map(row=><tr key={row.date}><th scope="row">{fmtDate(row.date)}</th><td className="income-text">{row.income ? `+ ${brl(row.income)}` : '—'}</td><td>{row.expenses ? `− ${brl(row.expenses)}` : '—'}</td><td className={row.net >= 0 ? 'income-text' : 'withdrawal-text'}>{row.net >= 0 ? '+' : '−'} {brl(Math.abs(row.net))}</td><td className={row.running >= 0 ? 'income-text' : 'withdrawal-text'}>{brl(row.running)}</td><td><button type="button" className="cashflow-open-day" onClick={() => { setCashflowDayDate(row.date); setCashflowConfirmAll(false) }}><ReceiptText size={14}/><span>Ver lançamentos</span><small>{row.entries.length}</small></button></td></tr>)}</tbody></table></div> : <EmptyState title="Sem movimentações previstas" text="Adicione contas ou receitas para acompanhar a evolução do saldo neste mês." action={<button className="button subtle" onClick={openNewEntry}><Plus size={15}/> Registrar lançamento</button>} />}
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

        <section className="panel month-close-panel"><PanelHeading title="Fechamento do mês" subtitle={monthClosure ? `Fechado em ${new Date(monthClosure.closed_at).toLocaleString('pt-BR')}` : 'Compare o orçamento com o realizado e salve um retrato deste mês.'} action={<button className="button primary" onClick={() => requestConfirmation({ title: monthClosure ? 'Atualizar fechamento?' : 'Fechar este mês?', message: `Salvar o comparativo de ${monthName(selectedMonth)}?`, details: 'O fechamento registra os totais e limites atuais. Você pode atualizar o retrato depois se editar lançamentos.', confirmLabel: monthClosure ? 'Atualizar fechamento' : 'Fechar mês', onConfirm: closeSelectedMonth })}><Check size={15}/>{monthClosure ? 'Atualizar fechamento' : 'Fechar mês'}</button>}/><div className="close-summary-grid"><div><span>Orçamento planejado</span><strong>{brl(displayedMonthSnapshot.planned_expenses)}</strong></div><div><span>Despesas realizadas</span><strong>{brl(displayedMonthSnapshot.actual_expenses)}</strong></div><div><span>Diferença</span><strong className={Number(displayedMonthSnapshot.planned_expenses)-Number(displayedMonthSnapshot.actual_expenses) < 0 ? 'withdrawal-text' : 'income-text'}>{brl(Number(displayedMonthSnapshot.planned_expenses)-Number(displayedMonthSnapshot.actual_expenses))}</strong></div><div><span>Resultado do mês</span><strong>{brl(displayedMonthSnapshot.net_result)}</strong></div></div>{displayedMonthSnapshot.categories?.length ? <div className="table-wrap"><table className="entry-table close-table"><thead><tr><th>Categoria</th><th className="align-right">Previsto</th><th className="align-right">Realizado</th><th className="align-right">Saldo do limite</th></tr></thead><tbody>{displayedMonthSnapshot.categories.map((item)=><tr key={item.category}><th scope="row">{item.category}</th><td className="align-right">{brl(item.planned)}</td><td className="align-right">{brl(item.actual)}</td><td className={`align-right ${Number(item.difference) < 0 ? 'withdrawal-text' : 'income-text'}`}>{brl(item.difference)}</td></tr>)}</tbody></table></div> : <p className="modal-help">Defina limites por categoria para incluir metas detalhadas no fechamento. O total de despesas e receitas já está sendo acompanhado.</p>}</section>

        <section className="panel history-panel"><PanelHeading title="Histórico recente" subtitle="Últimas criações, edições, pagamentos e exclusões" action={<span className="count-pill">{visibleHistory.length} eventos</span>}/><div className="history-filters"><label><Search size={15}/><input aria-label="Buscar no histórico" placeholder="Buscar descrição" value={historySearch} onChange={event=>setHistorySearch(event.target.value)}/></label><label><SlidersHorizontal size={14}/><select aria-label="Filtrar ação do histórico" value={historyAction} onChange={event=>setHistoryAction(event.target.value)}><option value="all">Todas as ações</option><option value="created">Criados</option><option value="updated">Editados</option><option value="settled">Pagos / recebidos</option><option value="deleted">Excluídos</option></select></label></div>{visibleHistory.length ? <div className="recent-history-list">{visibleHistory.slice(0,8).map((row)=><div className="recent-history-row" key={row.id}><span className={`history-dot ${row.action}`}/><div><b>{row.description}</b><small>{{created:'criado',updated:'editado',settled:'pago/recebido',deleted:'excluído'}[row.action] || row.action} · {new Date(row.changed_at).toLocaleString('pt-BR')}</small></div><strong>{brl((row.new_data || row.old_data)?.amount)}</strong>{entries.some((entry) => entry.id === row.expense_id) && <button className="button subtle" onClick={() => openHistory(entries.find((entry) => entry.id === row.expense_id))}>Detalhes</button>}</div>)}</div> : <p className="modal-help">{recentHistory.length ? 'Nenhum evento corresponde a esta busca.' : 'As alterações de lançamentos aparecerão aqui, inclusive os registros que forem removidos.'}</p>}</section>

        <section className="panel entries-panel">
          <PanelHeading title="Lançamentos do mês" subtitle={`${filteredMonthEntries.length} de ${sortedMonthEntries.length} registros em ${monthName(selectedMonth)}`} action={<button className="button subtle" onClick={openNewEntry}><Plus size={15} /> Adicionar</button>} />
          <EntryFilters value={entryFilters} onChange={setEntryFilters} categories={allCategories} responsibleOptions={responsibleOptions} />
          {filteredMonthEntries.length ? <EntryTable entries={filteredMonthEntries} highlightedEntryId={highlightedEntryId} attachments={attachments} defaultResponsible={userDisplayName(session.user)} onEdit={openEditEntry} onDelete={deleteEntry} onSettle={settleEntry} onHistory={openHistory} onShares={(item) => setShareModal({ ...item, share_details: sharesFor(item) })} onAttachments={(item) => setAttachmentModal({ item, files: attachments.filter((file) => file.expense_id === item.id) })} /> : <EmptyState title={sortedMonthEntries.length ? 'Nenhum resultado para estes filtros' : 'Este mês ainda está vazio'} text={sortedMonthEntries.length ? 'Tente mudar a busca ou os filtros.' : 'Adicione suas contas a pagar, valores a receber ou gastos do dia a dia.'} action={!sortedMonthEntries.length && <button className="button primary" onClick={openNewEntry}><Plus size={15} /> Criar lançamento</button>} />}
        </section>
      </> : activePage === 'year' ? <>
        {(() => { const rows = Array.from({length:12},(_,i)=>{const key=`${selectedYear}-${String(i+1).padStart(2,'0')}`;const list=entries.filter(item=>(item.status==='pending'?item.due_date:(item.settled_on||item.spent_on))?.startsWith(key));return {key,income:list.filter(x=>x.kind==='income').reduce((a,x)=>a+Number(x.amount),0),expense:list.filter(x=>x.kind==='expense').reduce((a,x)=>a+Number(x.amount),0)}});const max=Math.max(...rows.flatMap(x=>[x.income,x.expense]),1);return <><section className="stats-grid"><SummaryCard label="Entradas no ano" value={brl(rows.reduce((a,x)=>a+x.income,0))} detail={`Receitas registradas em ${selectedYear}`} icon={<ArrowDownLeft size={17}/>} tone="purple"/><SummaryCard label="Despesas no ano" value={brl(rows.reduce((a,x)=>a+x.expense,0))} detail={`Despesas registradas em ${selectedYear}`} icon={<ArrowUpRight size={17}/>} tone="blue"/><SummaryCard label="Resultado anual" value={brl(rows.reduce((a,x)=>a+x.income-x.expense,0))} detail="Entradas menos despesas" icon={<Wallet size={17}/>} tone="green"/></section><section className="panel annual-panel"><PanelHeading title={`Resumo de ${selectedYear}`} subtitle="Selecione um mês para abrir seus detalhes e lançamentos."/><div className="annual-grid">{rows.map(row=><button className="annual-month" key={row.key} onClick={()=>{setSelectedMonth(row.key);setActivePage('month')}}><b>{monthName(row.key,{month:'long'})}</b><div className="annual-bars"><i className="income-bar" style={{height:`${Math.max(row.income?4:0,row.income/max*100)}%`}}/><i className="expense-bar" style={{height:`${Math.max(row.expense?4:0,row.expense/max*100)}%`}}/></div><span>Entradas {brl(row.income)}</span><span>Despesas {brl(row.expense)}</span><strong>{brl(row.income-row.expense)}</strong></button>)}</div></section></>})()}
      </> : activePage === 'responsible' ? <>
        <section className="responsible-page-intro"><div className="responsible-intro-copy"><span className="eyebrow">RESUMO DO MÊS</span><h2>Pagamentos por pessoa</h2><p>Valores pendentes nas faturas de <b>{monthName(selectedMonth)}</b>, distribuídos pelos responsáveis de cada compra.</p></div><div className="responsible-intro-total"><span>Total pendente</span><strong>{brl(responsibleMonthlyPaymentList.reduce((sum, person) => sum + person.total, 0))}</strong><small>{responsibleMonthlyPaymentList.length} responsável(is) com valores neste mês</small></div></section>
        <section className="panel responsible-month-summary"><PanelHeading title="Quanto cada pessoa precisa pagar" subtitle="Os valores consideram somente compras de cartão ainda pendentes e respeitam o percentual de responsabilidade definido em cada lançamento." />{responsibleMonthlyPaymentList.length ? <div className="responsible-month-grid">{responsibleMonthlyPaymentList.map((person, personIndex) => { const itemCount = Object.values(person.cards).reduce((sum, card) => sum + card.entries.length, 0); const monthTotal = responsibleMonthlyPaymentList.reduce((sum, item) => sum + item.total, 0); const sharePercent = monthTotal ? person.total / monthTotal * 100 : 0; return <article className="responsible-month-person" key={person.name}><div className="responsible-month-person-head"><span className="responsible-person-avatar" aria-hidden="true">{person.name.trim().charAt(0).toLocaleUpperCase('pt-BR')}</span><span className="responsible-person-name"><b>{person.name}</b><small>{itemCount} compra(s) pendente(s) neste mês</small></span><strong>{brl(person.total)}</strong></div><div className="responsible-person-share"><div><span>Participação no total</span><b>{sharePercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b></div><span className="responsible-person-share-track"><i style={{ width: `${sharePercent}%` }} /></span></div><div className="responsible-month-card-breakdown">{Object.values(person.cards).sort((a,b)=>b.total-a.total).map((card) => <div key={card.name}><span>{card.name}</span><b>{brl(card.total)}</b></div>)}</div><div className="responsible-details"><button type="button" className="responsible-details-toggle" onClick={() => setExpandedResponsibleDetails(person)}><span>Ver compras e parcelas</span><small>{itemCount}</small><ChevronDown size={14} aria-hidden="true" /></button></div></article>})}</div> : <EmptyState title="Nenhum valor pendente por responsável" text={`Não há compras de cartão em aberto nas faturas de ${monthName(selectedMonth)}.`} />}</section>
      </> : activePage === 'cards' ? <>
        <section className="card-intro"><div><span className="eyebrow">ACOMPANHAMENTO DE FATURAS</span><h2>Faturas de {monthName(selectedMonth)}</h2><p>Filtre por cartão, mês e situação para encontrar uma fatura.</p></div><div className="card-intro-total"><span>Total nas faturas filtradas</span><strong>{brl(filteredMonthCards.reduce((sum, item) => sum + item.invoiceTotal, 0))}</strong></div></section>
        <section className="panel invoice-filter-bar" aria-label="Filtros de faturas"><label>Cartão<select aria-label="Filtrar por cartão" value={invoiceCardFilter} onChange={(event) => setInvoiceCardFilter(event.target.value)}><option value="all">Todos os cartões</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label><label>Mês<input aria-label="Filtrar faturas por mês" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label><label>Situação<select aria-label="Filtrar por situação da fatura" value={invoiceStatusFilter} onChange={(event) => setInvoiceStatusFilter(event.target.value)}><option value="all">Todas</option><option value="open">Em aberto</option><option value="paid">Pagas</option></select></label></section>

        {invoiceDueAlerts.length > 0 && <section className={`invoice-due-alert ${invoiceDueAlerts.some((alert) => alert.daysRemaining < 0) ? 'has-overdue' : ''}`} role="status"><div className="invoice-due-heading"><CalendarDays size={19}/><span><b>{invoiceDueAlerts.some((alert) => alert.daysRemaining < 0) ? 'Faturas precisam de atenção' : 'Vencimento próximo'}</b><small>Faturas abertas vencidas ou com vencimento nos próximos 7 dias.</small></span></div><div className="invoice-due-list">{invoiceDueAlerts.map(({card,dueDate,daysRemaining})=><div className={`invoice-due-item ${daysRemaining < 0 ? 'overdue' : ''}`} key={card.id}><b>{card.name}</b><span>{daysRemaining < 0 ? `Vencida há ${Math.abs(daysRemaining)} dia${Math.abs(daysRemaining)===1?'':'s'}` : daysRemaining === 0 ? 'Vence hoje' : daysRemaining === 1 ? 'Vence amanhã' : `Vence em ${daysRemaining} dias`} · {fmtDate(dueDate)}</span><strong>{brl(card.invoiceTotal)}</strong><button type="button" className="button subtle" onClick={()=>{setInvoiceCardFilter(card.id);setInvoiceStatusFilter('open')}}>Ver fatura</button></div>)}</div></section>}
        {cards.length ? filteredMonthCards.length ? <section className="managed-card-grid">{filteredMonthCards.map((item, index) => <article className="managed-card" key={item.id}><div className={`bank-card bank-card-${item.color || 'violet'}`}><div className="bank-card-top"><span>MEU CONTROLE</span><CreditCard size={20} /></div><div className="bank-card-chip" /><b>{item.name}</b><div className="bank-card-footer"><span>FECHAMENTO <strong>{String(item.closing_day).padStart(2, '0')}</strong></span><span>VENCIMENTO <strong>{String(item.due_day).padStart(2, '0')}</strong></span></div></div><div className="managed-card-body"><div><span>Fatura de {monthName(selectedMonth, { month: 'long' })}</span><strong>{brl(item.invoiceTotal)}</strong></div><div className="invoice-status-row">{item.invoiceEntries.length ? <><span className={`status-pill ${item.invoicePaid ? 'settled' : 'pending'}`}>{item.invoicePaid ? 'Fatura paga' : 'Em aberto'}</span>{item.invoicePaidOn && <small>em {fmtDate(item.invoicePaidOn)}</small>}<button className={`button ${item.invoicePaid ? 'subtle' : 'primary'}`} onClick={() => toggleInvoicePaid(item)}>{item.invoicePaid ? 'Reabrir fatura' : 'Marcar fatura paga'}</button></> : <span className="invoice-empty-label">Sem compras neste mês</span>}</div>{Object.keys(item.responsibleTotals).length > 0 && <div className="invoice-responsible-summary"><b>Por responsável</b>{Object.entries(item.responsibleTotals).sort((a,b)=>b[1]-a[1]).map(([name,total])=><div key={name}><span>{name}</span><strong>{brl(total)}</strong></div>)}</div>}<div className="card-limit-row"><div><span>Limite total</span><strong>{item.credit_limit == null ? '—' : brl(item.credit_limit)}</strong></div><div><span>Disponível agora</span><strong>{item.availableCalculated == null ? '—' : brl(item.availableCalculated)}</strong><small className="limit-explanation">Limite total menos compras pendentes</small></div></div><p>{item.pendingCount} compra{item.pendingCount === 1 ? '' : 's'} ainda pendente{item.pendingCount === 1 ? '' : 's'}</p><div className="card-actions"><button className="button subtle" onClick={() => openEditCard(item)}><Pencil size={14} /> Editar cartão</button><button className="icon-button danger" aria-label={`Excluir cartão ${item.name}`} title="Excluir cartão" onClick={() => deleteCard(item)}><Trash2 size={16} /></button></div></div></article>)}</section> : <section className="panel"><EmptyState title="Nenhuma fatura encontrada" text="Tente trocar o cartão, o mês ou a situação selecionada." /></section> : <section className="panel card-empty"><EmptyState title="Cadastre seu primeiro cartão" text="Depois você poderá acompanhar o total das compras por mês e a data de cada fatura." action={<button className="button primary" onClick={openNewCard}><Plus size={15} /> Cadastrar cartão</button>} /></section>}
        <section className="panel entries-panel"><PanelHeading title="Compras nos cartões" subtitle={`Lançamentos associados à fatura de ${monthName(selectedMonth)}`} /><label className="invoice-filter"><Users size={14}/><span>Responsável</span><select aria-label="Filtrar compras por responsável" value={cardResponsibleFilter} onChange={(event) => setCardResponsibleFilter(event.target.value)}><option value="all">Todos</option>{responsibleOptions.map((name) => <option key={name}>{name}</option>)}</select></label><EntryTable entries={filteredCardMonthEntries} highlightedEntryId={highlightedEntryId} defaultResponsible={userDisplayName(session.user)} onEdit={openEditEntry} onDelete={deleteEntry} onSettle={settleEntry} attachments={attachments} onHistory={openHistory} onShares={(item) => setShareModal({ ...item, share_details: sharesFor(item) })} onAttachments={(item) => setAttachmentModal({ item, files: attachments.filter((file) => file.expense_id === item.id) })} emptyText={cardMonthEntries.length && cardResponsibleFilter !== 'all' ? 'Nenhuma compra corresponde a este responsável.' : 'Não há compras lançadas para as faturas deste mês.'} /></section>
      </> : activePage === 'savings' ? <>
        {savingsGoals.length > 0 && <section className="panel goal-summary-panel"><PanelHeading title="Resumo das metas" subtitle={`${savingsGoals.length} cofrinho${savingsGoals.length === 1 ? '' : 's'} com objetivo definido`}/><div className="goal-summary-grid"><div><span>Guardado para as metas</span><strong>{brl(totalGoalSaved)}</strong></div><div><span>Falta para alcançar</span><strong>{brl(totalGoalRemaining)}</strong></div><div><span>Valor total das metas</span><strong>{brl(totalGoalAmount)}</strong></div><div className="goal-summary-progress"><div><span>Progresso geral</span><b>{Math.round(totalGoalAmount ? totalGoalSaved / totalGoalAmount * 100 : 0)}%</b></div><i role="progressbar" aria-label="Progresso geral das metas" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(totalGoalAmount ? totalGoalSaved / totalGoalAmount * 100 : 0)}><span style={{width:`${Math.min(100,totalGoalAmount ? totalGoalSaved / totalGoalAmount * 100 : 0)}%`}}/></i></div></div></section>}
        <section className="savings-hero"><div><span className="hero-kicker">TOTAL GUARDADO</span><strong>{brl(potBalances.reduce((sum, pot) => sum + pot.balance, 0))}</strong><span className="hero-caption">Saldo somado dos seus cofrinhos</span></div><div className="savings-month"><span>Movimentações em {monthName(selectedMonth)}</span><b className="income-text">+ {brl(monthDeposits)} guardados</b><b className="withdrawal-text">− {brl(monthWithdrawals)} retirados</b></div><PiggyBank className="savings-hero-icon" size={35} /></section>
        <section className="panel savings-note"><span><PiggyBank size={18}/><span>Os valores dos cofrinhos são um acompanhamento manual separado das despesas. Assim, guardar dinheiro não aparece como um novo gasto no seu orçamento.</span></span><button className="button subtle" onClick={openEmergencyFund}><Target size={15}/> Sugerir meta de emergência</button></section>
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

    {cashflowDayDate && (() => { const row = cashflowRows.find((item) => item.date === cashflowDayDate); if (!row) return null; const pending = row.entries.filter((item) => item.status === 'pending'); const pendingTotal = pending.reduce((sum, item) => sum + Number(item.amount), 0); return <Modal title={cashflowConfirmAll ? 'Confirmar lançamentos do dia' : `Lançamentos de ${fmtDate(row.date)}`} onClose={() => { setCashflowDayDate(null); setCashflowConfirmAll(false) }} className="cashflow-day-modal">{cashflowConfirmAll ? <div className="cashflow-day-confirm"><span className="cashflow-day-confirm-icon"><Check size={20}/></span><p>Marcar <b>{pending.length} lançamento(s)</b> como concluído(s)?</p><small>As despesas serão marcadas como pagas e as receitas como recebidas. Total dos pendentes: {brl(pendingTotal)}.</small><div className="modal-actions"><button type="button" className="button subtle" disabled={cashflowBulkBusy} onClick={() => setCashflowConfirmAll(false)}>Voltar</button><button type="button" className="button primary" disabled={cashflowBulkBusy} onClick={settleCashflowDay}><Check size={15}/>{cashflowBulkBusy ? 'Salvando…' : 'Confirmar'}</button></div></div> : <div className="cashflow-day-content"><p>Contas e receitas previstas para esta data.</p><div className="cashflow-day-list">{row.entries.slice().sort((a, b) => a.kind === b.kind ? a.description.localeCompare(b.description, 'pt-BR') : a.kind === 'expense' ? -1 : 1).map((item) => <article className="cashflow-day-entry" key={item.id}><span className={`entry-kind-icon ${item.kind}`}>{item.kind === 'income' ? <ArrowDownLeft size={15}/> : <ArrowUpRight size={15}/>}</span><span className="cashflow-day-entry-copy"><b>{item.description}</b><small>{item.category} · {item.kind === 'income' ? 'Receita' : 'Despesa'}</small></span><strong className={item.kind === 'income' ? 'income-text' : 'withdrawal-text'}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount)}</strong>{item.status === 'pending' ? <button type="button" className="button subtle cashflow-day-settle" onClick={() => settleEntry(item)}>{item.kind === 'income' ? 'Marcar recebida' : 'Marcar paga'}</button> : <span className="status-pill settled">{item.kind === 'income' ? 'Recebida' : 'Paga'}</span>}</article>)}</div><div className="modal-actions"><button type="button" className="button subtle" onClick={() => { setCashflowDayDate(null); setCashflowConfirmAll(false) }}>Fechar</button>{pending.length > 0 && <button type="button" className="button primary" onClick={() => setCashflowConfirmAll(true)}><Check size={15}/>Concluir todos ({pending.length})</button>}</div></div>}</Modal> })()}
    {expandedResponsibleDetails && <Modal title={`Compras e parcelas de ${expandedResponsibleDetails.name}`} onClose={() => setExpandedResponsibleDetails(null)} className="responsible-purchases-modal"><div className="responsible-purchases-modal-content"><p>Compras de cartão pendentes em <b>{monthName(selectedMonth)}</b>, separadas por cartão.</p><div className="responsible-purchases-modal-list">{Object.values(expandedResponsibleDetails.cards).sort((a, b) => b.total - a.total).map((card) => <section className="responsible-purchases-modal-card" key={card.name}><header><b>{card.name}</b><strong>{brl(card.total)}</strong></header>{card.entries.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).map((entry) => <div className="responsible-purchase-modal-row" key={entry.id}><span>{entry.description}{entry.installment_number ? ` · parcela ${entry.installment_number}/${entry.installment_count}` : ''}<small>Vence {fmtDate(entry.due_date)}</small></span><b>{brl(entry.responsibilityAmount)}</b></div>)}</section>)}</div><footer><span>Total atribuído a {expandedResponsibleDetails.name}</span><strong>{brl(expandedResponsibleDetails.total)}</strong></footer></div></Modal>}
    {profileModal && <ProfileModal value={profileName} onChange={setProfileName} onClose={() => setProfileModal(false)} onSubmit={saveProfileName} /> }
    {entryModal && <EntryModal title={editingEntryId ? 'Editar lançamento' : 'Novo lançamento'} value={entryForm} cards={cards} customCategories={userCategories} onChange={setEntryForm} onClose={() => setEntryModal(false)} onSubmit={saveEntry} />}
    {csvModal && <CsvImportModal rows={csvRows} error={csvError} busy={csvBusy} onFile={importCsvFile} onTemplate={downloadCsvTemplate} onImport={importCsvRows} onClose={() => setCsvModal(false)} />}
    {historyModal && <HistoryModal item={historyModal} rows={historyRows} onClose={() => setHistoryModal(null)} />}
    {globalSearchOpen && <GlobalSearchModal query={globalSearchQuery} onQueryChange={setGlobalSearchQuery} results={globalSearchResults} onSelect={openGlobalSearchResult} onClose={() => setGlobalSearchOpen(false)} />}
    {shareModal && <ShareSettlementModal item={shareModal} onSettle={saveShareSettlement} onClose={() => setShareModal(null)} />}
    {attachmentModal && <AttachmentModal item={attachmentModal.item} files={attachmentModal.files} onOpen={openAttachment} onDelete={deleteAttachment} onClose={() => setAttachmentModal(null)} />}
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

function EntryTable({ entries, onEdit, onDelete, onSettle, onHistory, onAttachments, onShares, highlightedEntryId, attachments = [], defaultResponsible = 'Eu', emptyText = 'Não há lançamentos neste mês.' }) {
  if (!entries.length) return <EmptyState title="Nada para mostrar" text={emptyText} />
  return <div className="table-wrap"><table className="entry-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th>Data / vencimento</th><th>Situação</th><th className="align-right">Valor</th><th aria-label="Ações" /></tr></thead><tbody>{entries.map((item) => { const displayDate = item.card_id ? item.spent_on : item.status === 'pending' ? item.due_date : (item.settled_on || item.spent_on); const responsibleLabel = responsibleDetailsFor(item, defaultResponsible).map((person) => `${person.name} (${Number(person.percentage)}%)`).join(', '); return <tr key={item.id} data-entry-id={item.id} className={highlightedEntryId === item.id ? 'entry-highlighted' : ''}><td><div className="entry-name"><span className={`entry-kind-icon ${item.kind}`} title={item.kind === 'income' ? 'Receita' : 'Despesa'}>{item.kind === 'income' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><span><b>{item.description}</b><small>{item.installment_number ? `Parcela ${item.installment_number} de ${item.installment_count} · ` : ''}{item.kind === 'income' ? 'Receita' : 'Despesa'}{item.paid_by ? ` · Pago por ${item.paid_by}` : ''}{item.kind === 'expense' ? ` · Responsável: ${responsibleLabel}` : ''}{item.shared_with?.length ? ` · Rateio: ${shareBreakdown(item)}` : ''}{item.notes ? ` · ${item.notes}` : ''}</small></span></div></td><td>{item.category}</td><td>{item.kind === 'income' ? '—' : paymentLabel(item)}</td><td>{fmtDate(displayDate)}</td><td><span className={`status-pill ${item.status}`}>{item.status === 'pending' ? 'Pendente' : item.kind === 'income' ? 'Recebida' : 'Paga'}</span></td><td className={`align-right amount ${item.kind === 'income' ? 'income-text' : ''}`}>{item.kind === 'income' ? '+' : '−'} {brl(item.amount)}</td><td><div className="row-actions">{item.shared_with?.length > 0 && <button className="icon-button" aria-label={`Controlar acertos do rateio de ${item.description}`} title="Acerto do rateio" onClick={() => onShares(item)}><Users size={15}/></button>}{item.status === 'pending' && <button className="icon-button" aria-label={item.kind === 'income' ? `Marcar ${item.description} como recebida` : `Marcar ${item.description} como paga`} title={item.kind === 'income' ? 'Marcar recebida' : 'Marcar paga'} onClick={() => onSettle(item)}><Check size={15} /></button>}{attachments.some((file) => file.expense_id === item.id) && <button className="icon-button" aria-label={`Abrir comprovantes de ${item.description}`} title="Comprovantes" onClick={() => onAttachments(item)}><Paperclip size={15}/></button>}<button className="icon-button" aria-label={`Ver histórico de ${item.description}`} title="Histórico" onClick={() => onHistory(item)}><History size={15}/></button><button className="icon-button" aria-label={`Editar ${item.description}`} title="Editar" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`Excluir ${item.description}`} title="Excluir" onClick={() => onDelete(item)}><Trash2 size={15} /></button></div></td></tr> })}</tbody></table></div>
}

function EntryModal({ title, value, cards, customCategories = [], onChange, onClose, onSubmit }) {
  const [attachmentError, setAttachmentError] = useState('')
  const set = (key, next) => onChange({ ...value, [key]: next })
  const participantNames = [...new Set((value.shared_with || '').split(/[,;]/).map((name) => name.trim()).filter(Boolean))]
  const updateParticipants = (text) => {
    const names = [...new Set(text.split(/[,;]/).map((name) => name.trim()).filter(Boolean))]
    const shares = names.map((name) => value.share_details?.find((share) => share.name === name) || { name, amount: '', settled: false })
    onChange({ ...value, shared_with: text, share_details: shares })
  }
  const updateResponsibles = (text) => {
    const names = [...new Set(text.split(/[,;]/).map((name) => name.trim()).filter(Boolean))]
    const percentage = names.length ? Math.round(10000 / names.length) / 100 : 0
    const shares = names.map((name, index) => ({ name, percentage: index === names.length - 1 ? 100 - percentage * (names.length - 1) : percentage }))
    onChange({ ...value, responsible_person: text, responsible_details: shares })
  }
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
    {value.kind === 'expense' && <><label>Responsável(is) pela despesa<input maxLength="240" value={value.responsible_person || ''} onChange={(event) => updateResponsibles(event.target.value)} placeholder="Ex.: David, Ana" /></label>{(value.responsible_details || []).length > 0 && <div className="responsible-editor">{value.responsible_details.map((person) => <label key={person.name}>{person.name} · responsabilidade (%)<input type="number" min="0" max="100" step="0.01" value={person.percentage} onChange={(event) => onChange({ ...value, responsible_details: value.responsible_details.map((share) => share.name === person.name ? { ...share, percentage: event.target.value } : share) })} /></label>)}</div>}<p className="modal-help">Se deixar vazio, você será o responsável. Para dividir, informe os nomes separados por vírgula e distribua 100% entre eles. Em compras parceladas, os percentuais valem para todas as parcelas. Isso é separado de quem pagou e do rateio de reembolso.</p><div className="rateio-label"><Users size={15}/> Rateio entre pessoas</div><div className="modal-form-two"><label>Quem pagou<input maxLength="80" value={value.paid_by || ''} onChange={(event) => set('paid_by', event.target.value)} placeholder="Ex.: David" /></label><label>Participantes<input maxLength="240" value={value.shared_with || ''} onChange={(event) => updateParticipants(event.target.value)} placeholder="Nomes separados por vírgula" /></label></div>{participantNames.length > 0 && <div className="share-editor">{participantNames.map((name) => <label key={name}>{name} · parte (R$)<input type="number" min="0" step="0.01" value={value.share_details?.find((share) => share.name === name)?.amount ?? ''} onChange={event=>onChange({...value,share_details:(value.share_details||[]).map(share=>share.name===name?{...share,amount:event.target.value}:share)})} placeholder="Em branco = divisão igual" /></label>)}</div>}<p className="modal-help">Deixe todas as partes em branco para dividir igualmente. Se informar valores, preencha todos e a soma precisa bater com o total.</p></>}
    <label>Observações (opcional)<textarea maxLength="1000" rows="2" value={value.notes || ''} onChange={(event) => set('notes', event.target.value)} placeholder="Detalhes ou referência do lançamento" /></label>
    <label>Anexar comprovantes (PDF, JPG, PNG ou WebP · até 10 MB cada)<input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const files = [...event.target.files]; const invalid = files.find((file) => file.size > 10 * 1024 * 1024 || !['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)); if (invalid) { setAttachmentError('Escolha PDF, JPG, PNG ou WebP com até 10 MB por arquivo.'); onChange({ ...value, attachmentFiles: [] }); event.target.value = ''; return } setAttachmentError(''); set('attachmentFiles', files) }} />{attachmentError && <small className="form-error">{attachmentError}</small>}{value.attachmentFiles?.length > 0 && <small>{value.attachmentFiles.map((file) => file.name).join(', ')}</small>}</label>
    <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15} /> Salvar lançamento</button></div>
  </form></Modal>
}

function CardModal({ title, value, onChange, onClose, onSubmit }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  const selectedColor = cardColors.find((color) => color.id === value.color) || cardColors[0]
  return <Modal title={title} onClose={onClose}><form className="modal-form" onSubmit={onSubmit}>
    <label>Nome do cartão<input required maxLength="60" value={value.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Cartão principal" /></label>
    <fieldset className="card-color-field"><legend>Cor do banner</legend><div className="card-color-options" role="radiogroup" aria-label="Cor do banner do cartão">{cardColors.map((color) => <button type="button" key={color.id} className={`card-color-swatch ${value.color === color.id ? 'selected' : ''}`} style={{ '--swatch-start': color.start, '--swatch-end': color.end }} role="radio" aria-checked={value.color === color.id} aria-label={color.label} title={color.label} onClick={() => set('color', color.id)} />)}</div><small>Escolha uma cor para identificar este cartão.</small></fieldset>
    <div className={`bank-card bank-card-${selectedColor.id} card-color-preview`} aria-label={`Prévia do cartão ${value.name || ''}`}><div className="bank-card-top"><span>MEU CONTROLE</span><CreditCard size={18} /></div><div className="bank-card-chip" /><b>{value.name || 'Nome do cartão'}</b></div>
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

function EntryFilters({ value, onChange, categories, responsibleOptions = [] }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  const active = value.search || value.kind !== 'all' || value.status !== 'all' || value.category !== 'all' || value.payment !== 'all' || value.responsible !== 'all'
  return <div className="entry-filters"><label className="search-field"><Search size={16}/><input aria-label="Buscar por descrição, categoria, forma de pagamento ou valor" placeholder="Buscar lançamento" value={value.search} onChange={(event) => set('search', event.target.value)}/></label><label><SlidersHorizontal size={14}/><select aria-label="Filtrar por tipo" value={value.kind} onChange={(event) => set('kind', event.target.value)}><option value="all">Todos os tipos</option><option value="expense">Despesas</option><option value="income">Receitas</option></select></label><label><select aria-label="Filtrar por situação" value={value.status} onChange={(event) => set('status', event.target.value)}><option value="all">Todas as situações</option><option value="pending">Pendentes</option><option value="settled">Pagas / recebidas</option></select></label><label><select aria-label="Filtrar por categoria" value={value.category} onChange={(event) => set('category', event.target.value)}><option value="all">Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><select aria-label="Filtrar por forma de pagamento" value={value.payment} onChange={(event) => set('payment', event.target.value)}><option value="all">Todas as formas</option><option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option><option value="other">Outro</option></select></label><label><Users size={14}/><select aria-label="Filtrar por responsável" value={value.responsible || 'all'} onChange={(event) => set('responsible', event.target.value)}><option value="all">Todos responsáveis</option>{responsibleOptions.map((name) => <option key={name}>{name}</option>)}</select></label>{active && <button type="button" className="button subtle clear-filters" onClick={() => onChange({search:'',kind:'all',status:'all',category:'all',payment:'all',responsible:'all'})}>Limpar filtros</button>}</div>
}

function GlobalSearchModal({query,onQueryChange,results,onSelect,onClose}) {
  return <Modal className="global-search-modal" title="Buscar lançamentos" onClose={onClose}><div className="global-search-content"><label className="global-search-input"><Search size={18}/><input autoFocus type="search" value={query} onChange={event=>onQueryChange(event.target.value)} placeholder="Descrição, categoria, cartão, observação…" aria-label="Buscar em todos os lançamentos"/><kbd>ESC</kbd></label>{!query.trim() ? <div className="global-search-empty"><span><Search size={19}/></span><b>Procure em todos os meses</b><small>Busque por descrição, categoria, forma de pagamento, cartão ou observação.</small></div> : results.length ? <><p className="global-search-count">{results.length} resultado{results.length === 1 ? '' : 's'}{results.length > 50 ? ' · mostrando os 50 mais recentes' : ''}</p><div className="global-search-results">{results.slice(0,50).map(item=>{const date=item.status==='pending'?item.due_date:(item.settled_on||item.spent_on);return <button type="button" className="global-search-result" key={item.id} onClick={()=>onSelect(item)}><span className={`entry-kind-icon ${item.kind}`}>{item.kind==='income'?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><span className="global-search-result-copy"><b>{item.description}</b><small>{item.kind==='income'?'Receita':'Despesa'} · {item.category} · {item.cards?.name || paymentLabel(item)} · {fmtDate(date)}</small></span><span className="global-search-result-value"><strong className={`amount ${item.kind==='income'?'income-text':''}`}>{item.kind==='income'?'+':'−'} {brl(item.amount)}</strong><small className={`status-pill ${item.status}`}>{item.status==='pending'?'Pendente':item.kind==='income'?'Recebida':'Paga'}</small></span></button>})}</div></> : <div className="global-search-empty"><span><Search size={19}/></span><b>Nenhum lançamento encontrado</b><small>Tente outra palavra, categoria ou forma de pagamento.</small></div>}</div></Modal>
}

function CsvImportModal({ rows, error, busy, onFile, onTemplate, onImport, onClose }) {
  const validCount = rows.filter((row) => !row.error).length
  return <Modal title="Importar lançamentos por CSV" onClose={onClose}><div className="modal-form csv-import-form"><p className="modal-help">Use o modelo para importar despesas e receitas. Datas aceitas: AAAA-MM-DD ou DD/MM/AAAA. Para rateio, separe os nomes com |.</p><button type="button" className="button subtle" onClick={onTemplate}><Download size={15}/> Baixar modelo CSV</button><label>Arquivo CSV<input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])}/></label>{error && <div className="notice" role="alert">{error}</div>}{rows.length > 0 && <><div className="csv-summary">{validCount} linhas válidas · {rows.length-validCount} com erro · máximo de 500 por importação</div><div className="table-wrap csv-preview"><table className="entry-table"><thead><tr><th>Linha</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Validação</th></tr></thead><tbody>{rows.slice(0,20).map((row)=><tr key={row.line}><td>{row.line}</td><td>{row.value.kind === 'income' ? 'Receita' : 'Despesa'}</td><td>{row.value.description}</td><td>{brl(row.value.amount)}</td><td className={row.error ? 'withdrawal-text' : 'income-text'}>{row.error || 'Pronta'}</td></tr>)}</tbody></table></div>{rows.length > 20 && <small>Prévia das primeiras 20 linhas; todas as {rows.length} serão validadas.</small>}</>}<div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button type="button" className="button primary" disabled={busy || validCount === 0} onClick={onImport}><FileUp size={15}/>{busy ? 'Importando…' : `Importar ${validCount || ''} lançamentos`}</button></div></div></Modal>
}

function HistoryModal({ item, rows, onClose }) {
  const labels = { created: 'Lançamento criado', updated: 'Lançamento editado', settled: 'Marcado como pago/recebido', deleted: 'Lançamento excluído' }
  const describe = (row) => {
    if (row.action === 'created') return `Valor inicial: ${brl(row.new_data?.amount)} · ${row.new_data?.category || 'Sem categoria'}`
    if (row.action === 'deleted') return `Último valor registrado: ${brl(row.old_data?.amount)} · ${row.old_data?.status === 'settled' ? 'Pago/recebido' : 'Pendente'}`
    const old = row.old_data || {}; const next = row.new_data || {}; const changes = []
    if (Number(old.amount) !== Number(next.amount)) changes.push(`Valor: ${brl(old.amount)} → ${brl(next.amount)}`)
    if (old.status !== next.status) changes.push(`Situação: ${old.status === 'settled' ? 'paga/recebida' : 'pendente'} → ${next.status === 'settled' ? 'paga/recebida' : 'pendente'}`)
    if (old.category !== next.category) changes.push(`Categoria: ${old.category} → ${next.category}`)
    if (old.due_date !== next.due_date) changes.push(`Vencimento: ${fmtDate(old.due_date)} → ${fmtDate(next.due_date)}`)
    return changes.join(' · ') || 'Detalhes do lançamento atualizados.'
  }
  return <Modal title={`Histórico · ${item.description}`} onClose={onClose}><div className="history-list">{rows.length ? rows.map((row)=><article className="history-item" key={row.id}><div><b>{labels[row.action] || 'Alteração'}</b><time>{new Date(row.changed_at).toLocaleString('pt-BR')}</time></div><p>{describe(row)}</p></article>) : <p className="modal-help">Ainda não há alterações registradas para este lançamento.</p>}</div><div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Fechar</button></div></Modal>
}

function AttachmentModal({ item, files, onOpen, onDelete, onClose }) {
  return <Modal title={`Comprovantes · ${item.description}`} onClose={onClose}><div className="attachment-list">{files.length ? files.map((file)=><div className="attachment-item" key={file.id}><Paperclip size={16}/><span><b>{file.file_name}</b><small>{(file.size_bytes/1024/1024).toFixed(2)} MB · {fmtDate(file.created_at.slice(0,10))}</small></span><button className="button subtle" onClick={()=>onOpen(file)}>Abrir</button><button className="icon-button danger" aria-label={`Excluir anexo ${file.file_name}`} title="Excluir anexo" onClick={()=>onDelete(file)}><Trash2 size={15}/></button></div>) : <p className="modal-help">Nenhum comprovante encontrado.</p>}</div><div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Fechar</button></div></Modal>
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

function Modal({ title, onClose, children, className = '' }) {
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

function ProfileModal({ value, onChange, onClose, onSubmit }) {
  return <Modal title="Editar nome de usuário" onClose={onClose}><form className="modal-form" onSubmit={onSubmit}><label>Nome de usuário<input type="text" required minLength="2" maxLength="40" autoComplete="nickname" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Como devemos chamar você?" /></label><p className="modal-help">Esse nome aparece no seu perfil e como responsável padrão nas despesas que você registrar.</p><div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={15}/> Salvar nome</button></div></form></Modal>
}

function AuthScreen({ mode, setMode, email, setEmail, username = '', setUsername, password, setPassword, confirmPassword = '', setConfirmPassword, onSubmit, message, onCancelRecovery }) {
  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  function switchMode() { setMode(isLogin ? 'signup' : 'login') }
  const heading = isReset ? 'Defina sua nova senha' : isForgot ? 'Recupere seu acesso' : isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'
  const description = isReset ? 'Escolha uma senha nova para voltar a acessar sua conta.' : isForgot ? 'Informe o e-mail da sua conta e enviaremos um link de redefinição.' : isLogin ? 'Entre para continuar cuidando do seu dinheiro.' : 'Comece a organizar suas contas em poucos passos.'
  const submitLabel = isReset ? 'Salvar nova senha' : isForgot ? 'Enviar link de recuperação' : isLogin ? 'Entrar na minha conta' : 'Criar minha conta'
  return <main className="auth-screen"><div className="auth-layout"><aside className="auth-showcase"><div className="auth-showcase-brand"><span className="brand-mark"><Wallet size={21}/></span><span>meu<span className="brand-light">controle</span></span></div><div className="auth-showcase-copy"><span className="auth-kicker"><i/> SUA VIDA FINANCEIRA, MAIS CLARA</span><h2>Seu dinheiro merece<br/>um plano <em>simples.</em></h2><p>Organize contas, acompanhe cartões e veja para onde seu dinheiro está indo, tudo em um só lugar.</p><div className="auth-features"><span><i>✓</i> Visão clara do seu mês</span><span><i>✓</i> Seus dados, só seus</span></div></div><div className="auth-visual" aria-hidden="true"><div className="auth-visual-top"><span><i/><i/><i/></span><small>SEU MÊS EM FOCO</small><CalendarDays size={16}/></div><div className="auth-visual-body"><div className="auth-visual-label"><span>Entradas</span><span>Contas</span><span>Cofrinhos</span></div><div className="auth-chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="auth-chart-base"/></div><div className="auth-visual-footer"><span><b/> Planejar fica mais leve</span><ArrowUpRight size={17}/></div></div><small className="auth-showcase-foot">CONTROLE NO SEU RITMO · PRIVACIDADE EM PRIMEIRO LUGAR</small></aside><section className="auth-card"><div className="auth-mode-content" key={mode}><div className="auth-card-top"><span className="auth-card-icon"><Wallet size={19}/></span><span>{isReset ? 'ATUALIZAÇÃO SEGURA' : 'ACESSO SEGURO'}</span></div><p className="eyebrow">SEU ESPAÇO FINANCEIRO</p><h1>{heading}</h1><p className="auth-copy">{description}</p><form onSubmit={onSubmit}>{!isReset && <label>E-mail<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label>}{mode === 'signup' && <label>Nome de usuário<input type="text" required minLength="2" maxLength="40" autoComplete="nickname" value={username} onChange={(event) => setUsername?.(event.target.value)} placeholder="Como devemos chamar você?" /></label>}{!isForgot && <label>{isReset ? 'Nova senha' : 'Senha'}<input type="password" required minLength="6" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" /></label>}{isReset && <label>Confirmar nova senha<input type="password" required minLength="6" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword?.(event.target.value)} placeholder="Digite a nova senha novamente" /></label>}{isLogin && <button className="auth-forgot" type="button" onClick={() => setMode('forgot')}>Esqueci minha senha</button>}{message && <div className="notice" role="status">{message}</div>}<button className="button primary auth-submit">{submitLabel}<ArrowRight size={17}/></button></form>{isReset ? <p className="auth-toggle">Já conseguiu redefinir? <button type="button" onClick={onCancelRecovery}>Voltar ao aplicativo</button></p> : <p className="auth-toggle">{isForgot ? 'Lembrou sua senha?' : isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'} <button type="button" onClick={isForgot ? () => setMode('login') : switchMode}>{isForgot ? 'Voltar ao login' : isLogin ? 'Criar conta' : 'Fazer login'}</button></p>}<p className="privacy-note"><span>◈</span> Cada conta acessa somente os próprios dados.</p></div></section></div></main>
}

function authErrorMessage(error, action) {
  const raw = error?.message || ''
  const message = raw.toLowerCase()
  if (/redirect.*(not allowed|allowlist)|redirect url/.test(message)) return 'O endereço de retorno não está autorizado. No Supabase, adicione o endereço do site em Authentication > URL Configuration > Redirect URLs.'
  if (action === 'signup' && (error?.code === 'weak_password' || /password.*(weak|short|at least|characters)/.test(message))) {
    const minimum = raw.match(/(?:at least|minimum of)\s+(\d+)\s+characters/i)
    return minimum ? `A senha precisa ter pelo menos ${minimum[1]} caracteres, conforme a regra do Supabase.` : `A senha não atende aos requisitos de segurança do Supabase. ${raw}`
  }
  if (/invalid login credentials|invalid_credentials/.test(message)) return 'E-mail ou senha incorretos. Confira os dados ou use “Esqueci minha senha”.'
  if (/email not confirmed/.test(message)) return 'Confirme seu e-mail pelo link enviado antes de entrar.'
  if (/already registered|user already exists/.test(message)) return 'Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.'
  if (error?.status === 429 || /rate limit|too many requests/.test(message)) return 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.'
  if (action === 'recovery') return `Não foi possível enviar o link de recuperação. ${raw}`
  return raw || 'Não foi possível concluir a solicitação. Tente novamente.'
}

function SetupScreen() {
  return <main className="auth-screen"><section className="auth-card setup-card"><div className="brand"><span className="brand-mark"><Wallet size={19} /></span><span>meu<span className="brand-light">controle</span></span></div><p className="eyebrow">CONFIGURAÇÃO INICIAL</p><h1>Conecte seu projeto Supabase</h1><p className="auth-copy">Configure as variáveis locais e aplique as migrações da pasta <code>supabase/migrations</code>.</p><p className="privacy-note">Use somente a chave publicável no frontend. Nunca coloque chaves secretas neste projeto.</p></section></main>
}

function YearPicker({value,onChange}) { return <div className="month-picker"><button className="icon-button" aria-label="Ano anterior" title="Ano anterior" onClick={()=>onChange(String(Number(value)-1))}><ArrowLeft size={16}/></button><label><CalendarDays size={16}/><span>{value}</span><ChevronDown size={14}/><select aria-label="Escolher ano" value={value} onChange={e=>onChange(e.target.value)}>{Array.from({length:11},(_,i)=>String(new Date().getFullYear()-5+i)).map(y=><option key={y}>{y}</option>)}</select></label><button className="icon-button" aria-label="Próximo ano" title="Próximo ano" onClick={()=>onChange(String(Number(value)+1))}><ArrowRight size={16}/></button></div> }
function ReminderModal({value,onChange,onClose,onSubmit}) { return <Modal title="Lembretes no aplicativo" onClose={onClose}><form className="modal-form" onSubmit={onSubmit}><label className="check-label"><input type="checkbox" checked={value.enabled} onChange={e=>onChange({...value,enabled:e.target.checked})}/> Personalizar o prazo dos avisos</label><label>Mostrar contas que vencem nos próximos<select value={value.days_before} onChange={e=>onChange({...value,days_before:Number(e.target.value)})}><option value="1">1 dia</option><option value="2">2 dias</option><option value="3">3 dias</option><option value="7">7 dias</option></select></label><p className="modal-help">Os avisos de contas atrasadas sempre aparecem. Com a personalização desligada, as próximas contas são mostradas com 7 dias de antecedência.</p><div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button className="button primary"><Bell size={15}/> Salvar preferências</button></div></form></Modal> }

function ShareSettlementModal({item,onSettle,onClose}) {
  const shares = sharesFor(item)
  const settledCount = shares.filter(share=>share.settled).length
  return <Modal title={`Acerto do rateio · ${item.description}`} onClose={onClose}><div className="share-settlement-list">{shares.map((share,index)=><div className="share-settlement-row" key={`${share.name}-${index}`}><span className={`share-avatar ${share.settled?'is-settled':''}`}><Users size={15}/></span><div><b>{share.name}</b><small>{share.settled?`Acertado${share.settled_on?` em ${fmtDate(share.settled_on)}`:''}`:'Aguardando acerto'}</small></div><strong>{brl(share.amount)}</strong><button className={`button ${share.settled?'subtle':'primary'}`} onClick={()=>onSettle(item,index,!share.settled)}>{share.settled?'Desfazer':'Marcar recebido'}</button></div>)}</div><p className="share-settlement-summary">{settledCount} de {shares.length} partes acertadas · {brl(shares.filter(share=>!share.settled).reduce((sum,share)=>sum+Number(share.amount),0))} em aberto</p><div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Fechar</button></div></Modal>
}

function InvoiceConfirmModal({value,month,onClose,onConfirm}) { const total=value.entries.reduce((sum,item)=>sum+Number(item.amount),0); const title=value.reopening?'Reabrir fatura':'Confirmar pagamento da fatura'; return <Modal title={title} onClose={onClose}><div className="invoice-confirm-content"><span className={`invoice-confirm-icon ${value.reopening?'reopen':''}`}><CreditCard size={21}/></span><p>{value.reopening?<>As compras de <b>{value.card.name}</b> na fatura de <b>{monthName(month)}</b> voltarão a ficar pendentes.</>:<>Confirma que a fatura de <b>{value.card.name}</b> de <b>{monthName(month)}</b> foi paga?</>}</p><div className="invoice-confirm-summary"><span>{value.entries.length} compra{value.entries.length===1?'':'s'} nesta fatura</span><strong>{brl(total)}</strong></div>{!value.reopening&&<small>As compras serão marcadas como pagas com a data de hoje. Isso também atualiza o limite disponível calculado.</small>}<div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button type="button" className={`button ${value.reopening?'subtle':'primary'}`} onClick={onConfirm}>{value.reopening?'Sim, reabrir fatura':'Sim, marcar como paga'}</button></div></div></Modal> }

function ConfirmationModal({value,onClose,onConfirm}) { return <Modal title={value.title} onClose={onClose}><div className="invoice-confirm-content"><span className="invoice-confirm-icon reopen"><Trash2 size={21}/></span><p>{value.message}</p>{value.details&&<small>{value.details}</small>}<div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancelar</button><button type="button" className="button confirm-danger" onClick={onConfirm}>{value.confirmLabel}</button></div></div></Modal> }
