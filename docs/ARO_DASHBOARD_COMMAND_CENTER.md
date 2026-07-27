# ARO Dashboard Command Center

## Referencia visual

Esta etapa usa as duas imagens fornecidas na conversa como referencia obrigatoria:

- Imagem 01: estrutura visual do dashboard premium em Liquid Glass azul.
- Imagem 02: marca circular oficial da ARO.

A Imagem 01 nao foi inserida como screenshot ou background. A interface foi recriada como UI real, responsiva e funcional.

## Identidade

- Marca principal: `public/brand/aro-mark.png`.
- Versao auxiliar: `public/brand/aro-mark-white.png`.
- Favicon/app icon: `public/favicon.png`.
- Sidebar exibe simbolo circular e texto `ARO`.
- O shell admin nao usa `ARO LAB ASSISTANT` nem VEIN como identidade principal.

## Shell administrativo

O admin usa `AdminShellV2` em todas as rotas `/admin/**`.

Estrutura:

- Sidebar fixa no desktop.
- Drawer no mobile.
- Topbar com busca global.
- Sino de alertas operacionais.
- Atalho para Messages.
- Menu de usuario real.
- Seletor de tema: Sistema, Claro, Escuro.

## Sidebar

Ordem visivel:

1. Dashboard -> `/admin`
2. Models -> `/admin/models`
3. Clients -> `/admin/clients`
4. Jobs -> `/admin/jobs`
5. Accounting -> `/admin/accounting`
6. Travel -> `/admin/travel`
7. Calendar -> `/admin/calendar`
8. Messages -> `/admin/messages`
9. Settings -> `/admin/settings`

## Dashboard

Fonte principal: `src/lib/admin-dashboard.ts`.

Widgets:

- Modelos Ativos: conta modelos `approved` e `is_published = true`.
- Jobs Abertos: conta jobs nos status operacionais definidos em `activeJobStatuses`.
- Temporadas Internacionais: usa Travel quando a migration 016 existir.
- Pagamentos Pendentes: usa Accounting quando as migrations 011 a 014 estiverem presentes.
- Proximos Trabalhos: usa `jobs` e `job_models`.
- Calendario compacto: usa `jobs.start_at` no mes selecionado.
- Ultimos Modelos Adicionados: usa `models.created_at`.
- Modelos Atualizados Recentemente: usa `models.updated_at` e campos de medidas.
- Entradas Financeiras Recentes: usa `model_accounting_entries`.
- Mapa de temporadas: usa coordenadas reais em `model_trips.destination_latitude` e `destination_longitude`.
- Modelos Viajando Agora: usa `model_trips` e `travel_flight_segments`.
- Alertas: usa apenas dados reais de Jobs, Accounting e Travel.

Nao existem nomes, valores ou cidades ficticias hardcoded no dashboard.

## Jobs versus Calendar

Jobs e Calendar sao areas diferentes.

- `/admin/jobs` mostra lista operacional com filtros e tabela/cards responsivos.
- `/admin/calendar` continua sendo a experiencia de agenda/calendario.
- `/admin/jobs/new` redireciona para `/admin/calendar/new?type=job`.
- `/admin/jobs/[id]` pode continuar redirecionando para `/admin/calendar/[id]`.
- A fonte unica de dados continua sendo `jobs` e `job_models`.

## Travel

Rotas criadas:

- `/admin/travel`
- `/admin/travel/new`
- `/admin/travel/[id]`
- `/admin/travel/[id]/edit`

Tabelas planejadas:

- `model_trips`
- `travel_flight_segments`
- `travel_documents`

Travel usa RLS admin-only nesta etapa.

Documentos de viagem usam o bucket privado existente `model-documents` com prefixo `travel/`.

## Migrations

Migrations existentes antes desta etapa iam ate `015_accounting_hardening_reconciliation.sql`.

Novas migrations locais:

- `016_travel_foundation.sql`
- `017_user_preferences_and_profile.sql`
- `018_travel_documents_and_hardening.sql`

Elas nao foram aplicadas remotamente nesta branch.

## Settings

Rotas:

- `/admin/settings`

Tabs:

- Perfil
- Aparencia
- Conta
- Preferencias

E-mail usa `supabase.auth.updateUser`.

Campos de perfil novos dependem da migration 017. Antes dela, a aplicacao cai para os campos antigos e mostra aviso administrativo.

## Fallbacks

- Accounting ausente: widgets financeiros mostram estado informativo.
- Travel ausente: widgets de viagem mostram estado informativo.
- Profile preferences ausentes: shell usa nome/e-mail e cargo `Administrador`.
- Imagem de modelo ausente: mostra iniciais.
- Falhas de widget entram em `failedWidgets` sem derrubar todo o dashboard.

## Performance

- Consultas limitadas.
- Sem N+1 para busca global.
- Busca global usa endpoint unico `/admin/search`.
- Dashboard usa renderizacao dinamica.
- Imagens de modelos usam signed URLs limitadas aos modelos exibidos.

## Pontos futuros

- Upload completo de documentos de viagem com fluxo de storage revisado.
- Preferencias de tema persistidas no shell a partir de `user_preferences`.
- Coordenadas automáticas para cidades de Travel, sem hardcode.
- Alert dismissals conectados a `operational_alert_dismissals`.
- Messages backend real.
- Mais de um trecho de voo editavel diretamente na UI.
