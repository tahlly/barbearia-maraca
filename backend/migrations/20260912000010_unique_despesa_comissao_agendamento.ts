import type { Knex } from 'knex';

// Proteção definitiva do hook automático de comissão (spec 3.4/3.5): ao concluir
// um agendamento, o Backend cria uma despesa com tipo_despesa='comissao' e
// agendamento_id preenchido. O check-then-insert na aplicação é vulnerável a
// corrida (duas conclusões simultâneas do MESMO agendamento criariam duas
// despesas de comissão). Este índice único parcial garante no nível do banco
// que haja no máximo UMA despesa de comissão por agendamento.
//
// Parcial em tipo_despesa='comissao': outros tipos de despesa podem
// legitimamente referenciar o mesmo agendamento (sem requisito de unicidade).
// O AND agendamento_id IS NOT NULL mantém o índice mínimo: despesas de comissão
// sem agendamento (coluna nullable) não são restritas, e NULL nunca conflita
// em índice único — sem essa condição, o índice fecharia sobre linhas
// irrelevantes sem ganho de integridade.
//
// Sem limpeza prévia: o recurso de comissão é novo (migration
// 20260912000001_create_comissao.ts e hook recém-implementado), portanto não
// existem despesas legadas com tipo_despesa='comissao'. Se houvesse, a criação
// do índice falharia, sinalizando estado inesperado — comportamento seguro.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE UNIQUE INDEX uq_despesa_comissao_agendamento
    ON despesa (agendamento_id)
    WHERE (tipo_despesa = 'comissao') AND (agendamento_id IS NOT NULL);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS uq_despesa_comissao_agendamento;
  `);
}