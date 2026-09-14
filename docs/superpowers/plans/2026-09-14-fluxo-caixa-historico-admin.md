# Fluxo de Caixa Histórico e Administração Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar a base histórica real, separar realizado/projetado, permitir exclusão em massa e habilitar gestão administrativa de usuários.

**Architecture:** O banco recebe campos de rastreabilidade em `transactions` e uma Edge Function administrativa. O frontend ganha filtros reutilizáveis e modos de dashboard sem alterar a separação por RLS. A importação será executada diretamente no Supabase e validada por contagens e totais antes da publicação.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Postgres/Auth/Edge Functions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-14-fluxo-caixa-historico-admin-design.md`

## Global Constraints
- Não commitar chave `service_role`.
- Preservar RLS por usuário.
- Não deduplicar automaticamente a planilha.
- Data de corte histórico: 2026-09-14.
- Build `npm run build` deve passar antes do merge.

---

### Task 1: Evolução do schema
**Files:**
- Create: `supabase/migrations/003_history_admin.sql`

**Produces:** `transactions.source`, `transactions.source_ref`, perfil administrativo e índice de rastreabilidade.

- [ ] Criar migration aditiva e idempotente.
- [ ] Aplicar migration no projeto Supabase.
- [ ] Marcar o perfil de Henrique como administrador.
- [ ] Verificar RLS/advisors.

### Task 2: Limpeza controlada e importação do legado
**Files:**
- Create: `supabase/imports/legacy_2024_2027.sql` (sem dados sensíveis além dos movimentos financeiros já autorizados; repositório é público, portanto este arquivo NÃO será commitado. A importação será executada diretamente no Supabase.)

**Produces:** 721 transações importadas com rastreabilidade.

- [ ] Apagar somente os 36 lançamentos de teste e 1 regra recorrente existentes.
- [ ] Resolver IDs de categorias por nome normalizado.
- [ ] Inserir 721 linhas com `source='legacy_import'` e `source_ref='dados2:<linha>'`.
- [ ] Marcar datas <= 2026-09-14 como `completed` e futuras como `planned`.
- [ ] Validar 721 total, 712 completed, 9 planned e totais financeiros da especificação.

### Task 3: Filtros e dashboard de fluxo de caixa
**Files:**
- Modify: `src/AppV2.tsx`
- Modify: `src/pro.css`

**Produces:** filtros de escopo, período, ano, mês, grupo e categoria; KPIs/gráficos sincronizados.

- [ ] Criar tipos `CashFlowScope` e `PeriodMode`.
- [ ] Criar função pura para filtrar transações pelo escopo e período.
- [ ] Adicionar controles Realizado / Projetado / Consolidado.
- [ ] Adicionar painel expansível de filtros.
- [ ] Atualizar KPIs, gráficos e breakdowns para usar o conjunto filtrado.
- [ ] Garantir responsividade.

### Task 4: Exclusão em massa
**Files:**
- Modify: `src/AppV2.tsx`
- Modify: `src/pro.css`

**Produces:** seleção por checkbox e exclusão múltipla.

- [ ] Adicionar estado `selectedTransactionIds`.
- [ ] Adicionar checkbox por linha e selecionar todos os registros visíveis.
- [ ] Mostrar ação contextual `Excluir selecionados`.
- [ ] Confirmar antes de excluir.
- [ ] Excluir no Supabase respeitando RLS e atualizar a tela.

### Task 5: Projeções de caixa
**Files:**
- Modify: `src/AppV2.tsx`
- Modify: `src/pro.css`

**Produces:** série temporal de saldo projetado baseada apenas em `planned` futuros.

- [ ] Agrupar movimentos previstos por mês/data.
- [ ] Calcular entradas, saídas e saldo acumulado.
- [ ] Mostrar KPIs e gráfico de fluxo projetado.
- [ ] Reutilizar filtros de período quando aplicável.

### Task 6: Administração de usuários
**Files:**
- Create: `supabase/functions/admin-create-user/index.ts`
- Modify: `src/AppV2.tsx`
- Modify: `src/pro.css`

**Produces:** fluxo de convite/criação de usuário acessível somente para administradores.

- [ ] Edge Function valida JWT do chamador.
- [ ] Edge Function consulta `profiles.is_admin`.
- [ ] Edge Function cria usuário por `auth.admin.createUser` com senha temporária ou convite.
- [ ] Frontend carrega perfil atual e só mostra Gestão de usuários para admin.
- [ ] Formulário permite nome, e-mail e senha temporária.
- [ ] Nunca expor service role no frontend.

### Task 7: Verificação e publicação
**Files:**
- Modify only if fixes are required by verification.

- [ ] Rodar build pelo GitHub Actions na branch/PR.
- [ ] Conferir status do commit e logs se necessário.
- [ ] Criar/mergear PR para `main` após sucesso.
- [ ] Conferir deploy do GitHub Pages.
- [ ] Revalidar contagens/totais no Supabase após deploy.