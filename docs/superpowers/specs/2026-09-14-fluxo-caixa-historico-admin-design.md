# Fluxo de Caixa Histórico, Projeções e Administração — Design

## Objetivo
Transformar o Meu Fluxo em uma base financeira histórica e projetada, importando `dados(2).xlsx`, preservando flexibilidade de classificação e adicionando ferramentas gerenciais e administrativas.

## Dados e importação
- Limpar somente os 36 lançamentos de teste de salário e a regra recorrente atualmente cadastrada.
- Preservar grupos, categorias, usuários, RLS e demais estruturas.
- Importar 721 registros da planilha.
- Registros com data até 2026-09-14: `completed`.
- Registros após 2026-09-14: `planned`.
- A coluna DATA do legado alimenta `competence_date` e `settlement_date`.
- MÊS e ANO não são importados por serem derivados da data.
- Identificar registros importados com `source='legacy_import'` e guardar uma chave de origem para rastreabilidade.
- Preservar duplicidades exatas da planilha; não deduplicar automaticamente.

## Normalização de classificação
Mapear os valores antigos para os IDs atuais:
- FATURAMENTO LÍQUIDO -> Receitas ou Investimentos e rendimentos, conforme categoria.
- MATERIAIS -> Materiais e compras.
- RECARGA VIVO -> Recarga de celular.
- ACESSÓRIOS E MANUTENÇÕES VEICULAR -> Manutenção e acessórios.
- AQUISIÇÃO DA MOTO -> Aquisição de veículo.
- Demais categorias usam correspondência por nome normalizado.

Os lançamentos sempre se relacionam por ID. Renomear ou mover categorias/grupos depois não quebra o histórico.

## Dashboard
Adicionar três escopos:
1. Fluxo de caixa realizado: somente `completed` até a data atual.
2. Fluxo de caixa projetado: somente `planned` futuros.
3. Consolidado: realizado + projetado.

Adicionar filtro expansível com:
- Todo período
- Ano
- Mês
- Intervalo personalizado
- Grupo
- Categoria

KPIs, gráficos e tabelas devem obedecer ao mesmo filtro.

## Projeções
A página Projeções usa apenas movimentos previstos reais (parcelas, recorrências e contas futuras). Mostrar entradas previstas, saídas previstas, saldo acumulado e série temporal projetada.

## Lançamentos
- Checkbox por linha.
- Selecionar todos os registros visíveis.
- Exclusão em massa com confirmação.
- Edição continua disponível por registro.

## Administração de usuários
- Henrique é administrador (`profiles.is_admin=true`).
- Usuários administradores enxergam uma área Configurações > Usuários.
- A criação de usuários ocorre por uma Edge Function segura no Supabase usando credencial administrativa no servidor, nunca no frontend.
- Cada usuário criado usa Supabase Auth normal e recebe perfil próprio.
- RLS mantém dados financeiros separados entre usuários.

## Segurança
- Nenhuma service role key será commitada no GitHub.
- RLS permanece habilitado.
- Operações administrativas passam por Edge Function e verificação de `profiles.is_admin`.

## Validação
Após importação, conferir:
- 721 registros importados.
- 712 realizados e 9 previstos.
- Entradas históricas: R$ 56.142,94.
- Saídas históricas: R$ 55.222,81.
- Saídas futuras: R$ 461,32.
- Nenhuma entrada futura na planilha.

Build do frontend deve passar antes de merge para `main`.