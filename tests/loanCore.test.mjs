import test from 'node:test'
import assert from 'node:assert/strict'
import { computeLoanLedger } from '../src/loanCore.ts'

const loan = { id:'loan-1', monthly_rate:0.01, start_date:'2026-01-01' }

test('accrues interest by elapsed days and applies payment to interest first', () => {
  const events = [
    { loan_id:'loan-1', event_date:'2026-01-01', event_type:'disbursement', amount:1000 },
    { loan_id:'loan-1', event_date:'2026-01-31', event_type:'payment', amount:110 },
  ]
  const ledger = computeLoanLedger(loan, events, '2026-03-02')
  assert.equal(Math.round(ledger.lent * 100) / 100, 1000)
  assert.equal(Math.round(ledger.paid * 100) / 100, 110)
  assert.equal(Math.round(ledger.interestPaid * 100) / 100, 10)
  assert.equal(Math.round(ledger.principal * 100) / 100, 900)
  assert.equal(Math.round(ledger.interest * 100) / 100, 9)
  assert.equal(Math.round(ledger.total * 100) / 100, 909)
})

test('multiple disbursements follow the real event chronology', () => {
  const events = [
    { loan_id:'loan-1', event_date:'2026-01-01', event_type:'disbursement', amount:1000 },
    { loan_id:'loan-1', event_date:'2026-01-16', event_type:'disbursement', amount:500 },
  ]
  const ledger = computeLoanLedger(loan, events, '2026-01-31')
  assert.equal(ledger.lent, 1500)
  assert.ok(ledger.interest > 10)
  assert.ok(ledger.total > 1510)
})
