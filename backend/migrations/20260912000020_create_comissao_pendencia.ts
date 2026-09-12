import type { Knex } from 'knex';

// Pendência de comissão (decisão de negócio registrada na rodada posterior ao
// Passo 5): quando um atendimento é CONCLUÍDO com o interruptor de comissão ATIVO
// e o profissional NÃO tem percentual cadastrado para o serviço na tabela
// `comissao_servico`, o hook automático NÃO trava a conclusão (a barbearia não
// para por causa de configuração administrativa faltando — padrão de mercado),
// mas passa a registrar um aviso consultável aqui para o admin revisar depois.
//
// O docs/PENDENCIAS.md NÃO foi reaproveitado: aquele arquivo é rastreabilidade
// de DESENVOLVIMENTO (decisões adiadas, estado aberta/em andamento/resolvida),
// não dados operacionais de produção.
//
// `resolvido` (default false) permite ao endpoint de leitura listar apenas os
// casos pendentes. O fluxo de marcar como resolvido fica para a rodada de
// Frontend/UI (fora do escopo atual).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('comissao_pendencia', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('agendamento_id').notNullable().references('id').inTable('agendamento').onDelete('CASCADE');
    table.uuid('funcionario_id').notNullable().references('id').inTable('funcionario').onDelete('CASCADE');
    table.uuid('servico_id').notNullable().references('id').inTable('servico').onDelete('CASCADE');
    table.date('data').notNullable();
    table.boolean('resolvido').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // Proteção de banco contra duplicação, mesmo padrão do índice único parcial da
  // despesa de comissão: para um MESMO agendamento só pode existir UMA pendência
  // não resolvida. Duas conclusões simultâneas do mesmo agendamento sem
  // percentual configurado não criam dois avisos.
  await knex.raw(`
    CREATE UNIQUE INDEX uq_comissao_pendencia_agendamento
    ON comissao_pendencia (agendamento_id)
    WHERE (resolvido = false);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS uq_comissao_pendencia_agendamento;
  `);
  await knex.schema.dropTableIfExists('comissao_pendencia');
}