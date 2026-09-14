function cashDate(row) {
  return row.settlement_date || row.competence_date || ''
}

export function filterCashFlow(rows, options = {}) {
  const {
    scope = 'consolidated',
    today = new Date().toISOString().slice(0, 10),
    periodMode = 'all',
    year = '',
    month = '',
    from = '',
    to = '',
    groupId = 'all',
    categoryId = 'all',
    groupByCategory = {},
  } = options

  return rows.filter((row) => {
    if (!row || row.type === 'transfer' || row.status === 'cancelled') return false
    const date = cashDate(row)
    if (!date) return false

    if (scope === 'realized' && !(row.status === 'completed' && date <= today)) return false
    if (scope === 'projected' && !(row.status === 'planned' && date >= today)) return false
    if (scope === 'consolidated' && !['completed', 'planned', 'overdue'].includes(row.status)) return false

    if (periodMode === 'year' && year && !date.startsWith(`${year}-`)) return false
    if (periodMode === 'month' && month && !date.startsWith(month)) return false
    if (periodMode === 'custom') {
      if (from && date < from) return false
      if (to && date > to) return false
    }

    if (groupId && groupId !== 'all' && groupByCategory[row.category_id] !== groupId) return false
    if (categoryId && categoryId !== 'all' && row.category_id !== categoryId) return false
    return true
  })
}

export function buildProjectionSeries(rows, today = new Date().toISOString().slice(0, 10), openingBalance = 0) {
  const future = rows.filter((row) => row && row.status === 'planned' && row.type !== 'transfer' && row.status !== 'cancelled' && cashDate(row) >= today)
  const grouped = new Map()

  for (const row of future) {
    const key = cashDate(row).slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, { key, income: 0, expense: 0 })
    const bucket = grouped.get(key)
    if (row.type === 'income') bucket.income += Number(row.amount || 0)
    if (row.type === 'expense') bucket.expense += Number(row.amount || 0)
  }

  let balance = Number(openingBalance || 0)
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key)).map((item) => {
    const net = item.income - item.expense
    balance += net
    return { ...item, net, balance }
  })
}

export function summarizeCashFlow(rows) {
  const income = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const expense = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return { income, expense, net: income - expense }
}
