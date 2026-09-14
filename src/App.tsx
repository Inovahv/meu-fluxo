import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from './lib/supabase'

type PageId = 'dashboard' | 'transactions' | 'payables' | 'loans' | 'vehicles' | 'investments' | 'comparisons' | 'projections' | 'settings'
type IconName = PageId | 'menu' | 'plus' | 'bell' | 'search' | 'close' | 'wallet' | 'calendar' | 'trend'
type TransactionLabel = 'Saída' | 'Entrada' | 'Transferência'
type CategoryNature = Exclude<TransactionLabel, 'Transferência'>
type DbTransactionType = 'income' | 'expense' | 'transfer'
type DbStatus = 'planned' | 'completed' | 'overdue' | 'cancelled'
type Scenario = 'Conservador' | 'Base' | 'Otimista'
type SettingsPanel = 'accounts' | 'recurrences' | 'users' | 'security' | null

type Category = { id: string; name: string }
type CategoryGroup = { id: string; name: string; nature: CategoryNature; categories: Category[] }
type Account = { id: string; name: string; account_type: string; initial_balance: number; active?: boolean }
type Transaction = {
  id: string
  account_id: string | null
  category_id: string | null
  type: DbTransactionType
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
type LoanEvent = { id: string; loan_id: string; event_date: string; event_type: string; amount: number; interest_component: number; principal_component: number }
type RecurringRule = { id: string; name: string; amount: number; nature: CategoryNature; day: number; active: boolean }
type EntryPayload = {
  type: TransactionLabel
  description: string
  amount: number
  competenceDate: string
  groupId: string
  categoryId: string
  paymentMethod: string
  accountId: string
  installments: number
  settlementDate: string
  firstInstallmentDate: string
  status: DbStatus
  notes: string
  vehicleId: string
}

type PreviewState = {
  groups: CategoryGroup[]
  accounts: Account[]
  transactions: Transaction[]
  vehicles: Vehicle[]
  borrowers: Borrower[]
  loans: Loan[]
  loanEvents: LoanEvent[]
  recurrences: RecurringRule[]
}

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
  dashboard: 'Resumo financeiro do período',
  transactions: 'Entradas, saídas e transferências',
  payables: 'Compromissos previstos e realizados',
  loans: 'Juros, pagamentos e amortizações',
  vehicles: 'Custo real e média mensal por veículo',
  investments: 'Aportes, resgates e rendimentos',
  comparisons: 'Variações, tendências e alertas',
  projections: 'Cenários futuros do fluxo de caixa',
  settings: 'Perfil, categorias e preferências',
}

const defaultCategoryGroups: CategoryGroup[] = [
  { id: 'receitas', name: 'Receitas', nature: 'Entrada', categories: ['Salário', 'Décimo terceiro salário', 'Outros ganhos', 'Trabalho rural'].map((name, index) => ({ id: `receitas-${index}`, name })) },
  { id: 'investimentos-rendimentos', name: 'Investimentos e rendimentos', nature: 'Entrada', categories: ['Rendimentos bancários', 'Juros de empréstimos para terceiros'].map((name, index) => ({ id: `investimentos-rendimentos-${index}`, name })) },
  { id: 'moradia-utilidades', name: 'Moradia e utilidades', nature: 'Saída', categories: ['Aluguel', 'Gás de cozinha', 'Mobília', 'Materiais domésticos', 'Material de consumo'].map((name, index) => ({ id: `moradia-utilidades-${index}`, name })) },
  { id: 'despesas-pessoais', name: 'Despesas pessoais', nature: 'Saída', categories: ['Alimentação', 'Supermercado', 'Lazer', 'Saúde', 'Corte de cabelo'].map((name, index) => ({ id: `despesas-pessoais-${index}`, name })) },
  { id: 'servicos-digitais', name: 'Serviços digitais', nature: 'Saída', categories: ['Internet', 'Recarga de celular', 'Canva', 'Spotify'].map((name, index) => ({ id: `servicos-digitais-${index}`, name })) },
  { id: 'veiculos', name: 'Despesas veiculares', nature: 'Saída', categories: ['Combustível', 'Manutenção e acessórios', 'Troca de óleo', 'IPVA', 'Licenciamento', 'Vistoria veicular', 'Serviços de despachante', 'Aquisição de veículo', 'CNH'].map((name, index) => ({ id: `veiculos-${index}`, name })) },
  { id: 'transporte', name: 'Transporte', nature: 'Saída', categories: ['Passagem Águia Branca', 'Passagem São Gabriel', 'Táxi'].map((name, index) => ({ id: `transporte-${index}`, name })) },
  { id: 'materiais-compras', name: 'Materiais e compras', nature: 'Saída', categories: ['Equipamentos e acessórios', 'Vestuário e calçados', 'Aparelho eletrônico'].map((name, index) => ({ id: `materiais-compras-${index}`, name })) },
  { id: 'outras-despesas', name: 'Outras despesas', nature: 'Saída', categories: ['Gastos com terceiros', 'Outros gastos', 'Serviços de cartório', 'Despesas bancárias e taxas'].map((name, index) => ({ id: `outras-despesas-${index}`, name })) },
]

function id(prefix: string) {
  return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

function todayAsInputDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function currentMonthKey() {
  return todayAsInputDate().slice(0, 7)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0)
}

function parseMoney(value: string) {
  const clean = value.replace(/R\$/g, '').replace(/\s/g, '')
  const normalized = clean.includes(',') && clean.includes('.') ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(',', '.')
  const result = Number(normalized)
  return Number.isFinite(result) ? result : 0
}

function addMonthsIso(date: string, offset: number) {
  const [year, month, day] = date.split('-').map(Number)
  const first = new Date(year, month - 1 + offset, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const safeDay = Math.min(day, lastDay)
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function typeToDb(type: TransactionLabel): DbTransactionType {
  return type === 'Entrada' ? 'income' : type === 'Saída' ? 'expense' : 'transfer'
}

function dbToLabel(type: DbTransactionType): TransactionLabel {
  return type === 'income' ? 'Entrada' : type === 'expense' ? 'Saída' : 'Transferência'
}

function statusLabel(status: DbStatus, date?: string | null) {
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'overdue' || (status === 'planned' && date && date < todayAsInputDate())) return 'Vencido'
  return status === 'planned' ? 'Previsto' : 'Realizado'
}

function loadPreviewState(): PreviewState {
  const fallback: PreviewState = { groups: defaultCategoryGroups, accounts: [], transactions: [], vehicles: [], borrowers: [], loans: [], loanEvents: [], recurrences: [] }
  try {
    const raw = localStorage.getItem('meu-fluxo-preview-v2')
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const p: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    transactions: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
    payables: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    loans: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M7 7V4h10v3M8 13h8M12 10v6"/></>,
    vehicles: <><path d="m5 15 1.5-6h11l1.5 6M3 15h18v4h-3v-2H6v2H3z"/><path d="M7 14h.01M17 14h.01"/></>,
    investments: <><path d="M4 20V10M10 20V5M16 20v-7M22 20V3M2 20h21"/></>,
    comparisons: <><path d="M7 4v16M17 4v16M4 8l3-3 3 3M14 16l3 3 3-3"/></>,
    projections: <><path d="m3 18 6-7 4 4 8-10M16 5h5v5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2Z"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M15 10h7v5h-7a2.5 2.5 0 0 1 0-5Z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    trend: <path d="m3 17 6-6 4 4 8-9M16 6h5v5"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{p[name]}</svg>
}

function Brand() {
  return <div className="brand"><span className="brandMark"><i/><i/><i/></span><span><strong>Meu Fluxo</strong><small>Finanças pessoais</small></span></div>
}

function EmptyState({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="emptyState"><span className="emptyIcon"><Icon name={icon} size={23}/></span><h3>{title}</h3><p>{text}</p>{action && <button className="secondaryButton" onClick={onAction}>{action}</button>}</div>
}

function PageHeader({ title, description, action, onAction, children }: { title: string; description: string; action?: string; onAction?: () => void; children?: ReactNode }) {
  return <div className="pageHeader"><div><h2>{title}</h2><p>{description}</p></div><div className="pageActions">{children}{action && <button className="primaryButton" onClick={onAction}><Icon name="plus" size={17}/>{action}</button>}</div></div>
}

function Metric({ label, value = 0, detail, tone = 'blue', currency = true }: { label: string; value?: number; detail?: string; tone?: string; currency?: boolean }) {
  return <article className="metric"><span className={`metricIcon ${tone}`}><Icon name={tone === 'green' ? 'trend' : tone === 'red' ? 'wallet' : 'dashboard'} size={18}/></span><small>{label}</small><strong>{currency ? money(value) : value}</strong><p>{detail || 'Calculado a partir dos lançamentos'}</p></article>
}

function SimpleDialog({ title, description, close, children, wide = false }: { title: string; description?: string; close: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="dialogBackdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className={`dialog ${wide ? 'wideDialog' : ''}`}>
      <div className="dialogHeader"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="iconButton" onClick={close}><Icon name="close"/></button></div>
      <div className="simpleDialogBody">{children}</div>
    </section>
  </div>
}

function TransactionTable({ transactions, groups, accounts }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[] }) {
  const categoryInfo = useMemo(() => {
    const map = new Map<string, { category: string; group: string }>()
    groups.forEach((group) => group.categories.forEach((category) => map.set(category.id, { category: category.name, group: group.name })))
    return map
  }, [groups])
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts])
  return <div className="tableScroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Grupo</th><th>Conta</th><th>Situação</th><th className="right">Valor</th></tr></thead><tbody>{transactions.map((transaction) => {
    const info = transaction.category_id ? categoryInfo.get(transaction.category_id) : undefined
    return <tr key={transaction.id}><td>{formatDate(transaction.competence_date)}</td><td><strong>{transaction.description}</strong><small className="rowSub">{info?.category || dbToLabel(transaction.type)}</small></td><td>{info?.group || '—'}</td><td>{transaction.account_id ? accountMap.get(transaction.account_id) || '—' : '—'}</td><td><span className={`statusPill ${statusLabel(transaction.status, transaction.settlement_date).toLowerCase()}`}>{statusLabel(transaction.status, transaction.settlement_date)}</span></td><td className={`right amountCell ${transaction.type}`}>{transaction.type === 'expense' ? '− ' : transaction.type === 'income' ? '+ ' : ''}{money(transaction.amount)}</td></tr>
  })}</tbody></table></div>
}

function DashboardPage({ transactions, groups, accounts, openEntry, goTransactions }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; openEntry: () => void; goTransactions: () => void }) {
  const [period, setPeriod] = useState(currentMonthKey())
  const options = useMemo(() => Array.from({ length: 12 }, (_, index) => addMonthsIso(`${currentMonthKey()}-01`, -index).slice(0, 7)), [])
  const monthTransactions = transactions.filter((item) => item.competence_date.startsWith(period) && item.status !== 'cancelled')
  const income = monthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const expense = monthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const initialBalance = accounts.reduce((sum, account) => sum + Number(account.initial_balance || 0), 0)
  const completedBalance = transactions.filter((item) => item.status === 'completed').reduce((sum, item) => sum + (item.type === 'income' ? item.amount : item.type === 'expense' ? -item.amount : 0), initialBalance)
  const recent = [...transactions].sort((a, b) => (b.competence_date + b.id).localeCompare(a.competence_date + a.id)).slice(0, 5)
  return <><PageHeader title="Visão geral" description="Acompanhe o mês, identifique mudanças e acesse os detalhes." action="Novo lançamento" onAction={openEntry}><select className="selectControl" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período">{options.map((option) => <option key={option} value={option}>{monthLabel(option)}</option>)}</select></PageHeader><div className="metrics"><Metric label="Entradas no mês" value={income} tone="green"/><Metric label="Saídas no mês" value={expense} tone="red"/><Metric label="Resultado do mês" value={income - expense}/><Metric label="Saldo disponível" value={completedBalance} tone="amber"/></div><div className="dashboardGrid"><section className="card chartCard"><div className="cardHeader"><div><h3>Entradas e saídas</h3><p>Evolução dos últimos seis meses</p></div><div className="legend"><span className="income">Entradas</span><span className="expense">Saídas</span></div></div><div className="miniBars">{Array.from({ length: 6 }, (_, index) => addMonthsIso(`${period}-01`, index - 5).slice(0, 7)).map((month) => {
    const rows = transactions.filter((item) => item.competence_date.startsWith(month) && item.status !== 'cancelled')
    const monthIncome = rows.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const monthExpense = rows.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    const max = Math.max(monthIncome, monthExpense, 1)
    return <div className="barMonth" key={month}><div className="bars"><i className="barIncome" style={{ height: `${Math.max(5, (monthIncome / max) * 100)}%` }}/><i className="barExpense" style={{ height: `${Math.max(5, (monthExpense / max) * 100)}%` }}/></div><small>{monthLabel(month).slice(0, 3)}</small></div>
  })}</div></section><section className="card"><div className="cardHeader"><div><h3>Despesas por grupo</h3><p>Participação no mês</p></div></div>{expense === 0 ? <EmptyState icon="comparisons" title="Sem despesas" text="Os grupos aparecerão aqui conforme os lançamentos forem registrados."/> : <div className="groupBreakdown">{groups.filter((group) => group.nature === 'Saída').map((group) => {
    const ids = new Set(group.categories.map((category) => category.id))
    const total = monthTransactions.filter((item) => item.type === 'expense' && item.category_id && ids.has(item.category_id)).reduce((sum, item) => sum + item.amount, 0)
    if (!total) return null
    return <div key={group.id}><span>{group.name}</span><strong>{money(total)}</strong><small>{((total / expense) * 100).toFixed(1)}%</small></div>
  })}</div>}</section></div><div className="dashboardGrid lower"><section className="card"><div className="cardHeader"><div><h3>Últimos lançamentos</h3><p>Entradas e saídas recentes</p></div><button className="textButton" onClick={goTransactions}>Ver todos</button></div>{recent.length ? <TransactionTable transactions={recent} groups={groups} accounts={accounts}/> : <EmptyState icon="transactions" title="Nenhum lançamento" text="Adicione uma entrada ou saída para iniciar o controle." action="Adicionar lançamento" onAction={openEntry}/>}</section><section className="card attention"><div className="cardHeader"><div><h3>Atenção</h3><p>Contas, tendências e avisos</p></div></div><div className="notice neutral"><Icon name="bell"/><div><strong>{transactions.some((item) => item.status === 'planned' && item.settlement_date && item.settlement_date < todayAsInputDate()) ? 'Existem compromissos vencidos' : 'Sem alertas críticos'}</strong><p>Os avisos são calculados com base nos seus compromissos previstos.</p></div></div></section></div></>
}

function TransactionsPage({ transactions, groups, accounts, openEntry }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; openEntry: () => void }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [group, setGroup] = useState('all')
  const categoryToGroup = useMemo(() => {
    const map = new Map<string, string>()
    groups.forEach((item) => item.categories.forEach((category) => map.set(category.id, item.id)))
    return map
  }, [groups])
  const categoryNames = useMemo(() => {
    const map = new Map<string, string>()
    groups.forEach((item) => item.categories.forEach((category) => map.set(category.id, category.name)))
    return map
  }, [groups])
  const filtered = transactions.filter((item) => {
    const haystack = `${item.description} ${item.category_id ? categoryNames.get(item.category_id) || '' : ''}`.toLocaleLowerCase()
    const matchesSearch = haystack.includes(search.toLocaleLowerCase())
    const matchesType = type === 'all' || item.type === type
    const matchesGroup = group === 'all' || (item.category_id && categoryToGroup.get(item.category_id) === group)
    return matchesSearch && matchesType && matchesGroup
  })
  return <><PageHeader title="Lançamentos" description="Consulte, filtre e registre todas as movimentações." action="Adicionar lançamento" onAction={openEntry}/><div className="toolbar"><label className="searchField"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar descrição ou categoria"/></label><select className="selectControl" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todos os tipos</option><option value="income">Entradas</option><option value="expense">Saídas</option><option value="transfer">Transferências</option></select><select className="selectControl" value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">Todos os grupos</option>{groups.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div><section className="card tableCard">{filtered.length ? <TransactionTable transactions={filtered} groups={groups} accounts={accounts}/> : <EmptyState icon="transactions" title={transactions.length ? 'Nenhum resultado' : 'Sua lista está vazia'} text={transactions.length ? 'Ajuste os filtros para localizar outros lançamentos.' : 'Os lançamentos poderão ser filtrados por período, grupo, categoria e situação.'} action={transactions.length ? undefined : 'Criar primeiro lançamento'} onAction={openEntry}/>}</section></>
}

function PayablesPage({ transactions, groups, accounts, openPlanned }: { transactions: Transaction[]; groups: CategoryGroup[]; accounts: Account[]; openPlanned: () => void }) {
  const planned = transactions.filter((item) => item.status === 'planned').sort((a, b) => (a.settlement_date || a.competence_date).localeCompare(b.settlement_date || b.competence_date))
  const today = todayAsInputDate()
  const seven = new Date(`${today}T12:00:00`); seven.setDate(seven.getDate() + 7)
  const sevenIso = `${seven.getFullYear()}-${String(seven.getMonth() + 1).padStart(2, '0')}-${String(seven.getDate()).padStart(2, '0')}`
  const dueSoon = planned.filter((item) => item.type === 'expense' && item.settlement_date && item.settlement_date >= today && item.settlement_date <= sevenIso).reduce((sum, item) => sum + item.amount, 0)
  const receivable = planned.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const overdue = planned.filter((item) => item.type === 'expense' && item.settlement_date && item.settlement_date < today).reduce((sum, item) => sum + item.amount, 0)
  return <><PageHeader title="Pagar e receber" description="Veja o que vence, o que já foi realizado e o que está atrasado." action="Nova conta" onAction={openPlanned}/><div className="statusMetrics"><article><span>Vence nos próximos 7 dias</span><strong>{money(dueSoon)}</strong></article><article><span>A receber</span><strong>{money(receivable)}</strong></article><article><span>Vencido</span><strong>{money(overdue)}</strong></article></div><div className="twoColumns"><section className="card"><div className="cardHeader"><div><h3>Calendário financeiro</h3><p>{monthLabel(currentMonthKey())}</p></div><button className="iconButton" onClick={openPlanned} title="Adicionar compromisso"><Icon name="calendar"/></button></div>{planned.length ? <div className="agendaList">{planned.slice(0, 8).map((item) => <button type="button" key={item.id} onClick={openPlanned}><span>{formatDate(item.settlement_date || item.competence_date)}</span><strong>{item.description}</strong><small>{money(item.amount)}</small></button>)}</div> : <EmptyState icon="calendar" title="Nenhuma conta programada" text="Recorrências e parcelas futuras aparecerão automaticamente." action="Programar conta" onAction={openPlanned}/>}</section><section className="card"><div className="cardHeader"><div><h3>Próximos compromissos</h3><p>Ordenados por vencimento</p></div></div>{planned.length ? <TransactionTable transactions={planned.slice(0, 5)} groups={groups} accounts={accounts}/> : <EmptyState icon="payables" title="Agenda livre" text="Não há contas previstas para este período."/>}</section></div></>
}

function LoansPage({ loans, borrowers, loanEvents, openLoan }: { loans: Loan[]; borrowers: Borrower[]; loanEvents: LoanEvent[]; openLoan: () => void }) {
  const [search, setSearch] = useState('')
  const borrowerMap = new Map<string, Borrower>()
  borrowers.forEach((item) => borrowerMap.set(item.id, item))
  const balances = new Map<string, number>()
  loans.forEach((loan) => {
    const events = loanEvents.filter((event) => event.loan_id === loan.id)
    const principal = events.reduce((sum, event) => sum + (event.event_type === 'disbursement' ? event.amount : -Number(event.principal_component || 0)), 0)
    balances.set(loan.id, Math.max(principal, 0))
  })
  const total = Array.from(balances.values()).reduce((sum: number, value: number) => sum + value, 0)
  const interestReceived = loanEvents.reduce((sum, event) => sum + Number(event.interest_component || 0), 0)
  const filtered = loans.filter((loan) => (borrowerMap.get(loan.borrower_id)?.name || '').toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <><PageHeader title="Empréstimos" description="Controle por pessoa com juros compostos proporcionais aos dias." action="Novo empréstimo" onAction={openLoan}/><div className="twoColumns loanIntro"><section className="card loanSummary"><span className="sectionTag">Resumo geral</span><strong className="bigValue">{money(total)}</strong><p>Saldo principal a receber</p><div className="miniGrid"><div><small>Total emprestado</small><strong>{money(loanEvents.filter((event) => event.event_type === 'disbursement').reduce((sum, event) => sum + event.amount, 0))}</strong></div><div><small>Juros recebidos</small><strong>{money(interestReceived)}</strong></div><div><small>Pessoas</small><strong>{new Set(loans.map((loan) => loan.borrower_id)).size}</strong></div></div></section><section className="card formulaCard"><h3>Regra de cálculo</h3><p>Taxa mensal configurável com capitalização proporcional aos dias.</p><code>saldo × ((1 + taxa)<sup>dias ÷ 30</sup> − 1)</code><small>Pagamentos quitam primeiro os juros acumulados e depois amortizam o principal.</small></section></div><section className="card sectionGap"><div className="cardHeader"><div><h3>Pessoas e contratos</h3><p>Filtre pelo nome e consulte os contratos</p></div><label className="compactSearch"><Icon name="search" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar pessoa"/></label></div>{filtered.length ? <div className="recordGrid">{filtered.map((loan) => <article key={loan.id}><span className="recordIcon"><Icon name="loans"/></span><div><strong>{borrowerMap.get(loan.borrower_id)?.name || 'Pessoa'}</strong><small>Início {formatDate(loan.start_date)} · {(loan.monthly_rate * 100).toFixed(2)}% a.m.</small></div><b>{money(balances.get(loan.id) || 0)}</b></article>)}</div> : <EmptyState icon="loans" title={loans.length ? 'Nenhum contrato encontrado' : 'Nenhum empréstimo cadastrado'} text={loans.length ? 'Tente pesquisar por outro nome.' : 'Cadastre uma pessoa e registre as datas em que o dinheiro foi entregue.'} action={loans.length ? undefined : 'Cadastrar empréstimo'} onAction={openLoan}/>}</section></>
}

function VehiclesPage({ vehicles, transactions, openVehicle }: { vehicles: Vehicle[]; transactions: Transaction[]; openVehicle: () => void }) {
  return <><PageHeader title="Veículos" description="Separe o custo real do mês e acompanhe a média mensal." action="Cadastrar veículo" onAction={openVehicle}/><div className="twoColumns"><section className="card">{vehicles.length ? <div className="recordGrid">{vehicles.map((vehicle) => {
    const costs = transactions.filter((item) => item.vehicle_id === vehicle.id && item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    return <article key={vehicle.id}><span className="recordIcon"><Icon name="vehicles"/></span><div><strong>{vehicle.name}</strong><small>{[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}</small></div><b>{money(costs)}</b></article>
  })}</div> : <EmptyState icon="vehicles" title="Nenhum veículo cadastrado" text="Cadastre carro ou moto para relacionar combustível, impostos e manutenção." action="Cadastrar veículo" onAction={openVehicle}/>}</section><section className="card"><div className="cardHeader"><div><h3>Custo mês a mês</h3><p>Sem ratear valores no fluxo de caixa real</p></div></div><div className="emptyChart compact"><div className="chartGrid"><i/><i/><i/></div><span>{vehicles.length ? 'Os custos serão consolidados pelos lançamentos vinculados.' : 'Cadastre um veículo para visualizar.'}</span></div></section></div><section className="card infoCard sectionGap"><div className="notice blue"><Icon name="vehicles"/><div><strong>Como a média será apresentada</strong><p>IPVA, licenciamento e seguro permanecem no mês do pagamento. A média mensal será exibida separadamente para planejamento.</p></div></div></section></>
}

function InvestmentsPage({ accounts, transactions, openInvestment }: { accounts: Account[]; transactions: Transaction[]; openInvestment: () => void }) {
  const investments = accounts.filter((account) => account.account_type === 'investment')
  const investmentIds = new Set(investments.map((item) => item.id))
  const related = transactions.filter((item) => item.account_id && investmentIds.has(item.account_id))
  const balance = investments.reduce((sum, item) => sum + Number(item.initial_balance || 0), 0) + related.reduce((sum, item) => sum + (item.type === 'income' ? item.amount : item.type === 'expense' ? -item.amount : 0), 0)
  const month = currentMonthKey()
  const monthRelated = related.filter((item) => item.competence_date.startsWith(month))
  const yieldValue = monthRelated.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  return <><PageHeader title="Investimentos" description="Acompanhe aportes, resgates, rentabilidade e rendimentos realizados." action="Adicionar investimento" onAction={openInvestment}/><div className="metrics"><Metric label="Saldo aplicado" value={balance}/><Metric label="Movimentação no mês" value={monthRelated.reduce((sum, item) => sum + item.amount, 0)}/><Metric label="Rendimento líquido" value={yieldValue} tone="green"/><Metric label="Produtos ativos" value={investments.length} tone="amber" detail="Quantidade de contas de investimento" currency={false}/></div><div className="twoColumns"><section className="card"><div className="cardHeader"><div><h3>Evolução dos investimentos</h3><p>Patrimônio e rendimento líquido</p></div></div><div className="emptyChart"><div className="chartGrid"><i/><i/><i/></div><span>{investments.length ? 'A evolução será formada pelos lançamentos vinculados às contas de investimento.' : 'Cadastre uma conta de investimento para começar.'}</span></div></section><section className="card"><div className="cardHeader"><div><h3>Produtos</h3><p>Contas cadastradas</p></div></div>{investments.length ? <div className="recordGrid compactRecords">{investments.map((item) => <article key={item.id}><span className="recordIcon"><Icon name="investments"/></span><div><strong>{item.name}</strong><small>Investimento</small></div><b>{money(item.initial_balance || 0)}</b></article>)}</div> : <EmptyState icon="investments" title="Nenhum produto cadastrado" text="Cadastre um investimento. Aportes podem ser tratados como transferências, sem inflar as despesas." action="Adicionar investimento" onAction={openInvestment}/>}</section></div></>
}

function ComparisonsPage({ transactions, groups }: { transactions: Transaction[]; groups: CategoryGroup[] }) {
  const [mode, setMode] = useState<'previous' | 'year'>('previous')
  const current = currentMonthKey()
  const reference = addMonthsIso(`${current}-01`, mode === 'previous' ? -1 : -12).slice(0, 7)
  const currentRows = transactions.filter((item) => item.competence_date.startsWith(current) && item.status !== 'cancelled')
  const referenceRows = transactions.filter((item) => item.competence_date.startsWith(reference) && item.status !== 'cancelled')
  const summarize = (rows: Transaction[]) => ({ income: rows.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0), expense: rows.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0) })
  const a = summarize(currentRows), b = summarize(referenceRows)
  const groupChanges = groups.filter((group) => group.nature === 'Saída').map((group) => {
    const ids = new Set(group.categories.map((category) => category.id))
    const currentValue = currentRows.filter((item) => item.category_id && ids.has(item.category_id) && item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    const referenceValue = referenceRows.filter((item) => item.category_id && ids.has(item.category_id) && item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    return { name: group.name, currentValue, referenceValue, difference: currentValue - referenceValue }
  }).filter((item) => item.currentValue || item.referenceValue).sort((x, y) => Math.abs(y.difference) - Math.abs(x.difference))
  return <><PageHeader title="Comparações" description="Entenda o que aumentou, diminuiu e se tornou tendência."><select className="selectControl" value={mode} onChange={(event) => setMode(event.target.value as 'previous' | 'year')}><option value="previous">Mês anterior</option><option value="year">Mesmo mês do ano anterior</option></select></PageHeader><div className="twoColumns"><section className="card"><div className="cardHeader"><div><h3>Resumo da comparação</h3><p>{monthLabel(current)} × {monthLabel(reference)}</p></div></div>{currentRows.length || referenceRows.length ? <div className="comparisonList"><div><span>Entradas</span><strong>{money(a.income)}</strong><small>{money(a.income - b.income)} de diferença</small></div><div><span>Saídas</span><strong>{money(a.expense)}</strong><small>{money(a.expense - b.expense)} de diferença</small></div><div><span>Resultado</span><strong>{money((a.income - a.expense) - (b.income - b.expense))}</strong><small>Variação do resultado</small></div></div> : <EmptyState icon="comparisons" title="Ainda não há períodos comparáveis" text="São necessários lançamentos em pelo menos dois períodos."/>}</section><section className="card"><div className="cardHeader"><div><h3>Variação por grupo</h3><p>Maiores aumentos e reduções</p></div></div>{groupChanges.length ? <div className="comparisonList">{groupChanges.slice(0, 6).map((item) => <div key={item.name}><span>{item.name}</span><strong>{money(item.difference)}</strong><small>{money(item.currentValue)} no período atual</small></div>)}</div> : <EmptyState icon="trend" title="Sem variações calculadas" text="Quando houver dados comparáveis, os grupos aparecerão aqui."/>}</section></div><section className="card sectionGap"><div className="cardHeader"><div><h3>Análises automáticas</h3><p>Tendências calculadas a partir do histórico</p></div></div><div className="notice neutral"><Icon name="bell"/><div><strong>{groupChanges.length ? `${groupChanges[0].name} tem a maior variação absoluta` : 'Nenhuma tendência disponível'}</strong><p>{groupChanges.length ? `Diferença de ${money(groupChanges[0].difference)} em relação ao período de comparação.` : 'Inclua mais períodos para formar uma tendência confiável.'}</p></div></div></section></>
}

function ProjectionsPage({ transactions, accounts }: { transactions: Transaction[]; accounts: Account[] }) {
  const [scenario, setScenario] = useState<Scenario>('Base')
  const [endMonth, setEndMonth] = useState(addMonthsIso(`${currentMonthKey()}-01`, 9).slice(0, 7))
  const initialBalance = accounts.reduce((sum, item) => sum + Number(item.initial_balance || 0), 0) + transactions.filter((item) => item.status === 'completed').reduce((sum, item) => sum + (item.type === 'income' ? item.amount : item.type === 'expense' ? -item.amount : 0), 0)
  const future = transactions.filter((item) => item.status === 'planned' && (item.settlement_date || item.competence_date) <= `${endMonth}-31` && (item.settlement_date || item.competence_date) >= todayAsInputDate())
  const baseIncome = future.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0)
  const baseExpense = future.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
  const incomeFactor = scenario === 'Conservador' ? .9 : scenario === 'Otimista' ? 1.1 : 1
  const expenseFactor = scenario === 'Conservador' ? 1.1 : scenario === 'Otimista' ? .9 : 1
  const projectedIncome = baseIncome * incomeFactor
  const projectedExpense = baseExpense * expenseFactor
  return <><PageHeader title="Projeções" description="Visualize o saldo futuro usando parcelas e contas previstas."><label className="dateControl">Projetar até<input type="month" value={endMonth} min={currentMonthKey()} onChange={(event) => setEndMonth(event.target.value)}/></label></PageHeader><div className="scenarioTabs">{(['Conservador', 'Base', 'Otimista'] as Scenario[]).map((item) => <button key={item} className={scenario === item ? 'active' : ''} onClick={() => setScenario(item)}>{item}</button>)}</div><section className="card projectionCard"><div className="projectionSummary"><div><small>Saldo inicial</small><strong>{money(initialBalance)}</strong></div><div><small>Entradas previstas</small><strong>{money(projectedIncome)}</strong></div><div><small>Saídas previstas</small><strong>{money(projectedExpense)}</strong></div><div><small>Saldo projetado</small><strong>{money(initialBalance + projectedIncome - projectedExpense)}</strong></div></div><div className="emptyChart"><div className="chartGrid"><i/><i/><i/><i/></div><span>{future.length ? `${future.length} compromisso${future.length === 1 ? '' : 's'} considerado${future.length === 1 ? '' : 's'} no cenário ${scenario.toLowerCase()}.` : 'A projeção não inventa receitas ou rendimentos sem uma premissa cadastrada.'}</span></div></section></>
}

function SettingsPage({ groups, onAddGroup, onAddCategory, openPanel }: { groups: CategoryGroup[]; onAddGroup: (name: string, nature: CategoryNature) => Promise<void>; onAddCategory: (groupId: string, name: string) => Promise<void>; openPanel: (panel: Exclude<SettingsPanel, null>) => void }) {
  const [editor, setEditor] = useState<'group' | 'category' | null>(null)
  const [name, setName] = useState('')
  const [nature, setNature] = useState<CategoryNature>('Saída')
  const [groupId, setGroupId] = useState(groups[0]?.id || '')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const categoryCount = groups.reduce((total, group) => total + group.categories.length, 0)
  useEffect(() => { if (!groupId && groups[0]) setGroupId(groups[0].id) }, [groups, groupId])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    setSaving(true)
    try {
      if (editor === 'group') await onAddGroup(cleanName, nature)
      if (editor === 'category' && groupId) await onAddCategory(groupId, cleanName)
      setMessage(`${editor === 'group' ? 'Grupo' : 'Categoria'} adicionado com sucesso.`)
      setName('')
      setEditor(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }
  return <><PageHeader title="Configurações" description="Personalize o sistema sem alterar os dados de outros usuários."/><div className="configSummary"><article><small>Grupos cadastrados</small><strong>{groups.length}</strong></article><article><small>Categorias cadastradas</small><strong>{categoryCount}</strong></article><article><small>Escopo</small><strong>Por usuário</strong></article></div><section className="card categoryManager"><div className="cardHeader categoryManagerHeader"><div><h3>Grupos e categorias</h3><p>Estrutura inicial preparada a partir das classificações da planilha.</p></div><div className="inlineActions"><button className="secondaryButton" onClick={() => { setEditor('group'); setMessage('') }}><Icon name="plus" size={16}/>Novo grupo</button><button className="primaryButton" onClick={() => { setEditor('category'); setGroupId(groups[0]?.id || ''); setMessage('') }}><Icon name="plus" size={16}/>Nova categoria</button></div></div>{editor && <form className="configForm" onSubmit={submit}><div><strong>{editor === 'group' ? 'Adicionar grupo' : 'Adicionar categoria'}</strong><small>A alteração fica associada ao perfil atual quando o Supabase está conectado.</small></div><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder={editor === 'group' ? 'Ex.: Educação' : 'Ex.: Cursos'} autoFocus required/></label>{editor === 'group' ? <label>Natureza<select value={nature} onChange={(event) => setNature(event.target.value as CategoryNature)}><option>Saída</option><option>Entrada</option></select></label> : <label>Grupo<select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}<div className="configFormActions"><button type="button" className="textButton" onClick={() => setEditor(null)}>Cancelar</button><button className="primaryButton" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</button></div></form>}{message && <div className="configMessage">{message}</div>}<div className="categoryGroups">{groups.map((group) => <article className="categoryGroup" key={group.id}><div className="categoryGroupHeader"><div><strong>{group.name}</strong><small>{group.categories.length} categorias</small></div><span className={`natureBadge ${group.nature === 'Entrada' ? 'income' : 'expense'}`}>{group.nature}</span></div><div className="categoryChips">{group.categories.map((category) => <span key={category.id}>{category.name}</span>)}</div></article>)}</div></section><div className="settingsGrid sectionGap">{[
    { panel: 'accounts' as const, title: 'Contas e cartões', text: 'Saldos, tipos de conta e cartões.', icon: 'wallet' as IconName },
    { panel: 'recurrences' as const, title: 'Recorrências', text: 'Salário, aluguel e serviços recorrentes.', icon: 'calendar' as IconName },
    { panel: 'users' as const, title: 'Usuários', text: 'Acessos e separação por perfil.', icon: 'settings' as IconName },
    { panel: 'security' as const, title: 'Segurança e dados', text: 'Sessão, recuperação, exportação e backup.', icon: 'dashboard' as IconName },
  ].map((item) => <button className="settingCard" key={item.title} onClick={() => openPanel(item.panel)}><span className="settingIcon"><Icon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.text}</small></span><b>›</b></button>)}</div></>
}

function EntryDialog({ close, groups, accounts, vehicles, initialStatus = 'completed', onSave }: { close: () => void; groups: CategoryGroup[]; accounts: Account[]; vehicles: Vehicle[]; initialStatus?: DbStatus; onSave: (payload: EntryPayload) => Promise<void> }) {
  const [type, setType] = useState<TransactionLabel>('Saída')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [groupId, setGroupId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [accountId, setAccountId] = useState('')
  const [installments, setInstallments] = useState('1')
  const [competenceDate, setCompetenceDate] = useState(todayAsInputDate())
  const [settlementDate, setSettlementDate] = useState(todayAsInputDate())
  const [firstInstallmentDate, setFirstInstallmentDate] = useState('')
  const [status, setStatus] = useState<DbStatus>(initialStatus)
  const [notes, setNotes] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const availableGroups = useMemo(() => groups.filter((group) => group.nature === type), [groups, type])
  const selectedGroup = groups.find((group) => group.id === groupId)
  const isCreditCard = type === 'Saída' && paymentMethod === 'Cartão de crédito'
  const availableAccounts = isCreditCard ? accounts.filter((account) => account.account_type === 'credit_card') : accounts.filter((account) => account.account_type !== 'credit_card')
  function changeType(nextType: TransactionLabel) {
    setType(nextType); setGroupId(''); setCategoryId(''); setAccountId(''); if (nextType !== 'Saída') setPaymentMethod('Pix')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const numericAmount = parseMoney(amount)
    if (numericAmount <= 0) { setMessage('Informe um valor maior que zero.'); return }
    setSaving(true); setMessage('')
    try {
      await onSave({ type, description: description.trim(), amount: numericAmount, competenceDate, groupId, categoryId, paymentMethod, accountId, installments: Number(installments), settlementDate, firstInstallmentDate, status, notes: notes.trim(), vehicleId })
      close()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o lançamento.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="dialogBackdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="dialog entryDialog" onSubmit={submit}><div className="dialogHeader"><div><h2>Novo lançamento</h2><p>Registre a competência e o efeito no caixa separadamente.</p></div><button type="button" className="iconButton" onClick={close}><Icon name="close"/></button></div><div className="typeTabs">{(['Saída', 'Entrada', 'Transferência'] as TransactionLabel[]).map((item) => <button type="button" className={type === item ? 'active' : ''} onClick={() => changeType(item)} key={item}>{item}</button>)}</div><div className="formGrid"><label className="full">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === 'Saída' ? 'Ex.: Compra no supermercado' : 'Ex.: Salário do mês'} required/></label><label>Valor total<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="R$ 0,00" required/></label><label>Data de competência<input type="date" value={competenceDate} onChange={(event) => setCompetenceDate(event.target.value)} required/><small className="fieldHint">Data da compra ou do fato gerador.</small></label>{type !== 'Transferência' && <><label>Grupo<select value={groupId} onChange={(event) => { setGroupId(event.target.value); setCategoryId('') }} required><option value="">Selecionar grupo</option>{availableGroups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!selectedGroup} required><option value="">Selecionar categoria</option>{selectedGroup?.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></>}{type === 'Saída' && <label>Tipo de pagamento<select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setAccountId('') }}><option>Pix</option><option>Dinheiro</option><option>Transferência</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Boleto</option><option>Débito automático</option><option>Outro</option></select></label>}<label>{isCreditCard ? 'Cartão' : 'Conta'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Sem conta específica</option>{availableAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>{!isCreditCard && <label>Data de {type === 'Entrada' ? 'recebimento' : 'pagamento'}<input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} required/><small className="fieldHint">Data em que o valor entra ou sai do caixa.</small></label>}{isCreditCard && <><label>Quantidade de parcelas<select value={installments} onChange={(event) => setInstallments(event.target.value)}>{Array.from({ length: 24 }, (_, index) => index + 1).map((number) => <option value={number} key={number}>{number}x</option>)}</select></label><label>Data da primeira parcela<input type="date" value={firstInstallmentDate} onChange={(event) => setFirstInstallmentDate(event.target.value)} required/><small className="fieldHint">As demais serão programadas mês a mês.</small></label><div className="installmentBox full"><Icon name="calendar"/><div><strong>Competência preservada em {formatDate(competenceDate)}</strong><p>O valor total pertence à data da compra. As {installments} parcela{installments === '1' ? '' : 's'} afetam o fluxo a partir da primeira data informada.</p></div></div></>}<label>Situação<select value={status} onChange={(event) => setStatus(event.target.value as DbStatus)}><option value="completed">Realizado</option><option value="planned">Previsto</option></select></label>{vehicles.length > 0 && type === 'Saída' && <label>Veículo<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Não vincular</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.name}</option>)}</select></label>}<label className="full">Observação<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Inclua um detalhe para facilitar a busca"/></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button type="submit" className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Salvar lançamento'}</button></div></form></div>
}

function AccountDialog({ close, accounts, preset = 'checking', onSave }: { close: () => void; accounts: Account[]; preset?: string; onSave: (name: string, type: string, balance: number) => Promise<void> }) {
  const [name, setName] = useState('')
  const [type, setType] = useState(preset)
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('')
    try { await onSave(name.trim(), type, parseMoney(balance)); setName(''); setBalance(''); setMessage('Conta cadastrada com sucesso.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar.') } finally { setSaving(false) }
  }
  return <SimpleDialog title={preset === 'investment' ? 'Investimentos' : 'Contas e cartões'} description="Cadastre as contas usadas nos lançamentos." close={close} wide><form className="stackForm" onSubmit={submit}><div className="formGrid"><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder={type === 'credit_card' ? 'Ex.: Nubank' : 'Ex.: Conta principal'} required/></label><label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option value="checking">Conta corrente</option><option value="cash">Dinheiro</option><option value="savings">Poupança</option><option value="credit_card">Cartão de crédito</option><option value="investment">Investimento</option></select></label><label>Saldo inicial<input value={balance} onChange={(event) => setBalance(event.target.value)} inputMode="decimal" placeholder="0,00"/></label><div className="formButtonCell"><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</button></div></div>{message && <div className="configMessage dialogMessage">{message}</div>}</form><div className="recordGrid dialogRecords">{accounts.length ? accounts.map((account) => <article key={account.id}><span className="recordIcon"><Icon name={account.account_type === 'investment' ? 'investments' : 'wallet'}/></span><div><strong>{account.name}</strong><small>{account.account_type.replace('_', ' ')}</small></div><b>{money(account.initial_balance || 0)}</b></article>) : <EmptyState icon="wallet" title="Nenhuma conta cadastrada" text="Cadastre ao menos uma conta para relacionar seus lançamentos."/>}</div></SimpleDialog>
}

function VehicleDialog({ close, onSave }: { close: () => void; onSave: (vehicle: Omit<Vehicle, 'id'>) => Promise<void> }) {
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { await onSave({ name: name.trim(), plate: plate.trim() || null, make: make.trim() || null, model: model.trim() || null, model_year: year ? Number(year) : null, status: 'active' }); close() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar.') } finally { setSaving(false) } }
  return <SimpleDialog title="Cadastrar veículo" description="Depois, vincule as despesas ao veículo no lançamento." close={close}><form onSubmit={submit}><div className="formGrid"><label className="full">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Honda Civic" required/></label><label>Marca<input value={make} onChange={(event) => setMake(event.target.value)}/></label><label>Modelo<input value={model} onChange={(event) => setModel(event.target.value)}/></label><label>Placa<input value={plate} onChange={(event) => setPlate(event.target.value)}/></label><label>Ano<input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric"/></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter inlineFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar veículo'}</button></div></form></SimpleDialog>
}

function LoanDialog({ close, onSave }: { close: () => void; onSave: (data: { name: string; contact: string; amount: number; rate: number; date: string; notes: string }) => Promise<void> }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('1.00')
  const [date, setDate] = useState(todayAsInputDate())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); const value = parseMoney(amount); if (value <= 0) { setMessage('Informe um valor maior que zero.'); return } setSaving(true); setMessage(''); try { await onSave({ name: name.trim(), contact: contact.trim(), amount: value, rate: Number(rate.replace(',', '.')) / 100, date, notes: notes.trim() }); close() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar.') } finally { setSaving(false) } }
  return <SimpleDialog title="Novo empréstimo" description="Cadastre a pessoa, o principal e a taxa mensal." close={close}><form onSubmit={submit}><div className="formGrid"><label>Nome da pessoa<input value={name} onChange={(event) => setName(event.target.value)} required/></label><label>Contato<input value={contact} onChange={(event) => setContact(event.target.value)}/></label><label>Valor emprestado<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" required/></label><label>Taxa ao mês (%)<input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" required/></label><label>Data do empréstimo<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required/></label><label>Observação<input value={notes} onChange={(event) => setNotes(event.target.value)}/></label>{message && <div className="error full">{message}</div>}</div><div className="dialogFooter inlineFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button className="primaryButton" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar empréstimo'}</button></div></form></SimpleDialog>
}

function RecurrencesDialog({ close, rules, onChange }: { close: () => void; rules: RecurringRule[]; onChange: (rules: RecurringRule[]) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [nature, setNature] = useState<CategoryNature>('Saída')
  const [day, setDay] = useState('10')
  function submit(event: FormEvent) { event.preventDefault(); const value = parseMoney(amount); if (!name.trim() || value <= 0) return; onChange([...rules, { id: id('rec'), name: name.trim(), amount: value, nature, day: Math.min(31, Math.max(1, Number(day))), active: true }]); setName(''); setAmount('') }
  return <SimpleDialog title="Recorrências" description="Regras de referência salvas neste dispositivo para planejamento." close={close} wide><form onSubmit={submit}><div className="formGrid"><label>Descrição<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Internet" required/></label><label>Valor<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required/></label><label>Natureza<select value={nature} onChange={(event) => setNature(event.target.value as CategoryNature)}><option>Saída</option><option>Entrada</option></select></label><label>Dia do mês<input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} required/></label></div><div className="dialogFooter inlineFooter"><button className="primaryButton">Adicionar recorrência</button></div></form>{rules.length ? <div className="recordGrid dialogRecords">{rules.map((rule) => <article key={rule.id}><span className="recordIcon"><Icon name="calendar"/></span><div><strong>{rule.name}</strong><small>{rule.nature} · todo dia {rule.day}</small></div><b>{money(rule.amount)}</b><button className="tinyButton" onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}>Remover</button></article>)}</div> : <EmptyState icon="calendar" title="Nenhuma recorrência" text="Adicione regras mensais para organizar o planejamento."/>}</SimpleDialog>
}

function UserDialog({ close, session, previewMode }: { close: () => void; session?: Session | null; previewMode: boolean }) {
  return <SimpleDialog title="Usuários" description="Cada sessão enxerga apenas as próprias linhas no Supabase." close={close}><div className="notice blue"><Icon name="settings"/><div><strong>{session?.user.email || 'Modo de visualização'}</strong><p>{previewMode ? 'Nesta visualização os dados ficam apenas neste navegador.' : 'O banco usa políticas RLS vinculadas ao ID do usuário autenticado.'}</p></div></div></SimpleDialog>
}

function SecurityDialog({ close, onExport, onReset, onSignOut, canSignOut }: { close: () => void; onExport: () => void; onReset: () => Promise<void>; onSignOut: () => Promise<void>; canSignOut: boolean }) {
  const [message, setMessage] = useState('')
  async function reset() { try { await onReset(); setMessage('E-mail de recuperação solicitado. Confira sua caixa de entrada.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível solicitar a recuperação.') } }
  return <SimpleDialog title="Segurança e dados" description="Ferramentas de recuperação, exportação e sessão." close={close}><div className="securityActions"><button className="secondaryButton" onClick={onExport}>Exportar meus dados (JSON)</button><button className="secondaryButton" onClick={reset}>Enviar link para redefinir senha</button>{canSignOut && <button className="primaryButton" onClick={onSignOut}>Encerrar sessão</button>}</div>{message && <div className="configMessage dialogMessage">{message}</div>}</SimpleDialog>
}

function NotificationsDialog({ close, transactions }: { close: () => void; transactions: Transaction[] }) {
  const today = todayAsInputDate()
  const next = new Date(`${today}T12:00:00`); next.setDate(next.getDate() + 7)
  const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  const alerts = transactions.filter((item) => item.status === 'planned' && item.settlement_date && item.settlement_date <= nextIso).sort((a, b) => (a.settlement_date || '').localeCompare(b.settlement_date || ''))
  return <SimpleDialog title="Notificações" description="Compromissos vencidos e dos próximos sete dias." close={close}>{alerts.length ? <div className="recordGrid dialogRecords">{alerts.map((item) => <article key={item.id}><span className="recordIcon"><Icon name="bell"/></span><div><strong>{item.description}</strong><small>{statusLabel(item.status, item.settlement_date)} · {formatDate(item.settlement_date)}</small></div><b>{money(item.amount)}</b></article>)}</div> : <EmptyState icon="bell" title="Sem alertas" text="Nenhum compromisso exige atenção nos próximos sete dias."/>}</SimpleDialog>
}

function AppShell({ session, previewMode = false }: { session?: Session | null; previewMode?: boolean }) {
  const initial = (location.hash.replace('#/', '') as PageId) || 'dashboard'
  const previewInitial = useMemo(() => loadPreviewState(), [])
  const [page, setPage] = useState<PageId>(navigation.some((item) => item.id === initial) || initial === 'settings' ? initial : 'dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [entryStatus, setEntryStatus] = useState<DbStatus>('completed')
  const [loanOpen, setLoanOpen] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountPreset, setAccountPreset] = useState('checking')
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [groups, setGroups] = useState<CategoryGroup[]>(previewMode ? previewInitial.groups : [])
  const [accounts, setAccounts] = useState<Account[]>(previewMode ? previewInitial.accounts : [])
  const [transactions, setTransactions] = useState<Transaction[]>(previewMode ? previewInitial.transactions : [])
  const [vehicles, setVehicles] = useState<Vehicle[]>(previewMode ? previewInitial.vehicles : [])
  const [borrowers, setBorrowers] = useState<Borrower[]>(previewMode ? previewInitial.borrowers : [])
  const [loans, setLoans] = useState<Loan[]>(previewMode ? previewInitial.loans : [])
  const [loanEvents, setLoanEvents] = useState<LoanEvent[]>(previewMode ? previewInitial.loanEvents : [])
  const [recurrences, setRecurrences] = useState<RecurringRule[]>(previewInitial.recurrences)
  const [dataLoading, setDataLoading] = useState(Boolean(session && supabase))
  const currentLabel = useMemo(() => [...navigation, { id: 'settings' as PageId, label: 'Configurações' }].find((item) => item.id === page)?.label || 'Visão geral', [page])

  useEffect(() => {
    if (!previewMode) return
    localStorage.setItem('meu-fluxo-preview-v2', JSON.stringify({ groups, accounts, transactions, vehicles, borrowers, loans, loanEvents, recurrences }))
  }, [previewMode, groups, accounts, transactions, vehicles, borrowers, loans, loanEvents, recurrences])

  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false
    async function load() {
      setDataLoading(true)
      const client = supabase!
      let groupResponse = await client.from('category_groups').select('id,name,nature,sort_order').eq('active', true).order('sort_order')
      if (!groupResponse.error && (!groupResponse.data || groupResponse.data.length === 0)) {
        await client.rpc('create_default_financial_categories')
        groupResponse = await client.from('category_groups').select('id,name,nature,sort_order').eq('active', true).order('sort_order')
      }
      const [categoryResponse, accountResponse, transactionResponse, vehicleResponse, borrowerResponse, loanResponse, loanEventResponse] = await Promise.all([
        client.from('categories').select('id,group_id,name').eq('active', true).order('name'),
        client.from('accounts').select('id,name,account_type,initial_balance,active').eq('active', true).order('created_at'),
        client.from('transactions').select('id,account_id,category_id,type,status,description,notes,payment_method,amount,competence_date,settlement_date,installment_group_id,installment_number,installment_total,vehicle_id').order('competence_date', { ascending: false }),
        client.from('vehicles').select('id,name,plate,make,model,model_year,status').eq('status', 'active').order('created_at'),
        client.from('borrowers').select('id,name,document,contact,notes').order('created_at'),
        client.from('loans').select('id,borrower_id,monthly_rate,start_date,status,notes').order('start_date', { ascending: false }),
        client.from('loan_events').select('id,loan_id,event_date,event_type,amount,interest_component,principal_component').order('event_date'),
      ])
      if (cancelled) return
      const categories = categoryResponse.data || []
      setGroups((groupResponse.data || []).map((group) => ({ id: String(group.id), name: String(group.name), nature: group.nature === 'income' ? 'Entrada' : 'Saída', categories: categories.filter((category) => category.group_id === group.id).map((category) => ({ id: String(category.id), name: String(category.name) })) })))
      setAccounts((accountResponse.data || []).map((item) => ({ ...item, initial_balance: Number(item.initial_balance || 0) })) as Account[])
      setTransactions((transactionResponse.data || []).map((item) => ({ ...item, amount: Number(item.amount || 0) })) as Transaction[])
      setVehicles((vehicleResponse.data || []) as Vehicle[])
      setBorrowers((borrowerResponse.data || []) as Borrower[])
      setLoans((loanResponse.data || []).map((item) => ({ ...item, monthly_rate: Number(item.monthly_rate || 0) })) as Loan[])
      setLoanEvents((loanEventResponse.data || []).map((item) => ({ ...item, amount: Number(item.amount || 0), interest_component: Number(item.interest_component || 0), principal_component: Number(item.principal_component || 0) })) as LoanEvent[])
      setDataLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [session?.user.id])

  function navigate(next: PageId) { setPage(next); setMenuOpen(false); location.hash = `/${next}`; window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function openEntry(status: DbStatus = 'completed') { setEntryStatus(status); setEntryOpen(true) }
  async function signOut() { if (session && supabase) await supabase.auth.signOut() }

  async function addGroup(name: string, nature: CategoryNature) {
    if (session && supabase) {
      const { data, error } = await supabase.from('category_groups').insert({ user_id: session.user.id, name, nature: nature === 'Entrada' ? 'income' : 'expense' }).select('id,name,nature').single()
      if (error || !data) throw error || new Error('Não foi possível salvar o grupo.')
      setGroups((current) => [...current, { id: String(data.id), name: String(data.name), nature, categories: [] }])
      return
    }
    if (groups.some((group) => group.name.toLocaleLowerCase() === name.toLocaleLowerCase() && group.nature === nature)) throw new Error('Este grupo já existe.')
    setGroups((current) => [...current, { id: id('grupo'), name, nature, categories: [] }])
  }

  async function addCategory(groupId: string, name: string) {
    const target = groups.find((group) => group.id === groupId)
    if (!target) throw new Error('Grupo não encontrado.')
    if (target.categories.some((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('Esta categoria já existe no grupo.')
    if (session && supabase) {
      const { data, error } = await supabase.from('categories').insert({ user_id: session.user.id, group_id: groupId, name }).select('id,name').single()
      if (error || !data) throw error || new Error('Não foi possível salvar a categoria.')
      setGroups((current) => current.map((group) => group.id === groupId ? { ...group, categories: [...group.categories, { id: String(data.id), name: String(data.name) }] } : group))
      return
    }
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, categories: [...group.categories, { id: id('categoria'), name }] } : group))
  }

  async function saveEntry(payload: EntryPayload) {
    const dbType = typeToDb(payload.type)
    const baseRow = { account_id: payload.accountId || null, category_id: payload.type === 'Transferência' ? null : payload.categoryId || null, type: dbType, status: payload.status, description: payload.description, notes: payload.notes || null, payment_method: payload.type === 'Saída' ? payload.paymentMethod : null, competence_date: payload.competenceDate, vehicle_id: payload.vehicleId || null }
    const isCard = payload.type === 'Saída' && payload.paymentMethod === 'Cartão de crédito'
    const rows: Omit<Transaction, 'id'>[] = []
    if (isCard) {
      const count = Math.max(1, payload.installments)
      const groupId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : id('parcelas')
      const totalCents = Math.round(payload.amount * 100)
      const baseCents = Math.floor(totalCents / count)
      const remainder = totalCents - baseCents * count
      for (let index = 0; index < count; index += 1) {
        rows.push({ ...baseRow, amount: (baseCents + (index === 0 ? remainder : 0)) / 100, settlement_date: addMonthsIso(payload.firstInstallmentDate, index), installment_group_id: groupId, installment_number: index + 1, installment_total: count } as Omit<Transaction, 'id'>)
      }
    } else {
      rows.push({ ...baseRow, amount: payload.amount, settlement_date: payload.settlementDate, installment_group_id: null, installment_number: null, installment_total: null } as Omit<Transaction, 'id'>)
    }
    if (session && supabase) {
      const { data, error } = await supabase.from('transactions').insert(rows.map((row) => ({ ...row, user_id: session.user.id }))).select('id,account_id,category_id,type,status,description,notes,payment_method,amount,competence_date,settlement_date,installment_group_id,installment_number,installment_total,vehicle_id')
      if (error) throw error
      setTransactions((current) => [...((data || []).map((item) => ({ ...item, amount: Number(item.amount || 0) })) as Transaction[]), ...current])
      return
    }
    setTransactions((current) => [...rows.map((row) => ({ ...row, id: id('tx') } as Transaction)), ...current])
  }

  async function saveAccount(name: string, accountType: string, balance: number) {
    if (!name) throw new Error('Informe o nome da conta.')
    if (session && supabase) {
      const { data, error } = await supabase.from('accounts').insert({ user_id: session.user.id, name, account_type: accountType, initial_balance: balance }).select('id,name,account_type,initial_balance,active').single()
      if (error || !data) throw error || new Error('Não foi possível salvar a conta.')
      setAccounts((current) => [...current, { ...data, initial_balance: Number(data.initial_balance || 0) } as Account])
      return
    }
    setAccounts((current) => [...current, { id: id('conta'), name, account_type: accountType, initial_balance: balance, active: true }])
  }

  async function saveVehicle(vehicle: Omit<Vehicle, 'id'>) {
    if (session && supabase) {
      const { data, error } = await supabase.from('vehicles').insert({ ...vehicle, user_id: session.user.id }).select('id,name,plate,make,model,model_year,status').single()
      if (error || !data) throw error || new Error('Não foi possível salvar o veículo.')
      setVehicles((current) => [...current, data as Vehicle])
      return
    }
    setVehicles((current) => [...current, { ...vehicle, id: id('veiculo') }])
  }

  async function saveLoan(data: { name: string; contact: string; amount: number; rate: number; date: string; notes: string }) {
    if (session && supabase) {
      const { data: borrower, error: borrowerError } = await supabase.from('borrowers').insert({ user_id: session.user.id, name: data.name, contact: data.contact || null, notes: data.notes || null }).select('id,name,contact,notes').single()
      if (borrowerError || !borrower) throw borrowerError || new Error('Não foi possível cadastrar a pessoa.')
      const { data: loan, error: loanError } = await supabase.from('loans').insert({ user_id: session.user.id, borrower_id: borrower.id, monthly_rate: data.rate, start_date: data.date, notes: data.notes || null }).select('id,borrower_id,monthly_rate,start_date,status,notes').single()
      if (loanError || !loan) throw loanError || new Error('Não foi possível cadastrar o empréstimo.')
      const { data: event, error: eventError } = await supabase.from('loan_events').insert({ user_id: session.user.id, loan_id: loan.id, event_date: data.date, event_type: 'disbursement', amount: data.amount, principal_component: data.amount }).select('id,loan_id,event_date,event_type,amount,interest_component,principal_component').single()
      if (eventError || !event) throw eventError || new Error('Não foi possível registrar a liberação.')
      setBorrowers((current) => [...current, borrower as Borrower])
      setLoans((current) => [{ ...loan, monthly_rate: Number(loan.monthly_rate || 0) } as Loan, ...current])
      setLoanEvents((current) => [...current, { ...event, amount: Number(event.amount || 0), interest_component: Number(event.interest_component || 0), principal_component: Number(event.principal_component || 0) } as LoanEvent])
      return
    }
    const borrowerId = id('pessoa'), loanId = id('emprestimo')
    setBorrowers((current) => [...current, { id: borrowerId, name: data.name, contact: data.contact, notes: data.notes }])
    setLoans((current) => [{ id: loanId, borrower_id: borrowerId, monthly_rate: data.rate, start_date: data.date, status: 'active', notes: data.notes }, ...current])
    setLoanEvents((current) => [...current, { id: id('evento'), loan_id: loanId, event_date: data.date, event_type: 'disbursement', amount: data.amount, interest_component: 0, principal_component: data.amount }])
  }

  async function resetPassword() {
    if (!session?.user.email || !supabase) throw new Error('A recuperação por e-mail só fica disponível com uma sessão conectada.')
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, { redirectTo: `${location.origin}${location.pathname}` })
    if (error) throw error
  }

  function exportData() {
    const payload = { exportedAt: new Date().toISOString(), accounts, groups, transactions, vehicles, borrowers, loans, loanEvents, recurrences }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `meu-fluxo-backup-${todayAsInputDate()}.json`; anchor.click(); URL.revokeObjectURL(url)
  }

  const pages: Record<PageId, ReactNode> = {
    dashboard: <DashboardPage transactions={transactions} groups={groups} accounts={accounts} openEntry={() => openEntry('completed')} goTransactions={() => navigate('transactions')}/>,
    transactions: <TransactionsPage transactions={transactions} groups={groups} accounts={accounts} openEntry={() => openEntry('completed')}/>,
    payables: <PayablesPage transactions={transactions} groups={groups} accounts={accounts} openPlanned={() => openEntry('planned')}/>,
    loans: <LoansPage loans={loans} borrowers={borrowers} loanEvents={loanEvents} openLoan={() => setLoanOpen(true)}/>,
    vehicles: <VehiclesPage vehicles={vehicles} transactions={transactions} openVehicle={() => setVehicleOpen(true)}/>,
    investments: <InvestmentsPage accounts={accounts} transactions={transactions} openInvestment={() => { setAccountPreset('investment'); setAccountOpen(true) }}/>,
    comparisons: <ComparisonsPage transactions={transactions} groups={groups}/>,
    projections: <ProjectionsPage transactions={transactions} accounts={accounts}/>,
    settings: <SettingsPage groups={groups} onAddGroup={addGroup} onAddCategory={addCategory} openPanel={setSettingsPanel}/>,
  }

  return <div className="appShell"><aside className={menuOpen ? 'open' : ''}><Brand/><span className="navSection">Principal</span><nav>{navigation.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon name={item.id}/>{item.label}</button>)}</nav><span className="navSection">Conta</span><nav><button className={page === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Icon name="settings"/>Configurações</button></nav><div className="profile"><span>HV</span><div><strong>{session?.user.email?.split('@')[0] || 'Henrique'}</strong><small>{previewMode ? 'Modo estrutura' : 'Usuário conectado'}</small></div><button onClick={signOut}>{session ? 'Sair' : ''}</button></div></aside>{menuOpen && <button className="menuOverlay" onClick={() => setMenuOpen(false)}/>}<main className="workspace"><header className="topbar"><button className="mobileMenu" onClick={() => setMenuOpen(true)}><Icon name="menu"/></button><div><small>{pageHelp[page]}</small><h1>{currentLabel}</h1></div><div className="topActions"><button className="iconButton notificationButton" onClick={() => setNotificationsOpen(true)}><Icon name="bell"/>{transactions.some((item) => item.status === 'planned' && item.settlement_date && item.settlement_date <= todayAsInputDate()) && <i/>}</button><button className="primaryButton topNew" onClick={() => openEntry('completed')}><Icon name="plus" size={17}/>Novo lançamento</button></div></header>{previewMode && <div className="previewBanner"><span>Visualização funcional</span><p>Os dados deste modo ficam apenas neste navegador até a conexão com o Supabase.</p></div>}<div className="workspaceContent">{dataLoading ? <div className="card loadingCard">Carregando seus dados...</div> : pages[page]}</div></main>{entryOpen && <EntryDialog close={() => setEntryOpen(false)} groups={groups} accounts={accounts} vehicles={vehicles} initialStatus={entryStatus} onSave={saveEntry}/>} {loanOpen && <LoanDialog close={() => setLoanOpen(false)} onSave={saveLoan}/>} {vehicleOpen && <VehicleDialog close={() => setVehicleOpen(false)} onSave={saveVehicle}/>} {accountOpen && <AccountDialog close={() => setAccountOpen(false)} accounts={accounts} preset={accountPreset} onSave={saveAccount}/>} {settingsPanel === 'accounts' && <AccountDialog close={() => setSettingsPanel(null)} accounts={accounts} onSave={saveAccount}/>} {settingsPanel === 'recurrences' && <RecurrencesDialog close={() => setSettingsPanel(null)} rules={recurrences} onChange={setRecurrences}/>} {settingsPanel === 'users' && <UserDialog close={() => setSettingsPanel(null)} session={session} previewMode={previewMode}/>} {settingsPanel === 'security' && <SecurityDialog close={() => setSettingsPanel(null)} onExport={exportData} onReset={resetPassword} onSignOut={signOut} canSignOut={Boolean(session)}/>} {notificationsOpen && <NotificationsDialog close={() => setNotificationsOpen(false)} transactions={transactions}/>}</div>
}

function SetupNotice({ preview }: { preview: () => void }) {
  return <main className="setupPage"><section className="setupCard"><Brand/><span className="status">Estrutura em validação</span><h1>O painel já pode ser revisado antes da conexão com os dados.</h1><p>Navegue pelas telas, crie lançamentos de teste e valide o uso no computador e no celular. No modo de visualização, os dados ficam apenas neste navegador.</p><div className="setupActions"><button className="primaryButton" onClick={preview}>Visualizar estrutura</button></div><div className="codeList"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div><p className="securityNote">Quando as variáveis forem configuradas, login e dados persistentes entram automaticamente em uso.</p></section></main>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); if (!supabase) return; setLoading(true); setMessage(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (error) setMessage('Não foi possível entrar. Confira o e-mail e a senha.') }
  async function forgot() { if (!supabase) return; if (!email.trim()) { setMessage('Digite seu e-mail antes de solicitar a recuperação.'); return } setLoading(true); const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}${location.pathname}` }); setLoading(false); setMessage(error ? 'Não foi possível enviar o link de recuperação.' : 'Link de recuperação solicitado. Confira seu e-mail.') }
  return <main className="loginPage"><section className="loginIntro"><Brand/><div><span className="eyebrow">Controle financeiro pessoal</span><h1>Suas finanças organizadas em um só lugar.</h1><p>Lançamentos, empréstimos, veículos e investimentos com dados protegidos por usuário.</p></div><small>Os valores de cada perfil permanecem separados.</small></section><section className="loginPanel"><form className="loginCard" onSubmit={submit}><h2>Entrar</h2><p>Acesse o seu painel financeiro.</p><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>{message && <div className={message.includes('solicitado') ? 'configMessage loginMessage' : 'error'}>{message}</div>}<button type="submit" className="primaryButton" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button><button type="button" className="textButton" onClick={forgot} disabled={loading}>Esqueci minha senha</button></form></section></main>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!hasSupabaseConfig && !preview) return <SetupNotice preview={() => setPreview(true)}/>
  if (!hasSupabaseConfig && preview) return <AppShell previewMode/>
  if (loading) return <main className="loading">Carregando...</main>
  return session ? <AppShell session={session}/> : <Login/>
}
