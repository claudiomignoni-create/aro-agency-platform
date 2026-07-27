# ARO x VEIN Port Map

Este documento registra como a Agenda da VEIN deve orientar a evolucao da ARO sem copiar branding, dados, credenciais, buckets, IDs, regras comerciais, percentuais financeiros ou tabelas que criariam um segundo sistema paralelo.

## Principios

- A ARO continua usando `jobs`, `job_models` e `model_calendar_blocks` como origem da Agenda.
- `calendar_events`, `event_models` e estruturas financeiras da VEIN sao referencia de experiencia e arquitetura, nao tabelas a copiar diretamente.
- A Agenda cria e edita eventos operacionais; o Financeiro futuro deve refletir a Agenda.
- Datas usam helpers dinamicos da ARO e timezone operacional `America/Sao_Paulo`.
- ARO nao usa classificacao Freelance. Os boards oficiais continuam: Desenvolvimento, New Face, Mainboard e Image.

## Agenda

| Origem VEIN | Destino ARO | Decisao | Justificativa |
| --- | --- | --- | --- |
| `src/app/admin/calendar/page.tsx` | `src/app/admin/calendar/page.tsx` | Adaptar | Portar experiencia de mes, semana, lista, filtros e navegacao, mas usando `listAdminJobs()` e tipos/status da ARO. |
| `src/app/admin/calendar/calendar-filter-form.tsx` | `src/app/admin/calendar/page.tsx` | Adaptar | ARO pode comecar com filtros server-rendered simples para reduzir risco e dependencias. |
| `src/components/admin/google-calendar-chrome.tsx` | CSS local em `src/app/admin/calendar/page.tsx` | Adaptar parcialmente | Aproveitar padroes de comportamento e responsividade, sem copiar visual VEIN. |
| `src/app/admin/calendar/new/page.tsx` | `src/app/admin/calendar/new/page.tsx` | Adaptar | Criar evento da Agenda com os campos ja suportados por `jobs`. |
| `src/app/admin/calendar/[id]/page.tsx` | `src/app/admin/calendar/[id]/page.tsx` | Adaptar | Mostrar detalhe operacional do evento mantendo status e fluxo de aprovacao da ARO. |
| `src/app/admin/calendar/[id]/edit/page.tsx` | `src/app/admin/calendar/[id]/edit/page.tsx` | Adaptar | Editar `jobs`, substituir vinculos em `job_models` e sincronizar `model_calendar_blocks`. |
| `src/app/admin/calendar/actions.ts` | `src/app/admin/jobs/actions.ts` | Adaptar | Manter actions atuais da ARO e redirecionar para a nova rota de Agenda. |
| `src/lib/calendar-events.ts` | `src/lib/jobs.ts` | Adaptar | Reusar helpers e selects de `jobs`; nao criar `calendar_events`. |
| `src/lib/calendar.ts` | `src/lib/calendar.ts` | Adaptar | Manter helpers dinamicos ja adicionados no PR #9. |
| `src/components/admin/filter-drawer.tsx` | Futuro componente ARO | Nao copiar agora | Pode ser util em mobile, mas esta etapa usa CSS local para reduzir diff. |
| VEIN mobile calendar behavior | `src/app/admin/calendar/page.tsx` | Adaptar | Layout responsivo com lista compacta no mobile e sem overflow horizontal. |

## Financeiro

| Origem VEIN | Destino ARO | Decisao | Justificativa |
| --- | --- | --- | --- |
| `financial_job_entries` | Futuro modulo financeiro ARO | Nao copiar agora | A etapa atual nao implementa financeiro completo. |
| `src/app/admin/finance/**` | Futuro `src/app/admin/finance/**` ARO | Mapear depois | Referencia para extratos, recebimentos, contas de modelos e PDFs. |
| `src/lib/finance-calculations.ts` | Futuro helper financeiro ARO | Adaptar depois | Percentuais e moedas da VEIN nao devem ser copiados para a ARO. |
| Pagamentos recebidos de clientes | Futuro financeiro ARO vinculado a `jobs.id` | Adaptar depois | Recebimentos devem refletir eventos da Agenda. |
| Contas dos modelos | Futuro financeiro ARO vinculado a `job_models.model_id` | Adaptar depois | Um lancamento por modelo vinculado ao evento. |
| Despesas e adiantamentos | Futuro financeiro ARO | Adaptar depois | Passagens, hospedagem, transporte e outros custos entram na etapa financeira. |
| Pagamentos para modelos | Futuro financeiro ARO | Adaptar depois | Deve respeitar regras comerciais da ARO. |
| Extratos e PDFs | Futuro financeiro ARO | Adaptar depois | Geracao de PDFs fica fora desta etapa. |
| Regras de integridade | Migrations futuras ARO | Adaptar depois | Criar constraints forward-only quando o desenho financeiro estiver fechado. |

## Cadastro De Modelos

| Origem VEIN | Destino ARO | Decisao | Justificativa |
| --- | --- | --- | --- |
| `src/app/admin/models/model-form.tsx` | `src/app/admin/models/model-form.tsx` | Mapear, nao alterar agora | Cadastro360 da ARO ja possui abas extensas e deve ser preservado. |
| `representation_type = freelance` | ARO | Nao copiar | ARO nao trabalha com classificacao Freelance. |
| Campos de medidas, skills, midia e historico | Cadastro360 ARO | Preservar | Ja existem na ARO e nao fazem parte desta etapa de Agenda. |
| Representacao internacional / mother agency | Cadastro360 ARO | Preservar | Exclusividade ARO pode coexistir com representacao internacional. |
| Boards VEIN | Boards ARO | Adaptar depois | ARO usa Desenvolvimento, New Face, Mainboard e Image. |

## Clientes E Fiscal

| Origem VEIN | Destino ARO | Decisao | Justificativa |
| --- | --- | --- | --- |
| `src/app/admin/clients/**` | `src/app/admin/clients/**` | Mapear, nao alterar agora | CRM ARO deve continuar funcionando. |
| Dados gerais e contatos | CRM ARO | Preservar | Ja existem campos de cliente e canais. |
| Dados de cobranca | Futuro CRM/Financeiro ARO | Adaptar depois | Nao implementar financeiro/fiscal nesta etapa. |
| Dados fiscais brasileiros | Futuro CRM ARO | Adaptar depois | CNPJ, CPF, IE, IM e regime tributario exigem desenho proprio. |
| Dados fiscais internacionais | Futuro CRM ARO | Adaptar depois | Tax ID, VAT e company registration nao devem dividir campo sem tipo de documento. |
| Criacao rapida de cliente na Agenda | Futuro incremento | Nao copiar agora | Pode ser feita depois, sem substituir o CRM completo. |

## Proximas Etapas

### Etapa 2 - Cadastro de modelos e clientes

- Remover opcao Freelance da interface.
- Tratar todos os modelos como exclusivos da ARO.
- Tornar board obrigatorio entre Desenvolvimento, New Face, Mainboard e Image.
- Alinhar Cadastro360 com a organizacao operacional observada na VEIN, preservando documentos, medidas, skills, historico, saude, logistica, midia e representacao internacional.
- Separar dados fiscais brasileiros e internacionais sem reutilizar o mesmo campo para CNPJ e VAT sem identificacao.

### Etapa 3 - Financeiro e PDFs

- Criar um lancamento financeiro por modelo vinculado a `job_models`.
- Registrar cache bruto, taxa da agencia, impostos, deducoes, valor liquido, recebimentos, pagamentos parciais e saldo.
- Incluir despesas, adiantamentos, passagens, hospedagem e transporte.
- Criar conta corrente, extrato mensal, relatorios e PDFs.
- Manter a Agenda como origem unica de trabalhos.
