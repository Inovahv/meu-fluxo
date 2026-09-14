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
  [key: string]: unknown
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
}
export function filterCashFlow(rows: CashRow[], options?: CashFlowFilterOptions): CashRow[]
export function buildProjectionSeries(rows: CashRow[], today?: string, openingBalance?: number): Array<{key:string;income:number;expense:number;net:number;balance:number}>
export function summarizeCashFlow(rows: CashRow[]): {income:number;expense:number;net:number}
