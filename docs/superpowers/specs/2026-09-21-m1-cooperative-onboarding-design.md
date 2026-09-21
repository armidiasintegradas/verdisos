# VERDIS M1 — Cooperative Onboarding Design

Status: **pronto para implementação após conexão do projeto Supabase VERDIS**  
Data: **21/09/2026**

## 1. Objetivo

Permitir que um usuário autenticado, ainda sem membership ativo, inicialize com segurança a primeira organização cooperativa dentro de um tenant próprio, sem permitir escrita direta do frontend nas tabelas críticas de tenancy.

O onboarding deve transformar:

`auth.users` sem escopo → perfil → tenant → organização → unidade → membership `cooperative_manager`

em **uma única operação transacional server-side**.

## 2. Invariantes de segurança

- o frontend não recebe INSERT direto em `tenants`, `organizations`, `units` ou `memberships`;
- o usuário precisa estar autenticado via `auth.uid()`;
- o usuário só pode executar o bootstrap se ainda não possuir membership ativo;
- o membership inicial só pode apontar para o próprio `auth.uid()`;
- o papel inicial é resolvido pelo código `cooperative_manager`, nunca aceito arbitrariamente do cliente;
- tenant, organização e unidade criados na operação devem pertencer ao mesmo escopo;
- a operação é atômica: falha em qualquer etapa reverte tudo;
- nenhum dado de autorização vem de `user_metadata`;
- o RPC deve revogar EXECUTE de `PUBLIC` e `anon`, concedendo apenas a `authenticated`;
- toda criação precisa entrar na trilha de auditoria existente;
- o slug precisa ser validado e único;
- CNPJ/CPF ou tax_id continua opcional no bootstrap inicial, mas deve respeitar unicidade quando informado.

## 3. Contrato proposto

RPC pública controlada:

`bootstrap_cooperative_account(...)`

Entrada:

- `p_tenant_slug text`
- `p_tenant_name text`
- `p_organization_legal_name text`
- `p_organization_display_name text`
- `p_tax_id text default null`
- `p_unit_name text`
- `p_unit_code text`
- `p_display_name text default null`

Saída:

- `tenant_id uuid`
- `organization_id uuid`
- `unit_id uuid`
- `membership_id uuid`
- `role_id uuid`

## 4. Regras de domínio

1. rejeitar usuário não autenticado;
2. rejeitar usuário com membership ativo;
3. validar slug;
4. localizar role built-in `cooperative_manager`;
5. upsert apenas do próprio `user_profiles.user_id = auth.uid()`;
6. criar tenant;
7. criar organização;
8. criar unidade;
9. criar membership ativo para o usuário corrente;
10. devolver IDs do escopo;
11. o frontend chama `ScopeProvider.reload()` após sucesso;
12. o novo escopo passa a ser selecionado automaticamente.

## 5. UX

Quando o usuário estiver autenticado e `memberships.length === 0`, o `ScopeBoundary` deve renderizar uma tela de onboarding em vez de uma mensagem terminal.

Campos mínimos:

- Nome da cooperativa;
- Razão social;
- CNPJ opcional;
- Nome da unidade;
- Código da unidade;
- Nome do gestor.

A aplicação pode sugerir o slug, mas o backend continua sendo a autoridade da validação.

## 6. Estados

- carregando;
- formulário inicial;
- validando;
- criando organização;
- sucesso / carregando escopo;
- slug indisponível;
- tax_id duplicado;
- conta já vinculada a um escopo;
- falha inesperada com retry seguro.

## 7. Testes de banco obrigatórios

- usuário anônimo não executa;
- usuário autenticado sem membership cria um único escopo;
- usuário com membership ativo é bloqueado;
- chamada repetida não cria segundo tenant;
- role arbitrária não pode ser injetada;
- membership pertence ao usuário chamador;
- unidade pertence à organização criada;
- tenant/org/unit consistentes;
- rollback completo em falha intermediária;
- isolamento entre usuários/tenants;
- `PUBLIC` e `anon` sem EXECUTE;
- RLS continua bloqueando INSERT direto.

## 8. Testes web obrigatórios

- usuário sem membership vê onboarding;
- submit válido chama o RPC;
- sucesso recarrega memberships;
- novo escopo torna-se ativo;
- erros conhecidos aparecem de forma amigável;
- formulário não permite duplo submit;
- nenhuma fixture demo aparece durante o onboarding.

## 9. Dependências externas

Antes de habilitar o fluxo em produção:

- projeto Supabase VERDIS conectado;
- Auth Site URL configurada;
- Redirect URLs configuradas;
- SMTP de produção configurado;
- política de criação de contas definida (convite/admin ou signup controlado).

## 10. Critério de aceite

O onboarding é considerado concluído quando um usuário real consegue:

`Entrar → criar cooperativa → entrar automaticamente no novo escopo → registrar recebimento → consultar estoque → registrar venda → consultar documentos/auditoria`

sem uso de IDs seed, fixtures ou fallback demo.
