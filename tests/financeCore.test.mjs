import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCashFlow, buildProjectionSeries, calculateRealizedBalance } from '../src/financeCore.ts'

const rows = [
  { id:'1', type:'income', status:'completed', amount:1000, competence_date:'2026-08-05', settlement_date:'2026-08-05', category_id:'salary' },
  { id:'2', type:'expense', status:'completed', amount:250, competence_date:'2026-09-10', settlement_date:'2026-09-10', category_id:'food' },
  { id:'3', type:'income', status:'planned', amount:1200, competence_date:'2026-10-05', settlement_date:'2026-10-05', category_id:'salary' },
  { id:'4', type:'expense', status:'planned', amount:100, competence_date:'2026-10-10', settlement_date:'2026-10-10', category_id:'internet' },
  { id:'5', type:'expense', status:'cancelled', amount:999, competence_date:'2026-08-01', settlement_date:'2026-08-01', category_id:'food' },
]

const groupByCategory = { salary:'income-group', food:'personal', internet:'digital' }

test('realized scope includes only completed cash movements up to today', () => {
  const result = filterCashFlow(rows, { scope:'realized', today:'2026-09-14', periodMode:'all', groupByCategory })
  assert.deepEqual(result.map(r => r.id), ['1','2'])
})

test('projected scope includes only planned movements from today forward', () => {
  const result = filterCashFlow(rows, { scope:'projected', today:'2026-09-14', periodMode:'all', groupByCategory })
  assert.deepEqual(result.map(r => r.id), ['3','4'])
})

test('year month custom group and category filters compose', () => {
  const year = filterCashFlow(rows, { scope:'consolidated', today:'2026-09-14', periodMode:'year', year:'2026', groupByCategory })
  assert.equal(year.length, 4)
  const month = filterCashFlow(rows, { scope:'consolidated', today:'2026-09-14', periodMode:'month', month:'2026-10', groupByCategory })
  assert.deepEqual(month.map(r => r.id), ['3','4'])
  const custom = filterCashFlow(rows, { scope:'consolidated', today:'2026-09-14', periodMode:'custom', from:'2026-09-01', to:'2026-09-30', groupByCategory })
  assert.deepEqual(custom.map(r => r.id), ['2'])
  const group = filterCashFlow(rows, { scope:'consolidated', today:'2026-09-14', periodMode:'all', groupId:'digital', groupByCategory })
  assert.deepEqual(group.map(r => r.id), ['4'])
  const category = filterCashFlow(rows, { scope:'consolidated', today:'2026-09-14', periodMode:'all', categoryId:'food', groupByCategory })
  assert.deepEqual(category.map(r => r.id), ['2'])
})

test('projection series accumulates planned future cash by month', () => {
  const series = buildProjectionSeries(rows, '2026-09-14', 0)
  assert.deepEqual(series, [
    { key:'2026-10', income:1200, expense:100, net:1100, balance:1100 },
  ])
})

test('realized balance ignores future, cancelled and transfer movements', () => {
  const balance = calculateRealizedBalance([
    { id:'past-income', type:'income', status:'completed', amount:100, competence_date:'2026-09-01', settlement_date:'2026-09-01', category_id:null },
    { id:'future-income', type:'income', status:'completed', amount:900, competence_date:'2026-10-01', settlement_date:'2026-10-01', category_id:null },
    { id:'cancelled-expense', type:'expense', status:'cancelled', amount:50, competence_date:'2026-09-02', settlement_date:'2026-09-02', category_id:null },
    { id:'transfer', type:'transfer', status:'completed', amount:300, competence_date:'2026-09-03', settlement_date:'2026-09-03', category_id:null },
    { id:'planned-expense', type:'expense', status:'planned', amount:25, competence_date:'2026-10-04', settlement_date:'2026-10-04', category_id:null },
  ], [{ initial_balance: 500 }], '2026-09-15')
  assert.equal(balance, 600)
})

test('period filter uses the selected accounting basis', () => {
  const splitDate = {
    id:'6', type:'expense', status:'completed', amount:500,
    competence_date:'2026-01-20', settlement_date:'2026-02-10', category_id:'food'
  }
  const cash = filterCashFlow([...rows, splitDate], {
    scope:'consolidated', today:'2026-09-14', periodMode:'month', month:'2026-02',
    dateBasis:'cash', groupByCategory
  })
  const competence = filterCashFlow([...rows, splitDate], {
    scope:'consolidated', today:'2026-09-14', periodMode:'month', month:'2026-01',
    dateBasis:'competence', groupByCategory
  })
  assert.ok(cash.some(row => row.id === '6'))
  assert.ok(competence.some(row => row.id === '6'))
})

test('period filter defaults to the cash accounting basis', () => {
  const splitDate = {
    id:'7', type:'expense', status:'completed', amount:500,
    competence_date:'2026-01-20', settlement_date:'2026-02-10', category_id:'food'
  }
  const result = filterCashFlow([...rows, splitDate], {
    scope:'consolidated', today:'2026-09-14', periodMode:'month', month:'2026-02', groupByCategory
  })
  assert.ok(result.some(row => row.id === '7'))
})
