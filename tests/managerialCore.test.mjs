import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analysisDate, buildMonthlySeries, calculateDelta, buildExecutiveAlerts,
  buildVehicleSummaries, buildInvestmentSummary, buildAnalysisYears, selectedMonthContext
} from '../src/managerialCore.ts'

const movements = [
  { id:'a', type:'income', status:'completed', amount:1000, competence_date:'2026-01-05', settlement_date:'2026-01-05' },
  { id:'b', type:'expense', status:'completed', amount:300, competence_date:'2026-01-10', settlement_date:'2026-02-10' },
  { id:'c', type:'expense', status:'completed', amount:500, competence_date:'2026-03-10', settlement_date:'2026-03-10' },
  { id:'d', type:'expense', status:'cancelled', amount:999, competence_date:'2026-02-01', settlement_date:'2026-02-01' },
]

test('analysisDate chooses settlement for cash and purchase date for competence', () => {
  assert.equal(analysisDate(movements[1], 'cash'), '2026-02-10')
  assert.equal(analysisDate(movements[1], 'competence'), '2026-01-10')
})

test('monthly series fills empty months and carries balance', () => {
  assert.deepEqual(buildMonthlySeries(movements, {
    basis:'cash', openingBalance:100, fromMonth:'2026-01', toMonth:'2026-03'
  }), [
    { key:'2026-01', income:1000, expense:0, net:1000, balance:1100 },
    { key:'2026-02', income:0, expense:300, net:-300, balance:800 },
    { key:'2026-03', income:0, expense:500, net:-500, balance:300 },
  ])
})

test('delta is null when the comparison base is zero', () => {
  assert.deepEqual(calculateDelta(120, 0), { amount:120, percent:null })
  assert.deepEqual(calculateDelta(120, 100), { amount:20, percent:20 })
})

test('alerts explain a negative result and expense increase', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:1000, expense:500, net:500, balance:500 },
    { key:'2026-02', income:800, expense:600, net:200, balance:700 },
    { key:'2026-03', income:500, expense:750, net:-250, balance:450 },
  ])
  assert.equal(alerts[0].tone, 'critical')
  assert.match(alerts[0].message, /R\$\s*250,00/)
  assert.ok(alerts.some(alert => alert.tone === 'warning' && alert.message.includes('25,0%')))
})

test('alerts ignore an expense increase below the 15 percent warning threshold', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:2000, expense:1000, net:1000, balance:1000 },
    { key:'2026-02', income:2000, expense:1149, net:851, balance:1851 },
  ])
  assert.equal(alerts.some(alert => alert.tone === 'warning'), false)
})

test('alerts warn when expenses increase by exactly 15 percent', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:2000, expense:1000, net:1000, balance:1000 },
    { key:'2026-02', income:2000, expense:1150, net:850, balance:1850 },
  ])
  assert.ok(alerts.some(alert => alert.tone === 'warning' && alert.message.includes('15,0%')))
})

test('alerts celebrate an expense reduction of exactly 10 percent', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:2000, expense:1000, net:1000, balance:1000 },
    { key:'2026-02', income:2000, expense:900, net:1100, balance:2100 },
  ])
  assert.ok(alerts.some(alert => alert.tone === 'positive' && alert.message.includes('10,0%')))
})

test('alerts report an informational comparison when the expense base is zero', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:1000, expense:0, net:1000, balance:1000 },
    { key:'2026-02', income:1000, expense:100, net:900, balance:1900 },
  ])
  assert.ok(alerts.some(alert => alert.tone === 'info'))
  assert.equal(alerts.some(alert => alert.tone === 'warning'), false)
})

test('alerts report an informational state for an empty series', () => {
  const alerts = buildExecutiveAlerts([])
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].tone, 'info')
})

test('alerts report an informational state for a single comparable month', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:500, expense:100, net:400, balance:400 },
  ])
  assert.ok(alerts.some(alert => alert.tone === 'info'))
  assert.equal(alerts.some(alert => alert.tone === 'positive'), false)
})

test('alerts explain a zero-movement final month', () => {
  const alerts = buildExecutiveAlerts([
    { key:'2026-01', income:500, expense:100, net:400, balance:400 },
    { key:'2026-02', income:0, expense:0, net:0, balance:400 },
  ])
  assert.ok(alerts.some(alert => alert.tone === 'info'))
})

test('monthly series and delta amounts normalize decimal currency values', () => {
  const series = buildMonthlySeries([
    { type:'income', status:'completed', amount:0.10, competence_date:'2026-01-01', settlement_date:'2026-01-01' },
    { type:'income', status:'completed', amount:0.20, competence_date:'2026-01-02', settlement_date:'2026-01-02' },
  ], { basis:'cash' })
  assert.deepEqual(series, [
    { key:'2026-01', income:0.30, expense:0, net:0.30, balance:0.30 },
  ])
  assert.equal(calculateDelta(0.30, 0.10).amount, 0.20)
})

test('cash analysis falls back to competence date without settlement', () => {
  assert.equal(analysisDate({
    type:'expense', status:'completed', amount:10, competence_date:'2026-04-15', settlement_date:null
  }, 'cash'), '2026-04-15')
})

test('monthly series uses competence dates when selected', () => {
  assert.deepEqual(buildMonthlySeries([
    { type:'expense', status:'completed', amount:80, competence_date:'2026-04-10', settlement_date:'2026-05-10' },
  ], { basis:'competence' }), [
    { key:'2026-04', income:0, expense:80, net:-80, balance:-80 },
  ])
})

test('monthly series excludes transfers and adjustments', () => {
  assert.deepEqual(buildMonthlySeries([
    { type:'transfer', status:'completed', amount:100, competence_date:'2026-04-01', settlement_date:'2026-04-01' },
    { type:'adjustment', status:'completed', amount:50, competence_date:'2026-04-02', settlement_date:'2026-04-02' },
    { type:'expense', status:'completed', amount:20, competence_date:'2026-04-03', settlement_date:'2026-04-03' },
  ], { basis:'cash' }), [
    { key:'2026-04', income:0, expense:20, net:-20, balance:-20 },
  ])
})

test('monthly series continues through a year boundary', () => {
  assert.deepEqual(buildMonthlySeries([
    { type:'income', status:'completed', amount:100, competence_date:'2026-12-20', settlement_date:'2026-12-20' },
    { type:'expense', status:'completed', amount:40, competence_date:'2027-01-05', settlement_date:'2027-01-05' },
  ], { basis:'cash', fromMonth:'2026-12', toMonth:'2027-01' }), [
    { key:'2026-12', income:100, expense:0, net:100, balance:100 },
    { key:'2027-01', income:0, expense:40, net:-40, balance:60 },
  ])
})

test('monthly series fills an explicitly bounded empty interval', () => {
  assert.deepEqual(buildMonthlySeries([], {
    basis:'cash', openingBalance:50, fromMonth:'2026-12', toMonth:'2027-01'
  }), [
    { key:'2026-12', income:0, expense:0, net:0, balance:50 },
    { key:'2027-01', income:0, expense:0, net:0, balance:50 },
  ])
})

test('vehicle annual summary keeps real month and divides annual average by twelve', () => {
  const vehicles = [{ id:'car-1', name:'Carro' }]
  const rows = [
    { type:'expense', status:'completed', amount:1200, competence_date:'2026-01-10', settlement_date:'2026-01-10', vehicle_id:'car-1' },
    { type:'expense', status:'completed', amount:300, competence_date:'2026-03-10', settlement_date:'2026-03-10', vehicle_id:'car-1' },
  ]
  const [summary] = buildVehicleSummaries(vehicles, rows, '2026', 'cash')
  assert.equal(summary.total, 1500)
  assert.equal(summary.monthlyAverage, 125)
  assert.equal(summary.peakMonth, '2026-01')
  assert.equal(summary.months[0].expense, 1200)
  assert.equal(summary.months[1].expense, 0)
})

test('investment summary uses only completed movements from investment accounts', () => {
  const accounts = [
    { id:'inv', name:'Cofrinho', account_type:'investment', initial_balance:1000 },
    { id:'bank', name:'Corrente', account_type:'checking', initial_balance:500 },
  ]
  const rows = [
    { type:'income', status:'completed', amount:100, competence_date:'2026-01-01', settlement_date:'2026-01-01', account_id:'inv' },
    { type:'expense', status:'completed', amount:20, competence_date:'2026-01-02', settlement_date:'2026-01-02', account_id:'inv' },
    { type:'income', status:'planned', amount:999, competence_date:'2026-02-01', settlement_date:'2026-02-01', account_id:'inv' },
    { type:'income', status:'completed', amount:500, competence_date:'2026-01-01', settlement_date:'2026-01-01', account_id:'bank' },
  ]
  const summary = buildInvestmentSummary(accounts, rows, 'cash')
  assert.equal(summary.initialBalance, 1000)
  assert.equal(summary.income, 100)
  assert.equal(summary.expense, 20)
  assert.equal(summary.balance, 1080)
  assert.equal(summary.accounts.length, 1)
})

test('analysis years keep competence and cash years after a regime switch', () => {
  const years = buildAnalysisYears([
    { type:'expense', status:'completed', amount:100, competence_date:'2024-12-30', settlement_date:'2025-01-02' },
    { type:'income', status:'completed', amount:50, competence_date:'', settlement_date:null },
    { type:'income', status:'completed', amount:50, competence_date:'2025-03-01', settlement_date:'2025-03-01' },
  ], '2026')
  assert.deepEqual(years, ['2026', '2025', '2024'])
})

test('selected month context returns the selected month and its immediate predecessor', () => {
  const series = buildMonthlySeries(movements, {
    basis:'cash', fromMonth:'2026-01', toMonth:'2026-03'
  })
  const context = selectedMonthContext(series, '2026-03')
  assert.equal(context.current?.key, '2026-03')
  assert.equal(context.previous?.key, '2026-02')
  assert.equal(selectedMonthContext(series, 'missing').current?.key, '2026-03')
  assert.equal(selectedMonthContext(series).current?.key, '2026-03')
  assert.equal(selectedMonthContext(series, '2026-02').previous?.key, '2026-01')
  assert.equal(selectedMonthContext(series, '2026-01').previous, null)
  assert.deepEqual(selectedMonthContext([]), { current:null, previous:null })
})
