export const brl = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const monthOf = (date = new Date()) => localDate(date).slice(0, 7)
export const monthStart = (key) => `${key}-01`
export const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
export const monthName = (key, options = { month: 'long', year: 'numeric' }) => new Date(`${key}-15T12:00:00`).toLocaleDateString('pt-BR', options)
export const normalizeSearchText = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
export const userDisplayName = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || 'Eu'
export const responsibleDetailsFor = (item, fallbackName) => {
  if (item.responsible_details?.length) return item.responsible_details
  return [{ name: item.responsible_person || fallbackName || 'Eu', percentage: 100 }]
}
export const responsibleNamesFor = (item, fallbackName) => responsibleDetailsFor(item, fallbackName).map((person) => person.name)
export const responsibilityAmountsFor = (item, fallbackName) => {
  const details = responsibleDetailsFor(item, fallbackName)
  const totalCents = Math.round(Number(item.amount) * 100)
  const exact = details.map((person) => totalCents * Number(person.percentage) / 100)
  const cents = exact.map(Math.floor)
  let remainder = totalCents - cents.reduce((sum, amount) => sum + amount, 0)
  exact.map((amount, index) => ({ index, fraction: amount - cents[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index).slice(0, remainder).forEach(({ index }) => { cents[index] += 1 })
  return details.map((person, index) => ({ name: person.name, amount: cents[index] / 100 }))
}
export const paymentLabel = (item) => {
  if (item.payment_method === 'credit_card') return item.cards?.name || 'Cartão de crédito'
  if (item.payment_method === 'debit_card') return 'Cartão de débito'
  if (item.payment_method === 'pix') return 'Pix'
  if (item.payment_method === 'cash') return 'Dinheiro'
  return 'Outro'
}
export const expenseCategories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Compras', 'Serviços', 'Educação', 'Outros']
export const incomeCategories = ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Vendas', 'Outros']
export const chartColors = ['#6d28d9', '#8428d8', '#9b36d7', '#5b21b6', '#ad5ce0', '#7336b8', '#bf7ae5', '#8b5ac7', '#d1a6eb']
export const cardColors = [
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
export const initialEntry = (monthKey = monthOf()) => {
  const date = monthKey === monthOf() ? localDate() : monthStart(monthKey)
  return { kind: 'expense', description: '', amount: '', category: 'Alimentação', spent_on: date, due_date: date, settled_on: '', status: 'pending', payment_method: 'pix', card_id: '', invoice_month: monthKey, installment_count: '1', paid_by: '', responsible_person: '', responsible_details: [], shared_with: '', share_details: [], notes: '', attachmentFiles: [] }
}

export function shareBreakdown(item) {
  if (item.share_details?.length) return item.share_details.map((share) => `${share.name}: ${brl(share.amount)}`).join(' · ')
  const names = [...new Set((item.shared_with || []).map((name) => name.trim()).filter(Boolean))]
  if (!names.length) return ''
  const cents = Math.round(Number(item.amount) * 100)
  const base = Math.floor(cents / names.length), extra = cents % names.length
  return names.map((name, index) => `${name}: ${brl((base + (index < extra ? 1 : 0)) / 100)}`).join(' · ')
}

export function sharesFor(item) {
  if (item.share_details?.length) return item.share_details
  const names = [...new Set((item.shared_with || []).map((name) => name.trim()).filter(Boolean))]
  if (!names.length) return []
  const cents = Math.round(Number(item.amount) * 100), base = Math.floor(cents / names.length), remainder = cents % names.length
  return names.map((name, index) => ({ name, amount: (base + (index < remainder ? 1 : 0)) / 100, settled: name.toLocaleLowerCase('pt-BR') === (item.paid_by || '').trim().toLocaleLowerCase('pt-BR'), settled_on: null }))
}

export function allocateShareAmounts(total, shares) {
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

