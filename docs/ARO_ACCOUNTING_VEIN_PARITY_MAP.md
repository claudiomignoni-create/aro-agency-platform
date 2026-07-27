# ARO Accounting x VEIN Accounting Parity Map

## Objetivo

Portar a paridade funcional do Accounting da VEIN `main` para a AROLAB sem criar um segundo sistema operacional de trabalhos. A Agenda da ARO continua sendo a origem unica para criar, editar, confirmar, cancelar e vincular modelos a trabalhos.

Referencia revisada:
- VEIN repo: `claudiomignoni-create/vein-agency-platform`
- VEIN branch: `main`
- VEIN commit revisado: `df6216ead124eae9efefe8184f999f48423f7305`

Base ARO:
- Branch base: `feat/arolab-agenda-vein-foundation`
- Novo HEAD da Agenda: `7d8c3818c6ba8effe5d4d297c4f22f460bfbe8b9`
- Tabelas operacionais existentes: `jobs`, `job_models`, `model_calendar_blocks`
- Ultima migration ARO existente: `010_agenda_event_types.sql`

## Arquivos VEIN mapeados

- `src/app/admin/finance/**`: interface de Accounting, dashboard, jobs financeiros, recebiveis, despesas, contas de modelos, relatórios, ações e rotas de PDF.
- `src/lib/finance.ts`: leitura de trabalhos financeiros e suas relações.
- `src/lib/accounting.ts`: calculos, extratos, filtros, summaries, recibos, despesas, contas de modelos e relatórios.
- `src/lib/finance-calculations.ts`: conversão monetária e formulas base.
- `src/lib/accounting-pdf-route.ts`: autenticação e resposta HTTP do PDF.
- `src/lib/accounting-pdf-document.ts`: documento PDF server-side.
- `src/lib/accounting-pdf.ts`: renderização PDF.
- `scripts/generate-pdf-logo.ts`: geração do logo embutido no build.
- `tests/*accounting*`, `tests/*finance*`, `tests/*expense*`: testes de calculo, extrato, PDF, integridade e ciclo de despesas.
- Migrations financeiras revisadas: `014`, `015`, `019`, `020`, `021`, `022`, `023` e `025` por alterar despesas/delete operacional.

## Tabelas: VEIN para ARO

| VEIN | ARO equivalente | Acao |
| --- | --- | --- |
| `calendar_events` | `jobs` | Adaptar todas as leituras e constraints financeiras para `jobs`. |
| `event_models` | `job_models` | Criar um lancamento financeiro por `job_id + model_id`. |
| `financial_job_entries.calendar_event_id` | `financial_job_entries.job_id` | Usar FK para `public.jobs(id)`. Nao criar `calendar_events`. |
| `financial_job_entries.model_id` | `models.id` | Compatível. |
| `financial_job_entries.client_id` | `clients.id` | Compatível. |
| `financial_job_payment_receipts.financial_job_entry_id` | Mesmo nome | Mantido. |
| `model_accounting_entries` | Mesmo nome | Mantido com categorias ARO e moedas BRL/USD/EUR. |
| `model_accounting_plans` | Mesmo nome | Mantido para despesas/adiantamentos recorrentes. |
| `clients.payment_terms` | Campos fiscais/billing ARO novos | Expandir CRM sem misturar CNPJ, CPF, VAT e Tax ID em campo unico. |
| `models.representation_type` | Nao aplicavel | Nao portar Freelance. Modelos ARO sao exclusivos. |
| `model_documents.banking_info_private` | Mesmo campo inicial | Reutilizar nesta etapa; futuras colunas privadas podem detalhar pagamento. |

## Campos compativeis

- `jobs.client_id`, `jobs.project_name`, `jobs.brand_name`, `jobs.start_at`, `jobs.status`, `jobs.client_budget`, `jobs.agency_fee_percent`, `jobs.final_amount`.
- `job_models.model_id`, `job_models.fee_amount`, `job_models.final_amount`, `job_models.status`.
- `models.id`, `models.display_name`, `models.stage_name`, `models.main_image_path`.
- `clients.id`, `clients.company_name`, `clients.city`, `clients.country`.

## Campos que precisam adaptacao

- `calendar_event_id` deve virar `job_id` em schema, libs, rotas, testes e constraints.
- `calendar_event.status` deve virar `jobs.status`; recebimentos aceitos apenas para status confirmados/finalizados, sem alterar status operacional.
- Moeda default da VEIN `THB` deve virar `BRL`. `THB` nao deve ser default nem hardcode operacional.
- Calculo VEIN 30/70 nao deve ser copiado como regra ARO. ARO usa taxa da agencia adicionada ao cliente: exemplo R$ 1.000,00 cachê + 20% taxa = R$ 1.200,00 cliente, mantendo R$ 1.000,00 bruto do modelo.
- Campos fiscais de clientes precisam migration propria.
- PDF deve usar AROLAB, BRL por padrao e logo ARO embutido, sem reutilizar logo VEIN.

## Regras que podem ser copiadas

- Recebimentos parciais e integrais.
- Bloqueio de overpayment por moeda.
- Recibos contabilizados imutaveis e anulacao com motivo.
- Despesas/adiantamentos com status `scheduled`, `posted`, `void`.
- Planos semanais e mensais com `request_key` unico.
- Pagamento ao modelo bloqueado acima do saldo disponivel.
- Extrato separando trabalhos pagos, pendentes, despesas, pagamentos, ajustes e anulados.
- PDF server-side autenticado, com Open PDF e Download PDF.

## Regras que nao podem ser copiadas sem adaptacao

- `calendar_events` e `event_models`.
- `THB` como moeda padrao.
- Percentuais fixos 30% / 70%.
- `freelance` ou split por representacao.
- Textos, branding, logo e identidade VEIN.
- Qualquer alteracao automatica de status operacional do trabalho por pagamento financeiro.

## Migrations necessarias

A proxima sequencia livre na ARO e `011`.

Sequencia oficial reservada para esta release conjunta:

- `010_agenda_event_types.sql`
- `011_accounting_base.sql`
- `012_accounting_receipts_integrity.sql`
- `013_model_accounting_entries_plans.sql`
- `014_clients_billing_tax_fields.sql`
- `015_accounting_hardening_reconciliation.sql`

PR #5 possui uma migration antiga tambem chamada `010`, e PR #6 possui outra migration antiga tambem chamada `010`. Esses PRs nao fazem parte desta release. Quando forem retomados, suas migrations deverao receber numeros posteriores a `015`. Notificacoes e IA nao devem ser incorporadas nesta release.

1. `011_accounting_base.sql`
   - Tipo `finance_currency` com `BRL`, `USD`, `EUR`.
   - `financial_job_entries` com `job_id`, `model_id`, `client_id`, valores ARO, status financeiro e `financial_review_required`.
   - Backfill deterministico somente quando `job_models` possui valores claros; caso contrario marcar revisao.
   - RLS admin-only.

2. `012_accounting_receipts_integrity.sql`
   - `financial_job_payment_receipts`.
   - Locks/constraints contra moeda divergente, overpayment, recebimento em trabalho nao confirmado/finalizado, delete de contabilizados e edicao material.

3. `013_model_accounting_entries_plans.sql`
   - `model_accounting_entries`, `model_accounting_plans`, despesas, adiantamentos, payouts, ajustes, planos recorrentes e bloqueios de saldo.

4. `014_clients_billing_tax_fields.sql`
   - Campos fiscais Brasil e internacional separados no CRM de clientes.

5. `015_accounting_hardening_reconciliation.sql`
   - Hardening final, funcoes de conciliacao/auditoria, protecao contra remover modelo de trabalho com recebimento e relatorio seguro de contagens.

PDF nao exige migration.

## Riscos de dados legados

- Trabalhos antigos podem ter `client_budget`, `final_amount`, `job_models.fee_amount` ou `job_models.final_amount` nulos.
- Nao converter `null` em zero silenciosamente.
- Nao marcar trabalho antigo como pago.
- Registros com mapeamento incompleto devem ficar `financial_review_required = true`.
- Logs de auditoria devem trazer contagens, nao nomes de modelos/clientes.

## Plano de rollback

- Migrations sao forward-only; rollback operacional deve ser feito por nova migration corretiva.
- Como o Accounting cria tabelas separadas e nao substitui `jobs/job_models`, a Agenda pode continuar funcionando se o Accounting for ocultado da navegacao.
- Recebimentos/despesas/pagamentos contabilizados nao devem ser apagados; correcoes financeiras devem ser por anulacao ou lancamento compensatorio.
- Para rollback visual, remover link Accounting da navegacao e manter redirects seguros.

## Validacoes obrigatorias

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`
- Busca por hardcodes proibidos:
  - `grep -R "VEIN" src scripts tests || true`
  - `grep -R '"THB"' src scripts tests || true`
  - `grep -R "freelance" src/app/admin/accounting src/lib/accounting* || true`

## Decisao de implementacao ARO

- Interface visivel em `/admin/accounting`.
- Redirects de `/admin/finance` e subrotas para `/admin/accounting`.
- RLS financeiro admin-only nesta etapa.
- Moeda padrao `BRL`; `USD` e `EUR` suportadas sem conversao automatica.
- Nenhuma migration sera aplicada ao Supabase remoto sem autorizacao explicita.
