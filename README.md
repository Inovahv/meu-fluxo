# Meu Fluxo

Sistema pessoal de controle financeiro com React, TypeScript e Supabase.

## Painel executivo integrado

Todos os movimentos do fluxo financeiro vêm de `transactions`. Dashboard, linha do tempo mensal, gráficos, alertas determinísticos, comparações e projeções compartilham essa base. A linha do tempo aceita rolagem por toque e seleção por teclado.

### Caixa e Competência

- **Caixa (padrão):** agrupa pela data de pagamento ou recebimento (`settlement_date`); quando ausente, usa a competência como fallback explícito.
- **Competência:** agrupa pela data original da compra ou receita (`competence_date`), independentemente do pagamento.
- Realizado usa movimentos `completed`; Projetado usa `planned` a partir da data de referência; Consolidado reúne as duas leituras. Cancelados não entram nos indicadores.
- Uma compra de R$ 500 em cinco parcelas gera R$ 100 em cada mês de Caixa e R$ 500 no mês original de Competência. O arredondamento em centavos fica na primeira parcela.

### Veículos e Investimentos

São visões derivadas dos lançamentos, sem cadastro financeiro paralelo. Edite um lançamento para atualizar suas análises.

- Cadastre o veículo em **Configurações > Veículos** e selecione **Veículo (opcional)** ao lançar uma Saída. O módulo mostra gastos reais por mês, total anual, média anual dividida por 12 e mês de maior custo; não redistribui gastos anuais.
- Cadastre a conta em **Configurações > Contas e investimentos**, escolhendo o tipo **Investimento** (`investment`). Vincule os lançamentos a essa conta para acompanhar saldo inicial mais entradas menos saídas realizadas, rendimentos, resgates e taxas registrados.

### Aparência

Em **Configurações > Aparência**, escolha **Claro**, **Escuro** ou **Automático**. Automático acompanha ao vivo a preferência do sistema. A escolha é guardada somente no navegador, por ID de usuário (`meu-fluxo:theme:<id>`), sem gravação no Supabase ou sincronização entre dispositivos. Se o armazenamento estiver bloqueado, a mudança continua funcionando durante a sessão.

### Empréstimos independentes

Empréstimos continuam usando exclusivamente `borrowers`, `loans` e `loan_events`, com juros compostos proporcionais aos dias. Não alimentam o saldo das contas, a linha do tempo, os alertas, as comparações, Veículos ou Investimentos.

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha a URL e a chave pública do Supabase.
3. Execute `npm install`.
4. Execute `npm run dev`.

Use Node.js 24 para executar diretamente os testes que importam módulos TypeScript.

## Verificação local

```bash
node --test tests/*.test.mjs
npm run typecheck
npm run build
```

O build é gerado em `dist/`. Para conferir o resultado localmente, execute `npm run preview`. Faça o smoke test em desktop e em 390 px, nos três temas, incluindo formulários, tabelas, trilho mensal e Empréstimos.

## Banco de dados

O histórico de esquema está em `supabase/migrations/`. O painel integrado pressupõe o esquema existente com contas, veículos e datas de competência/caixa nos lançamentos, protegido por RLS. Esta entrega não exige migração ou alteração no banco. Não reaplique migrações em uma base existente sem revisar seu estado.

## Segurança

Não inclua senha do banco, chave `service_role`, CPF, planilhas ou extratos reais no GitHub. A chave pública do Supabase pode ser usada pelo frontend somente com RLS corretamente ativado.
