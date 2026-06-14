# Notificações + E-mails

Esta etapa cria a base segura para notificações internas e fila de e-mails da AROLAB.

## Estado inicial

O provider inicial é `disabled`.

Nesse modo, o sistema:

- cria notificações internas em `notifications`;
- renderiza templates e salva mensagens em `email_outbox`;
- não envia e-mail real;
- permite revisar destinatário, assunto, corpo, status e erro antes de ativar um provider externo.

## Migration

Aplicar no Supabase:

```sql
supabase/migrations/010_notifications_email_workflow.sql
```

A migration cria:

- `notifications`;
- `email_templates`;
- `email_outbox`;
- `email_settings`;
- enums de notificação, status de e-mail e provider;
- policies RLS para admin e leitura própria de usuários.

## Variáveis de ambiente

```env
EMAIL_PROVIDER=disabled
EMAIL_FROM=claudio@arolab.co
EMAIL_REPLY_TO=claudio@arolab.co
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

`EMAIL_PROVIDER` aceita:

- `disabled`;
- `manual`;
- `resend`;
- `gmail`.

## Resend

Para ativar Resend:

1. configurar `EMAIL_PROVIDER=resend`;
2. configurar `RESEND_API_KEY`;
3. validar domínio/remetente no painel da Resend;
4. alterar `email_settings.is_enabled` para `true` quando estiver pronto para envio real.

Sem `RESEND_API_KEY`, a tentativa de envio marca o item como `failed` com mensagem clara.

## Gmail API

O envio por Gmail deve usar OAuth da Google API, não senha nem app password.

Fluxo futuro:

1. criar OAuth Client no Google Cloud;
2. configurar `GOOGLE_CLIENT_ID`;
3. configurar `GOOGLE_CLIENT_SECRET`;
4. gerar e guardar `GOOGLE_REFRESH_TOKEN` em variável de ambiente segura;
5. implementar o trecho de envio Gmail em `src/lib/email.ts`;
6. alterar `EMAIL_PROVIDER=gmail`;
7. alterar `email_settings.is_enabled` para `true`.

Segredos não devem ser salvos em tabelas do banco.

## Templates iniciais

A migration cria templates para:

- convite de trabalho para modelo;
- lembrete de trabalho;
- convite de casting;
- aviso de opção;
- solicitação de atualização de perfil;
- solicitação de atualização de medidas;
- solicitação de novas polaroids;
- confirmação de pedido do cliente;
- aviso de novo pedido para admin.

As variáveis são substituídas no formato `{{nome_da_variavel}}`.
