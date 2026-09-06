import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'senha123';

export async function seed(knex: Knex): Promise<void> {
  await knex('agendamento').del();
  await knex('horario_excecao').del();
  await knex('horario_trabalho').del();
  await knex('servico').del();
  await knex('funcionario').del();
  await knex('cliente').del();
  await knex('usuario').del();

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

  // Horário padrão: segunda (1) a sábado (6), 09:00–19:00
  const HORARIO_PADRAO_INICIO = '09:00:00';
  const HORARIO_PADRAO_FIM = '19:00:00';
  const DIAS_UTEIS = [1, 2, 3, 4, 5, 6]; // seg a sáb

  const horariosTrabalho = barbeiroIds.flatMap((funcionarioId) =>
    DIAS_UTEIS.map((dia_semana) => ({
      funcionario_id: funcionarioId,
      dia_semana,
      hora_inicio: HORARIO_PADRAO_INICIO,
      hora_fim: HORARIO_PADRAO_FIM,
      ativo: true,
    })),
  );

  await knex('horario_trabalho').insert(horariosTrabalho);

  await knex('cliente').insert([
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
  ]);

  await knex('servico').insert([
    {
      nome: 'Corte',
      descricao: 'Corte de cabelo masculino',
      duracao_minutos: 30,
      preco: 45.00,
      ativo: true,
    },
    {
      nome: 'Barba',
      descricao: 'Barba feita com navalha e toalha quente',
      duracao_minutos: 20,
      preco: 35.00,
      ativo: true,
    },
    {
      nome: 'Corte + Barba',
      descricao: 'Combo de corte de cabelo e barba',
      duracao_minutos: 45,
      preco: 70.00,
      ativo: true,
    },
  ]);
}
