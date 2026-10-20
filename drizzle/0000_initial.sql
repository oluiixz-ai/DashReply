CREATE TABLE IF NOT EXISTS "automacoes" (
  "id" serial PRIMARY KEY,
  "nome" varchar(160) NOT NULL,
  "palavra_chave" varchar(200) NOT NULL,
  "tipo_correspondencia" varchar(20) NOT NULL DEFAULT 'contains',
  "escopo" varchar(30) NOT NULL DEFAULT 'all_posts',
  "post_id" varchar(120),
  "resposta_publica" text,
  "mensagem_direct" text,
  "link" text,
  "botao_texto" varchar(80),
  "botao_url" text,
  "follow_up_texto" text,
  "follow_up_minutos" integer,
  "ativa" boolean NOT NULL DEFAULT false,
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "variacoes_resposta" (
  "id" serial PRIMARY KEY,
  "automacao_id" integer NOT NULL REFERENCES "automacoes"("id") ON DELETE CASCADE,
  "texto" text NOT NULL,
  "criado_em" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "contatos" (
  "id" serial PRIMARY KEY,
  "instagram_user_id" varchar(120) NOT NULL UNIQUE,
  "username" varchar(120),
  "primeiro_nome" varchar(120),
  "ultimo_contato_em" timestamptz,
  "criado_em" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "eventos" (
  "id" serial PRIMARY KEY,
  "tipo" varchar(80) NOT NULL,
  "comment_id" varchar(180),
  "instagram_user_id" varchar(120),
  "automacao_id" integer REFERENCES "automacoes"("id") ON DELETE SET NULL,
  "status" varchar(30) NOT NULL DEFAULT 'received',
  "detalhe" jsonb,
  "erro" text,
  "criado_em" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "eventos_comment_id_unique" ON "eventos" ("comment_id");
CREATE INDEX IF NOT EXISTS "eventos_criado_em_idx" ON "eventos" ("criado_em");
CREATE TABLE IF NOT EXISTS "fila_envios" (
  "id" serial PRIMARY KEY,
  "tipo" varchar(30) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "tentativas" integer NOT NULL DEFAULT 0,
  "executar_em" timestamptz NOT NULL DEFAULT now(),
  "criado_em" timestamptz NOT NULL DEFAULT now(),
  "erro" text
);
CREATE INDEX IF NOT EXISTS "fila_status_exec_idx" ON "fila_envios" ("status", "executar_em");
CREATE TABLE IF NOT EXISTS "configuracoes" (
  "id" serial PRIMARY KEY,
  "chave" varchar(120) NOT NULL UNIQUE,
  "valor" text,
  "atualizado_em" timestamptz NOT NULL DEFAULT now()
);
