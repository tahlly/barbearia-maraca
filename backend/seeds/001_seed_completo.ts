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
  await knex('comissao_pendencia').del();
  await knex('despesa').del();
  await knex('funcionario_categoria').del();
  await knex('servico_categoria').del();
  await knex('categoria').del();
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

  const usuarios = await knex('usuario')
    .insert([
      { email: 'carlos@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'ana@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'joao@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'lucas@barbeariamaraca.com.br', senha_hash: hash, tipo: 'funcionario' },
      { email: 'maria@email.com', senha_hash: hash, tipo: 'cliente' },
      { email: 'pedro@email.com', senha_hash: hash, tipo: 'cliente' },
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
    ])
    .returning('id');

  // Barbeiros: índices 2 (João Pedro) e 3 (Lucas Mendes) no array inserido
  const barbeiroIds = [funcionarios[2].id, funcionarios[3].id];
  // João Pedro atende cabelos, Lucas Mendes atende barba
  const barbeiroCategoria = {
    [funcionarios[2].id]: ['Cabelo'],
    [funcionarios[3].id]: ['Barba'],
  };

  // Horário padrão de trabalho dos barbeiros: segunda (1) a sábado (6),
  // 09:00–19:00. Sem estes registros o wizard de agendamento não encontra slots
  // e o ambiente fica completamente não-agendável.
  const HORARIO_PADRAO_INICIO = '09:00:00';
  const HORARIO_PADRAO_FIM = '19:00:00';
  const DIAS_UTEIS = [1, 2, 3, 4, 5, 6]; // seg a sáb

  // Total: 2 barbeiros × 6 dias = 12 registros. O onConflict mantém o insert
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

  // Maria (usuarios[4]) e Pedro (usuarios[5]) — ordem dos clientes.
  const clientes = await knex('cliente')
    .insert([
      {
        usuario_id: usuarios[4].id,
        nome: 'Maria Oliveira',
        telefone: '(11) 99999-5555',
      },
      {
        usuario_id: usuarios[5].id,
        nome: 'Pedro Santos',
        telefone: '(11) 99999-6666',
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
  ]);

  // ── Agendamentos de demonstração (datas relativas a hoje) ────────────────
  // Garantias de cobertura:
  //  - concluídos no MÊS CORRENTE (para atendimentosMes, comissaoMes,
  //    servicosMaisFeitos e horariosMaisConcorridos do Painel do Barbeiro e do
  //    Resumo Financeiro do mês atual);
  //  - concluídos nos ÚLTIMOS 7 DIAS (atendimentosPorDia do Painel);
  //  - concluídos no MÊS ANTERIOR (comparativo de comissão e Resumo);
  //  - 2 pendências de comissão ABERTAS: Lucas Mendes sem % para 'Corte'
  //    uma no mês anterior e uma no mês corrente (data de amanhã-1);
  //  - confirmados e pendentes em dias futuros próximos; cancelados no passado.
  // Sem colisão de (funcionario, data, hora) — o índice único parcial da
  // migration 20260902000004 cobre horário exato (status <> cancelado).
  type StatusAgendamento = 'pendente' | 'confirmado' | 'cancelado' | 'concluido';
  type ServicoNome = 'Corte' | 'Barba' | 'Corte + Barba';

  // [data, hora, cliente(0=Maria,1=Pedro), funcionario(2=João,3=Lucas), servico, status]
  type LinhaAgendamento = [
    string,
    string,
    0 | 1,
    2 | 3,
    ServicoNome,
    StatusAgendamento,
  ];

  const hoje = new Date();
  const hojeDia = hoje.getDate();

  const AGENDAMENTOS: LinhaAgendamento[] = [];

  // ── Concluídos no mês ANTERIOR (histórico para comparativos) ────────────
  // João alterna Corte (30%) / Corte + Barba (25%); Lucas faz Barba (20%) /
  // Corte + Barba (25%); no dia 24 Lucas faz Corte (SEM %) → pendência 1.
  const diasMesAnterior = [3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 28];
  diasMesAnterior.forEach((dia, i) => {
    const data = diaMesAnterior(hoje, dia);
    const servicoJoao: ServicoNome = i % 2 === 0 ? 'Corte' : 'Corte + Barba';
    const servicoLucas: ServicoNome = dia === 24 ? 'Corte' : 'Barba';
    AGENDAMENTOS.push([data, '09:00', 0, 2, servicoJoao, 'concluido']);
    AGENDAMENTOS.push([data, '09:30', 1, 3, servicoLucas, 'concluido']);
  });

  // ── Concluídos no MÊS CORRENTE (incl. últimos 7 dias) ───────────────────
  // Distribui nos dias 1,3,6,10,15 e nos 4 dias que terminam hoje (hoje e os
  // três anteriores), sempre respeitando o dia atual. Assim o Painel do
  // Barbeiro sempre encontra atendimentos no mês corrente e nos últimos 7 dias.
  const candidatosMesAtual = [
    1,
    3,
    6,
    10,
    15,
    hojeDia - 3,
    hojeDia - 2,
    hojeDia - 1,
    hojeDia,
  ].filter((dia) => dia >= 1 && dia <= hojeDia);
  const diasMesAtual = [...new Set(candidatosMesAtual)].sort((a, b) => a - b);

  const HORAS_DIA: Record<number, string> = {
    0: '09:00',
    1: '09:30',
    2: '10:00',
    3: '10:30',
    4: '11:00',
    5: '14:00',
    6: '15:00',
    7: '16:00',
  };

  diasMesAtual.forEach((dia, i) => {
    const data = diaDoMes(hoje, dia);
    // João: serviços variados no mês (Corte / Corte + Barba) e horários
    // distintos — alimenta servicosMaisFeitos e horariosMaisConcorridos.
    const servicoJoao: ServicoNome = i % 3 === 0 ? 'Corte + Barba' : 'Corte';
    const horaJoao = HORAS_DIA[i % 8] ?? '09:00';
    AGENDAMENTOS.push([data, horaJoao, 0, 2, servicoJoao, 'concluido']);

    // Lucas: Barba, exceto no dia "ontem" (hojeDia - 1), quando faz Corte
    // (SEM %) → pendência 2. Se hoje for dia 1, cai no próprio hoje — a
    // pendência do mês corrente continua garantida.
    const diaPendenciaAtual = hojeDia >= 2 ? hojeDia - 1 : hojeDia;
    const servicoLucas: ServicoNome = dia === diaPendenciaAtual ? 'Corte' : 'Barba';
    const horaLucas = dia === hojeDia ? '10:00' : '09:30';
    AGENDAMENTOS.push([data, horaLucas, 1, 3, servicoLucas, 'concluido']);
  });

  // ── Confirmados (próximos dias úteis) ────────────────────────────────────
  AGENDAMENTOS.push(
    [dataOffset(hoje, 1), '09:00', 1, 2, 'Corte', 'confirmado'],
    [dataOffset(hoje, 1), '09:30', 0, 3, 'Barba', 'confirmado'],
    [dataOffset(hoje, 2), '10:00', 0, 2, 'Corte + Barba', 'confirmado'],
    [dataOffset(hoje, 2), '10:30', 1, 3, 'Barba', 'confirmado'],
    [dataOffset(hoje, 3), '11:00', 1, 2, 'Corte', 'confirmado'],
    [dataOffset(hoje, 3), '11:30', 0, 3, 'Barba', 'confirmado'],
  );

  // ── Pendentes (aguardando confirmação) ──────────────────────────────────
  AGENDAMENTOS.push(
    [dataOffset(hoje, 1), '13:00', 0, 2, 'Corte', 'pendente'],
    [dataOffset(hoje, 1), '13:30', 1, 3, 'Barba', 'pendente'],
    [dataOffset(hoje, 2), '14:00', 1, 2, 'Corte', 'pendente'],
    [dataOffset(hoje, 2), '14:30', 0, 3, 'Barba', 'pendente'],
    [dataOffset(hoje, 3), '15:00', 0, 2, 'Corte + Barba', 'pendente'],
  );

  // ── Cancelados (passado recente) ─────────────────────────────────────────
  AGENDAMENTOS.push(
    [dataOffset(hoje, -1), '15:00', 0, 2, 'Corte', 'cancelado'],
    [dataOffset(hoje, -1), '15:30', 1, 3, 'Barba', 'cancelado'],
    [dataOffset(hoje, -2), '16:00', 1, 2, 'Corte + Barba', 'cancelado'],
    [dataOffset(hoje, -2), '16:30', 0, 3, 'Barba', 'cancelado'],
  );

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
      descricao: 'IMPULSIONAMENTO INSTAGRAM',
      tipo_despesa: 'outro',
      valor: 250.0,
      data: dataOffset(hoje, -7),
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
  const PERCENTUAIS_COMISSAO: Record<ServicoNome, Partial<Record<2 | 3, number>>> = {
    Corte: { 2: 30, 3: undefined }, // Lucas SEM percentual para Corte → pendências abertas
    Barba: { 3: 20 },
    'Corte + Barba': { 2: 25, 3: 25 },
  };
  const NOME_FUNCIONARIO: Record<2 | 3, string> = { 2: 'João Pedro', 3: 'Lucas Mendes' };

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