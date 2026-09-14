import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from './lib/supabase'

type PageId = 'dashboard' | 'transactions' | 'payables' | 'loans' | 'vehicles' | 'investments' | 'comparisons' | 'projections' | 'settings'
type IconName = PageId | 'menu' | 'plus' | 'bell' | 'search' | 'close' | 'wallet' | 'calendar' | 'trend' | 'edit' | 'check'
type Nature = 'Entrada' | 'Saída'
type DbType = 'income' | 'expense' | 'transfer'
type DbStatus = 'planned' | 'completed' | 'overdue' | 'cancelled'
type ChartKind = 'bar' | 'line'
type Scope = 'single' | 'future'

type Category = { id: string; name: string; group_id?: string; active?: boolean }
type CategoryGroup = { id: string; name: string; nature: Nature; categories: Category[]; active?: boolean }
type Account = { id: string; name: string; account_type: string; initial_balance: number; active?: boolean }
type Transaction = {
  id: string
  account_id: string | null
  category_id: string | null
  type: DbType
  status: DbStatus
  description: string
  notes: string | null
  payment_method: string | null
  amount: number
  competence_date: string
  settlement_date: string | null
  installment_group_id: string | null
  installment_number: number | null
  installment_total: number | null
  vehicle_id: string | null
}
type Vehicle = { id: string; name: string; plate: string | null; make: string | null; model: string | null; model_year: number | null; status?: string }
type Borrower = { id: string; name: string; document?: string | null; contact?: string | null; notes?: string | null }
type Loan = { id: string; borrower_id: string; monthly_rate: number; start_date: string; status: string; notes?: string | null }
type LoanEvent = { id: string; loan_id: string; event_date: string; event_type: string; amount: number; interest_component: number; principal_component: number; notes?: string | null }
type RecurringRule = { id: string; name: string; type: DbType; amount: number; category_id: string | null; account_id: string | null; payment_method: string | null; day_of_month: number; start_date: string; end_date: string | null; active: boolean; notes: string | null }
type TransactionDraft = {
  nature: Nature
  description: string
  amount: number
  competenceDate: string
  settlementDate: string
  groupId: string
  categoryId: string
  accountId: string
  paymentMethod: string
  status: DbStatus
  notes: string
  vehicleId: string
  installments: number
  firstInstallmentDate: string
  recurring: boolean
  recurrenceDay: number
  recurrenceEnd: string
  scope: Scope
}

type LoanLedger = { principal: number; interest: number; total: number; lent: number; paid: number; interestPaid: number }

const navigation: Array<{ id: PageId; label: string }> = [
  { id: 'dashboard', label: 'Visão geral' },
  { id: 'transactions', label: 'Lançamentos' },
  { id: 'payables', label: 'Pagar e receber' },
  { id: 'loans', label: 'Empréstimos' },
  { id: 'vehicles', label: 'Veículos' },
  { id: 'investments', label: 'Investimentos' },
  { id: 'comparisons', label: 'Comparações' },
  { id: 'projections', label: 'Projeções' },
]

const pageHelp: Record<PageId, string> = {
  dashboard: 'Dashboard gerencial e análise do período',
  transactions: 'Entradas e saídas com edição completa',
  payables: 'Agenda gerada a partir dos lançamentos previstos',
  loans: 'Pessoas, contratos, juros e pagamentos',
  vehicles: 'Custos reais por veículo',
  investments: 'Patrimônio, rendimentos e evolução',
  comparisons: 'Compare dois períodos livremente',
  projections: 'Cenários futuros com compromissos previstos',
  settings: 'Categorias, grupos, contas e recorrências',
}

const RECURRENCE_MARKER = '[[MF:RECORRENTE]]'
const palette = ['#2f6df6', '#16a46f', '#d98b16', '#7b61ff', '#df5454', '#14a7a0', '#9a6a3a', '#5b6b86']

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function uuid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0)
}

function parseMoney(value: string) {
  const normalized = value.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}

function dateLabel(value?: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function monthLabel(value: string) {
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1)).replace('.', '')
}

function addMonths(date: string, offset: number, preferredDay?: number) {
  const [year, month, day] = date.split('-').map(Number)
  const base = new Date(year, month - 1 + offset, 1)
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const finalDay = Math.min(preferredDay || day, last)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`
}

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000))
}

function natureToDb(nature: Nature): DbType { return nature === 'Entrada' ? 'income' : 'expense' }
function dbToNature(type: DbType): Nature { return type === 'income' ? 'Entrada' : 'Saída' }
function isRecurring(transaction: Transaction) { return Boolean(transaction.notes?.startsWith(RECURRENCE_MARKER)) }
function cleanNotes(notes?: string | null) { return notes?.startsWith(RECURRENCE_MARKER) ? notes.replace(RECURRENCE_MARKER, '').replace(/^\n/, '') : notes || '' }
function statusText(transaction: Transaction) {
  if (transaction.status === 'cancelled') return 'Cancelado'
  if (transaction.status === 'overdue' || (transaction.status === 'planned' && transaction.settlement_date && transaction.settlement_date < today())) return 'Vencido'
  return transaction.status === 'planned' ? 'Previsto' : 'Realizado'
}

function inRange(transaction: Transaction, from: string, to: string) {
  const date = transaction.competence_date
  return (!from || date >= from) && (!to || date <= to)
}

function buildPeriods(rows: Transaction[], from: string, to: string) {
  const source = rows.filter((row) => inRange(row, from, to))
  const keys = Array.from(new Set(source.map((row) => row.competence_date.slice(0, 7)))).sort()
  return keys.map((key) => ({
    key,
    income: source.filter((row) => row.type === 'income' && row.competence_date.startsWith(key) && row.status !== 'cancelled').reduce((sum, row) => sum + row.amount, 0),
    expense: source.filter((row) => row.type === 'expense' && row.competence_date.startsWith(key) && row.status !== 'cancelled').reduce((sum, row) => sum + row.amount, 0),
  }))
}

function computeLoanLedger(loan: Loan, events: LoanEvent[], asOf = today()): LoanLedger {
  let principal = 0
  let interest = 0
  let lent = 0
  let paid = 0
  let interestPaid = 0
  let cursor = loan.start_date
  const ordered = [...events].filter((event) => event.loan_id === loan.id && event.event_date <= asOf).sort((a, b) => a.event_date.localeCompare(b.event_date))
  for (const event of ordered) {
    const days = daysBetween(cursor, event.event_date)
    if (principal > 0 && days > 0) interest += principal * (Math.pow(1 + loan.monthly_rate, days / 30) - 1)
    if (event.event_type === 'disbursement') {
      principal += event.amount
      lent += event.amount
    } else if (event.event_type === 'payment') {
      paid += event.amount
      const toInterest = Math.min(interest, event.amount)
      interest -= toInterest
      interestPaid += toInterest
      principal = Math.max(0, principal - Math.max(0, event.amount - toInterest))
    } else if (event.event_type === 'adjustment') {
      principal += event.amount
    }
    cursor = event.event_date
  }
  const remainingDays = daysBetween(cursor, asOf)
  if (principal > 0 && remainingDays > 0) interest += principal * (Math.pow(1 + loan.monthly_rate, remainingDays / 30) - 1)
  return { principal, interest, total: principal + interest, lent, paid, interestPaid }
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    transactions: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
    payables: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    loans: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M7 7V4h10v3M8 13h8M12 10v6"/></>,
    vehicles: <><path d="m5 15 1.5-6h11l1.5 6M3 15h18v4h-3v-2H6v2H3z"/><path d="M7 14h.01M17 14h.01"/></>,
    investments: <><path d="M4 20V10M10 20V5M16 20v-7M22 20V3M2 20h21"/></>,
    comparisons: <><path d="M7 4v16M17 4v16M4 8l3-3 3 3M14 16l3 3 3-3"/></>,
    projections: <><path d="m3 18 6-7 4 4 8-10M16 5h5v5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>, plus: <path d="M12 5v14M5 12h14"/>, bell: <><path d="M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2Z"/><path d="M10 21h4"/></>, search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>, close: <path d="m6 6 12 12M18 6 6 18"/>, wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M15 10h7v5h-7a2.5 2.5 0 0 1 0-5Z"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>, trend: <path d="m3 17 6-6 4 4 8-9M16 6h5v5"/>, edit: <><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></>, check: <path d="m5 12 4 4L19 6"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function Brand() { return <div className="brand"><span className="brandMark"><i/><i/><i/></span><span><strong>Meu Fluxo</strong><small>Finanças pessoais</small></span></div> }
function PageHeader({ title, description, action, onAction, children }: { title: string; description: string; action?: string; onAction?: () => void; children?: ReactNode }) { return <div className="pageHeader"><div><h2>{title}</h2><p>{description}</p></div><div className="pageActions">{children}{action && <button className="primaryButton" onClick={onAction}><Icon name="plus" size={17}/>{action}</button>}</div></div> }
function Empty({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="emptyState"><span className="emptyIcon"><Icon name={icon}/></span><h3>{title}</h3><p>{text}</p>{action && <button className="secondaryButton" onClick={onAction}>{action}</button>}</div> }
function Metric({ label, value, detail, tone = 'blue' }: { label: string; value: number; detail?: string; tone?: string }) { return <article className="metric"><span className={`metricIcon ${tone}`}><Icon name={tone === 'green' ? 'trend' : tone === 'red' ? 'wallet' : 'dashboard'} size={18}/></span><small>{label}</small><strong>{money(value)}</strong><p>{detail || 'Conforme filtros selecionados'}</p></article> }

function Modal({ title, description, close, children, wide = false }: { title: string; description?: string; close: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="dialogBackdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className={`dialog ${wide ? 'wideDialog' : ''}`}><div className="dialogHeader"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="iconButton" onClick={close}><Icon name="close"/></button></div><div className="simpleDialogBody">{children}</div></section></div>
}

function TimelineChart({ rows, kind, height = 250 }: { rows: Array<{ key: string; income: number; expense: number }>; kind: ChartKind; height?: number }) {
  if (!rows.length) return <div className="chartEmpty">Sem dados no período selecionado.</div>
  const width = 760
  const padX = 48
  const padY = 28
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const max = Math.max(1, ...rows.flatMap((row) => [row.income, row.expense]))
  const x = (index: number) => padX + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW)
  const y = (value: number) => padY + innerH - (value / max) * innerH
  const pointsIncome = rows.map((row, index) => `${x(index)},${y(row.income)}`).join(' ')
  const pointsExpense = rows.map((row, index) => `${x(index)},${y(row.expense)}`).join(' ')
  const barWidth = Math.max(8, Math.min(24, innerW / Math.max(rows.length, 1) / 3))
  return <div className="timelineChart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução financeira">{[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1={padX} y1={padY + innerH * ratio} x2={width - padX} y2={padY + innerH * ratio} className="chartGuide"/><text x={6} y={padY + innerH * ratio + 4} className="chartAxis">{money(max * (1 - ratio)).replace('R$ ', '')}</text></g>)}{kind === 'line' ? <><polyline points={pointsIncome} className="lineIncome"/><polyline points={pointsExpense} className="lineExpense"/>{rows.map((row, index) => <g key={row.key}><circle cx={x(index)} cy={y(row.income)} r="4" className="dotIncome"/><circle cx={x(index)} cy={y(row.expense)} r="4" className="dotExpense"/></g>)}</> : rows.map((row, index) => <g key={row.key}><rect x={x(index) - barWidth - 2} y={y(row.income)} width={barWidth} height={padY + innerH - y(row.income)} rx="4" className="rectIncome"/><rect x={x(index) + 2} y={y(row.expense)} width={barWidth} height={padY + innerH - y(row.expense)} rx="4" className="rectExpense"/></g>)}{rows.map((row, index) => <text key={row.key} x={x(index)} y={height - 6} textAnchor="middle" className="chartAxis">{monthLabel(row.key)}</text>)}</svg><div className="chartLegend"><span className="legendIncome">Entradas</span><span className="legendExpense">Saídas</span></div></div>
}

function Donut({ items }: { items: Array<{ name: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <Empty icon="comparisons" title="Sem despesas" text="Nenhuma despesa atende aos filtros atuais."/>
  let cursor = 0
  const segments = items.slice(0, 8).map((item, index) => {
    const start = cursor
    const end = cursor + (item.value / total) * 100
    cursor = end
    return `${palette[index % palette.length]} ${start}% ${end}%`
  })
  return <div className="donutWrap"><div className="donut" style={{ background: `conic-gradient(${segments.join(',')})` }}><div><strong>{money(total)}</strong><small>Total</small></div></div><div className="donutLegend">{items.slice(0, 8).map((item, index) => <div key={item.name}><i style={{ background: palette[index % palette.length] }}/><span>{item.name}</span><strong>{((item.value / total) * 100).toFixed(1)}%</strong></div>)}</div></div>
}

function DateFilter({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) {
  return <div className="dateRange"><button className={!from && !to ? 'active' : ''} onClick={() => { setFrom(''); setTo('') }}>Todo período</button><label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label></div>
}

function TransactionTable({ rows, groups, accounts, onEdit, onCancel }: { rows: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; onEdit: (row: Transaction) => void; onCancel: (row: Transaction) => void }) {
  const categoryMap = new Map<string, { category: string; group: string }>()
  groups.forEach((group) => group.categories.forEach((category) => categoryMap.set(category.id, { category: category.name, group: group.name })))
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]))
  return <div className="tableScroll"><table className="proTable"><thead><tr><th>Competência</th><th>Descrição</th><th>Grupo / categoria</th><th>Conta</th><th>Situação</th><th className="right">Valor</th><th/></tr></thead><tbody>{rows.map((row) => {
    const info = row.category_id ? categoryMap.get(row.category_id) : undefined
    return <tr key={row.id}><td>{dateLabel(row.competence_date)}</td><td><strong>{row.description}</strong><small>{isRecurring(row) ? 'Recorrente' : row.installment_total && row.installment_total > 1 ? `${row.installment_number}/${row.installment_total}` : cleanNotes(row.notes)}</small></td><td><span>{info?.group || '—'}</span><small>{info?.category || '—'}</small></td><td>{row.account_id ? accountMap.get(row.account_id) || '—' : '—'}</td><td><span className={`statusPill ${statusText(row).toLowerCase()}`}>{statusText(row)}</span></td><td className={`right amountCell ${row.type}`}>{row.type === 'expense' ? '− ' : '+ '}{money(row.amount)}</td><td><div className="rowActions"><button onClick={() => onEdit(row)} title="Editar"><Icon name="edit" size={16}/></button>{row.status !== 'cancelled' && <button onClick={() => onCancel(row)} title="Cancelar lançamento">×</button>}</div></td></tr>
  })}</tbody></table></div>
}

function TransactionEditor({ close, editing, groups, accounts, vehicles, onSave }: { close: () => void; editing?: Transaction | null; groups: CategoryGroup[]; accounts: Account[]; vehicles: Vehicle[]; onSave: (draft: TransactionDraft, editing?: Transaction | null) => Promise<void> }) {
  const initialNature = editing ? dbToNature(editing.type) : 'Saída'
  const initialGroup = editing?.category_id ? groups.find((group) => group.categories.some((category) => category.id === editing.category_id)) : undefined
  const [nature, setNature] = useState<Nature>(initialNature)
  const [description, setDescription] = useState(editing?.description || '')
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace('.', ',') : '')
  const [competenceDate, setCompetenceDate] = useState(editing?.competence_date || today())
  const [settlementDate, setSettlementDate] = useState(editing?.settlement_date || today())
  const [groupId, setGroupId] = useState(initialGroup?.id || '')
  const [categoryId, setCategoryId] = useState(editing?.category_id || '')
  const [accountId, setAccountId] = useState(editing?.account_id || '')
  const [paymentMethod, setPaymentMethod] = useState(editing?.payment_method || 'Pix')
  const [status, setStatus] = useState<DbStatus>(editing?.status || 'completed')
  const [notes, setNotes] = useState(cleanNotes(editing?.notes))
  const [vehicleId, setVehicleId] = useState(editing?.vehicle_id || '')
  const [installments, setInstallments] = useState(editing?.installment_total || 1)
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(editing?.settlement_date || '')
  const [recurring, setRecurring] = useState(editing ? isRecurring(editing) : false)
  const [recurrenceDay, setRecurrenceDay] = useState(Number((editing?.settlement_date || today()).slice(-2)))
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [scope, setScope] = useState<Scope>('single')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const availableGroups = groups.filter((group) => group.nature === nature)
  const selectedGroup = groups.find((group) => group.id === groupId)
  const creditCard = nature === 'Saída' && paymentMethod === 'Cartão de crédito'
  const hasSeries = Boolean(editing?.installment_group_id && (isRecurring(editing) || (editing.installment_total || 0) > 1))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (value <= 0) { setMessage('Informe um valor maior que zero.'); return }
    if (!categoryId) { setMessage('Selecione uma categoria.'); return }
    setSaving(true); setMessage('')
    try {
      await onSave({ nature, description: description.trim(), amount: value, competenceDate, settlementDate, groupId, categoryId, accountId, paymentMethod, status, notes: notes.trim(), vehicleId, installments, firstInstallmentDate, recurring, recurrenceDay, recurrenceEnd, scope }, editing)
      close()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally { setSaving(false) }
  }
  return <Modal title={editing ? 'Editar lançamento' : 'Novo lançamento'} description="Competência representa o fato gerador; pagamento/recebimento representa o caixa." close={close} wide><form onSubmit={submit}><div className="natureTabs"><button type="button" className={nature === 'Saída' ? 'active expense' : ''} onClick={() => { setNature('Saída'); setGroupId(''); setCategoryId('') }}>Saída</button><button type="button" className={nature === 'Entrada' ? 'active income' : ''} onClick={() => { setNature('Entrada'); setGroupId(''); setCategoryId('') }}>Entrada</button></div><div className="formGrid"><label className="full">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} required/></label><label>Valor<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required/></label><label>Data de competência<input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} required/></label><label>Grupo<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setCategoryId('') }} required><option value="">Selecionar</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!selectedGroup} required><option value="">Selecionar</option>{selectedGroup?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{nature === 'Saída' && <label>Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Boleto</option><option>Débito automático</option><option>Outro</option></select></label>}<label>Conta<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Sem conta específica</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>{creditCard && !editing ? <><label>Parcelas<select value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}x</option>)}</select></label><label>Primeira parcela<input type="date" value={firstInstallmentDate} onChange={(event) => setFirstInstallmentDate(event.target.value)} required/></label></> : <label>Data de {nature === 'Entrada' ? 'recebimento' : 'pagamento'}<input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} required/></label>}<label>Situação<select value={status} onChange={(event) => setStatus(event.target.value as DbStatus)}><option value="completed">Realizado</option><option value="planned">Previsto</option></select></label>{nature === 'Saída' && vehicles.length > 0 && <label>Veículo<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Não vincular</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>}<label className="full">Observação<input value={notes} onChange={(event) => setNotes(event.target.value)}/></label>{!creditCard && !editing && <div className="full recurrenceBox"><label className="checkLine"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)}/><span><strong>Lançamento recorrente</strong><small>Gera automaticamente ocorrências futuras em Pagar e receber.</small></span></label>{recurring && <div className="recurrenceFields"><label>Dia do mês<input type="number" min="1" max="31" value={recurrenceDay} onChange={(event) => setRecurrenceDay(Number(event.target.value))}/></label><label>Encerrar em <small>(opcional)</small><input type="date" value={recurrenceEnd} min={settlementDate} onChange={(event) => setRecurrenceEnd(event.target.value)}/></label></div>}</div>}{hasSeries && <div className="full recurrenceBox"><strong>Este lançamento faz parte de uma série.</strong><label className="scopeChoice"><input type="radio" checked={scope === 'single'} onChange={() => setScope('single')}/>Editar somente este lançamento</label><label className="scopeChoice"><input type="radio" checked={scope === 'future'} onChange={() => setScope('future')}/>Editar este e os próximos da série</label></div>}{message && <div className="error full">{message}</div>}</div><div className="dialogFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div></form></Modal>
}

function DashboardPage({ transactions, groups, accounts, onNew, onEdit, onCancel }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; onNew: () => void; onEdit: (row: Transaction) => void; onCancel: (row: Transaction) => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [groupId, setGroupId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [chart, setChart] = useState<ChartKind>('bar')
  const categories = groupId === 'all' ? groups.flatMap((group) => group.categories) : groups.find((group) => group.id === groupId)?.categories || []
  const categoryToGroup = new Map<string, string>()
  groups.forEach((group) => group.categories.forEach((category) => categoryToGroup.set(category.id, group.id)))
  const filtered = transactions.filter((row) => row.type !== 'transfer' && row.status !== 'cancelled' && inRange(row, from, to) && (groupId === 'all' || (row.category_id && categoryToGroup.get(row.category_id) === groupId)) && (categoryId === 'all' || row.category_id === categoryId))
  const income = filtered.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
  const expense = filtered.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
  const opening = accounts.reduce((sum, account) => sum + Number(account.initial_balance || 0), 0)
  const realizedBalance = opening + transactions.filter((row) => row.status === 'completed').reduce((sum, row) => sum + (row.type === 'income' ? row.amount : row.type === 'expense' ? -row.amount : 0), 0)
  const periods = buildPeriods(filtered, '', '')
  const expenseGroups = groups.map((group) => ({ name: group.name, value: filtered.filter((row) => row.type === 'expense' && row.category_id && group.categories.some((category) => category.id === row.category_id)).reduce((sum, row) => sum + row.amount, 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  return <><PageHeader title="Visão geral" description="Analise o desempenho financeiro por período, grupo e categoria." action="Novo lançamento" onAction={onNew}/><section className="filterPanel"><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo}/><select value={groupId} onChange={(event) => { setGroupId(event.target.value); setCategoryId('all') }}><option value="all">Todos os grupos</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></section><div className="metrics"><Metric label="Entradas" value={income} tone="green"/><Metric label="Saídas" value={expense} tone="red"/><Metric label="Resultado" value={income - expense}/><Metric label="Saldo disponível" value={realizedBalance} tone="amber" detail="Saldo realizado nas contas"/></div><div className="dashboardGrid proDashboard"><section className="card chartCard"><div className="cardHeader"><div><h3>Evolução financeira</h3><p>Entradas e saídas ao longo do tempo</p></div><div className="chartSwitch"><button className={chart === 'bar' ? 'active' : ''} onClick={() => setChart('bar')}>Barras</button><button className={chart === 'line' ? 'active' : ''} onClick={() => setChart('line')}>Linhas</button></div></div><TimelineChart rows={periods} kind={chart}/></section><section className="card"><div className="cardHeader"><div><h3>Despesas por grupo</h3><p>Participação no período filtrado</p></div></div><Donut items={expenseGroups}/></section></div><div className="dashboardGrid lower"><section className="card"><div className="cardHeader"><div><h3>Últimos lançamentos</h3><p>Movimentações mais recentes dentro do filtro</p></div></div>{filtered.length ? <TransactionTable rows={[...filtered].sort((a, b) => b.competence_date.localeCompare(a.competence_date)).slice(0, 8)} groups={groups} accounts={accounts} onEdit={onEdit} onCancel={onCancel}/> : <Empty icon="transactions" title="Nenhum lançamento" text="Não há dados para os filtros selecionados." action="Novo lançamento" onAction={onNew}/>}</section><section className="card"><div className="cardHeader"><div><h3>Maiores grupos de despesa</h3><p>Ranking no período</p></div></div><div className="rankingList">{expenseGroups.slice(0, 6).map((item, index) => <div key={item.name}><span>{index + 1}</span><strong>{item.name}</strong><b>{money(item.value)}</b></div>)}{!expenseGroups.length && <Empty icon="comparisons" title="Sem despesas" text="O ranking aparecerá quando houver despesas no período."/>}</div></section></div></>
}

function TransactionsPage({ transactions, groups, accounts, onNew, onEdit, onCancel }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; onNew: () => void; onEdit: (row: Transaction) => void; onCancel: (row: Transaction) => void }) {
  const [search, setSearch] = useState('')
  const [nature, setNature] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const categoryNames = new Map<string, string>(); groups.forEach((group) => group.categories.forEach((category) => categoryNames.set(category.id, `${group.name} ${category.name}`)))
  const rows = transactions.filter((row) => row.type !== 'transfer' && inRange(row, from, to) && (nature === 'all' || row.type === nature) && (status === 'all' || statusText(row).toLowerCase() === status) && `${row.description} ${row.category_id ? categoryNames.get(row.category_id) || '' : ''}`.toLowerCase().includes(search.toLowerCase()))
  return <><PageHeader title="Lançamentos" description="Todos os registros podem ser revisados e editados." action="Novo lançamento" onAction={onNew}/><section className="filterPanel transactionFilters"><label className="searchField"><Icon name="search" size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição, grupo ou categoria"/></label><select value={nature} onChange={(event) => setNature(event.target.value)}><option value="all">Entradas e saídas</option><option value="income">Entradas</option><option value="expense">Saídas</option></select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas as situações</option><option value="realizado">Realizados</option><option value="previsto">Previstos</option><option value="vencido">Vencidos</option><option value="cancelado">Cancelados</option></select><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo}/></section><section className="card tableCard">{rows.length ? <TransactionTable rows={rows} groups={groups} accounts={accounts} onEdit={onEdit} onCancel={onCancel}/> : <Empty icon="transactions" title="Nenhum lançamento encontrado" text="Ajuste os filtros ou registre uma nova movimentação." action="Novo lançamento" onAction={onNew}/>}</section></>
}

function PayablesPage({ transactions, groups, accounts, onNew, onEdit, onCancel }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; onNew: () => void; onEdit: (row: Transaction) => void; onCancel: (row: Transaction) => void }) {
  const planned = transactions.filter((row) => row.type !== 'transfer' && row.status === 'planned').sort((a, b) => (a.settlement_date || a.competence_date).localeCompare(b.settlement_date || b.competence_date))
  const overdue = planned.filter((row) => row.settlement_date && row.settlement_date < today())
  const payable = planned.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
  const receivable = planned.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
  return <><PageHeader title="Pagar e receber" description="Esta agenda é formada automaticamente pelos lançamentos previstos e recorrentes." action="Novo previsto" onAction={onNew}/><div className="statusMetrics"><article><span>Total a pagar</span><strong>{money(payable)}</strong></article><article><span>Total a receber</span><strong>{money(receivable)}</strong></article><article><span>Vencido</span><strong>{money(overdue.reduce((sum, row) => sum + row.amount, 0))}</strong></article></div><section className="card tableCard">{planned.length ? <TransactionTable rows={planned} groups={groups} accounts={accounts} onEdit={onEdit} onCancel={onCancel}/> : <Empty icon="calendar" title="Agenda livre" text="Ao registrar lançamentos futuros ou recorrentes, eles aparecerão aqui automaticamente." action="Criar lançamento previsto" onAction={onNew}/>}</section></>
}

function LoanDetail({ loan, borrower, events, onEditBorrower, onEditLoan, onPayment, onEditEvent }: { loan: Loan; borrower: Borrower; events: LoanEvent[]; onEditBorrower: () => void; onEditLoan: () => void; onPayment: () => void; onEditEvent: (event: LoanEvent) => void }) {
  const ledger = computeLoanLedger(loan, events)
  const sorted = events.filter((event) => event.loan_id === loan.id).sort((a, b) => b.event_date.localeCompare(a.event_date))
  return <div className="loanDetail"><div className="loanPerson"><div><span className="avatarLarge">{borrower.name.slice(0, 2).toUpperCase()}</span><div><h3>{borrower.name}</h3><p>{borrower.contact || 'Sem contato cadastrado'}</p></div></div><div className="inlineActions"><button className="secondaryButton" onClick={onEditBorrower}><Icon name="edit" size={15}/>Pessoa</button><button className="secondaryButton" onClick={onEditLoan}><Icon name="edit" size={15}/>Contrato</button><button className="primaryButton" onClick={onPayment}><Icon name="plus" size={15}/>Registrar pagamento</button></div></div><div className="loanKpis"><div><small>Principal a receber</small><strong>{money(ledger.principal)}</strong></div><div><small>Juros a receber</small><strong>{money(ledger.interest)}</strong></div><div><small>Total a receber</small><strong>{money(ledger.total)}</strong></div><div><small>Total pago</small><strong>{money(ledger.paid)}</strong></div></div><div className="cardHeader loanHistoryHeader"><div><h3>Histórico financeiro</h3><p>Liberações e pagamentos em ordem cronológica</p></div></div><div className="eventList">{sorted.map((event) => <article key={event.id}><span className={`eventDot ${event.event_type}`}/><div><strong>{event.event_type === 'disbursement' ? 'Valor emprestado' : event.event_type === 'payment' ? 'Pagamento recebido' : 'Ajuste'}</strong><small>{dateLabel(event.event_date)}{event.notes ? ` · ${event.notes}` : ''}</small></div><b>{money(event.amount)}</b>{event.event_type === 'payment' && <button className="iconButton mini" onClick={() => onEditEvent(event)}><Icon name="edit" size={14}/></button>}</article>)}</div></div>
}

function LoansPage({ loans, borrowers, events, onNew, onEditBorrower, onEditLoan, onPayment, onEditEvent }: { loans: Loan[]; borrowers: Borrower[]; events: LoanEvent[]; onNew: () => void; onEditBorrower: (borrower: Borrower) => void; onEditLoan: (loan: Loan) => void; onPayment: (loan: Loan) => void; onEditEvent: (event: LoanEvent) => void }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(loans[0]?.id || '')
  useEffect(() => { if (!selectedId && loans[0]) setSelectedId(loans[0].id) }, [loans, selectedId])
  const borrowerMap = new Map(borrowers.map((borrower) => [borrower.id, borrower]))
  const ledgers = loans.map((loan) => ({ loan, ledger: computeLoanLedger(loan, events) }))
  const totals = ledgers.reduce((acc, item) => ({ lent: acc.lent + item.ledger.lent, principal: acc.principal + item.ledger.principal, interest: acc.interest + item.ledger.interest, total: acc.total + item.ledger.total }), { lent: 0, principal: 0, interest: 0, total: 0 })
  const filtered = loans.filter((loan) => (borrowerMap.get(loan.borrower_id)?.name || '').toLowerCase().includes(search.toLowerCase()))
  const selected = loans.find((loan) => loan.id === selectedId)
  const selectedBorrower = selected ? borrowerMap.get(selected.borrower_id) : undefined
  return <><PageHeader title="Empréstimos" description="Controle por pessoa, com pagamentos e juros proporcionais aos dias." action="Novo empréstimo" onAction={onNew}/><div className="loanKpis mainLoanKpis"><div><small>Total emprestado</small><strong>{money(totals.lent)}</strong></div><div><small>Principal a receber</small><strong>{money(totals.principal)}</strong></div><div><small>Juros a receber</small><strong>{money(totals.interest)}</strong></div><div><small>Total a receber</small><strong>{money(totals.total)}</strong></div></div><div className="loanWorkspace"><section className="card loanDirectory"><label className="searchField"><Icon name="search" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar pessoa"/></label><div className="personList">{filtered.map((loan) => { const person = borrowerMap.get(loan.borrower_id); const ledger = computeLoanLedger(loan, events); return <button className={selectedId === loan.id ? 'active' : ''} key={loan.id} onClick={() => setSelectedId(loan.id)}><span>{person?.name.slice(0, 2).toUpperCase()}</span><div><strong>{person?.name || 'Pessoa'}</strong><small>{(loan.monthly_rate * 100).toFixed(2)}% a.m.</small></div><b>{money(ledger.total)}</b></button> })}</div>{!loans.length && <Empty icon="loans" title="Nenhum empréstimo" text="Cadastre o primeiro contrato para iniciar o controle." action="Novo empréstimo" onAction={onNew}/>}</section><section className="card loanPanel">{selected && selectedBorrower ? <LoanDetail loan={selected} borrower={selectedBorrower} events={events} onEditBorrower={() => onEditBorrower(selectedBorrower)} onEditLoan={() => onEditLoan(selected)} onPayment={() => onPayment(selected)} onEditEvent={onEditEvent}/> : <Empty icon="loans" title="Selecione uma pessoa" text="A ficha completa do empréstimo aparecerá aqui."/>}</section></div></>
}

function InvestmentsPage({ accounts, transactions, onNewAccount }: { accounts: Account[]; transactions: Transaction[]; onNewAccount: () => void }) {
  const investments = accounts.filter((account) => account.account_type === 'investment')
  const [accountId, setAccountId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [chart, setChart] = useState<ChartKind>('line')
  const ids = new Set(investments.filter((account) => accountId === 'all' || account.id === accountId).map((account) => account.id))
  const rows = transactions.filter((row) => row.account_id && ids.has(row.account_id) && inRange(row, from, to) && row.status !== 'cancelled')
  const periods = buildPeriods(rows, '', '')
  const initial = investments.filter((account) => accountId === 'all' || account.id === accountId).reduce((sum, account) => sum + Number(account.initial_balance || 0), 0)
  const incomes = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
  const expenses = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
  const balance = initial + incomes - expenses
  return <><PageHeader title="Investimentos" description="Acompanhe produtos e evolução com filtros de período." action="Novo investimento" onAction={onNewAccount}/><section className="filterPanel"><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo}/><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="all">Todos os investimentos</option>{investments.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><div className="chartSwitch"><button className={chart === 'line' ? 'active' : ''} onClick={() => setChart('line')}>Linhas</button><button className={chart === 'bar' ? 'active' : ''} onClick={() => setChart('bar')}>Barras</button></div></section><div className="metrics"><Metric label="Saldo estimado" value={balance}/><Metric label="Entradas/rendimentos" value={incomes} tone="green"/><Metric label="Saídas/resgates" value={expenses} tone="red"/><Metric label="Resultado do período" value={incomes - expenses}/></div><section className="card"><div className="cardHeader"><div><h3>Evolução dos investimentos</h3><p>Eixo Y em valores; eixo X em linha do tempo</p></div></div><TimelineChart rows={periods} kind={chart} height={290}/></section><section className="card sectionGap"><div className="cardHeader"><div><h3>Produtos cadastrados</h3><p>Contas classificadas como investimento</p></div></div><div className="recordGrid">{investments.map((account) => <article key={account.id}><span className="recordIcon"><Icon name="investments"/></span><div><strong>{account.name}</strong><small>Saldo inicial</small></div><b>{money(account.initial_balance)}</b></article>)}{!investments.length && <Empty icon="investments" title="Nenhum investimento" text="Cadastre uma conta do tipo investimento para começar." action="Novo investimento" onAction={onNewAccount}/>}</div></section></>
}

function ComparisonsPage({ transactions }: { transactions: Transaction[] }) {
  const now = today()
  const [aFrom, setAFrom] = useState(`${now.slice(0, 7)}-01`)
  const [aTo, setATo] = useState(now)
  const previous = addMonths(`${now.slice(0, 7)}-01`, -1)
  const [bFrom, setBFrom] = useState(`${previous.slice(0, 7)}-01`)
  const [bTo, setBTo] = useState(new Date(new Date(`${now}T12:00:00`).getFullYear(), new Date(`${now}T12:00:00`).getMonth(), 0).toISOString().slice(0, 10))
  const summarize = (from: string, to: string) => {
    const rows = transactions.filter((row) => row.type !== 'transfer' && row.status !== 'cancelled' && inRange(row, from, to))
    const income = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
    const expense = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
    return { rows, income, expense, result: income - expense }
  }
  const a = summarize(aFrom, aTo), b = summarize(bFrom, bTo)
  const variation = (current: number, reference: number) => reference === 0 ? null : ((current - reference) / Math.abs(reference)) * 100
  return <><PageHeader title="Comparações" description="Compare qualquer mês, data ou intervalo personalizado."/><div className="comparisonFilters"><section className="card"><strong>Período A</strong><div className="rangeInputs"><label>De<input type="date" value={aFrom} onChange={(event) => setAFrom(event.target.value)}/></label><label>Até<input type="date" value={aTo} onChange={(event) => setATo(event.target.value)}/></label></div></section><section className="card"><strong>Período B</strong><div className="rangeInputs"><label>De<input type="date" value={bFrom} onChange={(event) => setBFrom(event.target.value)}/></label><label>Até<input type="date" value={bTo} onChange={(event) => setBTo(event.target.value)}/></label></div></section></div><section className="card comparisonTableCard"><table className="comparisonTable"><thead><tr><th>Indicador</th><th>Período A</th><th>Período B</th><th>Diferença</th><th>Variação</th></tr></thead><tbody>{[
    ['Entradas', a.income, b.income], ['Saídas', a.expense, b.expense], ['Resultado', a.result, b.result],
  ].map(([label, current, reference]) => { const c = current as number, r = reference as number, pct = variation(c, r); return <tr key={label as string}><td><strong>{label as string}</strong></td><td>{money(c)}</td><td>{money(r)}</td><td className={c - r >= 0 ? 'positive' : 'negative'}>{money(c - r)}</td><td>{pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}</td></tr> })}</tbody></table></section><div className="twoColumns sectionGap"><section className="card"><div className="cardHeader"><div><h3>Período A</h3><p>Evolução mensal</p></div></div><TimelineChart rows={buildPeriods(a.rows, '', '')} kind="bar"/></section><section className="card"><div className="cardHeader"><div><h3>Período B</h3><p>Evolução mensal</p></div></div><TimelineChart rows={buildPeriods(b.rows, '', '')} kind="bar"/></section></div></>
}

function ProjectionsPage({ transactions, accounts }: { transactions: Transaction[]; accounts: Account[] }) {
  const [months, setMonths] = useState(12)
  const [scenario, setScenario] = useState<'Conservador' | 'Base' | 'Otimista'>('Base')
  const end = addMonths(today(), months)
  const planned = transactions.filter((row) => row.status === 'planned' && row.type !== 'transfer' && (row.settlement_date || row.competence_date) >= today() && (row.settlement_date || row.competence_date) <= end)
  const incomeBase = planned.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
  const expenseBase = planned.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
  const income = incomeBase * (scenario === 'Conservador' ? .9 : scenario === 'Otimista' ? 1.1 : 1)
  const expense = expenseBase * (scenario === 'Conservador' ? 1.1 : scenario === 'Otimista' ? .9 : 1)
  const balance = accounts.reduce((sum, account) => sum + account.initial_balance, 0) + transactions.filter((row) => row.status === 'completed').reduce((sum, row) => sum + (row.type === 'income' ? row.amount : row.type === 'expense' ? -row.amount : 0), 0)
  return <><PageHeader title="Projeções" description="Projete o caixa usando parcelas e recorrências já cadastradas."><select className="selectControl" value={months} onChange={(event) => setMonths(Number(event.target.value))}><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option><option value={24}>24 meses</option></select></PageHeader><div className="scenarioTabs">{(['Conservador', 'Base', 'Otimista'] as const).map((item) => <button key={item} className={scenario === item ? 'active' : ''} onClick={() => setScenario(item)}>{item}</button>)}</div><div className="projectionSummary"><div><small>Saldo atual</small><strong>{money(balance)}</strong></div><div><small>Entradas previstas</small><strong>{money(income)}</strong></div><div><small>Saídas previstas</small><strong>{money(expense)}</strong></div><div><small>Saldo projetado</small><strong>{money(balance + income - expense)}</strong></div></div><section className="card sectionGap"><div className="cardHeader"><div><h3>Base da projeção</h3><p>{planned.length} lançamento{planned.length === 1 ? '' : 's'} previsto{planned.length === 1 ? '' : 's'} até {dateLabel(end)}</p></div></div><TimelineChart rows={buildPeriods(planned, '', '')} kind="line"/></section></>
}

function VehiclesPage({ vehicles, transactions }: { vehicles: Vehicle[]; transactions: Transaction[] }) {
  return <><PageHeader title="Veículos" description="Acompanhe custos vinculados aos seus veículos."/><div className="recordGrid vehicleRecords">{vehicles.map((vehicle) => { const rows = transactions.filter((row) => row.vehicle_id === vehicle.id && row.type === 'expense' && row.status !== 'cancelled'); return <article key={vehicle.id}><span className="recordIcon"><Icon name="vehicles"/></span><div><strong>{vehicle.name}</strong><small>{[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(' · ') || 'Sem detalhes'}</small></div><b>{money(rows.reduce((sum, row) => sum + row.amount, 0))}</b></article> })}{!vehicles.length && <Empty icon="vehicles" title="Nenhum veículo cadastrado" text="O cadastro de veículos permanece disponível na configuração de contas e ativos."/>}</div></>
}

function CategorySettings({ groups, onNewGroup, onEditGroup, onNewCategory, onEditCategory }: { groups: CategoryGroup[]; onNewGroup: () => void; onEditGroup: (group: CategoryGroup) => void; onNewCategory: (group?: CategoryGroup) => void; onEditCategory: (category: Category, group: CategoryGroup) => void }) {
  return <section className="card categoryManager"><div className="cardHeader categoryManagerHeader"><div><h3>Grupos e categorias</h3><p>Renomeie, mude a natureza ou mova categorias entre grupos.</p></div><div className="inlineActions"><button className="secondaryButton" onClick={onNewGroup}><Icon name="plus" size={15}/>Novo grupo</button><button className="primaryButton" onClick={() => onNewCategory()}><Icon name="plus" size={15}/>Nova categoria</button></div></div><div className="categoryGroups">{groups.map((group) => <article className="categoryGroup" key={group.id}><div className="categoryGroupHeader"><div><strong>{group.name}</strong><small>{group.categories.length} categorias</small></div><div className="groupHeaderActions"><span className={`natureBadge ${group.nature === 'Entrada' ? 'income' : 'expense'}`}>{group.nature}</span><button className="iconButton mini" onClick={() => onEditGroup(group)}><Icon name="edit" size={14}/></button></div></div><div className="categoryChips editableChips">{group.categories.map((category) => <button key={category.id} onClick={() => onEditCategory(category, group)}>{category.name}<Icon name="edit" size={12}/></button>)}<button className="addChip" onClick={() => onNewCategory(group)}>+ categoria</button></div></article>)}</div></section>
}

function SettingsPage({ groups, accounts, recurringRules, recurringRows, onNewGroup, onEditGroup, onNewCategory, onEditCategory, onAccounts, onEditRecurring }: { groups: CategoryGroup[]; accounts: Account[]; recurringRules: RecurringRule[]; recurringRows: Transaction[]; onNewGroup: () => void; onEditGroup: (group: CategoryGroup) => void; onNewCategory: (group?: CategoryGroup) => void; onEditCategory: (category: Category, group: CategoryGroup) => void; onAccounts: () => void; onEditRecurring: (row: Transaction) => void }) {
  const series = Array.from(new Map(recurringRows.filter(isRecurring).map((row) => [row.installment_group_id || row.id, row])).values())
  return <><PageHeader title="Configurações" description="Organize a estrutura financeira sem perder os vínculos históricos."/><div className="configSummary"><article><small>Grupos</small><strong>{groups.length}</strong></article><article><small>Categorias</small><strong>{groups.reduce((sum, group) => sum + group.categories.length, 0)}</strong></article><article><small>Recorrências</small><strong>{recurringRules.length || series.length}</strong></article></div><CategorySettings groups={groups} onNewGroup={onNewGroup} onEditGroup={onEditGroup} onNewCategory={onNewCategory} onEditCategory={onEditCategory}/><div className="settingsGrid sectionGap"><button className="settingCard" onClick={onAccounts}><span className="settingIcon"><Icon name="wallet"/></span><span><strong>Contas e investimentos</strong><small>{accounts.length} conta{accounts.length === 1 ? '' : 's'} cadastrada{accounts.length === 1 ? '' : 's'}</small></span><b>›</b></button><div className="settingCard static"><span className="settingIcon"><Icon name="calendar"/></span><span><strong>Recorrências</strong><small>Edite pela ocorrência e escolha “este e os próximos”.</small></span><b>{series.length}</b></div></div><section className="card sectionGap"><div className="cardHeader"><div><h3>Séries recorrentes</h3><p>Salário, internet e outros compromissos automáticos.</p></div></div>{series.length ? <div className="recordGrid">{series.map((row) => <article key={row.installment_group_id || row.id}><span className="recordIcon"><Icon name="calendar"/></span><div><strong>{row.description}</strong><small>{dbToNature(row.type)} · próximo em {dateLabel(row.settlement_date)}</small></div><b>{money(row.amount)}</b><button className="iconButton mini" onClick={() => onEditRecurring(row)}><Icon name="edit" size={14}/></button></article>)}</div> : <Empty icon="calendar" title="Nenhuma recorrência" text="Marque “Lançamento recorrente” ao cadastrar uma entrada ou saída."/>}</section></>
}

function GroupEditor({ close, groups, editing, onSave }: { close: () => void; groups: CategoryGroup[]; editing?: CategoryGroup | null; onSave: (name: string, nature: Nature, editing?: CategoryGroup | null) => Promise<void> }) {
  const [name, setName] = useState(editing?.name || '')
  const [nature, setNature] = useState<Nature>(editing?.nature || 'Saída')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { if (!editing && groups.some((group) => group.name.toLowerCase() === name.trim().toLowerCase() && group.nature === nature)) throw new Error('Este grupo já existe.'); await onSave(name.trim(), nature, editing); close() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') } finally { setSaving(false) } }
  return <Modal title={editing ? 'Editar grupo' : 'Novo grupo'} close={close}><form onSubmit={submit}><div className="formGrid"><label className="full">Nome<input value={name} onChange={(event) => setName(event.target.value)} required/></label><label className="full">Natureza<select value={nature} onChange={(event) => setNature(event.target.value as Nature)}><option>Saída</option><option>Entrada</option></select></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter inlineFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div></form></Modal>
}

function CategoryEditor({ close, groups, editing, initialGroup, onSave }: { close: () => void; groups: CategoryGroup[]; editing?: Category | null; initialGroup?: CategoryGroup | null; onSave: (name: string, groupId: string, editing?: Category | null) => Promise<void> }) {
  const [name, setName] = useState(editing?.name || '')
  const [groupId, setGroupId] = useState(initialGroup?.id || groups[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { await onSave(name.trim(), groupId, editing); close() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') } finally { setSaving(false) } }
  return <Modal title={editing ? 'Editar categoria' : 'Nova categoria'} description="Mover a categoria mantém os lançamentos vinculados ao mesmo ID." close={close}><form onSubmit={submit}><div className="formGrid"><label className="full">Nome<input value={name} onChange={(event) => setName(event.target.value)} required/></label><label className="full">Grupo<select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.nature}</option>)}</select></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter inlineFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div></form></Modal>
}

function AccountManager({ close, accounts, onSave }: { close: () => void; accounts: Account[]; onSave: (name: string, type: string, balance: number, editing?: Account | null) => Promise<void> }) {
  const [editing, setEditing] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [balance, setBalance] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  function pick(account?: Account | null) { setEditing(account || null); setName(account?.name || ''); setType(account?.account_type || 'checking'); setBalance(account ? String(account.initial_balance).replace('.', ',') : '') }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { await onSave(name.trim(), type, parseMoney(balance), editing); pick(null); setMessage('Conta salva com sucesso.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') } finally { setSaving(false) } }
  return <Modal title="Contas e investimentos" description="Cadastre e edite contas usadas nos lançamentos." close={close} wide><form onSubmit={submit}><div className="formGrid"><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required/></label><label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option value="checking">Conta corrente</option><option value="cash">Dinheiro</option><option value="savings">Poupança</option><option value="credit_card">Cartão de crédito</option><option value="investment">Investimento</option></select></label><label>Saldo inicial<input value={balance} onChange={(event) => setBalance(event.target.value)} inputMode="decimal"/></label><div className="formButtonCell"><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}</button></div></div>{message && <div className="configMessage dialogMessage">{message}</div>}</form><div className="recordGrid dialogRecords">{accounts.map((account) => <article key={account.id}><span className="recordIcon"><Icon name={account.account_type === 'investment' ? 'investments' : 'wallet'}/></span><div><strong>{account.name}</strong><small>{account.account_type.replace('_', ' ')}</small></div><b>{money(account.initial_balance)}</b><button className="iconButton mini" onClick={() => pick(account)}><Icon name="edit" size={14}/></button></article>)}</div></Modal>
}

function LoanEditor({ close, borrowers, editingLoan, editingBorrower, onSave }: { close: () => void; borrowers: Borrower[]; editingLoan?: Loan | null; editingBorrower?: Borrower | null; onSave: (data: { borrowerId?: string; name: string; contact: string; document: string; amount: number; rate: number; date: string; notes: string }, loan?: Loan | null, borrower?: Borrower | null) => Promise<void> }) {
  const existingBorrower = editingBorrower || (editingLoan ? borrowers.find((item) => item.id === editingLoan.borrower_id) : undefined)
  const [name, setName] = useState(existingBorrower?.name || '')
  const [contact, setContact] = useState(existingBorrower?.contact || '')
  const [document, setDocument] = useState(existingBorrower?.document || '')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(editingLoan ? String(editingLoan.monthly_rate * 100).replace('.', ',') : '1,00')
  const [date, setDate] = useState(editingLoan?.start_date || today())
  const [notes, setNotes] = useState(editingLoan?.notes || existingBorrower?.notes || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const personOnly = Boolean(editingBorrower && !editingLoan)
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); try { await onSave({ borrowerId: existingBorrower?.id, name: name.trim(), contact: contact.trim(), document: document.trim(), amount: parseMoney(amount), rate: Number(rate.replace(',', '.')) / 100, date, notes: notes.trim() }, editingLoan, editingBorrower); close() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') } finally { setSaving(false) } }
  return <Modal title={personOnly ? 'Editar pessoa' : editingLoan ? 'Editar empréstimo' : 'Novo empréstimo'} close={close} wide><form onSubmit={submit}><div className="formGrid"><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required/></label><label>Contato<input value={contact} onChange={(event) => setContact(event.target.value)}/></label><label>Documento<input value={document} onChange={(event) => setDocument(event.target.value)}/></label>{!personOnly && <><label>Taxa ao mês (%)<input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" required/></label><label>Data inicial<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label>{!editingLoan && <label>Valor emprestado<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required/> </label>}</>}<label className="full">Observação<input value={notes} onChange={(event) => setNotes(event.target.value)}/></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter inlineFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div></form></Modal>
}

function PaymentEditor({ close, loan, event, onSave }: { close: () => void; loan: Loan; event?: LoanEvent | null; onSave: (loan: Loan, amount: number, date: string, notes: string, event?: LoanEvent | null) => Promise<void> }) {
  const [amount, setAmount] = useState(event ? String(event.amount).replace('.', ',') : '')
  const [date, setDate] = useState(event?.event_date || today())
  const [notes, setNotes] = useState(event?.notes || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); const value = parseMoney(amount); if (value <= 0) { setMessage('Informe um valor maior que zero.'); return } setSaving(true); try { await onSave(loan, value, date, notes.trim(), event); close() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.') } finally { setSaving(false) } }
  return <Modal title={event ? 'Editar pagamento' : 'Registrar pagamento'} description="O saldo e os juros serão recalculados pela data informada." close={close}><form onSubmit={submit}><div className="formGrid"><label>Valor<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required/></label><label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required/></label><label className="full">Observação<input value={notes} onChange={(e) => setNotes(e.target.value)}/></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter inlineFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Salvar pagamento'}</button></div></form></Modal>
}

function AppShell({ session }: { session: Session }) {
  const initial = (location.hash.replace('#/', '') as PageId) || 'dashboard'
  const [page, setPage] = useState<PageId>([...navigation.map((item) => item.id), 'settings'].includes(initial) ? initial : 'dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanEvents, setLoanEvents] = useState<LoanEvent[]>([])
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([])
  const [transactionEditor, setTransactionEditor] = useState<{ open: boolean; row?: Transaction | null; planned?: boolean }>({ open: false })
  const [groupEditor, setGroupEditor] = useState<{ open: boolean; group?: CategoryGroup | null }>({ open: false })
  const [categoryEditor, setCategoryEditor] = useState<{ open: boolean; category?: Category | null; group?: CategoryGroup | null }>({ open: false })
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [loanEditor, setLoanEditor] = useState<{ open: boolean; loan?: Loan | null; borrower?: Borrower | null }>({ open: false })
  const [paymentEditor, setPaymentEditor] = useState<{ open: boolean; loan?: Loan | null; event?: LoanEvent | null }>({ open: false })
  const currentLabel = [...navigation, { id: 'settings' as PageId, label: 'Configurações' }].find((item) => item.id === page)?.label || 'Visão geral'

  useEffect(() => { void loadAll() }, [session.user.id])

  async function loadAll() {
    if (!supabase) return
    setLoading(true)
    let groupResult = await supabase.from('category_groups').select('id,name,nature,active,sort_order').eq('active', true).order('sort_order')
    if (!groupResult.error && (!groupResult.data || groupResult.data.length === 0)) {
      await supabase.rpc('create_default_financial_categories')
      groupResult = await supabase.from('category_groups').select('id,name,nature,active,sort_order').eq('active', true).order('sort_order')
    }
    const [categoryResult, accountResult, transactionResult, vehicleResult, borrowerResult, loanResult, eventResult] = await Promise.all([
      supabase.from('categories').select('id,name,group_id,active').eq('active', true).order('name'),
      supabase.from('accounts').select('id,name,account_type,initial_balance,active').eq('active', true).order('created_at'),
      supabase.from('transactions').select('id,account_id,category_id,type,status,description,notes,payment_method,amount,competence_date,settlement_date,installment_group_id,installment_number,installment_total,vehicle_id').order('competence_date', { ascending: false }),
      supabase.from('vehicles').select('id,name,plate,make,model,model_year,status').order('created_at'),
      supabase.from('borrowers').select('id,name,document,contact,notes').order('name'),
      supabase.from('loans').select('id,borrower_id,monthly_rate,start_date,status,notes').order('start_date', { ascending: false }),
      supabase.from('loan_events').select('id,loan_id,event_date,event_type,amount,interest_component,principal_component,notes').order('event_date'),
    ])
    const ruleResult = await supabase.from('recurring_rules').select('id,name,type,amount,category_id,account_id,payment_method,day_of_month,start_date,end_date,active,notes').eq('active', true).order('start_date')
    const categories = (categoryResult.data || []) as Array<Category & { group_id: string }>
    setGroups((groupResult.data || []).map((group) => ({ id: String(group.id), name: String(group.name), nature: group.nature === 'income' ? 'Entrada' : 'Saída', active: Boolean(group.active), categories: categories.filter((category) => category.group_id === group.id).map((category) => ({ id: String(category.id), name: String(category.name), group_id: String(category.group_id), active: Boolean(category.active) })) })))
    setAccounts((accountResult.data || []).map((item) => ({ ...item, initial_balance: Number(item.initial_balance || 0) })) as Account[])
    setTransactions((transactionResult.data || []).map((item) => ({ ...item, amount: Number(item.amount || 0) })) as Transaction[])
    setVehicles((vehicleResult.data || []) as Vehicle[])
    setBorrowers((borrowerResult.data || []) as Borrower[])
    setLoans((loanResult.data || []).map((item) => ({ ...item, monthly_rate: Number(item.monthly_rate || 0) })) as Loan[])
    setLoanEvents((eventResult.data || []).map((item) => ({ ...item, amount: Number(item.amount || 0), interest_component: Number(item.interest_component || 0), principal_component: Number(item.principal_component || 0) })) as LoanEvent[])
    if (!ruleResult.error) setRecurringRules((ruleResult.data || []).map((item) => ({ ...item, amount: Number(item.amount || 0), day_of_month: Number(item.day_of_month) })) as RecurringRule[])
    setLoading(false)
  }

  function navigate(next: PageId) { setPage(next); setMenuOpen(false); location.hash = `/${next}`; window.scrollTo({ top: 0, behavior: 'smooth' }) }

  async function saveTransaction(draft: TransactionDraft, editing?: Transaction | null) {
    if (!supabase) throw new Error('Serviço de dados indisponível.')
    const base = { account_id: draft.accountId || null, category_id: draft.categoryId, type: natureToDb(draft.nature), status: draft.status, description: draft.description, notes: draft.notes || null, payment_method: draft.nature === 'Saída' ? draft.paymentMethod : null, amount: draft.amount, competence_date: draft.competenceDate, settlement_date: draft.settlementDate, vehicle_id: draft.vehicleId || null }
    if (editing) {
      const noteValue = isRecurring(editing) ? `${RECURRENCE_MARKER}${draft.notes ? `\n${draft.notes}` : ''}` : draft.notes || null
      if (draft.scope === 'future' && editing.installment_group_id) {
        const future = transactions.filter((row) => row.installment_group_id === editing.installment_group_id && (row.settlement_date || row.competence_date) >= (editing.settlement_date || editing.competence_date))
        const firstDate = draft.settlementDate
        for (let index = 0; index < future.length; index += 1) {
          const row = future[index]
          const settlement = isRecurring(editing) ? addMonths(firstDate, index, Number(firstDate.slice(-2))) : row.settlement_date
          const competence = isRecurring(editing) ? addMonths(draft.competenceDate, index) : row.competence_date
          const { error } = await supabase.from('transactions').update({ ...base, notes: noteValue, settlement_date: settlement, competence_date: competence }).eq('id', row.id)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.from('transactions').update({ ...base, notes: noteValue }).eq('id', editing.id)
        if (error) throw error
      }
      await loadAll(); return
    }
    if (draft.recurring) {
      let seriesId = uuid()
      const ruleInsert = await supabase.from('recurring_rules').insert({ user_id: session.user.id, name: draft.description, type: natureToDb(draft.nature), amount: draft.amount, category_id: draft.categoryId, account_id: draft.accountId || null, payment_method: draft.nature === 'Saída' ? draft.paymentMethod : null, day_of_month: draft.recurrenceDay, start_date: draft.settlementDate, end_date: draft.recurrenceEnd || null, notes: draft.notes || null }).select('id').single()
      if (!ruleInsert.error && ruleInsert.data?.id) seriesId = String(ruleInsert.data.id)
      const end = draft.recurrenceEnd || addMonths(draft.settlementDate, 35, draft.recurrenceDay)
      const rows: Array<Record<string, unknown>> = []
      let index = 0
      let settlement = addMonths(draft.settlementDate, 0, draft.recurrenceDay)
      while (settlement <= end && index < 120) {
        rows.push({ ...base, user_id: session.user.id, notes: `${RECURRENCE_MARKER}${draft.notes ? `\n${draft.notes}` : ''}`, competence_date: addMonths(draft.competenceDate, index), settlement_date: settlement, status: index === 0 ? draft.status : 'planned', installment_group_id: seriesId, installment_number: index + 1 })
        index += 1
        settlement = addMonths(draft.settlementDate, index, draft.recurrenceDay)
      }
      rows.forEach((row) => { row.installment_total = rows.length })
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      await loadAll(); return
    }
    if (draft.nature === 'Saída' && draft.paymentMethod === 'Cartão de crédito' && draft.installments > 1) {
      const seriesId = uuid()
      const totalCents = Math.round(draft.amount * 100)
      const baseCents = Math.floor(totalCents / draft.installments)
      const remainder = totalCents - baseCents * draft.installments
      const rows = Array.from({ length: draft.installments }, (_, index) => ({ ...base, user_id: session.user.id, amount: (baseCents + (index === 0 ? remainder : 0)) / 100, settlement_date: addMonths(draft.firstInstallmentDate, index), installment_group_id: seriesId, installment_number: index + 1, installment_total: draft.installments, status: index === 0 ? draft.status : 'planned' }))
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      await loadAll(); return
    }
    const { error } = await supabase.from('transactions').insert({ ...base, user_id: session.user.id, installment_group_id: null, installment_number: null, installment_total: null })
    if (error) throw error
    await loadAll()
  }

  async function cancelTransaction(row: Transaction) {
    if (!supabase) return
    if (!window.confirm(`Cancelar “${row.description}”? O registro será preservado no histórico.`)) return
    const { error } = await supabase.from('transactions').update({ status: 'cancelled' }).eq('id', row.id)
    if (!error) await loadAll()
  }

  async function saveGroup(name: string, nature: Nature, editing?: CategoryGroup | null) {
    if (!supabase) return
    if (editing) {
      const { error } = await supabase.from('category_groups').update({ name, nature: natureToDb(nature) }).eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('category_groups').insert({ user_id: session.user.id, name, nature: natureToDb(nature) })
      if (error) throw error
    }
    await loadAll()
  }

  async function saveCategory(name: string, groupId: string, editing?: Category | null) {
    if (!supabase) return
    if (editing) {
      const { error } = await supabase.from('categories').update({ name, group_id: groupId }).eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('categories').insert({ user_id: session.user.id, name, group_id: groupId })
      if (error) throw error
    }
    await loadAll()
  }

  async function saveAccount(name: string, type: string, balance: number, editing?: Account | null) {
    if (!supabase) return
    if (editing) {
      const { error } = await supabase.from('accounts').update({ name, account_type: type, initial_balance: balance }).eq('id', editing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('accounts').insert({ user_id: session.user.id, name, account_type: type, initial_balance: balance })
      if (error) throw error
    }
    await loadAll()
  }

  async function saveLoan(data: { borrowerId?: string; name: string; contact: string; document: string; amount: number; rate: number; date: string; notes: string }, loan?: Loan | null, borrowerOnly?: Borrower | null) {
    if (!supabase) return
    if (borrowerOnly) {
      const { error } = await supabase.from('borrowers').update({ name: data.name, contact: data.contact || null, document: data.document || null, notes: data.notes || null }).eq('id', borrowerOnly.id)
      if (error) throw error
      await loadAll(); return
    }
    if (loan) {
      const { error: personError } = await supabase.from('borrowers').update({ name: data.name, contact: data.contact || null, document: data.document || null }).eq('id', loan.borrower_id)
      if (personError) throw personError
      const { error } = await supabase.from('loans').update({ monthly_rate: data.rate, start_date: data.date, notes: data.notes || null }).eq('id', loan.id)
      if (error) throw error
      await loadAll(); return
    }
    if (data.amount <= 0) throw new Error('Informe o valor emprestado.')
    const person = await supabase.from('borrowers').insert({ user_id: session.user.id, name: data.name, contact: data.contact || null, document: data.document || null, notes: data.notes || null }).select('id').single()
    if (person.error || !person.data) throw person.error || new Error('Não foi possível criar a pessoa.')
    const createdLoan = await supabase.from('loans').insert({ user_id: session.user.id, borrower_id: person.data.id, monthly_rate: data.rate, start_date: data.date, notes: data.notes || null }).select('id').single()
    if (createdLoan.error || !createdLoan.data) throw createdLoan.error || new Error('Não foi possível criar o empréstimo.')
    const event = await supabase.from('loan_events').insert({ user_id: session.user.id, loan_id: createdLoan.data.id, event_date: data.date, event_type: 'disbursement', amount: data.amount, principal_component: data.amount, interest_component: 0 })
    if (event.error) throw event.error
    await loadAll()
  }

  async function savePayment(loan: Loan, amount: number, date: string, notes: string, event?: LoanEvent | null) {
    if (!supabase) return
    if (event) {
      const { error } = await supabase.from('loan_events').update({ amount, event_date: date, notes: notes || null, interest_component: 0, principal_component: 0 }).eq('id', event.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('loan_events').insert({ user_id: session.user.id, loan_id: loan.id, event_date: date, event_type: 'payment', amount, notes: notes || null, interest_component: 0, principal_component: 0 })
      if (error) throw error
    }
    await loadAll()
  }

  async function signOut() { await supabase?.auth.signOut() }

  const pages: Record<PageId, ReactNode> = {
    dashboard: <DashboardPage transactions={transactions} groups={groups} accounts={accounts} onNew={() => setTransactionEditor({ open: true })} onEdit={(row) => setTransactionEditor({ open: true, row })} onCancel={cancelTransaction}/>,
    transactions: <TransactionsPage transactions={transactions} groups={groups} accounts={accounts} onNew={() => setTransactionEditor({ open: true })} onEdit={(row) => setTransactionEditor({ open: true, row })} onCancel={cancelTransaction}/>,
    payables: <PayablesPage transactions={transactions} groups={groups} accounts={accounts} onNew={() => setTransactionEditor({ open: true, planned: true })} onEdit={(row) => setTransactionEditor({ open: true, row })} onCancel={cancelTransaction}/>,
    loans: <LoansPage loans={loans} borrowers={borrowers} events={loanEvents} onNew={() => setLoanEditor({ open: true })} onEditBorrower={(borrower) => setLoanEditor({ open: true, borrower })} onEditLoan={(loan) => setLoanEditor({ open: true, loan })} onPayment={(loan) => setPaymentEditor({ open: true, loan })} onEditEvent={(event) => { const loan = loans.find((item) => item.id === event.loan_id); if (loan) setPaymentEditor({ open: true, loan, event }) }}/>,
    vehicles: <VehiclesPage vehicles={vehicles} transactions={transactions}/>,
    investments: <InvestmentsPage accounts={accounts} transactions={transactions} onNewAccount={() => setAccountsOpen(true)}/>,
    comparisons: <ComparisonsPage transactions={transactions}/>,
    projections: <ProjectionsPage transactions={transactions} accounts={accounts}/>,
    settings: <SettingsPage groups={groups} accounts={accounts} recurringRules={recurringRules} recurringRows={transactions} onNewGroup={() => setGroupEditor({ open: true })} onEditGroup={(group) => setGroupEditor({ open: true, group })} onNewCategory={(group) => setCategoryEditor({ open: true, group })} onEditCategory={(category, group) => setCategoryEditor({ open: true, category, group })} onAccounts={() => setAccountsOpen(true)} onEditRecurring={(row) => setTransactionEditor({ open: true, row })}/>,
  }

  return <div className="appShell proShell"><aside className={menuOpen ? 'open' : ''}><Brand/><span className="navSection">Principal</span><nav>{navigation.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon name={item.id}/>{item.label}</button>)}</nav><span className="navSection">Conta</span><nav><button className={page === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Icon name="settings"/>Configurações</button></nav><div className="profile"><span>{(session.user.email || 'HV').slice(0, 2).toUpperCase()}</span><div><strong>{session.user.email?.split('@')[0] || 'Usuário'}</strong><small>Conta protegida</small></div><button onClick={signOut}>Sair</button></div></aside>{menuOpen && <button className="menuOverlay" onClick={() => setMenuOpen(false)}/>}<main className="workspace"><header className="topbar"><button className="mobileMenu" onClick={() => setMenuOpen(true)}><Icon name="menu"/></button><div><small>{pageHelp[page]}</small><h1>{currentLabel}</h1></div><div className="topActions"><button className="primaryButton topNew" onClick={() => setTransactionEditor({ open: true })}><Icon name="plus" size={17}/>Novo lançamento</button></div></header><div className="workspaceContent">{loading ? <div className="card loadingCard">Carregando seus dados...</div> : pages[page]}</div></main>{transactionEditor.open && <TransactionEditor close={() => setTransactionEditor({ open: false })} editing={transactionEditor.row} groups={groups} accounts={accounts} vehicles={vehicles} onSave={async (draft, editing) => { if (transactionEditor.planned && !editing) draft.status = 'planned'; await saveTransaction(draft, editing) }}/>} {groupEditor.open && <GroupEditor close={() => setGroupEditor({ open: false })} groups={groups} editing={groupEditor.group} onSave={saveGroup}/>} {categoryEditor.open && <CategoryEditor close={() => setCategoryEditor({ open: false })} groups={groups} editing={categoryEditor.category} initialGroup={categoryEditor.group} onSave={saveCategory}/>} {accountsOpen && <AccountManager close={() => setAccountsOpen(false)} accounts={accounts} onSave={saveAccount}/>} {loanEditor.open && <LoanEditor close={() => setLoanEditor({ open: false })} borrowers={borrowers} editingLoan={loanEditor.loan} editingBorrower={loanEditor.borrower} onSave={saveLoan}/>} {paymentEditor.open && paymentEditor.loan && <PaymentEditor close={() => setPaymentEditor({ open: false })} loan={paymentEditor.loan} event={paymentEditor.event} onSave={savePayment}/>}</div>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); if (!supabase) return; setLoading(true); setMessage(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (error) setMessage('Não foi possível entrar. Confira o e-mail e a senha.') }
  async function forgot() { if (!supabase || !email.trim()) { setMessage('Informe seu e-mail para recuperar a senha.'); return } setLoading(true); const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}${location.pathname}` }); setLoading(false); setMessage(error ? 'Não foi possível enviar o link.' : 'Link de recuperação enviado para o seu e-mail.') }
  return <main className="loginPage"><section className="loginIntro"><Brand/><div><span className="eyebrow">Controle financeiro pessoal</span><h1>Decisões melhores começam com números organizados.</h1><p>Controle entradas, saídas, contas futuras, empréstimos, veículos e investimentos em um único painel.</p></div><small>Seus dados permanecem separados por usuário.</small></section><section className="loginPanel"><form className="loginCard" onSubmit={submit}><h2>Entrar</h2><p>Acesse o seu painel financeiro.</p><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>{message && <div className={message.includes('enviado') ? 'configMessage loginMessage' : 'error'}>{message}</div>}<button className="primaryButton" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button><button type="button" className="textButton" onClick={forgot}>Esqueci minha senha</button></form></section></main>
}

function MissingConfig() {
  return <main className="systemUnavailable"><section><Brand/><span className="status">Serviço indisponível</span><h1>O painel financeiro não conseguiu iniciar.</h1><p>A conexão segura com o banco de dados ainda não está configurada nesta publicação. Configure as variáveis do Supabase no ambiente do GitHub Pages.</p></section></main>
}

export default function AppV2() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!hasSupabaseConfig) return <MissingConfig/>
  if (loading) return <main className="loading">Carregando...</main>
  return session ? <AppShell session={session}/> : <Login/>
}
