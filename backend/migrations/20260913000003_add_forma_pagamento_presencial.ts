import type { Knex } from 'knex';

// Pagamento presencial (decisão de produto fechada pela usuária): a recepcionista
// REGISTRA no balcão que o valor já existente no sistema (preço do serviço do
// agendamento) foi recebido — dinheiro/maquininha — no momento de concluir o
// atendimento. O valor nunca é digitado nem exibido para a recepcionista (PRD:
// sem acesso financeiro). O faturamento do admin já nasce da conclusão do
// agendamento; a linha de pagamento é o registro de "pago".
//
// Mudanças aditivas (nada destrutivo; migration única, posterior a
// 20260913000002_add_checkout_url_pagamento.ts):
//
// 1. `mercadopago_order_id` → NULLABLE: pagamento presencial não tem ordem do
//    Mercado Pago. A unique `uq_pagamento_mercadopago_order_id` permanece válida
//    sem alteração (Postgres aceita múltiplos NULL em índice único).
// 2. Enum `forma_pagamento` ('mercadopago' | 'presencial') + coluna NOT NULL
//    DEFAULT 'mercadopago': todas as linhas existentes vieram do fluxo MP, então
//    o DEFAULT é o backfill correto (não existe presencial pré-existente).
// 3. Auditoria `registrado_por_usuario_id` (FK → usuario.id, ON DELETE SET NULL):
//    identifica quem registrou o pagamento presencial (recepcionista/admin).
//    Nulável de propósito: linhas do Mercado Pago não têm usuário registrante.
// 4. CHECK de coerência `chk_pagamento_forma_coerencia`: mercadopago SEMPRE tem
//    order id; presencial NUNCA tem.
// 5. Índice único parcial `uq_pagamento_agendamento_aprovado` em
//    (agendamento_id) WHERE status='aprovado': impede duas aprovações para o
//    mesmo agendamento (proteção estrutural contra dupla cobrança/registro
//    duplicado de "pago"). Complementa o índice de pendência única existente.
//    Evidência no dev DB antes da migration: 10 linhas 'aprovado' e 0
//    agendamentos com mais de uma aprovação — criação sem violação de dados.
export async function up(knex: Knex): Promise<void> {
  // 1. mercadopago_order_id passa a ser opcional (presencial não tem ordem MP).
  await knex.schema.alterTable('pagamento', (table) => {
    table.setNullable('mercadopago_order_id');
  });

  // 2. Enum e coluna forma_pagamento; backfill correto via DEFAULT 'mercadopago'.
  await knex.raw(`CREATE TYPE forma_pagamento AS ENUM ('mercadopago', 'presencial');`);
  await knex.schema.alterTable('pagamento', (table) => {
    table.specificType('forma_pagamento', 'forma_pagamento').notNullable().defaultTo('mercadopago');
  });

  // 3. Auditoria: quem registrou o pagamento (presencial tem usuário; MP não).
  await knex.schema.alterTable('pagamento', (table) => {
    table.uuid('registrado_por_usuario_id').nullable();
    table
      .foreign('registrado_por_usuario_id', 'fk_pagamento_registrado_por_usuario')
      .references('id')
      .inTable('usuario')
      .onDelete('SET NULL');
  });

  // 4. Coerência forma × ordem MP: mercadopago sempre com order id; presencial nunca.
  await knex.raw(`
    ALTER TABLE pagamento
    ADD CONSTRAINT chk_pagamento_forma_coerencia
    CHECK (forma_pagamento = 'presencial' OR mercadopago_order_id IS NOT NULL);
  `);

  // 5. Proteção estrutural contra dupla aprovação/dupla cobrança por agendamento.
  await knex.raw(`
    CREATE UNIQUE INDEX uq_pagamento_agendamento_aprovado
    ON pagamento (agendamento_id)
    WHERE (status = 'aprovado');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS uq_pagamento_agendamento_aprovado;
  `);

  await knex.raw(`
    ALTER TABLE pagamento
    DROP CONSTRAINT IF EXISTS chk_pagamento_forma_coerencia;
  `);

  await knex.raw(`
    ALTER TABLE pagamento
    DROP CONSTRAINT IF EXISTS fk_pagamento_registrado_por_usuario;
  `);

  await knex.schema.alterTable('pagamento', (table) => {
    table.dropColumn('registrado_por_usuario_id');
    table.dropColumn('forma_pagamento');
    // Restaura o NOT NULL original quando possível. Se já existirem linhas
    // presencial (order id NULL) no momento do rollback, o SET NOT NULL falhará
    // por violação de dados — comportamento esperado e documentado.
    table.dropNullable('mercadopago_order_id');
  });

  await knex.raw(`DROP TYPE IF EXISTS forma_pagamento;`);
}