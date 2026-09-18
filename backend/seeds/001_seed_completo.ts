import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'senha123';

// ── Helpers de datas RELATIVAS à execução ───────────────────────────────
// As telas consultam janelas relativas a "hoje": Painel do Barbeiro
// (mês civil corrente + últimos 7 dias), Resumo Financeiro (mês atual vs
// anterior), Dashboard (mês corrente). Com datas FIXAS no código, essas
// janelas ficam vazias semanas depois. Por isso o seed gera as datas a
// partir da data atual: os CENÁRIOS são sempre os mesmos; os valores de
// data variam conforme o dia da execução.
function dataISO(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Dia `dia` (1-based) do mês corrente, a partir de hoje. */
function diaDoMes(hoje: Date, dia: number): string {
  return dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), dia));
}

/** Dia `dia` (1-based) do MÊS ANTERIOR ao mês atual. */
function diaMesAnterior(hoje: Date, dia: number): string {
  return dataISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, dia));
}

/** Data deslocada `offset` dias a partir de hoje (negativo = passado). */
function dataOffset(hoje: Date, offset: number): string {
  const d = new Date(hoje);
  d.setDate(d.getDate() + offset);
  return dataISO(d);
}

export async function seed(knex: Knex): Promise<void> {
  // Ordem segura de reset por dependência (não altera nenhuma estrutura):
  // tabelas que referenciam agendamento/funcionario/servico/categoria primeiro.
  // `pagamento` referencia `agendamento` (CASCADE) — o del() explícito antes
  // de `agendamento` evita depender da cascata e mantém o reset previsível.
  await knex('comissao_pendencia').del();
  await knex('despesa').del();
  await knex('funcionario_categoria').del();
  await knex('servico_categoria').del();
  await knex('categoria').del();
  await knex('pagamento').del();
  await knex('agendamento').del();
  await knex('horario_excecao').del();
  await knex('horario_trabalho').del();
  await knex('comissao_servico').del();
  await knex('configuracao_comissao').del();
  await knex('servico').del();
  await knex('funcionario').del();
  await knex('cliente').del();
  await knex('usuario').del();
  await knex('categoria').del();

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  // Ordem do array (usada em todo o seed): 0=Carlos (admin), 1=Ana (recep),
  // 2=João (barbeiro), 3=Lucas (barbeiro), 4=Rafael (barbeiro),
  // 5..10 = clientes (Maria, Pedro, Fernanda, Roberto, Juliana, Tiago).
  const usuarios = await knex('usuario')
    .insert([
      { email: 'carlos@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'ana@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'joao@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'lucas@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'rafael@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'maria@email.com', senha_hash: hash, tipo: 'cliente' },
      { email: 'pedro@email.com', senha_hash: hash, tipo: 'cliente' },
      { email: 'fernanda@email.com', senha_hash: hash, tipo: 'cliente' },
      { email: 'roberto@email.com', senha_hash: hash, tipo: 'cliente' },
      { email: 'juliana@email.com', senha_hash: hash, tipo: 'cliente' },
      { email: 'tiago@email.com', senha_hash: hash, tipo: 'cliente' },
    ])
    .returning('id');

  const funcionarios = await knex('funcionario')
    .insert([
      {
        usuario_id: usuarios[0].id,
        nome: 'Carlos Silva',
        telefone: '(11) 99999-1111',
        cargo: 'administrador',
        especialidade: 'Gestão',
        ativo: true,
      },
      {
        usuario_id: usuarios[1].id,
        nome: 'Ana Souza',
        telefone: '(11) 99999-2222',
        cargo: 'recepcionista',
        ativo: true,
      },
      {
        usuario_id: usuarios[2].id,
        nome: 'João Pedro',
        telefone: '(11) 99999-3333',
        cargo: 'barbeiro',
        especialidade: 'Degradê',
        ativo: true,
      },
      {
        usuario_id: usuarios[3].id,
        nome: 'Lucas Mendes',
        telefone: '(11) 99999-4444',
        cargo: 'barbeiro',
        especialidade: 'Barba',
        ativo: true,
      },
      {
        usuario_id: usuarios[4].id,
        nome: 'Rafael Almeida',
        telefone: '(11) 99999-7777',
        cargo: 'barbeiro',
        especialidade: 'Cabelo e Barba',
        ativo: true,
      },
    ])
    .returning('id');

  // Barbeiros: índices 2 (João Pedro), 3 (Lucas Mendes) e 4 (Rafael Almeida)
  // no array inserido acima.
  const barbeiroIds = [funcionarios[2].id, funcionarios[3].id, funcionarios[4].id];
  // João Pedro atende cabelos; Lucas Mendes atende barba; Rafael Almeida
  // atende cabelo E barba.
  const barbeiroCategoria = {
    [funcionarios[2].id]: ['Cabelo'],
    [funcionarios[3].id]: ['Barba'],
    [funcionarios[4].id]: ['Cabelo', 'Barba'],
  };

  // Horário padrão de trabalho dos barbeiros: segunda (1) a sábado (6),
  // 09:00–19:00. Sem estes registros o wizard de agendamento não encontra slots
  // e o ambiente fica completamente não-agendável.
  const HORARIO_PADRAO_INICIO = '09:00:00';
  const HORARIO_PADRAO_FIM = '19:00:00';
  const DIAS_UTEIS = [1, 2, 3, 4, 5, 6]; // seg a sáb

  // Total: 3 barbeiros × 6 dias = 18 registros. O onConflict mantém o insert
  // idempotente com a mesma semântica de inserirHorariosPadrao do
  // horario-repository: pares (funcionario_id, dia_semana) já existentes são
  // ignorados, sem violar a unique horario_trabalho_funcionario_id_dia_semana_unique.
  const horariosTrabalho = barbeiroIds.flatMap((funcionarioId) =>
    DIAS_UTEIS.map((dia_semana) => ({
      funcionario_id: funcionarioId,
      dia_semana,
      hora_inicio: HORARIO_PADRAO_INICIO,
      hora_fim: HORARIO_PADRAO_FIM,
      ativo: true,
    })),
  );

  await knex('horario_trabalho').insert(horariosTrabalho)
    .onConflict(['funcionario_id', 'dia_semana'])
    .ignore();

  // ── Fidelidade ao backfill RBAC (migration 20260909000001) ──────────────
  // O reset acima apaga todos os usuários e, com eles, as linhas de
  // `permissao_usuario` (FK CASCADE). A matriz default do permissao-service já
  // garante as 6 permissões ao admin mesmo sem override no banco, mas por
  // fidelidade ao estado pós-migration recriamos a concessão das 5
  // permissões-padrão do catálogo para o administrador Carlos Silva.
  const PERMISSOES_ADMIN = [
    'ver_financeiro',
    'excluir_desativar_funcionario',
    'criar_admin',
    'gerenciar_permissoes',
    'editar_servicos_categorias',
  ] as const;

  await knex('permissao_usuario').insert(
    PERMISSOES_ADMIN.map((permissao) => ({
      usuario_id: usuarios[0].id,
      permissao,
      concedida: true,
    })),
  );

  // Clientes: Maria (usuarios[5]), Pedro (usuarios[6]), Fernanda (usuarios[7]),
  // Roberto (usuarios[8]), Juliana (usuarios[9]) e Tiago (usuarios[10]).
  const clientes = await knex('cliente')
    .insert([
      {
        usuario_id: usuarios[5].id,
        nome: 'Maria Oliveira',
        telefone: '(11) 99999-5555',
      },
      {
        usuario_id: usuarios[6].id,
        nome: 'Pedro Santos',
        telefone: '(11) 99999-6666',
      },
      {
        usuario_id: usuarios[7].id,
        nome: 'Fernanda Lima',
        telefone: '(11) 99999-8888',
      },
      {
        usuario_id: usuarios[8].id,
        nome: 'Roberto Nunes',
        telefone: '(11) 99999-9999',
      },
      {
        usuario_id: usuarios[9].id,
        nome: 'Juliana Castro',
        telefone: '(11) 98888-1111',
      },
      {
        usuario_id: usuarios[10].id,
        nome: 'Tiago Rocha',
        telefone: '(11) 98888-2222',
      },
    ])
    .returning('id');

  await knex('servico').insert([
    {
      nome: 'Corte',
      descricao: 'Corte de cabelo masculino',
      duracao_minutos: 30,
      preco: 45.0,
      ativo: true,
    },
    {
      nome: 'Barba',
      descricao: 'Barba feita com navalha e toalha quente',
      duracao_minutos: 20,
      preco: 35.0,
      ativo: true,
    },
    {
      nome: 'Corte + Barba',
      descricao: 'Combo de corte de cabelo e barba',
      duracao_minutos: 45,
      preco: 70.0,
      ativo: true,
    },
  ]).returning('id');

  const categorias = await knex('categoria')
    .insert([
      { nome: 'Cabelo', ativo: true },
      { nome: 'Barba', ativo: true },
    ])
    .returning('id');

  // Serviços: Corte -> Cabelo, Barba -> Barba, Corte + Barba -> Cabelo + Barba
  // Serviços inseridos nas linhas acima, na ordem: Corte, Barba, Corte + Barba.
  const servicos = await knex('servico').whereIn('nome', ['Corte', 'Barba', 'Corte + Barba']).select('id', 'nome');
  const categoriaCabelo = categorias[0].id;
  const categoriaBarba = categorias[1].id;
  const mapaServicos: Record<string, string> = {};
  for (const s of servicos) {
    mapaServicos[s.nome] = s.id;
  }

  const servicoCategorias = [
    { servico_id: mapaServicos['Corte'], categoria_id: categoriaCabelo },
    { servico_id: mapaServicos['Barba'], categoria_id: categoriaBarba },
    { servico_id: mapaServicos['Corte + Barba'], categoria_id: categoriaCabelo },
    { servico_id: mapaServicos['Corte + Barba'], categoria_id: categoriaBarba },
  ];

  await knex('servico_categoria').insert(servicoCategorias);

  const mapaCategorias: Record<string, string> = { Cabelo: categoriaCabelo, Barba: categoriaBarba };

  const funcionarioCategorias: Array<{ funcionario_id: string; categoria_id: string }> = [];
  for (const funcionarioId of barbeiroIds) {
    for (const nomeCategoria of barbeiroCategoria[funcionarioId]) {
      funcionarioCategorias.push({
        funcionario_id: funcionarioId,
        categoria_id: mapaCategorias[nomeCategoria],
      });
    }
  }

  await knex('funcionario_categoria').insert(funcionarioCategorias);

  // ── Regras de Comissão (spec 3.4/3.5) ────────────────────────────────────
  // Interruptor global ATIVO: concluir um agendamento via API gera a despesa
  // automática de comissão (quando há %) ou uma pendência (quando não há %).
  await knex('configuracao_comissao').insert({
    id: 'global',
    comissao_ativa: true,
  });

  // Percentuais por serviço por profissional (UNIQUE funcionario+servico).
  // Rafael NÃO tem percentual para 'Barba' (concluir Barba → comissao_pendencia,
  // padrão atual de Lucas com 'Corte'); João não tem para 'Barba'.
  await knex('comissao_servico').insert([
    {
      funcionario_id: funcionarios[2].id,
      servico_id: mapaServicos['Corte'],
      percentual: 30.0,
    },
    {
      funcionario_id: funcionarios[2].id,
      servico_id: mapaServicos['Corte + Barba'],
      percentual: 25.0,
    },
    {
      funcionario_id: funcionarios[3].id,
      servico_id: mapaServicos['Barba'],
      percentual: 20.0,
    },
    {
      funcionario_id: funcionarios[3].id,
      servico_id: mapaServicos['Corte + Barba'],
      percentual: 25.0,
    },
    {
      funcionario_id: funcionarios[4].id,
      servico_id: mapaServicos['Corte'],
      percentual: 25.0,
    },
    {
      funcionario_id: funcionarios[4].id,
      servico_id: mapaServicos['Corte + Barba'],
      percentual: 22.0,
    },
  ]);

  // ── Agendamentos de demonstração (datas relativas a hoje) ────────────────
  // Garantias de cobertura da massa:
  //  - concluídos no MÊS CORRENTE em TODOS os dias úteis (seg–sáb) já
  //    ocorridos, 3 slots por barbeiro por dia → atendimentosMes,
  //    atendimentosPorDia (últimos 7 dias), comissaoMes, servicosMaisFeitos e
  //    horariosMaisConcorridos do Painel do Barbeiro e do Resumo Financeiro;
  //  - concluídos no MÊS ANTERIOR (comparativo de comissão e Resumo);
  //  - pendências de comissão ABERTAS: Lucas sem % para 'Corte' e Rafael sem %
  //    para 'Barba' (mecanismo idêntico ao hook real — conclusão sem %
  //    cadastrado gera comissao_pendencia);
  //  - confirmados e pendentes em dias úteis futuros próximos (horários dentro
  //    dos slots do horario_trabalho); cancelados no passado recente.
  // Sem colisão de (funcionario, data, hora) — o índice único parcial da
  // migration 20260902000004 cobre horário exato (status <> cancelado); a
  // geração abaixo também mantém slots disjuntos para os cancelados.
  type StatusAgendamento = 'pendente' | 'confirmado' | 'cancelado' | 'concluido';
  type ServicoNome = 'Corte' | 'Barba' | 'Corte + Barba';

  // [data, hora, cliente(0..5), funcionario(2=João,3=Lucas,4=Rafael), servico, status]
  type LinhaAgendamento = [
    string,
    string,
    0 | 1 | 2 | 3 | 4 | 5,
    2 | 3 | 4,
    ServicoNome,
    StatusAgendamento,
  ];

  const hoje = new Date();
  const hojeDia = hoje.getDate();

  const AGENDAMENTOS: LinhaAgendamento[] = [];

  const BARBEIROS = [2, 3, 4] as const;
  const SLOTS_POR_BARBEIRO_DIA = 3;
  const HORAS_DIA = [
    '09:00', '09:30', '10:00', '10:30', '11:00',
    '14:00', '15:00', '16:00', '17:00', '18:00',
  ] as const;

  function ehDiaUtil(d: Date): boolean {
    // Domingo (0) não tem horario_trabalho (seg–sáb 09:00–19:00).
    return d.getDay() !== 0;
  }

  function clienteDe(indice: number): 0 | 1 | 2 | 3 | 4 | 5 {
    return (indice % 6) as 0 | 1 | 2 | 3 | 4 | 5;
  }

  // Serviço de cada barbeiro, variando com o dia (i) e o slot (s):
  //  - João: 1 em cada 3 atendimentos é combo, o resto Corte;
  //  - Lucas: Corte apenas quando (i + 2s) ≡ 3 (mod 7) → pendência; senão
  //    alterna combo e Barba;
  //  - Rafael: Barba apenas quando (i + s) ≡ 2 (mod 5) → pendência; senão
  //    alterna combo e Corte.
  function servicoConcluido(barbeiro: 2 | 3 | 4, i: number, s: number): ServicoNome {
    const k = i + s;
    if (barbeiro === 2) return k % 3 === 0 ? 'Corte + Barba' : 'Corte';
    if (barbeiro === 3) {
      if ((i + s * 2) % 7 === 3) return 'Corte';
      return k % 3 === 1 ? 'Corte + Barba' : 'Barba';
    }
    if (k % 5 === 2) return 'Barba';
    return k % 3 === 0 ? 'Corte + Barba' : 'Corte';
  }

  // ── Concluídos no mês ANTERIOR (histórico para comparativos) ────────────
  // 1 atendimento por barbeiro em 10 dias do mês anterior: mantém o histórico
  // do Resumo (evolução mensal e comparativo de comissão) sem inflar a massa.
  const diasMesAnterior = [3, 5, 8, 10, 12, 15, 17, 19, 22, 24];
  diasMesAnterior.forEach((dia, i) => {
    const data = diaMesAnterior(hoje, dia);
    BARBEIROS.forEach((barbeiro, j) => {
      const hora = HORAS_DIA[(i + j * 3) % HORAS_DIA.length];
      AGENDAMENTOS.push([data, hora, clienteDe(i + j), barbeiro, servicoConcluido(barbeiro, i, 0), 'concluido']);
    });
  });

  // ── Concluídos no MÊS CORRENTE (incl. últimos 7 dias) ───────────────────
  // Todos os dias úteis (seg–sáb) de 1 até hoje, com 3 slots por barbeiro:
  // alimenta TODO o mês do Painel do Barbeiro, o Resumo do mês atual e o
  // faturamento (concluídos) — base do lucro líquido positivo exigido.
  const diasMesAtual: Array<{ dia: number; indice: number }> = [];
  {
    let indice = 0;
    for (let dia = 1; dia <= hojeDia; dia++) {
      if (!ehDiaUtil(new Date(hoje.getFullYear(), hoje.getMonth(), dia))) continue;
      diasMesAtual.push({ dia, indice });
      indice++;
    }
  }

  diasMesAtual.forEach(({ dia, indice: i }) => {
    const data = diaDoMes(hoje, dia);
    BARBEIROS.forEach((barbeiro, j) => {
      for (let s = 0; s < SLOTS_POR_BARBEIRO_DIA; s++) {
        const hora = HORAS_DIA[(i * SLOTS_POR_BARBEIRO_DIA + j * SLOTS_POR_BARBEIRO_DIA + s) % HORAS_DIA.length];
        AGENDAMENTOS.push([data, hora, clienteDe(i + j + s), barbeiro, servicoConcluido(barbeiro, i, s), 'concluido']);
      }
    });
  });

  // ── Confirmados e pendentes (próximos dias úteis) ───────────────────────
  // Dias úteis futuros, com horários dentro dos slots 09:00–18:00 do
  // horario_trabalho. Confirmados nas manhãs/início da tarde; pendentes na
  // parte da tarde — grupos com horários disjuntos (sem colisão no índice).
  function proximosDiasUteis(quantidade: number): string[] {
    const datas: string[] = [];
    const d = new Date(hoje);
    while (datas.length < quantidade) {
      d.setDate(d.getDate() + 1);
      if (ehDiaUtil(d)) datas.push(dataISO(d));
    }
    return datas;
  }
  const diasFuturos = proximosDiasUteis(5);

  AGENDAMENTOS.push(
    [diasFuturos[0], '09:00', 2, 2, 'Corte', 'confirmado'],
    [diasFuturos[0], '09:30', 3, 3, 'Barba', 'confirmado'],
    [diasFuturos[0], '10:00', 4, 4, 'Corte + Barba', 'confirmado'],
    [diasFuturos[1], '09:30', 0, 2, 'Corte + Barba', 'confirmado'],
    [diasFuturos[1], '10:00', 5, 3, 'Barba', 'confirmado'],
    [diasFuturos[1], '10:30', 1, 4, 'Corte', 'confirmado'],
    [diasFuturos[2], '10:00', 4, 2, 'Corte', 'confirmado'],
    [diasFuturos[2], '10:30', 2, 3, 'Corte + Barba', 'confirmado'],
    [diasFuturos[3], '11:00', 5, 4, 'Barba', 'confirmado'],
    [diasFuturos[4], '11:00', 1, 2, 'Corte + Barba', 'confirmado'],
  );

  AGENDAMENTOS.push(
    [diasFuturos[0], '15:00', 0, 2, 'Corte', 'pendente'],
    [diasFuturos[0], '16:00', 3, 3, 'Barba', 'pendente'],
    [diasFuturos[1], '15:00', 5, 4, 'Corte', 'pendente'],
    [diasFuturos[1], '16:00', 1, 2, 'Corte + Barba', 'pendente'],
    [diasFuturos[2], '15:00', 2, 3, 'Corte + Barba', 'pendente'],
    [diasFuturos[2], '16:00', 4, 4, 'Barba', 'pendente'],
    [diasFuturos[3], '17:00', 3, 2, 'Corte', 'pendente'],
    [diasFuturos[3], '18:00', 0, 3, 'Barba', 'pendente'],
  );

  // ── Cancelados (passado recente) ────────────────────────────────────────
  // 5 dias úteis passados × 3 barbeiros = 15 cancelados; horários 12:00–13:00
  // (fora dos slots de concluídos) para nunca colidir com linhas ativas.
  const diasCancelados: string[] = [];
  for (let offset = -1; diasCancelados.length < 5 && offset >= -6; offset--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + offset);
    if (ehDiaUtil(d)) diasCancelados.push(dataISO(d));
  }

  const servicosCancelados: Array<[ServicoNome, ServicoNome, ServicoNome]> = [
    ['Corte', 'Barba', 'Corte + Barba'],
    ['Corte + Barba', 'Barba', 'Corte'],
    ['Corte', 'Corte + Barba', 'Barba'],
    ['Barba', 'Corte', 'Corte + Barba'],
    ['Corte + Barba', 'Barba', 'Corte'],
  ];

  diasCancelados.forEach((data, i) => {
    AGENDAMENTOS.push([data, '12:00', clienteDe(i), 2, servicosCancelados[i][0], 'cancelado']);
    AGENDAMENTOS.push([data, '12:30', clienteDe(i + 2), 3, servicosCancelados[i][1], 'cancelado']);
    AGENDAMENTOS.push([data, '13:00', clienteDe(i + 4), 4, servicosCancelados[i][2], 'cancelado']);
  });

  const idsAgendamentos = await knex('agendamento')
    .insert(
      AGENDAMENTOS.map(([data, hora, cliente, funcionario, servico, status]) => ({
        cliente_id: clientes[cliente].id,
        funcionario_id: funcionarios[funcionario].id,
        servico_id: mapaServicos[servico],
        data,
        hora: `${hora}:00`,
        status,
        observacao: null,
      })),
    )
    .returning('id');

  const agendamentosComId = AGENDAMENTOS.map(
    ([data, , , funcionario, servico, status], i) => ({
      id: idsAgendamentos[i].id,
      data,
      funcionario,
      servico,
      status,
    }),
  );

  // ── Pagamentos de demonstração (tabela `pagamento`) ─────────────────────
  // Uma linha por agendamento com pagamento (regra simples; o modelo permite
  // histórico, mas o seed não precisa dele). Respeita TODAS as constraints:
  //  - chk_pagamento_forma_coerencia (bicondicional): presencial jamais tem
  //    order id; mercadopago sempre tem;
  //  - uq_pagamento_mercadopago_order_id: ORD-SEED-* sequenciais (únicos);
  //  - uq_pagamento_agendamento_pendente / uq_pagamento_agendamento_aprovado:
  //    no máximo UMA linha por agendamento → nunca há dois pendentes nem dois
  //    aprovados para o mesmo agendamento;
  //  - chk_pagamento_valor_centavos: snapshot do preço do serviço em centavos.
  // Distribuição:
  //  - concluídos: maioria aprovado MP (order+payment fakes), alguns aprovado
  //    PRESENCIAL (registrados pela Ana no balcão — usuarios[1]) e os 2
  //    últimos sem pagamento (atendido sem registro de pagamento — zero linha);
  //  - cancelados: 9 aprovado MP (cancelado pago — cenário do faturamento),
  //    4 cancelado MP (desistência/estorno inexistente) e 2 pendente MP
  //    (checkout abandonado);
  //  - confirmados: 8 pendente MP (checkout aberto) e 2 aprovado MP
  //    (pagou antecipado);
  //  - pendentes: 8 pendente MP (checkout aberto).
  const PRECOS_CENTAVOS: Record<ServicoNome, number> = {
    Corte: 4500,
    Barba: 3500,
    'Corte + Barba': 7000,
  };

  const pagamentos: Array<{
    agendamento_id: string;
    mercadopago_order_id: string | null;
    mercadopago_payment_id: string | null;
    valor_centavos: number;
    status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado' | 'expirado';
    forma_pagamento: 'mercadopago' | 'presencial';
    registrado_por_usuario_id: string | null;
  }> = [];

  let ordemSeq = 0;
  let pagamentoSeq = 0;
  const proximaOrdem = (): string => `ORD-SEED-${String(++ordemSeq).padStart(4, '0')}`;
  const proximoPagamento = (): string => `PAY-SEED-${String(++pagamentoSeq).padStart(4, '0')}`;

  function pagamentoMercadoPago(
    agendamentoId: string,
    servico: ServicoNome,
    status: 'pendente' | 'aprovado' | 'cancelado',
  ): void {
    pagamentos.push({
      agendamento_id: agendamentoId,
      mercadopago_order_id: proximaOrdem(),
      mercadopago_payment_id: status === 'aprovado' ? proximoPagamento() : null,
      valor_centavos: PRECOS_CENTAVOS[servico],
      status,
      forma_pagamento: 'mercadopago',
      registrado_por_usuario_id: null,
    });
  }

  const concluidosOrdenados = agendamentosComId.filter((a) => a.status === 'concluido');
  concluidosOrdenados.forEach((a, i) => {
    // 1–2 concluídos no fim ficam SEM pagamento (atendido sem registro de
    // pagamento — permitido pelo modelo: zero linha).
    if (i >= concluidosOrdenados.length - 2) return;
    if (i % 7 === 3) {
      // Aprovado presencial registrado pela recepcionista Ana no balcão.
      pagamentos.push({
        agendamento_id: a.id,
        mercadopago_order_id: null,
        mercadopago_payment_id: null,
        valor_centavos: PRECOS_CENTAVOS[a.servico],
        status: 'aprovado',
        forma_pagamento: 'presencial',
        registrado_por_usuario_id: usuarios[1].id,
      });
    } else {
      pagamentoMercadoPago(a.id, a.servico, 'aprovado');
    }
  });

  const canceladosOrdenados = agendamentosComId.filter((a) => a.status === 'cancelado');
  canceladosOrdenados.forEach((a, i) => {
    if (i < 9) {
      pagamentoMercadoPago(a.id, a.servico, 'aprovado'); // cancelado pago (antecipado no MP)
    } else if (i < 13) {
      pagamentoMercadoPago(a.id, a.servico, 'cancelado'); // desistência/estorno inexistente
    } else {
      pagamentoMercadoPago(a.id, a.servico, 'pendente'); // checkout abandonado
    }
  });

  const confirmadosOrdenados = agendamentosComId.filter((a) => a.status === 'confirmado');
  confirmadosOrdenados.forEach((a, i) => {
    if (i < 2) {
      pagamentoMercadoPago(a.id, a.servico, 'aprovado'); // pagou antecipado
    } else {
      pagamentoMercadoPago(a.id, a.servico, 'pendente'); // checkout aberto
    }
  });

  const pendentesOrdenados = agendamentosComId.filter((a) => a.status === 'pendente');
  for (const a of pendentesOrdenados) {
    pagamentoMercadoPago(a.id, a.servico, 'pendente');
  }

  await knex('pagamento').insert(pagamentos);

  // ── Despesas manuais de demonstração (fixa / variavel / outro) ───────────
  // Distribuídas entre o mês corrente e o anterior, sempre em datas relativas
  // (passadas), para os totais e os comparativos do Resumo Financeiro.
  await knex('despesa').insert([
    {
      descricao: 'ALUGUEL DO SALAO',
      tipo_despesa: 'fixa',
      valor: 1500.0,
      data: diaDoMes(hoje, 1),
      recorrente: true,
    },
    {
      descricao: 'ALUGUEL DO SALAO',
      tipo_despesa: 'fixa',
      valor: 1500.0,
      data: diaMesAnterior(hoje, 1),
      recorrente: true,
    },
    {
      descricao: 'ENERGIA ELETRICA',
      tipo_despesa: 'fixa',
      valor: 280.0,
      data: dataOffset(hoje, -1),
      recorrente: false,
    },
    {
      descricao: 'PRODUTOS DE INSUMOS (SHAMPOO, BALM)',
      tipo_despesa: 'variavel',
      valor: 126.5,
      data: dataOffset(hoje, -3),
      recorrente: false,
    },
    {
      descricao: 'MATERIAL DESCARTÁVEL (LUVAS, TOALHAS)',
      tipo_despesa: 'variavel',
      valor: 89.9,
      data: dataOffset(hoje, -5),
      recorrente: false,
    },
    {
      descricao: 'ÁGUA E ESGOTO',
      tipo_despesa: 'fixa',
      valor: 95.0,
      data: dataOffset(hoje, -2),
      recorrente: false,
    },
    {
      descricao: 'IMPULSIONAMENTO INSTAGRAM',
      tipo_despesa: 'outro',
      valor: 250.0,
      data: dataOffset(hoje, -7),
      recorrente: false,
    },
    {
      descricao: 'MANUTENÇÃO DE EQUIPAMENTOS',
      tipo_despesa: 'outro',
      valor: 120.0,
      data: diaMesAnterior(hoje, 18),
      recorrente: false,
    },
    {
      descricao: 'LIMPEZA DO SALAO',
      tipo_despesa: 'fixa',
      valor: 180.0,
      data: diaMesAnterior(hoje, 20),
      recorrente: false,
    },
    {
      descricao: 'CAFÉ E RECEPÇÃO',
      tipo_despesa: 'variavel',
      valor: 45.3,
      data: diaMesAnterior(hoje, 22),
      recorrente: false,
    },
    {
      descricao: 'ASSINATURA SISTEMA DE AGENDA',
      tipo_despesa: 'outro',
      valor: 39.9,
      data: diaMesAnterior(hoje, 25),
      recorrente: true,
    },
  ]);

  // ── Despesas automáticas de comissão e pendências (replicam o hook) ──────
  // O hook real (comissao-service.aplicarComissaoNaConclusao) roda na
  // transação da conclusão; no seed replicamos o MESMO cálculo (BigInt):
  // valor = preço_centavos × percentual_base / 10000, arredondando à unidade.
  const PRECOS_SERVICO: Record<ServicoNome, number> = {
    Corte: 45.0,
    Barba: 35.0,
    'Corte + Barba': 70.0,
  };
  const PERCENTUAIS_COMISSAO: Record<ServicoNome, Partial<Record<2 | 3 | 4, number>>> = {
    Corte: { 2: 30, 3: undefined, 4: 25 }, // Lucas SEM % para Corte → pendência
    Barba: { 3: 20, 4: undefined }, // Rafael SEM % para Barba → pendência
    'Corte + Barba': { 2: 25, 3: 25, 4: 22 },
  };
  const NOME_FUNCIONARIO: Record<2 | 3 | 4, string> = {
    2: 'João Pedro',
    3: 'Lucas Mendes',
    4: 'Rafael Almeida',
  };

  function valorComissao(preco: number, percentual: number): number {
    const precoCents = BigInt(Math.round(preco * 100));
    const percentualBase = BigInt(Math.round(percentual * 100));
    const valorCents = (precoCents * percentualBase + 5000n) / 10000n;
    return Number(valorCents) / 100;
  }

  const despesasComissao: Array<{
    descricao: string;
    tipo_despesa: 'comissao';
    valor: number;
    data: string;
    recorrente: boolean;
    funcionario_id: string;
    agendamento_id: string;
  }> = [];
  const pendenciasComissao: Array<{
    agendamento_id: string;
    funcionario_id: string;
    servico_id: string;
    data: string;
    resolvido: boolean;
  }> = [];

  for (const a of agendamentosComId) {
    if (a.status !== 'concluido') continue;
    const percentual = PERCENTUAIS_COMISSAO[a.servico]?.[a.funcionario];
    if (percentual === undefined) {
      pendenciasComissao.push({
        agendamento_id: a.id,
        funcionario_id: funcionarios[a.funcionario].id,
        servico_id: mapaServicos[a.servico],
        data: a.data,
        resolvido: false,
      });
    } else {
      despesasComissao.push({
        descricao: `Comissão ${NOME_FUNCIONARIO[a.funcionario]}`,
        tipo_despesa: 'comissao',
        valor: valorComissao(PRECOS_SERVICO[a.servico], percentual),
        data: a.data,
        recorrente: false,
        funcionario_id: funcionarios[a.funcionario].id,
        agendamento_id: a.id,
      });
    }
  }

  if (despesasComissao.length > 0) {
    await knex('despesa').insert(despesasComissao);
  }
  if (pendenciasComissao.length > 0) {
    await knex('comissao_pendencia').insert(pendenciasComissao);
  }
}