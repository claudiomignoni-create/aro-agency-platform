# ARO Lab Internal App

Aplicação interna da ARO Models / ARO Lab para portal de modelos, portal de clientes e painel administrativo.

O site institucional pode continuar no Wix. Este repositório passa a concentrar o sistema operacional independente em `app.arolab.co`.

## Stack

- Next.js
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Vercel

## O que já existe

- Layout principal.
- Página de login com Supabase Auth.
- Proteção de rotas por role: `admin`, `model`, `client`.
- Dashboard admin com navegação lateral.
- Dashboard do modelo com navegação lateral.
- Dashboard do cliente com navegação lateral.
- Admin Models: listar, criar, editar e alterar status.
- Configuração inicial do Supabase.
- Tipos TypeScript principais.
- Migration SQL inicial do MVP.
- Middleware de sessão para rotas protegidas.

## Estrutura

```text
.
├── docs/
│   └── INDEPENDENT_APP_MIGRATION_PLAN.md
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── admin/
│   │   ├── client/
│   │   ├── model/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   └── types/
├── middleware.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Instalação local

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

3. Preencha `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Rode o app:

```bash
npm run dev
```

5. Abra:

```text
http://localhost:3000
```

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o arquivo:

```text
supabase/migrations/001_initial_schema.sql
```

Essa migration cria:

- `profiles`
- `models`
- `clients`
- `model_media`
- `availability`
- `shortlists`
- `shortlist_models`
- `client_requests`
- `bookings`
- `audit_logs`
- Buckets privados de storage.
- Políticas RLS iniciais.

## Criar usuários de teste

1. No Supabase Auth, crie usuários por e-mail e senha.
2. Copie o `id` de cada usuário.
3. Insira um registro em `profiles` com o mesmo `id`.

Exemplo:

```sql
insert into public.profiles (id, role, full_name)
values
  ('USER_ID_DO_ADMIN', 'admin', 'Admin ARO'),
  ('USER_ID_DO_MODELO', 'model', 'Modelo Teste'),
  ('USER_ID_DO_CLIENTE', 'client', 'Cliente Teste');
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Deploy na Vercel

1. Suba o projeto para o GitHub.
2. Na Vercel, clique em **Add New Project**.
3. Selecione o repositório.
4. Configure o framework como Next.js.
5. Adicione as variáveis de ambiente:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

6. Faça o primeiro deploy.
7. Em **Domains**, adicione:

```text
app.arolab.co
```

8. Aponte o DNS do domínio conforme instruções da Vercel.

## Rotas iniciais

- `/login`
- `/admin`
- `/admin/models`
- `/admin/models/new`
- `/admin/models/[id]/edit`
- `/model`
- `/client`

## Próximas implementações

- Formulários reais do portal do modelo.
- Upload para Supabase Storage.
- Busca de modelos para clientes.
- Shortlists.
- Pedidos para a agência.
- Painel admin de revisão de modelos e mídia.

## Fora do MVP

- Nota fiscal.
- WhatsApp.
- Google Calendar.
- Gateway de pagamento.
- Recomendações avançadas.
- Relatórios gerenciais.
