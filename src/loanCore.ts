export type LoanLike = { id:string; monthly_rate:number; start_date:string }
export type LoanEventLike = { loan_id:string; event_date:string; event_type:string; amount:number }
export type LoanLedger = { principal:number; interest:number; total:number; lent:number; paid:number; interestPaid:number }

function daysBetween(a:string,b:string){
  return Math.max(0,Math.round((new Date(`${b}T12:00:00`).getTime()-new Date(`${a}T12:00:00`).getTime())/86400000))
}

export function computeLoanLedger(loan:LoanLike, events:LoanEventLike[], asOf=new Date().toISOString().slice(0,10)):LoanLedger{
  let principal=0
  let interest=0
  let lent=0
  let paid=0
  let interestPaid=0
  let cursor=loan.start_date
  const ordered=[...events].filter((event)=>event.loan_id===loan.id&&event.event_date<=asOf).sort((a,b)=>a.event_date.localeCompare(b.event_date))
  for(const event of ordered){
    const days=daysBetween(cursor,event.event_date)
    if(principal>0&&days>0) interest+=principal*(Math.pow(1+loan.monthly_rate,days/30)-1)
    if(event.event_type==='disbursement'){
      principal+=event.amount
      lent+=event.amount
    }else if(event.event_type==='payment'){
      paid+=event.amount
      const toInterest=Math.min(interest,event.amount)
      interest-=toInterest
      interestPaid+=toInterest
      principal=Math.max(0,principal-Math.max(0,event.amount-toInterest))
    }else if(event.event_type==='adjustment'){
      principal+=event.amount
    }
    cursor=event.event_date
  }
  const remainingDays=daysBetween(cursor,asOf)
  if(principal>0&&remainingDays>0) interest+=principal*(Math.pow(1+loan.monthly_rate,remainingDays/30)-1)
  return {principal,interest,total:principal+interest,lent,paid,interestPaid}
}
