import type { Knex } from 'knex';

// Experimento local: pagamento via Mercado Pago (Checkout Pro / Orders API).
// Tabela desacoplada do ciclo de vida do agendamento — o status de pagamento é
// registrado aqui e NÃO vira status de agendamento (status_agendamento permanece
// pendente/confirmado/cancelado/concluido). Cada agendamento pode ter zero, uma
// ou várias linhas de pagamento ao longo do tempo (ex.: tentativa recusada seguida
// de nova tentativa), sem cascata de estados entre as duas tabelas.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TYPE status_pagamento AS ENUM ('pendente', 'aprovado', 'recusado', 'cancelado', 'expirado');`);

  await knex.schema.createTable('pagamento', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('agendamento_id').notNullable().references('id').inTable('agendamento').onDelete('CASCADE');
    table.string('mercadopago_order_id', 64).notNullable();
    table.string('mercadopago_payment_id', 64).nullable();
    table.integer('valor_centavos').notNullable();
    table.specificType('status', 'status_pagamento').notNullable().defaultTo('pendente');
    table.timestamps(true, true);

    // Uma ordem do Mercado Pago (ORD...) só pode existir uma vez no sistema:
    // a unicidade aqui é a proteção de idempotência contra criação duplicada de
    // ordem no MP para o mesmo intent.
    table.unique(['mercadopago_order_id'], { indexName: 'uq_pagamento_mercadopago_order_id' });
  });

  // Permite reutilizar o pagamento pendente existente e criar nova linha após
  // um estado terminal; impede duas ordens pendentes simultâneas para o MESMO
  // agendamento (corrida de checkout duplo) no nível do banco.
  await knex.raw(`
    CREATE UNIQUE INDEX uq_pagamento_agendamento_pendente
    ON pagamento (agendamento_id)
    WHERE (status = 'pendente');
  `);

  // Lookup por agendamento independente de status: o índice único parcial acima
  // cobre apenas linhas pendentes; histórico (aprovado/recusado/cancelado/expirado)
  // de um agendamento precisa deste índice amplo.
  await knex.schema.alterTable('pagamento', (table) => {
    table.index(['agendamento_id'], 'idx_pagamento_agendamento_id');
  });

  // Dinheiro em centavos (inteiro, nunca ponto flutuante binário); snapshot do
  // preço do serviço no momento da criação do pagamento. Valor negativo é
  // sempre inválido.
  await knex.raw(`
    ALTER TABLE pagamento
    ADD CONSTRAINT chk_pagamento_valor_centavos CHECK (valor_centavos >= 0);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE pagamento
    DROP CONSTRAINT IF EXISTS chk_pagamento_valor_centavos;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS uq_pagamento_agendamento_pendente;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS idx_pagamento_agendamento_id;
  `);

  await knex.schema.dropTableIfExists('pagamento');
  await knex.raw(`DROP TYPE IF EXISTS status_pagamento;`);
}