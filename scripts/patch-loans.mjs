import fs from 'node:fs'
const path='src/AppV3.tsx'
let source=fs.readFileSync(path,'utf8')
if(!source.includes("from './loanCore'")){
  source=source.replace("import type { CashFlowScope, PeriodMode } from './financeCore'", "import type { CashFlowScope, PeriodMode } from './financeCore'\nimport { computeLoanLedger } from './loanCore'")
}
const replacement=`function LoansPage({ loans, borrowers, events, onNew, onPayment }: { loans:Loan[];borrowers:Borrower[];events:LoanEvent[];onNew:()=>void;onPayment:(loan:Loan)=>void }) {
  const personMap=new Map(borrowers.map((b)=>[b.id,b]))
  const ledgers=new Map(loans.map((loan)=>[loan.id,computeLoanLedger(loan,events,today())]))
  const totalLent=loans.reduce((sum,loan)=>sum+(ledgers.get(loan.id)?.lent||0),0)
  const principal=loans.reduce((sum,loan)=>sum+(ledgers.get(loan.id)?.principal||0),0)
  const interest=loans.reduce((sum,loan)=>sum+(ledgers.get(loan.id)?.interest||0),0)
  const total=loans.reduce((sum,loan)=>sum+(ledgers.get(loan.id)?.total||0),0)
  return <><PageHeader title="Empréstimos" description="Contratos, juros proporcionais aos dias e pagamentos por pessoa." action="Novo empréstimo" onAction={onNew}/><div className="metrics"><Metric label="Total emprestado" value={totalLent}/><Metric label="Principal a receber" value={principal} tone="amber"/><Metric label="Juros a receber" value={interest} tone="green"/><Metric label="Total a receber" value={total} tone="blue"/></div><section className="card sectionGap"><div className="recordGrid loanRecords">{loans.map((loan)=>{const person=personMap.get(loan.borrower_id);const ledger=ledgers.get(loan.id);return <article key={loan.id}><span className="recordIcon"><Icon name="loans"/></span><div><strong>{person?.name||'Pessoa'}</strong><small>Desde {dateLabel(loan.start_date)} · {(loan.monthly_rate*100).toFixed(2)}% a.m. · juros recebidos {money(ledger?.interestPaid||0)}</small></div><b>{money(ledger?.total||0)}</b><button className="secondaryButton compact" onClick={()=>onPayment(loan)}>Registrar pagamento</button></article>})}{!loans.length&&<Empty icon="loans" title="Nenhum empréstimo" text="Cadastre um empréstimo para acompanhar principal, juros e pagamentos."/>}</div></section></>
}

function VehiclesPage`
source=source.replace(/function LoansPage[\s\S]*?\n\nfunction VehiclesPage/,replacement)
fs.writeFileSync(path,source)
