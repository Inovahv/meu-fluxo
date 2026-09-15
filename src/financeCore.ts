import { analysisDate, type AnalysisBasis } from './managerialCore.ts'

export type CashFlowScope = 'realized' | 'projected' | 'consolidated'
export type PeriodMode = 'all' | 'year' | 'month' | 'custom'
export type CashRow = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  status: 'planned' | 'completed' | 'overdue' | 'cancelled'
  amount: number
  competence_date: string
  settlement_date: string | null
  category_id: string | null
}
export type CashFlowFilterOptions = {
  scope?: CashFlowScope
  today?: string
  periodMode?: PeriodMode
  year?: string
  month?: string
  from?: string
  to?: string
  groupId?: string
  categoryId?: string
  groupByCategory?: Record<string,string>
  dateBasis?: AnalysisBasis
}

function cashDate(row: CashRow) { return row.settlement_date || row.competence_date || '' }

export function filterCashFlow<T extends CashRow>(rows: T[], options: CashFlowFilterOptions = {}): T[] {
  const { scope='consolidated', today=new Date().toISOString().slice(0,10), periodMode='all', year='', month='', from='', to='', groupId='all', categoryId='all', groupByCategory={}, dateBasis='cash' } = options
  return rows.filter((row) => {
    if (!row || row.type === 'transfer' || row.status === 'cancelled') return false
    const date = analysisDate(row, dateBasis)
    if (!date) return false
    if (scope === 'realized' && !(row.status === 'completed' && date <= today)) return false
    if (scope === 'projected' && !(row.status === 'planned' && date >= today)) return false
    if (scope === 'consolidated' && !['completed','planned','overdue'].includes(row.status)) return false
    if (periodMode === 'year' && year && !date.startsWith(`${year}-`)) return false
    if (periodMode === 'month' && month && !date.startsWith(month)) return false
    if (periodMode === 'custom') { if (from && date < from) return false; if (to && date > to) return false }
    if (groupId && groupId !== 'all' && groupByCategory[row.category_id || ''] !== groupId) return false
    if (categoryId && categoryId !== 'all' && row.category_id !== categoryId) return false
    return true
  })
}

export function buildProjectionSeries(rows: CashRow[], referenceDate = new Date().toISOString().slice(0,10), openingBalance = 0) {
  const future = filterCashFlow(rows, { scope: 'projected', today: referenceDate, dateBasis: 'cash' })
  const grouped = new Map<string,{key:string;income:number;expense:number}>()
  for (const row of future) {
    const key = cashDate(row).slice(0,7)
    if (!grouped.has(key)) grouped.set(key,{key,income:0,expense:0})
    const bucket = grouped.get(key)!
    if (row.type === 'income') bucket.income += Number(row.amount || 0)
    if (row.type === 'expense') bucket.expense += Number(row.amount || 0)
  }
  let balance = Number(openingBalance || 0)
  return [...grouped.values()].sort((a,b)=>a.key.localeCompare(b.key)).map((item)=>{const net=item.income-item.expense;balance+=net;return{...item,net,balance}})
}

export function summarizeCashFlow(rows: CashRow[]) {
  const income = rows.filter((row)=>row.type==='income').reduce((sum,row)=>sum+Number(row.amount||0),0)
  const expense = rows.filter((row)=>row.type==='expense').reduce((sum,row)=>sum+Number(row.amount||0),0)
  return { income, expense, net: income-expense }
}

export function calculateRealizedBalance(
  rows: CashRow[],
  accounts: Array<{ initial_balance: number }>,
  referenceDate: string,
) {
  const openingBalance = accounts.reduce((sum, account) => sum + Number(account.initial_balance || 0), 0)
  return openingBalance + summarizeCashFlow(
    filterCashFlow(rows, { scope: 'realized', today: referenceDate, dateBasis: 'cash' }),
  ).net
}
