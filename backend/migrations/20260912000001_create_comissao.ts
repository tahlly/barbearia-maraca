import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // configuracao_comissao: tabela singleton (spec 3.4) — interruptor global de
  // comissão. Padrão escolhido: PK string com valor fixo 'global'. A service fará
  // upsert sempre com esse id, garantindo no máximo uma linha sem depender de
  // sequence nem de controle fora do banco.
  await knex.schema.createTable('configuracao_comissao', (table) => {
    table.string('id', 20).primary();
    table.boolean('comissao_ativa').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // comissao_servico: percentual de comissão por serviço por profissional (spec 3.5).
  // Não há índice extra em funcionario_id: a UNIQUE (funcionario_id, servico_id)
  // abaixo já cria índice btree cujo prefixo mais à esquerda é funcionario_id,
  // cobrindo as consultas por profissional (listar configurações e buscar a do
  // serviço). Não há requisito de consulta por servico_id isolado que justifique
  // índice adicional.
  await knex.schema.createTable('comissao_servico', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionario').onDelete('CASCADE');
    table.uuid('servico_id').notNullable().references('id').inTable('servico').onDelete('CASCADE');
    table.decimal('percentual', 5, 2).notNullable();
    table.timestamps(true, true);
  });

  await knex.raw(`
    ALTER TABLE comissao_servico
    ADD CONSTRAINT chk_comissao_servico_percentual CHECK (percentual >= 0 AND percentual <= 100);
  `);

  await knex.raw(`
    ALTER TABLE comissao_servico
    ADD CONSTRAINT uq_comissao_servico_funcionario_servico UNIQUE (funcionario_id, servico_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE comissao_servico
    DROP CONSTRAINT IF EXISTS chk_comissao_servico_percentual;
  `);

  await knex.raw(`
    ALTER TABLE comissao_servico
    DROP CONSTRAINT IF EXISTS uq_comissao_servico_funcionario_servico;
  `);

  // Ordem inversa da criação: filha primeiro, depois o singleton.
  await knex.schema.dropTableIfExists('comissao_servico');
  await knex.schema.dropTableIfExists('configuracao_comissao');
}