# Painel Executivo Integrado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o Meu Fluxo em um painel executivo com Caixa/Competência, timeline mensal por toque, análises derivadas de veículos e investimentos e tema claro/escuro, preservando o Supabase atual e o isolamento dos empréstimos.

**Architecture:** `transactions` permanece como livro-caixa único. Funções puras em módulos centrais calculam datas, séries mensais, variações, alertas, parcelas e resumos derivados; `AppV3.tsx` apenas consulta o Supabase, aplica filtros e renderiza esses view models. Não haverá migração nesta etapa porque o esquema existente já contém `account_id`, `vehicle_id`, `competence_date` e `settlement_date` e todas as tabelas usam RLS.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Supabase JS 2, PostgreSQL 17, Node test runner e CSS nativo.

**Spec:** `docs/superpowers/specs/2026-09-14-painel-executivo-integrado-design.md`

## Global Constraints

- `public.transactions` é a única fonte de valores dos módulos gerais.
- Caixa é o regime padrão; Competência é uma alternância explícita.
- Parcelas mantêm `competence_date` original e distribuem somente `settlement_date` e valor.
- Veículos e Investimentos não possuem lançamento financeiro próprio.
- Cadastro de veículo fica em Configurações; conta de investimento fica em Configurações > Contas.
- Empréstimos permanecem isolados e não entram em saldos, gráficos, alertas ou comparações gerais.
- Não criar nem aplicar migração Supabase nesta entrega.
- Não incluir dados financeiros, chaves, senhas ou arquivos `.env` no GitHub.
- Continuar usando RLS e o cliente público do Supabase; nunca usar `service_role` no navegador.
- Interface em português brasileiro, moeda BRL e datas `dd/mm/aaaa` na exibição.
- Mobile com largura mínima de 320 px, timeline com toque e `scroll-snap`.
- Estados financeiros não podem depender somente de cor; usar texto, sinal ou ícone.
- Cada comportamento financeiro novo deve seguir RED → GREEN → REFACTOR.

---

### Task 1: Núcleo de regime contábil, série mensal e alertas

**Files:**
- Create: `src/managerialCore.ts`
- Create: `tests/managerialCore.test.mjs`
- Modify: `src/financeCore.ts`
- Modify: `tests/financeCore.test.mjs`

**Interfaces:**
- Produces: `AnalysisBasis`, `analysisDate()`, `buildMonthlySeries()`, `calculateDelta()` e `buildExecutiveAlerts()`.
- Modifies: `CashFlowFilterOptions.dateBasis?: AnalysisBasis`; `filterCashFlow()` passa a filtrar o período pela data do regime escolhido.
- Consumed later by: Dashboard, Comparações, Veículos e Investimentos.

- [ ] **Step 1: Write failing tests for Caixa versus Competência**

Append to `tests/financeCore.test.mjs` a fixture whose `competence_date` is `2026-01-20` and `settlement_date` is `2026-02-10`, then add:

```js
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
```

Create `tests/managerialCore.test.mjs` with hand-checked fixtures and tests:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analysisDate, buildMonthlySeries, calculateDelta, buildExecutiveAlerts
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
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
node --test tests/financeCore.test.mjs tests/managerialCore.test.mjs
```

Expected: FAIL because `managerialCore.ts`, `AnalysisBasis` and `dateBasis` do not exist.

- [ ] **Step 3: Implement the calculation contracts**

Create `src/managerialCore.ts` with these public types and signatures:

```ts
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
export type ExecutiveAlert = {
  tone: 'critical' | 'warning' | 'positive' | 'info'
  title: string
  message: string
}

export function analysisDate(row: ManagerialRow, basis: AnalysisBasis): string
export function buildMonthlySeries(
  rows: ManagerialRow[],
  options: { basis: AnalysisBasis; openingBalance?: number; fromMonth?: string; toMonth?: string }
): MonthlyPoint[]
export function calculateDelta(current: number, previous: number): { amount: number; percent: number | null }
export function buildExecutiveAlerts(series: MonthlyPoint[]): ExecutiveAlert[]
```

Implementation rules:

```ts
// analysisDate
return basis === 'competence'
  ? row.competence_date
  : row.settlement_date || row.competence_date

// calculateDelta
const amount = current - previous
return { amount, percent: previous === 0 ? null : (amount / Math.abs(previous)) * 100 }
```

`buildMonthlySeries()` must ignore `cancelled`, `transfer` and `adjustment`, fill every month inclusively between the requested bounds, and accumulate `balance`. `buildExecutiveAlerts()` evaluates the final two points and formats BRL with `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })`.

Update `src/financeCore.ts` to import `AnalysisBasis` and `analysisDate`, add `dateBasis?: AnalysisBasis` to `CashFlowFilterOptions`, default it to `'cash'`, and replace the private date selection inside `filterCashFlow()` with `analysisDate(row, dateBasis)` for scope and period comparisons.

- [ ] **Step 4: Run focused and full tests; verify GREEN**

Run:

```bash
node --test tests/financeCore.test.mjs tests/managerialCore.test.mjs
node --test tests/*.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 5: Refactor, typecheck and commit**

Run:

```bash
./node_modules/.bin/tsc -b --pretty false
git add src/managerialCore.ts src/financeCore.ts tests/managerialCore.test.mjs tests/financeCore.test.mjs
git commit -m "feat: adicionar analytics por caixa e competencia"
```

---

### Task 2: Parcelamento por competência e vínculo do veículo

**Files:**
- Create: `src/transactionCore.ts`
- Create: `tests/transactionCore.test.mjs`
- Modify: `src/AppV3.tsx`

**Interfaces:**
- Consumes: existing transaction columns and `addMonths` semantics.
- Produces: `buildInstallmentSchedule()` and `TransactionDraft.vehicleId`.
- Persists: `transactions.vehicle_id` using the existing RLS-protected table.

- [ ] **Step 1: Write failing installment tests**

Create `tests/transactionCore.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInstallmentSchedule } from '../src/transactionCore.ts'

test('installments keep purchase competence and spread only settlement dates', () => {
  assert.deepEqual(buildInstallmentSchedule({
    amount:500, count:5, competenceDate:'2026-01-20', firstSettlementDate:'2026-02-10'
  }), [
    { amount:100, competenceDate:'2026-01-20', settlementDate:'2026-02-10', installmentNumber:1, installmentTotal:5 },
    { amount:100, competenceDate:'2026-01-20', settlementDate:'2026-03-10', installmentNumber:2, installmentTotal:5 },
    { amount:100, competenceDate:'2026-01-20', settlementDate:'2026-04-10', installmentNumber:3, installmentTotal:5 },
    { amount:100, competenceDate:'2026-01-20', settlementDate:'2026-05-10', installmentNumber:4, installmentTotal:5 },
    { amount:100, competenceDate:'2026-01-20', settlementDate:'2026-06-10', installmentNumber:5, installmentTotal:5 },
  ])
})

test('rounding remainder is assigned to the first installment', () => {
  const rows = buildInstallmentSchedule({
    amount:100.01, count:3, competenceDate:'2026-01-31', firstSettlementDate:'2026-01-31'
  })
  assert.deepEqual(rows.map(row => row.amount), [33.35, 33.33, 33.33])
  assert.deepEqual(rows.map(row => row.settlementDate), ['2026-01-31','2026-02-28','2026-03-31'])
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test tests/transactionCore.test.mjs
```

Expected: FAIL because `transactionCore.ts` does not exist.

- [ ] **Step 3: Implement schedule generation**

Create `src/transactionCore.ts` with:

```ts
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

export function addMonthsClamped(value: string, offset: number): string
export function buildInstallmentSchedule(input: InstallmentScheduleInput): InstallmentScheduleRow[]
```

Validate `count` as an integer from 1 to 120 and `amount > 0`, throw `RangeError` otherwise, divide in integer cents, assign the remainder to installment 1, and clamp day 29/30/31 to the final day of short months while always using the preferred day from `firstSettlementDate`.

- [ ] **Step 4: Run schedule tests and verify GREEN**

Run:

```bash
node --test tests/transactionCore.test.mjs
```

Expected: 2 tests pass.

- [ ] **Step 5: Integrate vehicle and installments into AppV3**

Modify `src/AppV3.tsx`:

```ts
import { buildInstallmentSchedule } from './transactionCore'

type TransactionDraft = {
  // existing fields
  vehicleId: string
}
```

- Pass `vehicles` into `TransactionEditor`.
- Initialize `vehicleId` with `editing?.vehicle_id || ''`.
- Render a `Veículo (opcional)` select for Saídas, with `Nenhum veículo` and all active vehicles.
- Add `vehicle_id: draft.nature === 'Saída' ? draft.vehicleId || null : null` to the transaction payload.
- Include `vehicleId` in the draft submitted by the editor.
- Replace the inline credit-card split with `buildInstallmentSchedule()` and map each schedule row to `amount`, `competence_date`, `settlement_date`, `installment_number` and `installment_total`.
- Preserve the existing group ID, status, source, recurrence behavior and editing behavior.

- [ ] **Step 6: Verify integration and commit**

Run:

```bash
node --test tests/*.test.mjs
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
git add src/transactionCore.ts src/AppV3.tsx tests/transactionCore.test.mjs
git commit -m "feat: preservar competencia e vincular veiculos"
```

Expected: tests, typecheck and build exit 0.

---

### Task 3: Veículos e Investimentos derivados do livro-caixa

**Files:**
- Modify: `src/managerialCore.ts`
- Modify: `tests/managerialCore.test.mjs`
- Modify: `src/AppV3.tsx`

**Interfaces:**
- Consumes: `analysisDate()`, active vehicles, investment accounts and transactions.
- Produces: `buildVehicleSummaries()` and `buildInvestmentSummary()`.
- UI contract: module pages are read-only analytics; auxiliary records are edited only in Settings.

- [ ] **Step 1: Write failing derived-module tests**

Append to `tests/managerialCore.test.mjs`:

```js
import {
  buildVehicleSummaries, buildInvestmentSummary
} from '../src/managerialCore.ts'

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
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test tests/managerialCore.test.mjs
```

Expected: FAIL because the two functions are missing.

- [ ] **Step 3: Implement derived summaries**

Add these contracts to `src/managerialCore.ts`:

```ts
export type VehicleLike = { id: string; name: string }
export type AccountLike = { id: string; name: string; account_type: string; initial_balance: number }

export function buildVehicleSummaries(
  vehicles: VehicleLike[], rows: ManagerialRow[], year: string, basis: AnalysisBasis
): Array<{
  id: string; name: string; total: number; monthlyAverage: number;
  peakMonth: string | null; peakAmount: number;
  months: Array<{ key: string; expense: number }>
}>

export function buildInvestmentSummary(
  accounts: AccountLike[], rows: ManagerialRow[], basis: AnalysisBasis
): {
  initialBalance: number; income: number; expense: number; balance: number;
  accounts: Array<{ id: string; name: string; initialBalance: number; income: number; expense: number; balance: number }>
  months: MonthlyPoint[]
}
```

Vehicles use only completed expenses for the chosen year, return all 12 months and calculate `total / 12`. Investments use only completed, non-cancelled income/expense from accounts typed `investment`.

- [ ] **Step 4: Verify summary tests GREEN**

Run:

```bash
node --test tests/managerialCore.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Replace parallel entry points with derived UI**

Modify `src/AppV3.tsx`:

- `VehiclesPage` receives no `onNew`, adds year and vehicle filters, renders annual total, average monthly, peak month and 12 real monthly amounts from `buildVehicleSummaries()`.
- `InvestmentsPage` receives no `onNew` and renders `buildInvestmentSummary()` plus account cards and a monthly chart.
- Remove `vehicle` and `investment` from `SimpleEntityModal.kind`; keep only `loan | payment`.
- Remove the vehicle/investment branches from `saveEntity()`.
- Add a vehicle form and list to `SettingsPage`; accept `vehicles` and `onSaveVehicle(name, make, model, plate, id?)`.
- Implement `saveVehicle()` in `AppShell` against `public.vehicles`, always setting `user_id` on insert and preserving RLS ownership.
- Keep investment account creation in the existing account form with `account_type = investment`.
- Empty states direct the user to Configurações without creating financial data in the analytical pages.
- Do not change LoansPage, `computeLoanLedger()` or loan tables.

- [ ] **Step 6: Run complete verification and commit**

Run:

```bash
node --test tests/*.test.mjs
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
git add src/managerialCore.ts src/AppV3.tsx tests/managerialCore.test.mjs
git commit -m "feat: derivar veiculos e investimentos do caixa"
```

Expected: tests, typecheck and build exit 0.

---

### Task 4: Dashboard executivo, timeline por toque e comparações

**Files:**
- Modify: `src/AppV3.tsx`
- Create: `src/executive.css`
- Modify: `src/main.tsx`
- Modify: `tests/managerialCore.test.mjs`

**Interfaces:**
- Consumes: `AnalysisBasis`, `buildMonthlySeries()`, `calculateDelta()` and `buildExecutiveAlerts()`.
- Produces: `BasisToggle`, `MonthlyRail`, richer KPI details and one shared monthly series for cards and charts.

- [ ] **Step 1: Add a failing regression for selected-month KPI context**

Add to `src/managerialCore.ts` only after the test fails a function with this contract:

```ts
export function selectedMonthContext(
  series: MonthlyPoint[], selectedKey?: string
): { current: MonthlyPoint | null; previous: MonthlyPoint | null }
```

First append the test:

```js
test('selected month context returns the selected month and its immediate predecessor', () => {
  const series = buildMonthlySeries(movements, {
    basis:'cash', fromMonth:'2026-01', toMonth:'2026-03'
  })
  const context = selectedMonthContext(series, '2026-03')
  assert.equal(context.current?.key, '2026-03')
  assert.equal(context.previous?.key, '2026-02')
  assert.equal(selectedMonthContext(series, 'missing').current?.key, '2026-03')
})
```

- [ ] **Step 2: Run RED, implement the helper, then run GREEN**

Run:

```bash
node --test tests/managerialCore.test.mjs
```

Expected first run: FAIL because `selectedMonthContext` is missing. Implement it so an absent/invalid key selects the final point and its predecessor, then run the same command and expect PASS.

- [ ] **Step 3: Build the executive dashboard UI**

Modify `src/AppV3.tsx`:

- Add `basis` state to Dashboard, default `'cash'`.
- Pass `dateBasis:basis` into `filterCashFlow()`.
- Build the shared series with `buildMonthlySeries(filtered, { basis, openingBalance })`.
- Add `BasisToggle` with buttons `Caixa` and `Competência`, `aria-pressed`, and an explanatory line.
- Add `MonthlyRail` above the chart. Each button contains `monthLabel`, Entrada, Saída, Resultado and Saldo; clicking updates `selectedMonth`.
- Use `selectedMonthContext()` for the three monthly KPI variations.
- Extend `Metric` with optional `deltaPercent` and `favorable` so the detail says `↑ 12,0% vs. mês anterior`, `↓ 8,0% vs. mês anterior` or `Sem base comparável`.
- Feed the exact same `MonthlyPoint[]` to cards and `TimelineChart`.
- Extend `TimelineChart` to render Resultado: a blue line in line mode and a signed blue marker/label in column mode.
- Render alerts from `buildExecutiveAlerts()` with visible severity text.
- Add the Caixa/Competência toggle to `ComparisonsPage`; pass `dateBasis` to both compared filters and label the active rule.
- Keep LoansPage outside every new calculation and prop path.

- [ ] **Step 4: Add structural CSS and mobile swipe behavior**

Create `src/executive.css` and import it last in `src/main.tsx`:

```ts
import './executive.css'
```

Required CSS behaviors:

```css
.monthlyRail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 260px);
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}
.monthCard { scroll-snap-align: start; }
.monthCard:focus-visible,
.basisToggle button:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
@media (max-width: 640px) {
  .monthlyRail { grid-auto-columns: minmax(82vw, 290px); }
}
```

Also style KPI deltas, alert severities, selected cards and the result legend without relying on color alone.

- [ ] **Step 5: Verify and commit**

Run:

```bash
node --test tests/*.test.mjs
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
git add src/managerialCore.ts src/AppV3.tsx src/executive.css src/main.tsx tests/managerialCore.test.mjs
git commit -m "feat: criar dashboard executivo com timeline mensal"
```

Expected: tests, typecheck and build exit 0.

---

### Task 5: Tema Claro/Escuro/Automático e acabamento responsivo

**Files:**
- Create: `src/themeCore.ts`
- Create: `tests/themeCore.test.mjs`
- Modify: `src/AppV3.tsx`
- Modify: `src/executive.css`
- Modify: `README.md`

**Interfaces:**
- Produces: `ThemePreference`, `ResolvedTheme`, `resolveTheme()` and `themeStorageKey()`.
- Consumes: authenticated `session.user.id`, browser `localStorage` and `prefers-color-scheme`.

- [ ] **Step 1: Write failing theme tests**

Create `tests/themeCore.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTheme, themeStorageKey, normalizeThemePreference } from '../src/themeCore.ts'

test('explicit theme overrides the operating system preference', () => {
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')
})

test('automatic theme follows the operating system', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
})

test('invalid stored theme is normalized and storage is isolated by user', () => {
  assert.equal(normalizeThemePreference('sepia'), 'system')
  assert.equal(themeStorageKey('user-123'), 'meu-fluxo:theme:user-123')
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test tests/themeCore.test.mjs
```

Expected: FAIL because `themeCore.ts` does not exist.

- [ ] **Step 3: Implement theme contracts and verify GREEN**

Create `src/themeCore.ts`:

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function normalizeThemePreference(value: string | null | undefined): ThemePreference
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme
export function themeStorageKey(userId: string): string
```

Use only deterministic pure logic. Then run:

```bash
node --test tests/themeCore.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 4: Integrate per-user theme preference**

Modify `AppShell` in `src/AppV3.tsx`:

- Initialize preference from `localStorage.getItem(themeStorageKey(session.user.id))` through `normalizeThemePreference()`.
- Observe `window.matchMedia('(prefers-color-scheme: dark)')` while preference is `system`.
- Apply `document.documentElement.dataset.theme = resolveTheme(preference, systemDark)` and `document.documentElement.style.colorScheme`.
- Persist changes with the user-specific key.
- Pass `themePreference` and `onThemePreferenceChange` to `SettingsPage`.
- Add an `Aparência` card with three semantic buttons: Claro, Escuro and Automático; use `aria-pressed` and explanatory copy.

- [ ] **Step 5: Finish visual tokens and responsive states**

Extend `src/executive.css` with the exact light and dark tokens from the spec and override hard-coded surfaces used by the active AppV3 pages:

```css
:root {
  --page-bg:#f4f7fb; --surface:#fff; --surface-raised:#fff;
  --text:#172033; --text-muted:#667085; --border:#dfe6ef;
  --primary:#2563eb; --income:#0f8f68; --expense:#cf4555;
  --focus:#80aaff;
}
:root[data-theme='dark'] {
  --page-bg:#08111f; --surface:#111d2f; --surface-raised:#17263b;
  --text:#edf4ff; --text-muted:#aab8cb; --border:#2a3b52;
  --primary:#72a2ff; --income:#46c79a; --expense:#ff7b88;
  --focus:#9bbcff;
}
```

- Map legacy variables (`--bg`, `--ink`, `--muted`, `--line`, `--blue`, `--green`, `--red`) to the new tokens.
- Override cards, tables, inputs, dialogs, charts, filters, sidebar, topbar, empty states and configuration lists in dark mode.
- Add hover, selected, disabled and focus-visible states.
- Respect `@media (prefers-reduced-motion: reduce)`.
- At 320–480 px keep one-column forms, full-width actions and swipeable monthly cards without horizontal page overflow.

- [ ] **Step 6: Update documentation**

Update `README.md` with:

- Caixa/Competência explanation.
- Veículos and Investimentos as derived views.
- Vehicle/account registration location.
- Theme options.
- Explicit note that loans are independent.
- Commands `node --test tests/*.test.mjs`, `npm run typecheck` and `npm run build`.

- [ ] **Step 7: Run final local verification and commit**

Run:

```bash
node --test tests/*.test.mjs
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
git diff --check
git add src/themeCore.ts src/AppV3.tsx src/executive.css tests/themeCore.test.mjs README.md
git commit -m "feat: adicionar temas e acabamento responsivo"
```

Expected: all tests pass, typecheck exits 0, build exits 0 and `git diff --check` returns no output.

---

## Final verification

After Tasks 1–5:

```bash
node --test tests/*.test.mjs
./node_modules/.bin/tsc -b --pretty false
./node_modules/.bin/vite build
git diff --check
git status --short
```

Perform a browser smoke test at desktop and 390 px widths, validating Dashboard, Lançamentos, Veículos, Investimentos, Comparações, Configurações and the unchanged Empréstimos page. Confirm that no `.env`, credentials or financial export appears in `git diff --name-only $(git merge-base main HEAD)..HEAD`.

