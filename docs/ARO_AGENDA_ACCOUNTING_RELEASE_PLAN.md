# AROLAB Agenda + Accounting Release Plan

## Escopo da release conjunta

Esta release junta:

- datas dinâmicas;
- Agenda administrativa baseada em `jobs`, `job_models` e `model_calendar_blocks`;
- seletor direto de mês e ano em `/admin/calendar`;
- redirects de `/admin/jobs` para `/admin/calendar`;
- Accounting em `/admin/accounting`;
- redirects de `/admin/finance` para `/admin/accounting`;
- campos fiscais e de faturamento no CRM de clientes;
- migrations oficiais `010` a `015`;
- testes de cálculo financeiro ARO e PDF.

Não entram nesta release:

- Notificações;
- IA;
- PRs antigos fora do empilhamento da Agenda + Accounting.

## Sequência oficial de migrations reservada

Aplicar nesta ordem:

1. `010_agenda_event_types.sql`
2. `011_accounting_base.sql`
3. `012_accounting_receipts_integrity.sql`
4. `013_model_accounting_entries_plans.sql`
5. `014_clients_billing_tax_fields.sql`
6. `015_accounting_hardening_reconciliation.sql`

Observação: PR #5 possui uma migration antiga também chamada `010`; PR #6 possui outra migration antiga também chamada `010`. Esses PRs não fazem parte desta release. Quando forem retomados, suas migrations devem ser renumeradas para números posteriores a `015`.

## Objetos criados

- Tipo `public.finance_currency`: `BRL`, `USD`, `EUR`.
- Tabela `public.financial_job_entries`.
- Tabela `public.financial_job_payment_receipts`.
- Tabela `public.model_accounting_plans`.
- Tabela `public.model_accounting_entries`.
- Funções de lock, validação, saldo disponível, bloqueio de overpayment, bloqueio de payout acima de saldo e bloqueio de exclusão.
- View `public.accounting_backfill_audit`.
- Políticas RLS admin-only para tabelas financeiras.

## Tabelas alteradas

- `public.clients`: adiciona campos fiscais Brasil, campos internacionais, contato financeiro, prazo de pagamento, moeda padrão, notas fiscais e notas tributárias.
- `public.job_models`: recebe trigger de proteção contra remoção quando houver recebimento contabilizado vinculado.
- `public.financial_job_entries`: recebe trigger de proteção contra alteração material após recebimento.

## Estimativa de backfill

Antes da aplicação remota, executar apenas leitura:

```sql
select
  count(*) as total_job_models,
  count(*) filter (where jm.fee_amount is not null) as deterministic_fee_amount,
  count(*) filter (where jm.fee_amount is null) as review_required_missing_fee,
  count(*) filter (where j.status in ('canceled', 'declined')) as ignored_or_review_canceled_declined
from public.job_models jm
join public.jobs j on j.id = jm.job_id;
```

O backfill automático deve usar `job_models.fee_amount` como cachê base apenas quando preenchido. Casos sem `fee_amount` ou com status operacional ambíguo ficam `financial_review_required = true`.

## Queries de auditoria pós-migration

```sql
select * from public.accounting_backfill_audit;

select currency, count(*)
from public.financial_job_entries
group by currency
order by currency;

select financial_review_required, count(*)
from public.financial_job_entries
group by financial_review_required;

select status, count(*)
from public.financial_job_payment_receipts
group by status;

select status, entry_type, count(*)
from public.model_accounting_entries
group by status, entry_type
order by status, entry_type;
```

Não registrar nomes de clientes, modelos ou dados pessoais nos logs de auditoria.

## Riscos

- Aplicar migrations fora de ordem pode deixar o Accounting indisponível.
- Enums adicionados no PostgreSQL não são removidos de forma simples.
- Trabalhos antigos com valores financeiros nulos exigem revisão manual.
- Recebimentos e lançamentos contabilizados passam a ter histórico protegido.
- PRs antigos com migrations duplicadas `010` precisam renumeração antes de voltar ao empilhamento.

## Estratégia de backup

Antes de aplicar no Supabase remoto:

1. Criar backup completo pelo painel Supabase ou CLI autorizado.
2. Confirmar data/hora do backup.
3. Confirmar que o backup contempla schema e dados.
4. Registrar o identificador do backup fora do repositório.
5. Só então aplicar migrations.

Como confirmar:

- Verificar que o backup aparece como concluído no painel Supabase.
- Registrar timestamp e responsável.
- Fazer uma consulta somente leitura simples após o backup para confirmar conectividade.

## Procedimento de aplicação

Parar antes deste ponto até autorização final.

Após autorização:

1. Confirmar backup.
2. Aplicar migrations na ordem oficial.
3. Rodar queries de auditoria.
4. Abrir `/admin/calendar`.
5. Abrir `/admin/accounting`.
6. Validar recebimento parcial, recebimento integral, overpayment bloqueado, anulação, despesa, plano recorrente, payout e PDF.
7. Manter PR #11 como draft até validação final.

## Validação pós-migration

- Agenda abre sem depender de colunas fiscais.
- Accounting deixa de exibir painel de schema pendente.
- RLS financeiro permite admin e bloqueia não admin.
- Hard delete de recibos e lançamentos contábeis é bloqueado para qualquer status.
- Payout acima do saldo disponível é bloqueado.
- Plano semanal e mensal cria ocorrências.
- PDF abre inline e baixa com nome `AROLAB-NOME-MODELO-BRL-EXTRATO.pdf`.

## Rollback lógico

- Não apagar histórico financeiro contabilizado.
- Correções devem ser por anulação ou lançamento compensatório.
- Se o Accounting precisar ser pausado, remover temporariamente o link de navegação em nova migration/commit e manter tabelas preservadas.
- Para rollback de dados, restaurar backup ou aplicar migration corretiva forward-only.

## Checkpoint atual

Nenhuma migration foi aplicada ao Supabase remoto nesta etapa. O próximo passo que modifica banco remoto está bloqueado aguardando autorização final.
