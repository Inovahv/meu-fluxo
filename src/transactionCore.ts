export type InstallmentScheduleInput = {
  amount: number
  count: number
  competenceDate: string
  firstSettlementDate: string
}

export type InstallmentScheduleRow = {
  amount: number
  competenceDate: string
  settlementDate: string
  installmentNumber: number
  installmentTotal: number
}

export type TransactionStatus = 'planned' | 'completed' | 'overdue' | 'cancelled'

type TransactionFinancialBaseInput = {
  amount: number
  competenceDate: string
  settlementDate: string
  categoryId: string | null
  status: TransactionStatus
  source?: string | null
}

export type ExpenseTransactionFinancialInput = TransactionFinancialBaseInput & {
  type: 'expense'
  vehicleId: string
}

export type IncomeTransactionFinancialInput = TransactionFinancialBaseInput & {
  type: 'income'
  vehicleId?: never
}

export type TransactionFinancialInput = ExpenseTransactionFinancialInput | IncomeTransactionFinancialInput

type TransactionFinancialBaseRow = {
  amount: number
  competence_date: string
  settlement_date: string
  category_id: string | null
  vehicle_id: string | null
  status: TransactionStatus
  source: string
}

export type SimpleTransactionFinancialRow = TransactionFinancialBaseRow & {
  installment_group_id?: never
  installment_number?: never
  installment_total?: never
}

export type InstallmentTransactionFinancialRow = TransactionFinancialBaseRow & {
  installment_group_id: string
  installment_number: number
  installment_total: number
}

export type TransactionFinancialRow = SimpleTransactionFinancialRow | InstallmentTransactionFinancialRow

export type InstallmentTransactionOptions = {
  count: number
  firstSettlementDate: string
  installmentGroupId: string
}

const MAX_TRANSACTION_CENTS = 99_999_999_999_999
const VALID_TRANSACTION_STATUSES = new Set<TransactionStatus>(['planned', 'completed', 'overdue', 'cancelled'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function amountToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError('O valor deve ser maior que zero.')
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount))
  if (!match) throw new RangeError('O valor deve ter no máximo duas casas decimais.')

  const [, integerPart, fractionalPart = ''] = match
  const cents = Number(integerPart) * 100 + Number(fractionalPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents < 1) {
    throw new RangeError('O valor deve ser maior que zero.')
  }
  if (cents > MAX_TRANSACTION_CENTS) {
    throw new RangeError('O valor excede o limite máximo permitido.')
  }

  return cents
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError('Data inválida.')

  const [, year, month, day] = match.map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  if (month < 1 || month > 12 || day < 1 || day > lastDay) throw new RangeError('Data inválida.')

  return { year, month, day }
}

export function addMonthsClamped(value: string, offset: number): string {
  if (!Number.isInteger(offset)) throw new RangeError('Deslocamento mensal inválido.')

  const { year, month, day } = parseDate(value)
  const base = new Date(year, month - 1 + offset, 1)
  const targetYear = base.getFullYear()
  const targetMonth = base.getMonth() + 1
  const lastDay = new Date(targetYear, targetMonth, 0).getDate()

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

export function buildInstallmentSchedule(input: InstallmentScheduleInput): InstallmentScheduleRow[] {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 120) {
    throw new RangeError('A quantidade de parcelas deve estar entre 1 e 120.')
  }
  parseDate(input.competenceDate)
  parseDate(input.firstSettlementDate)

  const totalCents = amountToCents(input.amount)

  const installmentCents = Math.floor(totalCents / input.count)
  const remainder = totalCents - installmentCents * input.count

  return Array.from({ length: input.count }, (_, index) => ({
    amount: (installmentCents + (index === 0 ? remainder : 0)) / 100,
    competenceDate: input.competenceDate,
    settlementDate: addMonthsClamped(input.firstSettlementDate, index),
    installmentNumber: index + 1,
    installmentTotal: input.count,
  }))
}

export function createUuidV4(randomBytes?: Uint8Array): string {
  if (!randomBytes && typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = randomBytes ? new Uint8Array(randomBytes) : new Uint8Array(16)
  if (bytes.length !== 16) throw new RangeError('UUID requer 16 bytes.')

  if (!randomBytes) {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes)
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256)
      }
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function validateTransactionFinancialInput(input: TransactionFinancialInput): void {
  if (input.type !== 'income' && input.type !== 'expense') {
    throw new RangeError('Tipo de transação inválido.')
  }
  if (!VALID_TRANSACTION_STATUSES.has(input.status)) {
    throw new RangeError('Situação da transação inválida.')
  }
}

export function buildTransactionFinancialRows(input: IncomeTransactionFinancialInput): SimpleTransactionFinancialRow[]
export function buildTransactionFinancialRows(input: ExpenseTransactionFinancialInput): SimpleTransactionFinancialRow[]
export function buildTransactionFinancialRows(input: ExpenseTransactionFinancialInput, installments: InstallmentTransactionOptions): InstallmentTransactionFinancialRow[]
export function buildTransactionFinancialRows(input: TransactionFinancialInput): SimpleTransactionFinancialRow[]
export function buildTransactionFinancialRows(
  input: TransactionFinancialInput,
  installments?: InstallmentTransactionOptions,
): TransactionFinancialRow[] {
  validateTransactionFinancialInput(input)
  const amount = amountToCents(input.amount) / 100
  parseDate(input.competenceDate)
  parseDate(input.settlementDate)

  const base = {
    category_id: input.categoryId,
    vehicle_id: input.type === 'expense' ? input.vehicleId || null : null,
  }

  if (!installments) {
    return [{
      ...base,
      amount,
      competence_date: input.competenceDate,
      settlement_date: input.settlementDate,
      status: input.status,
      source: input.source || 'manual',
    }]
  }

  if (input.type !== 'expense') {
    throw new RangeError('Parcelamento é permitido apenas para Saídas.')
  }
  if (!UUID_PATTERN.test(installments.installmentGroupId)) {
    throw new RangeError('O identificador do grupo de parcelas deve ser um UUID válido.')
  }

  return buildInstallmentSchedule({
    amount: input.amount,
    count: installments.count,
    competenceDate: input.competenceDate,
    firstSettlementDate: installments.firstSettlementDate,
  }).map((installment) => ({
    ...base,
    amount: installment.amount,
    competence_date: installment.competenceDate,
    settlement_date: installment.settlementDate,
    status: installment.installmentNumber === 1 ? input.status : 'planned',
    source: 'installment',
    installment_group_id: installments.installmentGroupId,
    installment_number: installment.installmentNumber,
    installment_total: installment.installmentTotal,
  }))
}
