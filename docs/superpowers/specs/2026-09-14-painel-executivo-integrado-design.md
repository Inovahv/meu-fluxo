# Painel Executivo Integrado — Especificação de Design

**Data:** 14/09/2026  
**Projeto:** Meu Fluxo  
**Repositório:** `Inovahv/meu-fluxo`  
**Base aprovada:** livro-caixa único, Caixa como padrão, Competência como alternativa e Empréstimos isolados

## 1. Objetivo

Evoluir o Meu Fluxo para uma interface gerencial profissional, responsiva e acessível, usando `transactions` como fonte financeira única. Os módulos Veículos e Investimentos passam a ser leituras analíticas dessa base, sem lançamentos financeiros próprios. Empréstimos continuam como um controle independente e não participam dos totais, gráficos, comparações ou alertas do fluxo de caixa.

## 2. Estado atual confirmado

- O frontend é React 19 + TypeScript + Vite e consulta o Supabase diretamente com `@supabase/supabase-js`.
- O projeto Supabase `Meu-Fluxo` está ativo em `sa-east-1` e usa PostgreSQL 17.
- A base possui 721 lançamentos em `public.transactions`, nove grupos e 39 categorias.
- Todas as tabelas financeiras expostas têm RLS habilitado.
- `transactions` já contém `competence_date`, `settlement_date`, `account_id`, `vehicle_id`, parcelamento, origem e situação.
- `accounts.account_type` já permite distinguir contas de investimento.
- Não é necessária uma nova tabela ou migração de banco para esta etapa.

## 3. Princípios

1. **Fonte única:** todo valor financeiro nasce em `transactions`.
2. **Sem duplicação:** Veículos e Investimentos não criam lançamentos paralelos.
3. **Duas leituras contábeis:** Caixa e Competência usam os mesmos registros, mas datas diferentes.
4. **Configuração separada de movimentação:** veículos e contas de investimento são cadastros auxiliares em Configurações; os valores continuam vindo dos lançamentos.
5. **Empréstimos isolados:** `borrowers`, `loans` e `loan_events` não alimentam o livro-caixa nesta entrega.
6. **Explicabilidade:** cada KPI, alerta e gráfico deve permitir identificar os lançamentos que o compõem.
7. **Mobile primeiro:** a linha do tempo mensal deve aceitar rolagem horizontal por toque e preservar leitura confortável no desktop.

## 4. Regras financeiras

### 4.1 Regime de Caixa

- É a visão padrão do dashboard.
- Usa `settlement_date`; quando ela estiver ausente, usa `competence_date` como fallback explícito.
- Movimentos realizados usam `status = completed`.
- Movimentos projetados usam `status = planned` e data igual ou posterior à data de referência.
- Registros cancelados não participam de nenhum indicador.

### 4.2 Regime de Competência

- Usa sempre `competence_date`.
- Mantém a mesma separação entre realizado, projetado e consolidado.
- Uma compra parcelada preserva a data original da compra em todas as parcelas geradas.
- Exemplo: R$ 500 em 5 parcelas gera cinco movimentos de R$ 100 com datas de caixa mensais, mas todos mantêm a competência da compra. Assim, Caixa mostra R$ 100 por mês e Competência reconhece R$ 500 no mês original.

### 4.3 Parcelamento

- O valor total é dividido em centavos para evitar erro de arredondamento.
- Eventual diferença de centavos fica na primeira parcela.
- `firstInstallmentDate` define a primeira data de caixa.
- `competenceDate` nunca é substituída pela data da parcela.
- `installment_group_id`, `installment_number` e `installment_total` continuam identificando a série.

### 4.4 Saldos

- Saldo atual = soma dos saldos iniciais das contas + entradas realizadas − saídas realizadas.
- Resultado mensal = entradas − saídas.
- Saldo acumulado da linha do tempo parte do saldo inicial informado ao cálculo e adiciona cada resultado mensal.
- Transferências e ajustes não entram como receita ou despesa nesta entrega.

## 5. Integração dos módulos

### 5.1 Veículos

- A página Veículos é exclusivamente analítica e não possui botão de lançamento financeiro.
- O cadastro do bem fica em `Configurações > Veículos`.
- O editor de Saída exibe `Veículo (opcional)` para que combustível, manutenção, IPVA, seguro, licenciamento e outras despesas sejam vinculadas.
- A página oferece seletor de ano e seletor de veículo.
- Para cada veículo, mostra total anual real, média mensal anual (`total / 12`), mês de maior custo e distribuição real mês a mês.
- Meses sem gasto aparecem com zero; custos anuais permanecem no mês real e a média mensal aparece separadamente, sem alterar o livro-caixa.

### 5.2 Investimentos

- A página Investimentos é exclusivamente analítica e não possui botão `Adicionar investimento`.
- Contas com `account_type = investment` são configuradas em `Configurações > Contas`.
- O painel usa apenas lançamentos cujo `account_id` pertence a uma conta de investimento.
- Mostra saldo calculado, entradas/rendimentos registrados, saídas/resgates/taxas e movimentação mensal.
- O módulo não replica nem move transações; editar um lançamento atualiza automaticamente todas as análises.

### 5.3 Empréstimos

- Continua usando exclusivamente `borrowers`, `loans` e `loan_events`.
- Não participa do saldo das contas, timeline, investimentos, veículos, comparações ou alertas gerais.
- A regra atual de juros compostos proporcionais aos dias permanece intacta.

## 6. Dashboard executivo

### 6.1 Barra de contexto

- Alternância `Caixa | Competência` sempre visível.
- Escopo `Realizado | Projetado | Consolidado`.
- Filtros por período, grupo e categoria.
- Texto curto explica qual data está sendo usada.

### 6.2 KPIs

Quatro cartões principais:

1. Entradas.
2. Saídas.
3. Resultado líquido.
4. Saldo das contas.

Entradas, Saídas e Resultado exibem variação percentual contra o mês anterior quando houver base comparável. O sentido visual deve considerar que aumento de despesa é desfavorável e aumento de receita ou resultado é favorável.

### 6.3 Linha do tempo mensal

- Trilho horizontal rolável com `scroll-snap`, utilizável com toque, mouse e teclado.
- Cada cartão contém mês/ano, Entradas, Saídas, Resultado e Saldo acumulado.
- O mês selecionado recebe destaque e atualiza a leitura contextual do dashboard.
- A lista preenche meses vazios entre o primeiro e o último mês do intervalo.
- A posição inicial prioriza o mês atual quando ele existir; caso contrário, o último mês disponível.

### 6.4 Gráfico gerencial

- Alternância `Colunas | Linhas`.
- Entradas em verde-petróleo, Saídas em vermelho controlado e Resultado em azul.
- O gráfico usa os mesmos pontos da linha do tempo, evitando divergência de cálculo.
- Legenda contém texto e marcador; informação nunca depende apenas da cor.

### 6.5 Alertas

Regras determinísticas, sem inteligência artificial e sem custo externo:

- **Crítico:** resultado do último mês menor que zero.
- **Atenção:** despesas aumentaram 15% ou mais contra o mês anterior.
- **Positivo:** despesas diminuíram 10% ou mais contra o mês anterior.
- **Informativo:** não existe mês anterior comparável ou o período está sem movimentos.

Cada alerta explica o valor ou percentual que originou a mensagem.

## 7. Comparações e projeções

- Comparações respeitam a alternância Caixa/Competência.
- A tabela mantém Entradas, Saídas e Resultado, acrescentando leitura de tendência favorável/desfavorável.
- Projeções continuam baseadas em movimentos `planned` e exibem saldo acumulado.
- O dashboard e a página Projeções compartilham funções centrais para não divergirem.

## 8. Tema e identidade visual

### 8.1 Preferência

- Opções `Claro`, `Escuro` e `Automático` em Configurações.
- A preferência é salva localmente por ID de usuário, sem armazenar dado financeiro e sem exigir migração.
- `Automático` acompanha `prefers-color-scheme`.

### 8.2 Tokens de cor

Tema claro:

- fundo `#f4f7fb`;
- superfície `#ffffff`;
- texto `#172033`;
- primária `#2563eb`;
- entrada `#0f8f68`;
- saída `#cf4555`.

Tema escuro:

- fundo `#08111f`;
- superfície `#111d2f`;
- superfície elevada `#17263b`;
- texto `#edf4ff`;
- primária `#72a2ff`;
- entrada `#46c79a`;
- saída `#ff7b88`.

### 8.3 Acessibilidade

- Contraste mínimo de texto normal alinhado ao WCAG AA.
- Estados positivos e negativos combinam cor, ícone, sinal e texto.
- Foco de teclado visível em botões, campos e cartões interativos.
- Controles têm `aria-label`, `aria-pressed` ou rótulos semânticos quando necessário.
- Animações respeitam `prefers-reduced-motion`.

## 9. Segurança e Supabase

- O frontend usa somente chave pública/publicável; nunca recebe `service_role`.
- Consultas continuam protegidas por RLS com propriedade por `auth.uid()`.
- Nenhum dado financeiro é adicionado ao GitHub.
- Nenhuma migração será aplicada nesta etapa, porque o esquema existente já suporta a integração.
- A aplicação deve continuar funcionando se contas ou veículos ainda não tiverem sido cadastrados, exibindo estados vazios orientativos.

## 10. Estrutura de código

- `src/managerialCore.ts`: cálculos mensais, comparações, alertas, veículos e investimentos.
- `src/transactionCore.ts`: geração testável de parcelas.
- `src/themeCore.ts`: resolução e persistência segura da preferência visual.
- `src/AppV3.tsx`: orquestração de dados e composição das páginas.
- `src/executive.css`: tokens de tema, timeline, KPIs, módulos derivados e responsividade.
- `tests/managerialCore.test.mjs`, `tests/transactionCore.test.mjs` e `tests/themeCore.test.mjs`: regressões financeiras e de preferência.

## 11. Critérios de aceite

- Veículos e Investimentos não oferecem lançamento financeiro próprio.
- O editor de Saída permite selecionar um veículo e persiste `vehicle_id`.
- Uma compra parcelada mantém a mesma competência em todas as parcelas.
- Caixa e Competência produzem agrupamentos diferentes quando as datas diferem.
- Timeline mostra Entrada, Saída, Resultado e Saldo para cada mês e rola por toque no mobile.
- Gráficos de linha e coluna usam a mesma série mensal.
- Veículo mostra custo real mensal e média anual dividida por 12.
- Investimentos são derivados de contas `investment` e seus lançamentos.
- Temas Claro, Escuro e Automático funcionam e persistem por usuário no dispositivo.
- Empréstimos não alteram qualquer total geral.
- Testes, typecheck e build terminam sem falhas.

