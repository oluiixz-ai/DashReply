# DashReply

Painel de automações para Instagram construído com Next.js, TypeScript, Tailwind CSS, Neon Postgres e Drizzle ORM.

## Status atual

- Dashboard responsivo em português com dados demonstrativos.
- Criação local de rascunhos de automação.
- Estrutura inicial do banco para automações, contatos, eventos e fila de envios.
- Endpoint de verificação de webhook Meta com validação de assinatura.
- Login administrativo por variáveis de ambiente e cookie de sessão assinado.
- Endpoint de fila protegido por `CRON_SECRET`.

**Importante:** o dashboard ainda é uma interface inicial. As estatísticas são demonstrativas; criação de rascunho ainda não persiste no banco e o webhook apenas registra eventos recebidos. Nenhuma mensagem ou comentário real é enviado até que os handlers da API oficial da Meta sejam implementados e configurados.

## Configuração local

1. Use Node.js 20 ou superior.
2. Copie `.env.example` para `.env.local` e preencha os valores.
3. Crie um banco PostgreSQL no Neon e informe `DATABASE_URL`.
4. Gere um `SESSION_SECRET` aleatório com pelo menos 32 caracteres.
5. Instale dependências com `npm install`.
6. Gere/aplique as migrations com `npm run db:generate` e `npm run db:migrate`.
7. Inicie com `npm run dev`.

## Variáveis

Veja `.env.example`. Não publique segredos no GitHub. Configure-os nas variáveis de ambiente do Vercel.

## Integração Instagram

Use apenas a API oficial da Meta, com conta profissional, aplicativo Meta configurado, permissões aprovadas e webhook inscrito nos eventos necessários. A disponibilidade de respostas públicas e mensagens depende das permissões, limites e políticas vigentes da Meta. O endpoint de webhook valida `X-Hub-Signature-256`; os handlers de envio real ainda precisam ser implementados.
