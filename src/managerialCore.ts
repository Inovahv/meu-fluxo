export type AnalysisBasis = 'cash' | 'competence'

export type ManagerialRow = {
  id?: string
  type: string
  status: string
  amount: number
  competence_date: string
  settlement_date?: string | null
  account_id?: string | null
  category_id?: string | null
  vehicle_id?: string | null
}

export type MonthlyPoint = {
  key: string
  income: number
  expense: number
  net: number
  balance: number
}

export type VehicleLike = {
  id: string
  name: string
}

export type AccountLike = {
  id: string
  name: string
  account_type: string
  initial_balance: number
}

export type ExecutiveAlert = {
  tone: 'critical' | 'warning' | 'positive' | 'info'
  title: string
  message: string
}

export function analysisDate(row: ManagerialRow, basis: AnalysisBasis): string {
  return basis === 'competence'
    ? row.competence_date
    : row.settlement_date || row.competence_date
}

export function buildAnalysisYears(rows: ManagerialRow[], currentYear: string): string[] {
  const years = new Set<string>()
  if (/^\d{4}$/.test(currentYear)) years.add(currentYear)

  for (const row of rows) {
    for (const date of [row.competence_date, row.settlement_date]) {
      const year = date?.slice(0, 4) || ''
      if (/^\d{4}$/.test(year)) years.add(year)
    }
  }

  return [...years].sort((a, b) => b.localeCompare(a))
}

function monthAfter(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`
}

function toCents(value: number): number {
  return Math.round((Number(value) || 0) * 100)
}

function fromCents(value: number): number {
  return value / 100
}

export function buildMonthlySeries(
  rows: ManagerialRow[],
  options: { basis: AnalysisBasis; openingBalance?: number; fromMonth?: string; toMonth?: string }
): MonthlyPoint[] {
  const grouped = new Map<string, { income: number; expense: number }>()

  for (const row of rows) {
    if (row.status === 'cancelled' || row.type === 'transfer' || row.type === 'adjustment') continue
    const key = analysisDate(row, options.basis).slice(0, 7)
    if (!key) continue
    const point = grouped.get(key) || { income: 0, expense: 0 }
    if (row.type === 'income') point.income += toCents(row.amount)
    if (row.type === 'expense') point.expense += toCents(row.amount)
    grouped.set(key, point)
  }

  const keys = [...grouped.keys()].sort((a, b) => a.localeCompare(b))
  const fromMonth = options.fromMonth || keys[0]
  const toMonth = options.toMonth || keys.at(-1)
  if (!fromMonth || !toMonth || fromMonth > toMonth) return []

  const series: MonthlyPoint[] = []
  let balance = toCents(options.openingBalance || 0)
  for (let key = fromMonth; key <= toMonth; key = monthAfter(key)) {
    const { income, expense } = grouped.get(key) || { income: 0, expense: 0 }
    const net = income - expense
    balance += net
    series.push({
      key,
      income: fromCents(income),
      expense: fromCents(expense),
      net: fromCents(net),
      balance: fromCents(balance),
    })
  }
  return series
}

export function selectedMonthContext(
  series: MonthlyPoint[], selectedKey?: string
): { current: MonthlyPoint | null; previous: MonthlyPoint | null } {
  const selectedIndex = series.findIndex((point) => point.key === selectedKey)
  const index = selectedIndex < 0 ? series.length - 1 : selectedIndex
  return { current: series[index] || null, previous: series[index - 1] || null }
}

export function buildVehicleSummaries(
  vehicles: VehicleLike[],
  rows: ManagerialRow[],
  year: string,
  basis: AnalysisBasis
): Array<{
  id: string
  name: string
  total: number
  monthlyAverage: number
  peakMonth: string | null
  peakAmount: number
  months: Array<{ key: string; expense: number }>
}> {
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)

  return vehicles.map((vehicle) => {
    const expenses = new Map(months.map((key) => [key, 0]))
    for (const row of rows) {
      const key = analysisDate(row, basis).slice(0, 7)
      if (row.vehicle_id !== vehicle.id || row.type !== 'expense' || row.status !== 'completed' || !key.startsWith(`${year}-`)) continue
      expenses.set(key, (expenses.get(key) || 0) + toCents(row.amount))
    }

    const values = months.map((key) => ({ key, expense: expenses.get(key) || 0 }))
    const total = values.reduce((sum, month) => sum + month.expense, 0)
    const peak = values.reduce<{ key: string; expense: number } | null>((current, month) => !current || month.expense > current.expense ? month : current, null)
    return {
      id: vehicle.id,
      name: vehicle.name,
      total: fromCents(total),
      monthlyAverage: fromCents(Math.round(total / 12)),
      peakMonth: peak?.expense ? peak.key : null,
      peakAmount: fromCents(peak?.expense || 0),
      months: values.map((month) => ({ key: month.key, expense: fromCents(month.expense) })),
    }
  })
}

export function buildInvestmentSummary(
  accounts: AccountLike[],
  rows: ManagerialRow[],
  basis: AnalysisBasis
): {
  initialBalance: number
  income: number
  expense: number
  balance: number
  accounts: Array<{ id: string; name: string; initialBalance: number; income: number; expense: number; balance: number }>
  months: MonthlyPoint[]
} {
  const investmentAccounts = accounts.filter((account) => account.account_type === 'investment')
  const ids = new Set(investmentAccounts.map((account) => account.id))
  const movements = rows.filter((row) => ids.has(row.account_id || '') && row.status === 'completed' && (row.type === 'income' || row.type === 'expense'))
  const totals = new Map(investmentAccounts.map((account) => [account.id, { income: 0, expense: 0 }]))

  for (const row of movements) {
    const total = totals.get(row.account_id || '')
    if (!total) continue
    if (row.type === 'income') total.income += toCents(row.amount)
    if (row.type === 'expense') total.expense += toCents(row.amount)
  }

  const accountSummaries = investmentAccounts.map((account) => {
    const total = totals.get(account.id) || { income: 0, expense: 0 }
    const initialBalance = toCents(account.initial_balance)
    return {
      id: account.id,
      name: account.name,
      initialBalance: fromCents(initialBalance),
      income: fromCents(total.income),
      expense: fromCents(total.expense),
      balance: fromCents(initialBalance + total.income - total.expense),
    }
  })
  const initialBalance = accountSummaries.reduce((sum, account) => sum + toCents(account.initialBalance), 0)
  const income = accountSummaries.reduce((sum, account) => sum + toCents(account.income), 0)
  const expense = accountSummaries.reduce((sum, account) => sum + toCents(account.expense), 0)

  return {
    initialBalance: fromCents(initialBalance),
    income: fromCents(income),
    expense: fromCents(expense),
    balance: fromCents(initialBalance + income - expense),
    accounts: accountSummaries,
    months: buildMonthlySeries(movements, { basis, openingBalance: fromCents(initialBalance) }),
  }
}

export function calculateDelta(current: number, previous: number): { amount: number; percent: number | null } {
  const amount = fromCents(toCents(current) - toCents(previous))
  return { amount, percent: previous === 0 ? null : (amount / Math.abs(previous)) * 100 }
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function buildExecutiveAlerts(series: MonthlyPoint[]): ExecutiveAlert[] {
  const current = series.at(-1)
  const previous = series.at(-2)
  if (!current) {
    return [{
      tone: 'info',
      title: 'Sem movimentos',
      message: 'Não há movimentos no período analisado.',
    }]
  }

  const alerts: ExecutiveAlert[] = []
  if (current.net < 0) {
    alerts.push({
      tone: 'critical',
      title: 'Resultado negativo',
      message: `O resultado de ${current.key} foi negativo em ${brl.format(Math.abs(current.net))}.`,
    })
  }
  if (current.income === 0 && current.expense === 0) {
    alerts.push({
      tone: 'info',
      title: 'Sem movimentos',
      message: `Não há movimentos em ${current.key}.`,
    })
  }

  if (!previous || previous.expense === 0) {
    alerts.push({
      tone: 'info',
      title: 'Comparação indisponível',
      message: 'Não há base comparável para as despesas.',
    })
    return alerts
  }

  const { percent } = calculateDelta(current.expense, previous.expense)
  const variation = `${Math.abs(percent!).toFixed(1).replace('.', ',')}%`
  if (percent! >= 15) {
    alerts.push({
      tone: 'warning',
      title: 'Despesas em alta',
      message: `As despesas cresceram ${variation} em relação a ${previous.key}.`,
    })
  }
  if (percent! <= -10) {
    alerts.push({
      tone: 'positive',
      title: 'Despesas em queda',
      message: `As despesas caíram ${variation} em relação a ${previous.key}.`,
    })
  }
  return alerts
}
