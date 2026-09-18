import type { Knex } from 'knex';

// Correção do CHECK `chk_pagamento_forma_coerencia` (migration 20260913000003):
// a versão anterior garantia apenas a implicação "mercadopago ⇒ order id"
// (forma_pagamento = 'presencial' OR mercadopago_order_id IS NOT NULL), mas o
// comentário da própria migration afirma a invariante bicondicional:
//   - presencial NUNCA tem order id do Mercado Pago;
//   - mercadopago SEMPRE tem order id.
// Com o CHECK anterior, o banco aceitava `presencial` com order id preenchido.
//
// Evidência prévia no dev DB (antes desta migration): 0 linhas
// `forma_pagamento = 'presencial'` com `mercadopago_order_id IS NOT NULL`,
// enquanto 44 linhas mercadopago têm order id e 4 presencial não têm — a nova
// constraint bicondicional é criada sem violação de dados existentes.
//
// Migration aditiva/corretiva: não reescreve 20260913000003; drop + recriação
// do mesmo nome no mesmo comando. Como ADD CONSTRAINT valida linhas existentes
// (sem NOT VALID), qualquer violação histórica falharia a aplicação aqui.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE pagamento
    DROP CONSTRAINT IF EXISTS chk_pagamento_forma_coerencia;
  `);

  await knex.raw(`
    ALTER TABLE pagamento
    ADD CONSTRAINT chk_pagamento_forma_coerencia
    CHECK (
      (forma_pagamento = 'presencial' AND mercadopago_order_id IS NULL)
      OR
      (forma_pagamento = 'mercadopago' AND mercadopago_order_id IS NOT NULL)
    );
  `);
}

// down(): restaura EXATAMENTE o CHECK anterior (unidirecional) para permitir
// rollback da última batch. Seguro dado o novo CHECK: presencial nunca terá
// order id e mercadopago sempre terá, então nenhuma linha viola a versão
// unilateral restaurada.
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE pagamento
    DROP CONSTRAINT IF EXISTS chk_pagamento_forma_coerencia;
  `);

  await knex.raw(`
    ALTER TABLE pagamento
    ADD CONSTRAINT chk_pagamento_forma_coerencia
    CHECK (forma_pagamento = 'presencial' OR mercadopago_order_id IS NOT NULL);
  `);
}