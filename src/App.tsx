import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from './lib/supabase'

type PageId = 'dashboard' | 'transactions' | 'payables' | 'loans' | 'vehicles' | 'investments' | 'comparisons' | 'projections' | 'settings'
type IconName = PageId | 'menu' | 'plus' | 'bell' | 'search' | 'close' | 'wallet' | 'calendar' | 'trend'
type TransactionLabel = 'Saída' | 'Entrada' | 'Transferência'
type CategoryNature = Exclude<TransactionLabel, 'Transferência'>
type CategoryGroup = { id: string; name: string; nature: CategoryNature; categories: string[] }
const navigation: Array<{ id: PageId; label: string }> = [{id:'dashboard',label:'Visão geral'},{id:'transactions',label:'Lançamentos'},{id:'payables',label:'Pagar e receber'},{id:'loans',label:'Empréstimos'},{id:'vehicles',label:'Veículos'},{id:'investments',label:'Investimentos'},{id:'comparisons',label:'Comparações'},{id:'projections',label:'Projeções'}]
const pageHelp: Record<PageId,string>={dashboard:'Resumo financeiro do período',transactions:'Entradas, saídas e transferências',payables:'Compromissos previstos e realizados',loans:'Juros, pagamentos e amortizações',vehicles:'Custo real e média mensal por veículo',investments:'Aportes, resgates e rendimentos',comparisons:'Variações, tendências e alertas',projections:'Cenários futuros do fluxo de caixa',settings:'Perfil, categorias e preferências'}
const defaultCategoryGroups: CategoryGroup[] = [
  {id:'receitas',name:'Receitas',nature:'Entrada',categories:['Salário','Décimo terceiro salário','Outros ganhos','Trabalho rural']},
  {id:'investimentos-rendimentos',name:'Investimentos e rendimentos',nature:'Entrada',categories:['Rendimentos bancários','Juros de empréstimos para terceiros']},
  {id:'moradia-utilidades',name:'Moradia e utilidades',nature:'Saída',categories:['Aluguel','Gás de cozinha','Mobília','Materiais domésticos','Material de consumo']},
  {id:'despesas-pessoais',name:'Despesas pessoais',nature:'Saída',categories:['Alimentação','Supermercado','Lazer','Saúde','Corte de cabelo']},
  {id:'servicos-digitais',name:'Serviços digitais',nature:'Saída',categories:['Internet','Recarga de celular','Canva','Spotify']},
  {id:'veiculos',name:'Despesas veiculares',nature:'Saída',categories:['Combustível','Manutenção e acessórios','Troca de óleo','IPVA','Licenciamento','Vistoria veicular','Serviços de despachante','Aquisição de veículo','CNH']},
  {id:'transporte',name:'Transporte',nature:'Saída',categories:['Passagem Águia Branca','Passagem São Gabriel','Táxi']},
  {id:'materiais-compras',name:'Materiais e compras',nature:'Saída',categories:['Equipamentos e acessórios','Vestuário e calçados','Aparelho eletrônico']},
  {id:'outras-despesas',name:'Outras despesas',nature:'Saída',categories:['Gastos com terceiros','Outros gastos','Serviços de cartório','Despesas bancárias e taxas']},
]

function todayAsInputDate(){
  const now=new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

function Icon({name,size=20}:{name:IconName;size?:number}){const p:Record<IconName,ReactNode>={dashboard:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,transactions:<><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,payables:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,loans:<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M7 7V4h10v3M8 13h8M12 10v6"/></>,vehicles:<><path d="m5 15 1.5-6h11l1.5 6M3 15h18v4h-3v-2H6v2H3z"/><path d="M7 14h.01M17 14h.01"/></>,investments:<><path d="M4 20V10M10 20V5M16 20v-7M22 20V3M2 20h21"/></>,comparisons:<><path d="M7 4v16M17 4v16M4 8l3-3 3 3M14 16l3 3 3-3"/></>,projections:<><path d="m3 18 6-7 4 4 8-10M16 5h5v5"/></>,settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,menu:<path d="M4 7h16M4 12h16M4 17h16"/>,plus:<path d="M12 5v14M5 12h14"/>,bell:<><path d="M6 9a6 6 0 0 1 12 0v6l2 2H4l2-2Z"/><path d="M10 21h4"/></>,search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></>,close:<path d="m6 6 12 12M18 6 6 18"/>,wallet:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M15 10h7v5h-7a2.5 2.5 0 0 1 0-5Z"/></>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,trend:<path d="m3 17 6-6 4 4 8-9M16 6h5v5"/>};return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{p[name]}</svg>}
function Brand(){return <div className="brand"><span className="brandMark"><i/><i/><i/></span><span><strong>Meu Fluxo</strong><small>Finanças pessoais</small></span></div>}
function EmptyState({icon,title,text,action,onAction}:{icon:IconName;title:string;text:string;action?:string;onAction?:()=>void}){return <div className="emptyState"><span className="emptyIcon"><Icon name={icon} size={23}/></span><h3>{title}</h3><p>{text}</p>{action&&<button className="secondaryButton" onClick={onAction}>{action}</button>}</div>}
function PageHeader({title,description,action,onAction,children}:{title:string;description:string;action?:string;onAction?:()=>void;children?:ReactNode}){return <div className="pageHeader"><div><h2>{title}</h2><p>{description}</p></div><div className="pageActions">{children}{action&&<button className="primaryButton" onClick={onAction}><Icon name="plus" size={17}/>{action}</button>}</div></div>}
function Metric({label,tone='blue'}:{label:string;tone?:string}){return <article className="metric"><span className={`metricIcon ${tone}`}><Icon name={tone==='green'?'trend':tone==='red'?'wallet':'dashboard'} size={18}/></span><small>{label}</small><strong>R$ 0,00</strong><p>Sem lançamentos no período</p></article>}

function DashboardPage({openEntry}:{openEntry:()=>void}){return <><PageHeader title="Visão geral" description="Acompanhe o mês, identifique mudanças e acesse os detalhes." action="Novo lançamento" onAction={openEntry}><select className="selectControl" aria-label="Período"><option>Setembro de 2026</option></select></PageHeader><div className="metrics"><Metric label="Entradas no mês" tone="green"/><Metric label="Saídas no mês" tone="red"/><Metric label="Resultado do mês"/><Metric label="Saldo disponível" tone="amber"/></div><div className="dashboardGrid"><section className="card chartCard"><div className="cardHeader"><div><h3>Entradas e saídas</h3><p>Evolução dos últimos seis meses</p></div><div className="legend"><span className="income">Entradas</span><span className="expense">Saídas</span></div></div><div className="emptyChart"><div className="chartGrid"><i/><i/><i/><i/></div><span>O gráfico aparecerá após os primeiros lançamentos.</span></div></section><section className="card"><div className="cardHeader"><div><h3>Despesas por grupo</h3><p>Participação no mês</p></div></div><EmptyState icon="comparisons" title="Sem despesas" text="Os grupos aparecerão aqui conforme os lançamentos forem registrados."/></section></div><div className="dashboardGrid lower"><section className="card"><div className="cardHeader"><div><h3>Últimos lançamentos</h3><p>Entradas e saídas recentes</p></div><button className="textButton">Ver todos</button></div><EmptyState icon="transactions" title="Nenhum lançamento" text="Adicione uma entrada ou saída para iniciar o controle." action="Adicionar lançamento" onAction={openEntry}/></section><section className="card attention"><div className="cardHeader"><div><h3>Atenção</h3><p>Contas, tendências e avisos</p></div></div><div className="notice neutral"><Icon name="bell"/><div><strong>Sem alertas no momento</strong><p>Os avisos serão calculados com base no seu histórico.</p></div></div></section></div></>}
function TransactionsPage({openEntry}:{openEntry:()=>void}){return <><PageHeader title="Lançamentos" description="Consulte, filtre e registre todas as movimentações." action="Adicionar lançamento" onAction={openEntry}/><div className="toolbar"><label className="searchField"><Icon name="search" size={18}/><input placeholder="Pesquisar descrição ou categoria"/></label><select className="selectControl"><option>Todos os tipos</option><option>Entradas</option><option>Saídas</option><option>Transferências</option></select><select className="selectControl"><option>Todos os grupos</option></select></div><section className="card tableCard"><div className="tableScroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Grupo</th><th>Conta</th><th>Situação</th><th className="right">Valor</th></tr></thead><tbody/></table></div><EmptyState icon="transactions" title="Sua lista está vazia" text="Os lançamentos poderão ser filtrados por período, grupo, categoria e situação." action="Criar primeiro lançamento" onAction={openEntry}/></section></>}
function PayablesPage(){return <><PageHeader title="Pagar e receber" description="Veja o que vence, o que já foi realizado e o que está atrasado." action="Nova conta"/><div className="statusMetrics"><article><span>Vence nos próximos 7 dias</span><strong>R$ 0,00</strong></article><article><span>A receber</span><strong>R$ 0,00</strong></article><article><span>Vencido</span><strong>R$ 0,00</strong></article></div><div className="twoColumns"><section className="card"><div className="cardHeader"><div><h3>Calendário financeiro</h3><p>Setembro de 2026</p></div><button className="iconButton"><Icon name="calendar"/></button></div><EmptyState icon="calendar" title="Nenhuma conta programada" text="Recorrências e parcelas futuras aparecerão automaticamente."/></section><section className="card"><div className="cardHeader"><div><h3>Próximos compromissos</h3><p>Ordenados por vencimento</p></div></div><EmptyState icon="payables" title="Agenda livre" text="Não há contas previstas para este período."/></section></div></>}
function LoansPage(){return <><PageHeader title="Empréstimos" description="Controle por pessoa com juros compostos proporcionais aos dias." action="Novo empréstimo"/><div className="twoColumns loanIntro"><section className="card loanSummary"><span className="sectionTag">Resumo geral</span><strong className="bigValue">R$ 0,00</strong><p>Saldo principal a receber</p><div className="miniGrid"><div><small>Total emprestado</small><strong>R$ 0,00</strong></div><div><small>Juros recebidos</small><strong>R$ 0,00</strong></div><div><small>Pessoas</small><strong>0</strong></div></div></section><section className="card formulaCard"><h3>Regra de cálculo</h3><p>Taxa mensal configurável com capitalização proporcional aos dias.</p><code>saldo × ((1 + taxa)<sup>dias ÷ 30</sup> − 1)</code><small>Pagamentos quitam primeiro os juros acumulados e depois amortizam o principal.</small></section></div><section className="card sectionGap"><div className="cardHeader"><div><h3>Pessoas e contratos</h3><p>Filtre pelo nome e consulte a memória de cálculo</p></div><label className="compactSearch"><Icon name="search" size={16}/><input placeholder="Pesquisar pessoa"/></label></div><EmptyState icon="loans" title="Nenhum empréstimo cadastrado" text="Cadastre uma pessoa e registre as datas em que o dinheiro foi entregue." action="Cadastrar empréstimo"/></section></>}
function VehiclesPage(){return <><PageHeader title="Veículos" description="Separe o custo real do mês e acompanhe a média mensal." action="Cadastrar veículo"/><div className="twoColumns"><section className="card"><EmptyState icon="vehicles" title="Nenhum veículo cadastrado" text="Cadastre carro ou moto para relacionar combustível, impostos e manutenção." action="Cadastrar veículo"/></section><section className="card"><div className="cardHeader"><div><h3>Custo mês a mês</h3><p>Sem ratear valores no fluxo de caixa real</p></div></div><div className="emptyChart compact"><div className="chartGrid"><i/><i/><i/></div><span>Escolha um veículo para visualizar.</span></div></section></div><section className="card infoCard sectionGap"><div className="notice blue"><Icon name="vehicles"/><div><strong>Como a média será apresentada</strong><p>IPVA, licenciamento e seguro permanecem no mês do pagamento. A média mensal será exibida separadamente para planejamento.</p></div></div></section></>}
function InvestmentsPage(){return <><PageHeader title="Investimentos" description="Acompanhe aportes, resgates, rentabilidade e rendimentos realizados." action="Adicionar investimento"/><div className="metrics"><Metric label="Saldo aplicado"/><Metric label="Aportes no mês"/><Metric label="Rendimento líquido" tone="green"/><Metric label="Rentabilidade" tone="amber"/></div><div className="twoColumns"><section className="card"><div className="cardHeader"><div><h3>Evolução dos investimentos</h3><p>Patrimônio e rendimento líquido</p></div></div><div className="emptyChart"><div className="chartGrid"><i/><i/><i/></div><span>Cadastre uma conta de investimento para começar.</span></div></section><section className="card"><div className="cardHeader"><div><h3>Produtos</h3><p>Comparação por instituição</p></div></div><EmptyState icon="investments" title="Nenhum produto cadastrado" text="Aportes serão tratados como transferências, sem inflar as despesas."/></section></div></>}
function ComparisonsPage(){return <><PageHeader title="Comparações" description="Entenda o que aumentou, diminuiu e se tornou tendência."><select className="selectControl"><option>Mês anterior</option><option>Mesmo mês do ano anterior</option></select></PageHeader><div className="twoColumns"><section className="card"><div className="cardHeader"><div><h3>Resumo da comparação</h3><p>Valor, diferença e variação percentual</p></div></div><EmptyState icon="comparisons" title="Ainda não há períodos comparáveis" text="São necessários lançamentos em pelo menos dois períodos."/></section><section className="card"><div className="cardHeader"><div><h3>Variação por grupo</h3><p>Maiores aumentos e reduções</p></div></div><EmptyState icon="trend" title="Sem variações calculadas" text="Quando a base estiver pronta, cada resultado abrirá os lançamentos que o explicam."/></section></div><section className="card sectionGap"><div className="cardHeader"><div><h3>Análises automáticas</h3><p>Tendências calculadas com pelo menos três períodos completos</p></div></div><div className="notice neutral"><Icon name="bell"/><div><strong>Nenhuma tendência disponível</strong><p>Uma alteração isolada não será classificada como tendência.</p></div></div></section></>}
function ProjectionsPage(){return <><PageHeader title="Projeções" description="Visualize o saldo futuro usando recorrências, parcelas e contas previstas."><label className="dateControl">Projetar até<input type="month" defaultValue="2027-06"/></label></PageHeader><div className="scenarioTabs"><button>Conservador</button><button className="active">Base</button><button>Otimista</button></div><section className="card projectionCard"><div className="projectionSummary"><div><small>Saldo inicial</small><strong>R$ 0,00</strong></div><div><small>Entradas previstas</small><strong>R$ 0,00</strong></div><div><small>Saídas previstas</small><strong>R$ 0,00</strong></div><div><small>Saldo projetado</small><strong>R$ 0,00</strong></div></div><div className="emptyChart"><div className="chartGrid"><i/><i/><i/><i/></div><span>A projeção não inventará receitas ou rendimentos sem uma premissa cadastrada.</span></div></section></>}
function SettingsPage({groups,onAddGroup,onAddCategory}:{groups:CategoryGroup[];onAddGroup:(name:string,nature:CategoryNature)=>void;onAddCategory:(groupId:string,name:string)=>void}){
  const[editor,setEditor]=useState<'group'|'category'|null>(null)
  const[name,setName]=useState('')
  const[nature,setNature]=useState<CategoryNature>('Saída')
  const[groupId,setGroupId]=useState(groups[0]?.id||'')
  const[message,setMessage]=useState('')
  const categoryCount=groups.reduce((total,group)=>total+group.categories.length,0)
  function submit(e:FormEvent){
    e.preventDefault()
    const cleanName=name.trim()
    if(!cleanName)return
    if(editor==='group')onAddGroup(cleanName,nature)
    if(editor==='category'&&groupId)onAddCategory(groupId,cleanName)
    setMessage(`${editor==='group'?'Grupo':'Categoria'} adicionado nesta visualização.`)
    setName('')
    setEditor(null)
  }
  return <>
    <PageHeader title="Configurações" description="Personalize o sistema sem alterar os dados de outros usuários."/>
    <div className="configSummary">
      <article><small>Grupos cadastrados</small><strong>{groups.length}</strong></article>
      <article><small>Categorias cadastradas</small><strong>{categoryCount}</strong></article>
      <article><small>Escopo</small><strong>Por usuário</strong></article>
    </div>
    <section className="card categoryManager">
      <div className="cardHeader categoryManagerHeader">
        <div><h3>Grupos e categorias</h3><p>Estrutura inicial preparada a partir das classificações da planilha.</p></div>
        <div className="inlineActions">
          <button className="secondaryButton" onClick={()=>{setEditor('group');setMessage('')}}><Icon name="plus" size={16}/>Novo grupo</button>
          <button className="primaryButton" onClick={()=>{setEditor('category');setGroupId(groups[0]?.id||'');setMessage('')}}><Icon name="plus" size={16}/>Nova categoria</button>
        </div>
      </div>
      {editor&&<form className="configForm" onSubmit={submit}>
        <div>
          <strong>{editor==='group'?'Adicionar grupo':'Adicionar categoria'}</strong>
          <small>Na versão conectada, a alteração ficará apenas no perfil do usuário.</small>
        </div>
        <label>Nome<input value={name} onChange={e=>setName(e.target.value)} placeholder={editor==='group'?'Ex.: Educação':'Ex.: Cursos'} autoFocus required/></label>
        {editor==='group'?<label>Natureza<select value={nature} onChange={e=>setNature(e.target.value as CategoryNature)}><option>Saída</option><option>Entrada</option></select></label>:<label>Grupo<select value={groupId} onChange={e=>setGroupId(e.target.value)} required>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
        <div className="configFormActions"><button type="button" className="textButton" onClick={()=>setEditor(null)}>Cancelar</button><button className="primaryButton" type="submit">Adicionar</button></div>
      </form>}
      {message&&<div className="configMessage">{message}</div>}
      <div className="categoryGroups">
        {groups.map(group=><article className="categoryGroup" key={group.id}>
          <div className="categoryGroupHeader"><div><strong>{group.name}</strong><small>{group.categories.length} categorias</small></div><span className={`natureBadge ${group.nature==='Entrada'?'income':'expense'}`}>{group.nature}</span></div>
          <div className="categoryChips">{group.categories.map(category=><span key={category}>{category}</span>)}</div>
        </article>)}
      </div>
    </section>
    <div className="settingsGrid sectionGap">
      {[{title:'Contas e cartões',text:'Saldos, limites, fechamento e vencimento.',icon:'wallet' as IconName},{title:'Recorrências',text:'Salário, aluguel e serviços por vigência.',icon:'calendar' as IconName},{title:'Usuários',text:'Acessos e permissões administrativas.',icon:'settings' as IconName},{title:'Segurança e dados',text:'Senha, sessões, exportação e backup.',icon:'dashboard' as IconName}].map(item=><button className="settingCard" key={item.title}><span className="settingIcon"><Icon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.text}</small></span><b>›</b></button>)}
    </div>
  </>
}

function EntryDialog({close,groups}:{close:()=>void;groups:CategoryGroup[]}){
  const[type,setType]=useState<TransactionLabel>('Saída')
  const[groupId,setGroupId]=useState('')
  const[category,setCategory]=useState('')
  const[paymentMethod,setPaymentMethod]=useState('Pix')
  const[installments,setInstallments]=useState('1')
  const[competenceDate,setCompetenceDate]=useState(todayAsInputDate())
  const[settlementDate,setSettlementDate]=useState(todayAsInputDate())
  const[firstInstallmentDate,setFirstInstallmentDate]=useState('')
  const availableGroups=useMemo(()=>groups.filter(group=>group.nature===type),[groups,type])
  const selectedGroup=groups.find(group=>group.id===groupId)
  const isCreditCard=type==='Saída'&&paymentMethod==='Cartão de crédito'
  function changeType(nextType:TransactionLabel){
    setType(nextType)
    setGroupId('')
    setCategory('')
    if(nextType!=='Saída')setPaymentMethod('Pix')
  }
  function changeGroup(nextGroupId:string){setGroupId(nextGroupId);setCategory('')}
  function submit(e:FormEvent){
    e.preventDefault()
    alert('Estrutura validada. O lançamento e suas parcelas serão gravados quando o Supabase estiver conectado.')
    close()
  }
  return <div className="dialogBackdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}>
    <form className="dialog entryDialog" onSubmit={submit}>
      <div className="dialogHeader"><div><h2>Novo lançamento</h2><p>Registre a competência e o efeito no caixa separadamente.</p></div><button type="button" className="iconButton" onClick={close}><Icon name="close"/></button></div>
      <div className="typeTabs">{(['Saída','Entrada','Transferência'] as TransactionLabel[]).map(item=><button type="button" className={type===item?'active':''} onClick={()=>changeType(item)} key={item}>{item}</button>)}</div>
      <div className="formGrid">
        <label className="full">Descrição<input placeholder={type==='Saída'?'Ex.: Compra no supermercado':'Ex.: Salário do mês'} required/></label>
        <label>Valor total<input inputMode="decimal" placeholder="R$ 0,00" required/></label>
        <label>Data de competência<input type="date" value={competenceDate} onChange={e=>setCompetenceDate(e.target.value)} required/><small className="fieldHint">Data da compra ou do fato gerador. Hoje vem preenchido automaticamente.</small></label>
        {type!=='Transferência'&&<>
          <label>Grupo<select value={groupId} onChange={e=>changeGroup(e.target.value)} required><option value="">Selecionar grupo</option>{availableGroups.map(group=><option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
          <label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)} disabled={!selectedGroup} required><option value="">Selecionar categoria</option>{selectedGroup?.categories.map(item=><option key={item}>{item}</option>)}</select></label>
        </>}
        {type==='Saída'&&<label>Tipo de pagamento<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>Pix</option><option>Dinheiro</option><option>Transferência</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Boleto</option><option>Débito automático</option><option>Outro</option></select></label>}
        <label>{isCreditCard?'Cartão':'Conta'}<select required><option value="principal">{isCreditCard?'Cartão principal (exemplo)':'Conta principal (exemplo)'}</option></select></label>
        {!isCreditCard&&<label>Data de {type==='Entrada'?'recebimento':'pagamento'}<input type="date" value={settlementDate} onChange={e=>setSettlementDate(e.target.value)} required/><small className="fieldHint">Data em que o valor entra ou sai do caixa.</small></label>}
        {isCreditCard&&<>
          <label>Quantidade de parcelas<select value={installments} onChange={e=>setInstallments(e.target.value)}>{Array.from({length:24},(_,index)=>index+1).map(number=><option value={number} key={number}>{number}x</option>)}</select></label>
          <label>Data da primeira parcela<input type="date" value={firstInstallmentDate} onChange={e=>setFirstInstallmentDate(e.target.value)} required/><small className="fieldHint">As demais serão programadas mês a mês.</small></label>
          <div className="installmentBox full"><Icon name="calendar"/><div><strong>Competência preservada em {competenceDate.split('-').reverse().join('/')}</strong><p>O valor total pertence à data da compra. As {installments} parcela{installments==='1'?'':'s'} afetam apenas o fluxo de caixa a partir da primeira data informada.</p></div></div>
        </>}
        <label>Situação<select><option>Realizado</option><option>Previsto</option></select></label>
        <label className="full">Observação<input placeholder="Inclua um detalhe para facilitar a busca"/></label>
      </div>
      <div className="dialogFooter"><button type="button" className="secondaryButton" onClick={close}>Cancelar</button><button type="submit" className="primaryButton">Salvar lançamento</button></div>
    </form>
  </div>
}

function AppShell({session,previewMode=false}:{session?:Session|null;previewMode?:boolean}){
  const initial=(location.hash.replace('#/','') as PageId)||'dashboard'
  const[page,setPage]=useState<PageId>(navigation.some(item=>item.id===initial)||initial==='settings'?initial:'dashboard')
  const[menuOpen,setMenuOpen]=useState(false)
  const[entryOpen,setEntryOpen]=useState(false)
  const[categoryGroups,setCategoryGroups]=useState<CategoryGroup[]>(defaultCategoryGroups)
  const currentLabel=useMemo(()=>[...navigation,{id:'settings' as PageId,label:'Configurações'}].find(item=>item.id===page)?.label||'Visão geral',[page])
  function navigate(id:PageId){setPage(id);setMenuOpen(false);location.hash=`/${id}`;window.scrollTo({top:0,behavior:'smooth'})}
  function addGroup(name:string,nature:CategoryNature){
    setCategoryGroups(current=>current.some(group=>group.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&group.nature===nature)?current:[...current,{id:`grupo-${Date.now()}`,name,nature,categories:[]}])
  }
  function addCategory(groupId:string,name:string){
    setCategoryGroups(current=>current.map(group=>group.id===groupId&&!group.categories.some(category=>category.toLocaleLowerCase()===name.toLocaleLowerCase())?{...group,categories:[...group.categories,name]}:group))
  }
  async function signOut(){if(session)await supabase?.auth.signOut()}
  const pages:Record<PageId,ReactNode>={
    dashboard:<DashboardPage openEntry={()=>setEntryOpen(true)}/>,
    transactions:<TransactionsPage openEntry={()=>setEntryOpen(true)}/>,
    payables:<PayablesPage/>,
    loans:<LoansPage/>,
    vehicles:<VehiclesPage/>,
    investments:<InvestmentsPage/>,
    comparisons:<ComparisonsPage/>,
    projections:<ProjectionsPage/>,
    settings:<SettingsPage groups={categoryGroups} onAddGroup={addGroup} onAddCategory={addCategory}/>,
  }
  return <div className="appShell">
    <aside className={menuOpen?'open':''}><Brand/><span className="navSection">Principal</span><nav>{navigation.map(item=><button key={item.id} className={page===item.id?'active':''} onClick={()=>navigate(item.id)}><Icon name={item.id}/>{item.label}</button>)}</nav><span className="navSection">Conta</span><nav><button className={page==='settings'?'active':''} onClick={()=>navigate('settings')}><Icon name="settings"/>Configurações</button></nav><div className="profile"><span>HV</span><div><strong>{session?.user.email?.split('@')[0]||'Henrique'}</strong><small>{previewMode?'Modo estrutura':'Usuário conectado'}</small></div><button onClick={signOut}>{session?'Sair':''}</button></div></aside>
    {menuOpen&&<button className="menuOverlay" onClick={()=>setMenuOpen(false)}/>}
    <main className="workspace"><header className="topbar"><button className="mobileMenu" onClick={()=>setMenuOpen(true)}><Icon name="menu"/></button><div><small>{pageHelp[page]}</small><h1>{currentLabel}</h1></div><div className="topActions"><button className="iconButton"><Icon name="bell"/></button><button className="primaryButton topNew" onClick={()=>setEntryOpen(true)}><Icon name="plus" size={17}/>Novo lançamento</button></div></header>{previewMode&&<div className="previewBanner"><span>Visualização da estrutura</span><p>Dados reais e conexão com o Supabase ainda não foram adicionados.</p></div>}<div className="workspaceContent">{pages[page]}</div></main>
    {entryOpen&&<EntryDialog close={()=>setEntryOpen(false)} groups={categoryGroups}/>} 
  </div>
}
function SetupNotice({preview}:{preview:()=>void}){return <main className="setupPage"><section className="setupCard"><Brand/><span className="status">Estrutura em validação</span><h1>O painel já pode ser revisado antes da conexão com os dados.</h1><p>Navegue pelas telas, confira a organização e valide o uso no computador e no celular. Nenhum dado real será incluído nesta etapa.</p><div className="setupActions"><button className="primaryButton" onClick={preview}>Visualizar estrutura</button></div><div className="codeList"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div><p className="securityNote">As variáveis serão configuradas somente depois da aprovação desta estrutura.</p></section></main>}
function Login(){const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false);async function submit(e:FormEvent){e.preventDefault();if(!supabase)return;setLoading(true);setMessage('');const{error}=await supabase.auth.signInWithPassword({email,password});setLoading(false);if(error)setMessage('Não foi possível entrar. Confira o e-mail e a senha.')}return <main className="loginPage"><section className="loginIntro"><Brand/><div><span className="eyebrow">Controle financeiro pessoal</span><h1>Suas finanças organizadas em um só lugar.</h1><p>Lançamentos, empréstimos, veículos e investimentos com dados protegidos por usuário.</p></div><small>Os valores de cada perfil permanecem separados.</small></section><section className="loginPanel"><form className="loginCard" onSubmit={submit}><h2>Entrar</h2><p>Acesse o seu painel financeiro.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<div className="error">{message}</div>}<button type="submit" className="primaryButton" disabled={loading}>{loading?'Entrando...':'Entrar'}</button><button type="button" className="textButton">Esqueci minha senha</button></form></section></main>}
export default function App(){const[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(hasSupabaseConfig),[preview,setPreview]=useState(false);useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));return()=>data.subscription.unsubscribe()},[]);if(!hasSupabaseConfig&&!preview)return<SetupNotice preview={()=>setPreview(true)}/>;if(!hasSupabaseConfig&&preview)return<AppShell previewMode/>;if(loading)return<main className="loading">Carregando...</main>;return session?<AppShell session={session}/>:<Login/>}
