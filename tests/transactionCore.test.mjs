import test from 'node:test'
import assert from 'node:assert/strict'
import { addMonthsClamped, buildInstallmentSchedule, buildTransactionFinancialRows, createUuidV4 } from '../src/transactionCore.ts'

test('installments keep purchase competence and spread only settlement dates', () => {
  assert.deepEqual(buildInstallmentSchedule({
    amount: 500, count: 5, competenceDate: '2026-01-20', firstSettlementDate: '2026-02-10'
  }), [
    { amount: 100, competenceDate: '2026-01-20', settlementDate: '2026-02-10', installmentNumber: 1, installmentTotal: 5 },
    { amount: 100, competenceDate: '2026-01-20', settlementDate: '2026-03-10', installmentNumber: 2, installmentTotal: 5 },
    { amount: 100, competenceDate: '2026-01-20', settlementDate: '2026-04-10', installmentNumber: 3, installmentTotal: 5 },
    { amount: 100, competenceDate: '2026-01-20', settlementDate: '2026-05-10', installmentNumber: 4, installmentTotal: 5 },
    { amount: 100, competenceDate: '2026-01-20', settlementDate: '2026-06-10', installmentNumber: 5, installmentTotal: 5 },
  ])
})

test('rounding remainder is assigned to the first installment', () => {
  const rows = buildInstallmentSchedule({
    amount: 100.01, count: 3, competenceDate: '2026-01-31', firstSettlementDate: '2026-01-31'
  })
  assert.deepEqual(rows.map((row) => row.amount), [33.35, 33.33, 33.33])
  assert.deepEqual(rows.map((row) => row.settlementDate), ['2026-01-31', '2026-02-28', '2026-03-31'])
})

test('rejects installment counts outside the supported range', () => {
  const input = { amount: 100, competenceDate: '2026-01-20', firstSettlementDate: '2026-02-10' }
  assert.throws(() => buildInstallmentSchedule({ ...input, count: 0 }), RangeError)
  assert.throws(() => buildInstallmentSchedule({ ...input, count: 121 }), RangeError)
  assert.throws(() => buildInstallmentSchedule({ ...input, count: 1.5 }), RangeError)
})

test('accepts exact cent amounts and rejects fractions of a cent', () => {
  const input = { count: 1, competenceDate: '2026-01-20', firstSettlementDate: '2026-02-10' }
  assert.deepEqual(buildInstallmentSchedule({ ...input, amount: 0.1 }).map((row) => row.amount), [0.1])
  assert.deepEqual(buildInstallmentSchedule({ ...input, amount: 10.08 }).map((row) => row.amount), [10.08])
  assert.throws(() => buildInstallmentSchedule({ ...input, amount: 10.075 }), /duas casas decimais/)
})

test('rejects invalid amounts and accepts installment count boundaries', () => {
  const input = { competenceDate: '2026-01-20', firstSettlementDate: '2026-02-10' }
  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => buildInstallmentSchedule({ ...input, amount, count: 1 }), RangeError)
  }
  assert.equal(buildInstallmentSchedule({ ...input, amount: 120, count: 1 }).length, 1)
  assert.equal(buildInstallmentSchedule({ ...input, amount: 120, count: 120 }).length, 120)
})

test('clamps preferred month days and restores them after short months', () => {
  assert.equal(addMonthsClamped('2026-01-29', 1), '2026-02-28')
  assert.equal(addMonthsClamped('2026-01-30', 1), '2026-02-28')
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonthsClamped('2024-01-31', 1), '2024-02-29')
  assert.equal(addMonthsClamped('2026-01-31', 2), '2026-03-31')
})

test('financial rows link a vehicle only to expenses and preserve manual sources', () => {
  const base = {
    amount: 50, competenceDate: '2026-01-20', settlementDate: '2026-02-10',
    categoryId: 'category-1', status: 'completed', source: 'legacy_import'
  }
  assert.deepEqual(buildTransactionFinancialRows({ ...base, type: 'expense', vehicleId: 'vehicle-1' }), [{
    amount: 50, competence_date: '2026-01-20', settlement_date: '2026-02-10',
    category_id: 'category-1', vehicle_id: 'vehicle-1', status: 'completed', source: 'legacy_import'
  }])
  assert.equal(buildTransactionFinancialRows({ ...base, type: 'expense', vehicleId: '' })[0].vehicle_id, null)
  assert.equal(buildTransactionFinancialRows({ ...base, type: 'income', vehicleId: 'vehicle-1' })[0].vehicle_id, null)
  assert.equal(buildTransactionFinancialRows({ ...base, type: 'expense', vehicleId: '', source: null })[0].source, 'manual')
})

test('installment financial rows preserve transaction fields and series invariants', () => {
  const rows = buildTransactionFinancialRows({
    type: 'expense', amount: 100.01, competenceDate: '2026-01-20', settlementDate: '2026-01-31',
    categoryId: 'category-1', vehicleId: 'vehicle-1', status: 'completed', source: 'manual'
  }, { count: 3, firstSettlementDate: '2026-01-31', installmentGroupId: '11111111-1111-4111-8111-111111111111' })

  assert.deepEqual(rows, [
    { amount: 33.35, competence_date: '2026-01-20', settlement_date: '2026-01-31', category_id: 'category-1', vehicle_id: 'vehicle-1', status: 'completed', source: 'installment', installment_group_id: '11111111-1111-4111-8111-111111111111', installment_number: 1, installment_total: 3 },
    { amount: 33.33, competence_date: '2026-01-20', settlement_date: '2026-02-28', category_id: 'category-1', vehicle_id: 'vehicle-1', status: 'planned', source: 'installment', installment_group_id: '11111111-1111-4111-8111-111111111111', installment_number: 2, installment_total: 3 },
    { amount: 33.33, competence_date: '2026-01-20', settlement_date: '2026-03-31', category_id: 'category-1', vehicle_id: 'vehicle-1', status: 'planned', source: 'installment', installment_group_id: '11111111-1111-4111-8111-111111111111', installment_number: 3, installment_total: 3 },
  ])
})

test('rejects inconsistent installment payloads received from JavaScript', () => {
  const input = {
    amount: 50, competenceDate: '2026-01-20', settlementDate: '2026-02-10',
    categoryId: 'category-1', vehicleId: 'vehicle-1', status: 'completed', source: 'manual'
  }
  const validOptions = { count: 2, firstSettlementDate: '2026-02-10', installmentGroupId: '11111111-1111-4111-8111-111111111111' }
  assert.throws(() => buildTransactionFinancialRows({ ...input, type: 'income' }, validOptions), /Saídas/)
  assert.throws(() => buildTransactionFinancialRows({ ...input, type: 'expense', status: 'archived' }, validOptions), /Situação/)
  assert.throws(() => buildTransactionFinancialRows({ ...input, type: 'expense' }, { ...validOptions, installmentGroupId: '' }), /UUID/)
  assert.throws(() => buildTransactionFinancialRows({ ...input, type: 'expense' }, { ...validOptions, installmentGroupId: 'not-a-uuid' }), /UUID/)
})

test('enforces the numeric(14,2) transaction amount limit', () => {
  const input = { count: 1, competenceDate: '2026-01-20', firstSettlementDate: '2026-02-10' }
  assert.equal(buildInstallmentSchedule({ ...input, amount: 999999999999.99 })[0].amount, 999999999999.99)
  assert.throws(() => buildInstallmentSchedule({ ...input, amount: 1000000000000 }), /limite máximo/)
})

test('creates a valid UUID v4 from deterministic fallback bytes', () => {
  assert.equal(createUuidV4(new Uint8Array(16)), '00000000-0000-4000-8000-000000000000')
})
