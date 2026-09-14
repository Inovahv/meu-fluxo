# Meu Fluxo

Sistema pessoal de controle financeiro com React, TypeScript e Supabase.

## Estado atual

- Estrutura inicial do frontend
- Login por e-mail e senha com Supabase Auth
- Banco inicial com isolamento por usuário (RLS)
- Fluxo de publicação pelo GitHub Pages
- Sem dados pessoais ou credenciais no repositório

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha a URL e a chave pública do Supabase.
3. Execute `npm install`.
4. Execute `npm run dev`.

## Banco de dados

Execute `supabase/migrations/001_initial_schema.sql` no SQL Editor do Supabase. A migração cria as tabelas iniciais e ativa as políticas que impedem um usuário de consultar os registros de outro.

## Segurança

Não inclua senha do banco, chave `service_role`, CPF, planilhas ou extratos reais no GitHub. A chave pública do Supabase pode ser usada pelo frontend somente com RLS corretamente ativado.
