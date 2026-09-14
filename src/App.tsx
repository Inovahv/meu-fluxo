import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from './lib/supabase'

function Brand() {
  return (
    <div className="brand">
      <span className="brandMark" aria-hidden="true">
        <i /><i /><i />
      </span>
      <span><strong>Meu Fluxo</strong><small>Finanças pessoais</small></span>
    </div>
  )
}

function SetupNotice() {
  return (
    <main className="setupPage">
      <section className="setupCard">
        <Brand />
        <span className="status">Primeira etapa concluída</span>
        <h1>Estrutura pronta para conectar ao Supabase</h1>
        <p>O código inicial, a autenticação e a estrutura segura do banco já estão preparados. Falta cadastrar as duas variáveis públicas do projeto.</p>
        <div className="codeList">
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
        </div>
        <p className="securityNote">Senhas do banco e chaves administrativas nunca devem ser incluídas no código.</p>
      </section>
    </main>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setMessage('Não foi possível entrar. Confira o e-mail e a senha.')
  }

  return (
    <main className="loginPage">
      <section className="loginIntro">
        <Brand />
        <div>
          <span className="eyebrow">Controle financeiro pessoal</span>
          <h1>Suas finanças organizadas em um só lugar.</h1>
          <p>Acompanhe lançamentos, empréstimos, veículos e investimentos com os dados protegidos por usuário.</p>
        </div>
        <small>Os valores de cada perfil permanecem separados.</small>
      </section>
      <section className="loginPanel">
        <form className="loginCard" onSubmit={handleSubmit}>
          <h2>Entrar</h2>
          <p>Acesse o seu painel financeiro.</p>
          <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {message && <div className="error" role="alert">{message}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
          <button type="button" className="textButton">Esqueci minha senha</button>
        </form>
      </section>
    </main>
  )
}

function Dashboard({ session }: { session: Session }) {
  async function signOut() { await supabase?.auth.signOut() }
  return (
    <div className="dashboard">
      <aside>
        <Brand />
        <nav>
          <button className="active">Visão geral</button>
          <button>Lançamentos</button>
          <button>Empréstimos</button>
          <button>Veículos</button>
          <button>Investimentos</button>
          <button>Comparações</button>
          <button>Projeções</button>
        </nav>
        <button className="signOut" onClick={signOut}>Sair</button>
      </aside>
      <main>
        <header><div><span className="eyebrow">Painel financeiro</span><h1>Visão geral</h1></div><button className="primary">Novo lançamento</button></header>
        <div className="content">
          <div className="welcome"><div><h2>Base segura conectada</h2><p>Sessão ativa para {session.user.email}. Os indicadores serão preenchidos após a importação validada dos lançamentos.</p></div><span className="status">Conectado</span></div>
          <div className="metrics">
            {['Entradas no mês','Saídas no mês','Resultado do mês','Saldo acumulado'].map(label => <article key={label}><span>{label}</span><strong>R$ 0,00</strong><small>Aguardando importação</small></article>)}
          </div>
          <section className="emptyState"><span className="emptyIcon">+</span><h3>Próximo passo: importar os lançamentos</h3><p>A planilha será revisada antes da inclusão para separar valores realizados de parcelas futuras.</p></section>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!hasSupabaseConfig) return <SetupNotice />
  if (loading) return <main className="loading">Carregando...</main>
  return session ? <Dashboard session={session} /> : <Login />
}
